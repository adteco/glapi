/**
 * PO Receipt Hybrid Service
 *
 * Handles PO receipt lifecycle using the hybrid transaction model:
 * - Uses transaction_headers + transaction_lines (core tables)
 * - Uses po_receipt_ext + po_receipt_line_ext (extension tables)
 *
 * A PO Receipt represents items received against a Purchase Order.
 * The workflow is:
 * 1. Create receipt from PO (DRAFT)
 * 2. Submit for posting (PENDING)
 * 3. Post to update inventory and PO quantities (POSTED)
 */

import { BaseTransactionService } from './base-transaction-service';
import { PurchaseOrderHybridService } from './purchase-order-hybrid-service';
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
} from '../types/transaction.types';
import { db } from '@glapi/database';
import {
  transactionHeaders,
  transactionLines,
  TransactionHeader,
  TransactionLine,
  poReceiptExt,
  poReceiptLineExt,
  POReceiptExtRecord,
  POReceiptLineExtRecord,
  HybridPOReceiptStatus,
  HybridPOReceiptStatusValue,
  purchaseOrderExt,
  purchaseOrderLineExt,
  entities,
} from '@glapi/database/schema';
import { eq, and, desc, asc, sql, inArray, gte, lte, or, ilike } from 'drizzle-orm';
import Decimal from 'decimal.js';

// ============================================================================
// Types
// ============================================================================

export interface POReceiptHeader extends BaseTransactionHeader {
  purchaseOrderId: string;
  purchaseOrderNumber?: string;
  receiptLocationId?: string;
  shippingRef?: string;
  carrierName?: string;
  postedAt?: string;
  postedBy?: string;
  cancelledAt?: string;
}

export interface POReceiptLine extends BaseTransactionLine {
  purchaseOrderLineId?: string;
  quantityAccepted: string;
  quantityRejected: string;
  rejectionReason?: string;
  binLocation?: string;
  lotNumber?: string;
  serialNumbers?: string[];
}

export interface POReceiptWithDetails {
  header: POReceiptHeader;
  lines: POReceiptLine[];
  vendor?: { id: string; name: string };
  purchaseOrder?: { id: string; number: string };
}

export interface CreatePOReceiptInput {
  purchaseOrderId: string;
  receiptDate: string | Date;
  receiptLocationId?: string;
  shippingRef?: string;
  carrierName?: string;
  memo?: string;
  internalNotes?: string;
  lines: CreatePOReceiptLineInput[];
}

export interface CreatePOReceiptLineInput {
  purchaseOrderLineId: string;
  quantityReceived: number;
  quantityAccepted?: number;
  quantityRejected?: number;
  rejectionReason?: string;
  binLocation?: string;
  lotNumber?: string;
  serialNumbers?: string[];
}

export interface POReceiptFilters extends TransactionFilters {
  purchaseOrderId?: string;
  vendorId?: string;
  receiptDateFrom?: string | Date;
  receiptDateTo?: string | Date;
}

// Valid status transitions for PO receipts
const VALID_RECEIPT_TRANSITIONS: Record<HybridPOReceiptStatusValue, HybridPOReceiptStatusValue[]> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['POSTED', 'CANCELLED', 'DRAFT'],
  POSTED: [], // Posted receipts cannot transition
  CANCELLED: [], // Cancelled receipts cannot transition
};

// ============================================================================
// PO Receipt Hybrid Service
// ============================================================================

export class POReceiptHybridService extends BaseTransactionService {
  protected transactionType = TransactionTypeCode.PO_RECEIPT;
  protected eventCategory = 'PROCUREMENT' as const;
  private poService: PurchaseOrderHybridService;

  constructor(context: ServiceContext = {}) {
    super(context);
    this.poService = new PurchaseOrderHybridService(context);
  }

  // ==========================================================================
  // LIST Operations
  // ==========================================================================

  /**
   * List PO receipts with filters and pagination
   */
  async listReceipts(
    params: PaginationParams = {},
    filters: POReceiptFilters = {}
  ): Promise<PaginatedResult<POReceiptWithDetails>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(params);

