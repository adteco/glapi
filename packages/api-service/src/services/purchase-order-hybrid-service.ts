/**
 * Purchase Order Hybrid Service
 *
 * Handles purchase order lifecycle using the hybrid transaction model:
 * - Uses transaction_headers + transaction_lines (core tables)
 * - Uses purchase_order_ext + purchase_order_line_ext (extension tables)
 *
 * This service demonstrates the hybrid model pattern and will eventually
 * replace the legacy PurchaseOrderService.
 */

import { BaseTransactionService } from './base-transaction-service';
import {
  ServiceContext,
  ServiceError,
  PaginatedResult,
  PaginationParams,
} from '../types';
import {
  TransactionTypeCode,
  TransactionFilters,
  BaseTransactionHeader,
  BaseTransactionLine,
  TransactionApprovalAction,
  TransactionApprovalActionValue,
} from '../types/transaction.types';
import { db } from '@glapi/database';
import {
  transactionHeaders,
  transactionLines,
  TransactionHeader,
  TransactionLine,
  purchaseOrderExt,
  purchaseOrderLineExt,
  PurchaseOrderExtRecord,
  PurchaseOrderLineExtRecord,
  HybridPurchaseOrderStatus,
  HybridPurchaseOrderStatusValue,
  entities,
} from '@glapi/database/schema';
import { eq, and, desc, asc, sql, inArray, gte, lte, or, ilike } from 'drizzle-orm';
import Decimal from 'decimal.js';

// ============================================================================
// Types
// ============================================================================

export interface PurchaseOrderHeader extends BaseTransactionHeader {
  expectedDeliveryDate?: string;
  shipToLocationId?: string;
  shippingAddress?: string;
  shippingMethod?: string;
  shippingAmount: string;
  paymentTerms?: string;
  receivedAmount: string;
  billedAmount: string;
  currentApproverId?: string;
  approvedAt?: string;
  approvedBy?: string;
  closedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
}

export interface PurchaseOrderLine extends BaseTransactionLine {
  expectedDeliveryDate?: string;
  quantityReceived: string;
  quantityBilled: string;
  isClosed: boolean;
}

export interface PurchaseOrderWithDetails {
  header: PurchaseOrderHeader;
  lines: PurchaseOrderLine[];
  vendor?: { id: string; name: string };
}

export interface CreatePurchaseOrderHybridInput {
  subsidiaryId: string;
  vendorId: string;
  orderDate: string | Date;
  expectedDeliveryDate?: string | Date;
  shipToLocationId?: string;
  shippingAddress?: string;
  shippingMethod?: string;
  paymentTerms?: string;
  currencyCode?: string;
  exchangeRate?: number;
  memo?: string;
  internalNotes?: string;
  lines: CreatePurchaseOrderLineInput[];
}

export interface CreatePurchaseOrderLineInput {
  lineNumber?: number;
  itemId?: string;
  itemName: string;
  itemDescription?: string;
  quantity: number;
  unitOfMeasure?: string;
  unitPrice: number;
  taxAmount?: number;
  expectedDeliveryDate?: string | Date;
  accountId?: string;
  departmentId?: string;
  locationId?: string;
  classId?: string;
  projectId?: string;
  memo?: string;
}

export interface PurchaseOrderHybridFilters extends TransactionFilters {
  vendorId?: string;
  orderDateFrom?: string | Date;
  orderDateTo?: string | Date;
}