    // Build where conditions for core header
    const conditions = [
      eq(transactionHeaders.organizationId, organizationId),
      eq(transactionHeaders.transactionType, TransactionTypeCode.PO_RECEIPT),
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

    if (filters.dateFrom || filters.receiptDateFrom) {
      const dateFrom = filters.dateFrom || filters.receiptDateFrom!;
      const dateStr = typeof dateFrom === 'string'
        ? dateFrom
        : dateFrom.toISOString().split('T')[0];
      conditions.push(gte(transactionHeaders.transactionDate, dateStr));
    }

    if (filters.dateTo || filters.receiptDateTo) {
      const dateTo = filters.dateTo || filters.receiptDateTo!;
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
        ext: poReceiptExt,
      })
      .from(transactionHeaders)
      .leftJoin(poReceiptExt, eq(transactionHeaders.id, poReceiptExt.transactionId))
      .where(and(...conditions))
      .orderBy(desc(transactionHeaders.createdAt))
      .limit(take)
      .offset(skip);

    // Filter by purchaseOrderId if specified
    let filteredRows = rows;
    if (filters.purchaseOrderId) {
      filteredRows = rows.filter(r => r.ext?.purchaseOrderId === filters.purchaseOrderId);
    }

    // Enrich with details
    const receiptsWithDetails = await Promise.all(
      filteredRows.map(async (row) => this.enrichWithDetails(row.header, row.ext))
    );

    return this.createPaginatedResult(receiptsWithDetails, total, page, limit);
  }

  // ==========================================================================
  // GET Operations
  // ==========================================================================

  /**
   * Get a single PO receipt by ID
   */
  async getReceiptById(id: string): Promise<POReceiptWithDetails | null> {
    const organizationId = this.requireOrganizationContext();

    const rows = await db
      .select({
        header: transactionHeaders,
        ext: poReceiptExt,
      })
      .from(transactionHeaders)
      .leftJoin(poReceiptExt, eq(transactionHeaders.id, poReceiptExt.transactionId))
      .where(
        and(
          eq(transactionHeaders.id, id),
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.transactionType, TransactionTypeCode.PO_RECEIPT)
        )
      )
      .limit(1);

    if (!rows[0]) {
      return null;
    }

    return this.enrichWithDetails(rows[0].header, rows[0].ext);
  }

  // ==========================================================================
  // CREATE Operations
  // ==========================================================================

  /**
   * Create a new PO receipt from a purchase order
   */
  async createReceipt(input: CreatePOReceiptInput): Promise<POReceiptWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Get the PO to validate and get vendor info
    const po = await this.poService.getPurchaseOrderById(input.purchaseOrderId);
    if (!po) {
      throw new ServiceError('Purchase order not found', 'NOT_FOUND', 404);
    }

    // Validate PO is in a receivable status
    const receivableStatuses = ['APPROVED', 'PARTIALLY_RECEIVED'];
    if (!receivableStatuses.includes(po.header.status)) {
      throw new ServiceError(
        `Cannot receive against PO in status ${po.header.status}. PO must be APPROVED or PARTIALLY_RECEIVED.`,
        'VALIDATION_ERROR',
        400
      );
    }

    // Validate lines exist and reference valid PO lines
    if (!input.lines || input.lines.length === 0) {
      throw new ServiceError('At least one receipt line is required', 'VALIDATION_ERROR', 400);
    }

    const poLineMap = new Map(po.lines.map(l => [l.id, l]));
    for (const line of input.lines) {
      const poLine = poLineMap.get(line.purchaseOrderLineId);
      if (!poLine) {
        throw new ServiceError(
          `PO line ${line.purchaseOrderLineId} not found on purchase order`,
          'VALIDATION_ERROR',
          400
        );
      }

      // Validate quantity doesn't exceed remaining
      const remaining = new Decimal(poLine.quantity).minus(new Decimal(poLine.quantityReceived));
      if (new Decimal(line.quantityReceived).gt(remaining)) {
        throw new ServiceError(
          `Quantity ${line.quantityReceived} exceeds remaining quantity ${remaining.toString()} for line ${poLine.lineNumber}`,
          'VALIDATION_ERROR',
          400
        );
      }
    }

    // Generate receipt number
    const receiptNumber = await this.generateTransactionNumber();

    // Calculate totals based on PO line prices
    let subtotal = new Decimal(0);
    let taxTotal = new Decimal(0);

    const enrichedLines = input.lines.map((line, index) => {
      const poLine = poLineMap.get(line.purchaseOrderLineId)!;
      const quantity = new Decimal(line.quantityReceived);
      const unitPrice = new Decimal(poLine.unitPrice);
      const amount = quantity.times(unitPrice);
      const taxAmount = new Decimal(0); // Receipts don't track tax directly

      subtotal = subtotal.plus(amount);

      return {
        ...line,
        lineNumber: index + 1,
        itemId: poLine.itemId,
        itemName: poLine.itemName,
        itemDescription: poLine.itemDescription,
        quantity: line.quantityReceived,
        unitPrice: poLine.unitPrice,
        amount: amount.toString(),
        taxAmount: taxAmount.toString(),
        accountId: poLine.accountId,
        departmentId: poLine.departmentId,
        locationId: poLine.locationId,
        classId: poLine.classId,
        projectId: poLine.projectId,
      };
    });

    const totalAmount = subtotal.plus(taxTotal);

    // Create transaction header (core table)
    const header = await this.createHeader({
      subsidiaryId: po.header.subsidiaryId,
      transactionType: TransactionTypeCode.PO_RECEIPT,
      transactionNumber: receiptNumber,
      entityId: po.header.entityId,
      entityName: po.header.entityName || po.vendor?.name,
      transactionDate: this.toDateString(input.receiptDate),
      status: HybridPOReceiptStatus.DRAFT,
      subtotal: subtotal.toString(),
      taxAmount: taxTotal.toString(),
      totalAmount: totalAmount.toString(),
      currencyCode: po.header.currencyCode,
      exchangeRate: po.header.exchangeRate,
      memo: input.memo,
      internalNotes: input.internalNotes,
      createdBy: userId,
    });

    // Create receipt extension (type-specific fields)
    await db.insert(poReceiptExt).values({
      transactionId: header.id,
      purchaseOrderId: input.purchaseOrderId,
      receiptLocationId: input.receiptLocationId,
      shippingRef: input.shippingRef,
      carrierName: input.carrierName,
    });

    // Create transaction lines with extensions
    for (const line of enrichedLines) {
      const quantityAccepted = line.quantityAccepted ?? line.quantityReceived;
      const quantityRejected = line.quantityRejected ?? 0;

      // Create core line
      const [createdLine] = await db
        .insert(transactionLines)
        .values({
          transactionId: header.id,
          lineNumber: line.lineNumber,
          itemId: line.itemId,
          itemName: line.itemName,
          itemDescription: line.itemDescription,
          quantity: line.quantity.toString(),
          unitOfMeasure: poLineMap.get(line.purchaseOrderLineId)?.unitOfMeasure,
          unitPrice: line.unitPrice,
          amount: line.amount,
          taxAmount: line.taxAmount,
          accountId: line.accountId,
          departmentId: line.departmentId,
          locationId: line.locationId,
          classId: line.classId,
          projectId: line.projectId,
        })
        .returning();

      // Create line extension (receipt-specific fields)
      await db.insert(poReceiptLineExt).values({
        lineId: createdLine.id,
        purchaseOrderLineId: line.purchaseOrderLineId,
        quantityAccepted: quantityAccepted.toString(),
        quantityRejected: quantityRejected.toString(),
        rejectionReason: line.rejectionReason,
        binLocation: line.binLocation,
        lotNumber: line.lotNumber,
        serialNumbers: line.serialNumbers,
      });
    }

    // Emit event
    await this.emitEvent('POReceiptCreated', header.id, {
      receiptNumber: header.transactionNumber,
      purchaseOrderId: input.purchaseOrderId,
      vendorId: po.header.entityId,
      totalAmount: header.totalAmount,
      lineCount: enrichedLines.length,
    });

    return (await this.getReceiptById(header.id))!;
  }

  // ==========================================================================
  // WORKFLOW OPERATIONS
  // ==========================================================================

  /**
   * Submit a receipt for posting
   */
  async submitReceipt(receiptId: string): Promise<POReceiptWithDetails> {
    const userId = this.requireUserContext();

    const receipt = await this.getReceiptById(receiptId);
    if (!receipt) {
      throw new ServiceError('Receipt not found', 'NOT_FOUND', 404);
    }

    // Validate transition
    this.validateStatusTransition(
      receipt.header.status,
      HybridPOReceiptStatus.PENDING,
      VALID_RECEIPT_TRANSITIONS
    );

    // Update status
    await this.updateStatus(receiptId, HybridPOReceiptStatus.PENDING);

    // Emit event
    await this.emitEvent('POReceiptSubmitted', receiptId, {
      receiptNumber: receipt.header.transactionNumber,
      purchaseOrderId: receipt.header.purchaseOrderId,
      submittedBy: userId,
    });

    return (await this.getReceiptById(receiptId))!;
  }

  /**
   * Post a receipt - updates PO quantities and creates inventory entries
   */
  async postReceipt(receiptId: string): Promise<POReceiptWithDetails> {
    const userId = this.requireUserContext();

    const receipt = await this.getReceiptById(receiptId);
    if (!receipt) {
      throw new ServiceError('Receipt not found', 'NOT_FOUND', 404);
    }

    // Validate transition
    this.validateStatusTransition(
      receipt.header.status,
      HybridPOReceiptStatus.POSTED,
      VALID_RECEIPT_TRANSITIONS
    );

    // Calculate total received amount and build line updates for PO
    let totalReceivedAmount = new Decimal(0);
    const lineUpdates: Array<{ lineId: string; quantityReceived: Decimal }> = [];

    for (const line of receipt.lines) {
      const quantityAccepted = new Decimal(line.quantityAccepted);
      const amount = quantityAccepted.times(new Decimal(line.unitPrice));
      totalReceivedAmount = totalReceivedAmount.plus(amount);

      if (line.purchaseOrderLineId) {
        lineUpdates.push({
          lineId: line.purchaseOrderLineId,
          quantityReceived: quantityAccepted,
        });
      }
    }

    // Update PO received amounts (this will also update PO status)
    await this.poService.updateReceivedAmounts(
      receipt.header.purchaseOrderId,
      totalReceivedAmount,
      lineUpdates
    );

    // Update receipt status and posting info
    await this.updateStatus(receiptId, HybridPOReceiptStatus.POSTED);
    await db
      .update(poReceiptExt)
      .set({
        postedAt: new Date(),
        postedBy: userId,
      })
      .where(eq(poReceiptExt.transactionId, receiptId));

    // Emit event
    await this.emitEvent('POReceiptPosted', receiptId, {
      receiptNumber: receipt.header.transactionNumber,
      purchaseOrderId: receipt.header.purchaseOrderId,
      totalReceivedAmount: totalReceivedAmount.toString(),
      postedBy: userId,
    });

    return (await this.getReceiptById(receiptId))!;
  }

  /**
   * Cancel a receipt
   */
  async cancelReceipt(receiptId: string, reason?: string): Promise<POReceiptWithDetails> {
    const userId = this.requireUserContext();

    const receipt = await this.getReceiptById(receiptId);
    if (!receipt) {
      throw new ServiceError('Receipt not found', 'NOT_FOUND', 404);
    }

    // Validate transition
    this.validateStatusTransition(
      receipt.header.status,
      HybridPOReceiptStatus.CANCELLED,
      VALID_RECEIPT_TRANSITIONS
    );

    // Update status
    await this.updateStatus(receiptId, HybridPOReceiptStatus.CANCELLED);
    await db
      .update(poReceiptExt)
      .set({
        cancelledAt: new Date(),
      })
      .where(eq(poReceiptExt.transactionId, receiptId));

    // Emit event
    await this.emitEvent('POReceiptCancelled', receiptId, {
      receiptNumber: receipt.header.transactionNumber,
      purchaseOrderId: receipt.header.purchaseOrderId,
      reason,
      cancelledBy: userId,
    });

    return (await this.getReceiptById(receiptId))!;
  }

  /**
   * Return a receipt to draft status
   */
  async returnToDraft(receiptId: string): Promise<POReceiptWithDetails> {
    const userId = this.requireUserContext();

    const receipt = await this.getReceiptById(receiptId);
    if (!receipt) {
      throw new ServiceError('Receipt not found', 'NOT_FOUND', 404);
    }

    // Only PENDING receipts can be returned to draft
    if (receipt.header.status !== HybridPOReceiptStatus.PENDING) {
      throw new ServiceError(
        'Only PENDING receipts can be returned to draft',
        'VALIDATION_ERROR',
        400
      );
    }

    // Update status
    await this.updateStatus(receiptId, HybridPOReceiptStatus.DRAFT);

    // Emit event
    await this.emitEvent('POReceiptReturnedToDraft', receiptId, {
      receiptNumber: receipt.header.transactionNumber,
      returnedBy: userId,
    });

    return (await this.getReceiptById(receiptId))!;
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Enrich header and extension with full details
   */
  private async enrichWithDetails(
    header: TransactionHeader,
    ext: POReceiptExtRecord | null
  ): Promise<POReceiptWithDetails> {
    // Get vendor
    const vendor = await db
      .select({ id: entities.id, name: entities.name })
      .from(entities)
      .where(eq(entities.id, header.entityId))
      .limit(1);

    // Get PO info
    let purchaseOrder: { id: string; number: string } | undefined;
    if (ext?.purchaseOrderId) {
      const poResult = await db
        .select({
          id: transactionHeaders.id,
          number: transactionHeaders.transactionNumber,
        })
        .from(transactionHeaders)
        .where(eq(transactionHeaders.id, ext.purchaseOrderId))
        .limit(1);
      if (poResult[0]) {
        purchaseOrder = { id: poResult[0].id, number: poResult[0].number };
      }
    }

    // Get lines with extensions
    const lineRows = await db
      .select({
        line: transactionLines,
        ext: poReceiptLineExt,
      })
      .from(transactionLines)
      .leftJoin(poReceiptLineExt, eq(transactionLines.id, poReceiptLineExt.lineId))
      .where(eq(transactionLines.transactionId, header.id))
      .orderBy(asc(transactionLines.lineNumber));

    // Transform to output format
    const receiptHeader: POReceiptHeader = {
      ...this.transformHeader(header),
      purchaseOrderId: ext?.purchaseOrderId || '',
      purchaseOrderNumber: purchaseOrder?.number,
      receiptLocationId: ext?.receiptLocationId || undefined,
      shippingRef: ext?.shippingRef || undefined,
      carrierName: ext?.carrierName || undefined,
      postedAt: ext?.postedAt?.toISOString(),
      postedBy: ext?.postedBy || undefined,
      cancelledAt: ext?.cancelledAt?.toISOString(),
    };

    const receiptLines: POReceiptLine[] = lineRows.map(row => ({
      ...this.transformLine(row.line),
      purchaseOrderLineId: row.ext?.purchaseOrderLineId || undefined,
      quantityAccepted: row.ext?.quantityAccepted || '0',
      quantityRejected: row.ext?.quantityRejected || '0',
      rejectionReason: row.ext?.rejectionReason || undefined,
      binLocation: row.ext?.binLocation || undefined,
      lotNumber: row.ext?.lotNumber || undefined,
      serialNumbers: row.ext?.serialNumbers as string[] | undefined,
    }));

    return {
      header: receiptHeader,
      lines: receiptLines,
      vendor: vendor[0] ? { id: vendor[0].id, name: vendor[0].name } : undefined,
      purchaseOrder,
    };
  }
}