// Valid status transitions for purchase orders
const VALID_PO_TRANSITIONS: Record<HybridPurchaseOrderStatusValue, HybridPurchaseOrderStatusValue[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CANCELLED', 'CLOSED'],
  PARTIALLY_RECEIVED: ['FULLY_RECEIVED', 'CANCELLED', 'CLOSED'],
  FULLY_RECEIVED: ['PARTIALLY_BILLED', 'FULLY_BILLED', 'CLOSED'],
  PARTIALLY_BILLED: ['FULLY_BILLED', 'CLOSED'],
  FULLY_BILLED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

// ============================================================================
// Purchase Order Hybrid Service
// ============================================================================

export class PurchaseOrderHybridService extends BaseTransactionService {
  protected transactionType = TransactionTypeCode.PURCHASE_ORDER;
  protected eventCategory = 'PROCUREMENT' as const;

  constructor(context: ServiceContext = {}) {
    super(context);
  }

  // ==========================================================================
  // LIST Operations
  // ==========================================================================

  /**
   * List purchase orders with filters and pagination
   */
  async listPurchaseOrders(
    params: PaginationParams = {},
    filters: PurchaseOrderHybridFilters = {}
  ): Promise<PaginatedResult<PurchaseOrderWithDetails>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(params);

    // Build where conditions for core header
    const conditions = [
      eq(transactionHeaders.organizationId, organizationId),
      eq(transactionHeaders.transactionType, TransactionTypeCode.PURCHASE_ORDER),
    ];

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(transactionHeaders.status, filters.status));
      } else {
        conditions.push(eq(transactionHeaders.status, filters.status));
      }
    }

    if (filters.entityId || filters.vendorId) {
      conditions.push(eq(transactionHeaders.entityId, filters.entityId || filters.vendorId!));
    }

    if (filters.subsidiaryId) {
      conditions.push(eq(transactionHeaders.subsidiaryId, filters.subsidiaryId));
    }

    if (filters.dateFrom || filters.orderDateFrom) {
      const dateFrom = filters.dateFrom || filters.orderDateFrom!;
      const dateStr = typeof dateFrom === 'string'
        ? dateFrom
        : dateFrom.toISOString().split('T')[0];
      conditions.push(gte(transactionHeaders.transactionDate, dateStr));
    }

    if (filters.dateTo || filters.orderDateTo) {
      const dateTo = filters.dateTo || filters.orderDateTo!;
      const dateStr = typeof dateTo === 'string'
        ? dateTo
        : dateTo.toISOString().split('T')[0];
      conditions.push(lte(transactionHeaders.transactionDate, dateStr));
    }

    if (filters.search) {
      conditions.push(
        or(
          ilike(transactionHeaders.transactionNumber, `%${filters.search}%`),
          ilike(transactionHeaders.entityName, `%${filters.search}%`),
          ilike(transactionHeaders.memo, `%${filters.search}%`)
        )!
      );
    }

    // Count total
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactionHeaders)
      .where(and(...conditions));
    const total = Number(countResult[0]?.count || 0);

    // Fetch headers with extension data
    const rows = await db
      .select({
        header: transactionHeaders,
        ext: purchaseOrderExt,
      })
      .from(transactionHeaders)
      .leftJoin(purchaseOrderExt, eq(transactionHeaders.id, purchaseOrderExt.transactionId))
      .where(and(...conditions))
      .orderBy(desc(transactionHeaders.createdAt))
      .limit(take)
      .offset(skip);

    // Enrich with details
    const ordersWithDetails = await Promise.all(
      rows.map(async (row) => this.enrichWithDetails(row.header, row.ext))
    );

    return this.createPaginatedResult(ordersWithDetails, total, page, limit);
  }

  // ==========================================================================
  // GET Operations
  // ==========================================================================

  /**
   * Get a single purchase order by ID
   */
  async getPurchaseOrderById(id: string): Promise<PurchaseOrderWithDetails | null> {
    const organizationId = this.requireOrganizationContext();

    const rows = await db
      .select({
        header: transactionHeaders,
        ext: purchaseOrderExt,
      })
      .from(transactionHeaders)
      .leftJoin(purchaseOrderExt, eq(transactionHeaders.id, purchaseOrderExt.transactionId))
      .where(
        and(
          eq(transactionHeaders.id, id),
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.transactionType, TransactionTypeCode.PURCHASE_ORDER)
        )
      )
      .limit(1);

    if (!rows[0]) {
      return null;
    }

    return this.enrichWithDetails(rows[0].header, rows[0].ext, true);
  }

  // ==========================================================================
  // CREATE Operations
  // ==========================================================================

  /**
   * Create a new purchase order using hybrid model
   */
  async createPurchaseOrder(input: CreatePurchaseOrderHybridInput): Promise<PurchaseOrderWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Validate vendor exists
    const vendor = await db
      .select({ id: entities.id, name: entities.name })
      .from(entities)
      .where(eq(entities.id, input.vendorId))
      .limit(1);

    if (!vendor[0]) {
      throw new ServiceError('Vendor not found', 'NOT_FOUND', 404);
    }

    // Generate PO number
    const poNumber = await this.generateTransactionNumber();

    // Calculate line totals
    const { lines, subtotal, taxTotal, totalAmount } = this.calculateLineTotals(input.lines);

    // Create transaction header (core table)
    const header = await this.createHeader({
      subsidiaryId: input.subsidiaryId,
      transactionType: TransactionTypeCode.PURCHASE_ORDER,
      transactionNumber: poNumber,
      entityId: input.vendorId,
      entityName: vendor[0].name,
      transactionDate: this.toDateString(input.orderDate),
      status: HybridPurchaseOrderStatus.DRAFT,
      subtotal: subtotal.toString(),
      taxAmount: taxTotal.toString(),
      totalAmount: totalAmount.toString(),
      currencyCode: input.currencyCode || 'USD',
      exchangeRate: (input.exchangeRate || 1).toString(),
      memo: input.memo,
      internalNotes: input.internalNotes,
      createdBy: userId,
    });

    // Create purchase order extension (type-specific fields)
    await db.insert(purchaseOrderExt).values({
      transactionId: header.id,
      expectedDeliveryDate: input.expectedDeliveryDate
        ? this.toDateString(input.expectedDeliveryDate)
        : null,
      shipToLocationId: input.shipToLocationId,
      shippingAddress: input.shippingAddress,
      shippingMethod: input.shippingMethod,
      shippingAmount: '0',
      paymentTerms: input.paymentTerms,
      receivedAmount: '0',
      billedAmount: '0',
    });

    // Create transaction lines (core table)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const originalLine = input.lines[i]; // Keep reference to original for PO-specific fields
      const lineNumber = line.lineNumber || i + 1;

      // Create core line
      const [createdLine] = await db
        .insert(transactionLines)
        .values({
          transactionId: header.id,
          lineNumber,
          itemId: line.itemId,
          itemName: line.itemName,
          itemDescription: line.itemDescription,
          quantity: line.quantity.toString(),
          unitOfMeasure: line.unitOfMeasure,
          unitPrice: line.unitPrice.toString(),
          amount: line.amount.toString(),
          taxAmount: (line.taxAmount || 0).toString(),
          accountId: line.accountId,
          departmentId: line.departmentId,
          locationId: line.locationId,
          classId: line.classId,
          projectId: line.projectId,
          memo: line.memo,
        })
        .returning();

      // Create line extension (PO-specific fields)
      await db.insert(purchaseOrderLineExt).values({
        lineId: createdLine.id,
        expectedDeliveryDate: originalLine.expectedDeliveryDate
          ? this.toDateString(originalLine.expectedDeliveryDate)
          : null,
        quantityReceived: '0',
        quantityBilled: '0',
        isClosed: false,
      });
    }

    // Emit event
    await this.emitEvent('PurchaseOrderCreated', header.id, {
      poNumber: header.transactionNumber,
      vendorId: input.vendorId,
      totalAmount: header.totalAmount,
      lineCount: lines.length,
    });

    return (await this.getPurchaseOrderById(header.id))!;
  }

  // ==========================================================================
  // APPROVAL WORKFLOW
  // ==========================================================================

  /**
   * Submit a purchase order for approval
   */
  async submitPurchaseOrder(
    purchaseOrderId: string,
    comments?: string
  ): Promise<PurchaseOrderWithDetails> {
    const userId = this.requireUserContext();

    const po = await this.getPurchaseOrderById(purchaseOrderId);
    if (!po) {
      throw new ServiceError('Purchase order not found', 'NOT_FOUND', 404);
    }

    // Validate transition
    this.validateStatusTransition(
      po.header.status,
      HybridPurchaseOrderStatus.PENDING_APPROVAL,
      VALID_PO_TRANSITIONS
    );

    // Update status
    await this.updateStatus(purchaseOrderId, HybridPurchaseOrderStatus.PENDING_APPROVAL);

    // Record approval history (would go to a separate approval history table)
    // For now, emit an event
    await this.emitEvent('PurchaseOrderSubmitted', purchaseOrderId, {
      poNumber: po.header.transactionNumber,
      totalAmount: po.header.totalAmount,
      submittedBy: userId,
      comments,
    });

    return (await this.getPurchaseOrderById(purchaseOrderId))!;
  }

  /**
   * Approve or reject a purchase order
   */
  async approvePurchaseOrder(
    purchaseOrderId: string,
    action: 'APPROVE' | 'REJECT' | 'RETURN',
    comments?: string
  ): Promise<PurchaseOrderWithDetails> {
    const userId = this.requireUserContext();

    const po = await this.getPurchaseOrderById(purchaseOrderId);
    if (!po) {
      throw new ServiceError('Purchase order not found', 'NOT_FOUND', 404);
    }

    // Only pending POs can be approved/rejected
    if (po.header.status !== HybridPurchaseOrderStatus.PENDING_APPROVAL) {
      throw new ServiceError(
        `Purchase order must be in PENDING_APPROVAL status to ${action.toLowerCase()}`,
        'VALIDATION_ERROR',
        400
      );
    }

    let newStatus: HybridPurchaseOrderStatusValue;

    switch (action) {
      case 'APPROVE':
        newStatus = HybridPurchaseOrderStatus.APPROVED;
        break;
      case 'REJECT':
        newStatus = HybridPurchaseOrderStatus.CANCELLED;
        break;
      case 'RETURN':
        newStatus = HybridPurchaseOrderStatus.DRAFT;
        break;
      default:
        throw new ServiceError(`Invalid action: ${action}`, 'VALIDATION_ERROR', 400);
    }

    // Update status
    await this.updateStatus(purchaseOrderId, newStatus);

    // Update extension with approval info
    if (action === 'APPROVE') {
      await db
        .update(purchaseOrderExt)
        .set({
          approvedAt: new Date(),
          approvedBy: userId,
        })
        .where(eq(purchaseOrderExt.transactionId, purchaseOrderId));
    }

    // Emit event
    await this.emitEvent(`PurchaseOrder${action.charAt(0) + action.slice(1).toLowerCase()}d`, purchaseOrderId, {
      poNumber: po.header.transactionNumber,
      action,
      approvedBy: userId,
      comments,
    });

    return (await this.getPurchaseOrderById(purchaseOrderId))!;
  }

  /**
   * Cancel a purchase order
   */
  async cancelPurchaseOrder(
    purchaseOrderId: string,
    reason: string
  ): Promise<PurchaseOrderWithDetails> {
    const userId = this.requireUserContext();

    const po = await this.getPurchaseOrderById(purchaseOrderId);
    if (!po) {
      throw new ServiceError('Purchase order not found', 'NOT_FOUND', 404);
    }

    // Validate transition
    this.validateStatusTransition(
      po.header.status,
      HybridPurchaseOrderStatus.CANCELLED,
      VALID_PO_TRANSITIONS
    );

    // Update status
    await this.updateStatus(purchaseOrderId, HybridPurchaseOrderStatus.CANCELLED);

    // Update extension
    await db
      .update(purchaseOrderExt)
      .set({
        cancelledAt: new Date(),
        cancellationReason: reason,
      })
      .where(eq(purchaseOrderExt.transactionId, purchaseOrderId));

    // Emit event
    await this.emitEvent('PurchaseOrderCancelled', purchaseOrderId, {
      poNumber: po.header.transactionNumber,
      reason,
      cancelledBy: userId,
    });

    return (await this.getPurchaseOrderById(purchaseOrderId))!;
  }

  // ==========================================================================
  // RECEIPT STATUS UPDATE (called by POReceiptHybridService)
  // ==========================================================================

  /**
   * Update PO received amounts and status after receipt posting
   */
  async updateReceivedAmounts(
    purchaseOrderId: string,
    additionalReceivedAmount: Decimal,
    lineUpdates: Array<{ lineId: string; quantityReceived: Decimal }>
  ): Promise<void> {
    // Update line extensions
    for (const update of lineUpdates) {
      await db.execute(sql`
        UPDATE purchase_order_line_ext
        SET quantity_received = quantity_received + ${update.quantityReceived.toString()}::decimal
        WHERE line_id = ${update.lineId}
      `);
    }

    // Update header extension
    await db.execute(sql`
      UPDATE purchase_order_ext
      SET received_amount = received_amount + ${additionalReceivedAmount.toString()}::decimal
      WHERE transaction_id = ${purchaseOrderId}
    `);

    // Check and update status
    await this.updateReceiptStatus(purchaseOrderId);
  }

  private async updateReceiptStatus(purchaseOrderId: string): Promise<void> {
    // Get current totals
    const header = await db
      .select({ totalAmount: transactionHeaders.totalAmount })
      .from(transactionHeaders)
      .where(eq(transactionHeaders.id, purchaseOrderId))
      .limit(1);

    const ext = await db
      .select({ receivedAmount: purchaseOrderExt.receivedAmount })
      .from(purchaseOrderExt)
      .where(eq(purchaseOrderExt.transactionId, purchaseOrderId))
      .limit(1);

    if (!header[0] || !ext[0]) return;

    const total = new Decimal(header[0].totalAmount || 0);
    const received = new Decimal(ext[0].receivedAmount || 0);

    let newStatus: HybridPurchaseOrderStatusValue | null = null;

    if (received.gte(total)) {
      newStatus = HybridPurchaseOrderStatus.FULLY_RECEIVED;
    } else if (received.gt(0)) {
      newStatus = HybridPurchaseOrderStatus.PARTIALLY_RECEIVED;
    }

    if (newStatus) {
      await this.updateStatus(purchaseOrderId, newStatus);
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Enrich header and extension with full details
   */
  private async enrichWithDetails(
    header: TransactionHeader,
    ext: PurchaseOrderExtRecord | null,
    includeAll = false
  ): Promise<PurchaseOrderWithDetails> {
    // Get vendor
    const vendor = await db
      .select({ id: entities.id, name: entities.name })
      .from(entities)
      .where(eq(entities.id, header.entityId))
      .limit(1);

    // Get lines with extensions
    const lineRows = await db
      .select({
        line: transactionLines,
        ext: purchaseOrderLineExt,
      })
      .from(transactionLines)
      .leftJoin(purchaseOrderLineExt, eq(transactionLines.id, purchaseOrderLineExt.lineId))
      .where(eq(transactionLines.transactionId, header.id))
      .orderBy(asc(transactionLines.lineNumber));

    // Transform to output format
    const poHeader: PurchaseOrderHeader = {
      ...this.transformHeader(header),
      expectedDeliveryDate: ext?.expectedDeliveryDate || undefined,
      shipToLocationId: ext?.shipToLocationId || undefined,
      shippingAddress: ext?.shippingAddress || undefined,
      shippingMethod: ext?.shippingMethod || undefined,
      shippingAmount: ext?.shippingAmount || '0',
      paymentTerms: ext?.paymentTerms || undefined,
      receivedAmount: ext?.receivedAmount || '0',
      billedAmount: ext?.billedAmount || '0',
      currentApproverId: ext?.currentApproverId || undefined,
      approvedAt: ext?.approvedAt?.toISOString(),
      approvedBy: ext?.approvedBy || undefined,
      closedAt: ext?.closedAt?.toISOString(),
      cancelledAt: ext?.cancelledAt?.toISOString(),
      cancellationReason: ext?.cancellationReason || undefined,
    };

    const poLines: PurchaseOrderLine[] = lineRows.map(row => ({
      ...this.transformLine(row.line),
      expectedDeliveryDate: row.ext?.expectedDeliveryDate || undefined,
      quantityReceived: row.ext?.quantityReceived || '0',
      quantityBilled: row.ext?.quantityBilled || '0',
      isClosed: row.ext?.isClosed ?? false,
    }));

    return {
      header: poHeader,
      lines: poLines,
      vendor: vendor[0] ? { id: vendor[0].id, name: vendor[0].name } : undefined,
    };
  }
}
