/**
 * Purchase Order Service
 *
 * Handles purchase order lifecycle:
 * - PO creation and management
 * - Approval workflow
 * - Goods receipt processing
 * - Status tracking
 *
 * NOTE: Data access is delegated to PurchaseOrderRepository, PurchaseOrderLineRepository,
 * and PurchaseOrderReceiptRepository. This service focuses on business logic, orchestration,
 * and event emission.
 */

import { BaseService } from './base-service';
import { EventService } from './event-service';
import {
  ServiceContext,
  ServiceError,
  PaginatedResult,
  PaginationParams,
} from '../types';
import {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  SubmitPurchaseOrderInput,
  ApprovePurchaseOrderInput,
  CreateReceiptInput,
  PostReceiptInput,
  PurchaseOrderFilters,
  ReceiptFilters,
  PurchaseOrderWithDetails,
  PurchaseOrderLineWithDetails,
  PurchaseOrderApprovalEntry,
  ReceiptWithDetails,
  ReceiptLineWithDetails,
  ReceiptSummary,
  PurchaseOrderStatusValue,
  ReceiptStatusValue,
  POStatusSummary,
} from '../types/procure-to-pay.types';
import {
  PurchaseOrderStatus,
  ReceiptStatus,
  POApprovalActionType,
  VALID_PURCHASE_ORDER_TRANSITIONS,
  type POApprovalActionTypeValue,
  purchaseOrders,
  purchaseOrderLines,
  purchaseOrderReceipts,
  purchaseOrderReceiptLines,
  purchaseOrderApprovalHistory,
  entities,
  locations,
  items,
} from '@glapi/database/schema';
import { db as globalDb, type ContextualDatabase } from '@glapi/database';
import {
  PurchaseOrderRepository,
  PurchaseOrderLineRepository,
  PurchaseOrderReceiptRepository,
} from '@glapi/database/repositories';
import { eq, and, desc, asc, sql, inArray, gte, lte, or, ilike, lt } from 'drizzle-orm';
import Decimal from 'decimal.js';

export interface PurchaseOrderServiceOptions {
  db?: ContextualDatabase;
  purchaseOrderRepository?: PurchaseOrderRepository;
  purchaseOrderLineRepository?: PurchaseOrderLineRepository;
  purchaseOrderReceiptRepository?: PurchaseOrderReceiptRepository;
}

// ============================================================================
// Purchase Order Service
// ============================================================================

export class PurchaseOrderService extends BaseService {
  private db: ContextualDatabase;
  private poRepo: PurchaseOrderRepository;
  private poLineRepo: PurchaseOrderLineRepository;
  private receiptRepo: PurchaseOrderReceiptRepository;
  private eventService: EventService;

  constructor(context: ServiceContext = {}, options: PurchaseOrderServiceOptions = {}) {
    super(context);
    this.db = options.db ?? globalDb;
    // Initialize repositories with optional db context for RLS
    this.poRepo = options.purchaseOrderRepository ?? new PurchaseOrderRepository(options.db);
    this.poLineRepo = options.purchaseOrderLineRepository ?? new PurchaseOrderLineRepository(options.db);
    this.receiptRepo = options.purchaseOrderReceiptRepository ?? new PurchaseOrderReceiptRepository(options.db);
    this.eventService = new EventService(context);
  }

  // ==========================================================================
  // PURCHASE ORDER CRUD Operations
  // ==========================================================================

  /**
   * List purchase orders with filters and pagination
   */
  async listPurchaseOrders(
    params: PaginationParams = {},
    filters: PurchaseOrderFilters = {}
  ): Promise<PaginatedResult<PurchaseOrderWithDetails>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(params);

    // Use repository to fetch orders
    const { results: orders, total } = await this.poRepo.findAll(
      organizationId,
      { skip, take },
      filters
    );

    // Enrich with details
    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => this.enrichPOWithDetails(order))
    );

    return this.createPaginatedResult(ordersWithDetails, total, page, limit);
  }

  /**
   * Get a single purchase order by ID
   */
  async getPurchaseOrderById(id: string): Promise<PurchaseOrderWithDetails | null> {
    const organizationId = this.requireOrganizationContext();

    const order = await this.poRepo.findById(id, organizationId);
    if (!order) {
      return null;
    }

    return this.enrichPOWithDetails(order, true);
  }

  /**
   * Create a new purchase order
   */
  async createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrderWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Validate vendor exists
    const vendor = await this.db
      .select({ id: entities.id, name: entities.name })
      .from(entities)
      .where(eq(entities.id, input.vendorId))
      .limit(1);

    if (!vendor[0]) {
      throw new ServiceError('Vendor not found', 'NOT_FOUND', 404);
    }

    // Generate PO number
    const poNumber = await this.generatePONumber();

    // Calculate line totals
    const { lines, subtotal, taxTotal } = this.calculateLineTotals(input.lines);
    const shippingAmount = 0; // Shipping calculated per-line or added later
    const totalAmount = new Decimal(subtotal).plus(taxTotal).plus(shippingAmount).toFixed(2);

    // Create PO
    const [po] = await this.db
      .insert(purchaseOrders)
      .values({
        organizationId,
        subsidiaryId: input.subsidiaryId,
        poNumber,
        vendorId: input.vendorId,
        vendorName: vendor[0].name,
        orderDate: this.toDateString(input.orderDate),
        expectedDeliveryDate: input.expectedDeliveryDate
          ? this.toDateString(input.expectedDeliveryDate)
          : null,
        status: PurchaseOrderStatus.DRAFT,
        subtotal: subtotal.toString(),
        taxAmount: taxTotal.toString(),
        shippingAmount: shippingAmount.toString(),
        totalAmount,
        receivedAmount: '0',
        billedAmount: '0',
        shipToLocationId: input.shipToLocationId,
        shippingAddress: input.shippingAddress,
        shippingMethod: input.shippingMethod,
        paymentTerms: input.paymentTerms,
        currencyCode: input.currencyCode || 'USD',
        exchangeRate: (input.exchangeRate || 1).toString(),
        memo: input.memo,
        internalNotes: input.internalNotes,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    // Create lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = line.lineNumber || i + 1;

      await this.db.insert(purchaseOrderLines).values({
        purchaseOrderId: po.id,
        lineNumber,
        itemId: line.itemId,
        itemName: line.itemName,
        itemDescription: line.itemDescription,
        quantity: line.quantity.toString(),
        unitOfMeasure: line.unitOfMeasure,
        unitPrice: line.unitPrice.toString(),
        amount: line.amount.toString(),
        taxAmount: (line.taxAmount || 0).toString(),
        quantityReceived: '0',
        quantityBilled: '0',
        accountId: line.accountId,
        departmentId: line.departmentId,
        locationId: line.locationId,
        classId: line.classId,
        projectId: line.projectId,
        expectedDeliveryDate: line.expectedDeliveryDate
          ? this.toDateString(line.expectedDeliveryDate)
          : null,
        memo: line.memo,
        isClosed: false,
      });
    }

    // Emit event
    await this.eventService.emit({
      eventType: 'PurchaseOrderCreated',
      eventCategory: 'PROCUREMENT',
      aggregateType: 'PurchaseOrder',
      aggregateId: po.id,
      data: {
        poNumber: po.poNumber,
        vendorId: po.vendorId,
        totalAmount: po.totalAmount,
        lineCount: lines.length,
      },
    });

    return this.enrichPOWithDetails(po, true);
  }

  /**
   * Update a purchase order (only in DRAFT or REJECTED status)
   */
  async updatePurchaseOrder(
    id: string,
    input: UpdatePurchaseOrderInput
  ): Promise<PurchaseOrderWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Get existing PO
    const existing = await this.getPurchaseOrderById(id);
    if (!existing) {
      throw new ServiceError('Purchase order not found', 'NOT_FOUND', 404);
    }

    // Only allow updates in DRAFT or REJECTED status
    if (existing.status !== PurchaseOrderStatus.DRAFT &&
        existing.status !== PurchaseOrderStatus.REJECTED) {
      throw new ServiceError(
        `Cannot update purchase order in ${existing.status} status. Only DRAFT or REJECTED orders can be updated.`,
        'VALIDATION_ERROR',
        400
      );
    }

    // Update PO
    await this.db
      .update(purchaseOrders)
      .set({
        expectedDeliveryDate: input.expectedDeliveryDate
          ? this.toDateString(input.expectedDeliveryDate)
          : existing.expectedDeliveryDate,
        shipToLocationId: input.shipToLocationId ?? existing.shipToLocationId,
        shippingAddress: input.shippingAddress ?? existing.shippingAddress,
        shippingMethod: input.shippingMethod ?? existing.shippingMethod,
        paymentTerms: input.paymentTerms ?? existing.paymentTerms,
        memo: input.memo ?? existing.memo,
        internalNotes: input.internalNotes ?? existing.internalNotes,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, organizationId)));

    return (await this.getPurchaseOrderById(id))!;
  }

  /**
   * Delete a purchase order (only in DRAFT status)
   */
  async deletePurchaseOrder(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    const existing = await this.getPurchaseOrderById(id);
    if (!existing) {
      throw new ServiceError('Purchase order not found', 'NOT_FOUND', 404);
    }

    if (existing.status !== PurchaseOrderStatus.DRAFT) {
      throw new ServiceError('Only DRAFT purchase orders can be deleted', 'VALIDATION_ERROR', 400);
    }

    // Delete lines first (cascade should handle this, but be explicit)
    await this.db.delete(purchaseOrderLines).where(eq(purchaseOrderLines.purchaseOrderId, id));

    // Delete PO
    await this.db
      .delete(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, organizationId)));

    // Emit event
    await this.eventService.emit({
      eventType: 'PurchaseOrderDeleted',
      eventCategory: 'PROCUREMENT',
      aggregateType: 'PurchaseOrder',
      aggregateId: id,
      data: { poNumber: existing.poNumber },
    });
  }

  // ==========================================================================
  // APPROVAL WORKFLOW
  // ==========================================================================

  /**
   * Submit a purchase order for approval
   */
  async submitPurchaseOrder(input: SubmitPurchaseOrderInput): Promise<PurchaseOrderWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const po = await this.getPurchaseOrderById(input.purchaseOrderId);
    if (!po) {
      throw new ServiceError('Purchase order not found', 'NOT_FOUND', 404);
    }

    // Validate transition
    this.validateStatusTransition(po.status, PurchaseOrderStatus.SUBMITTED);

    // Update status
    await this.db
      .update(purchaseOrders)
      .set({
        status: PurchaseOrderStatus.SUBMITTED,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(purchaseOrders.id, input.purchaseOrderId),
        eq(purchaseOrders.organizationId, organizationId)
      ));

    // Record approval history
    await this.recordApprovalHistory(
      input.purchaseOrderId,
      POApprovalActionType.SUBMITTED,
      po.status,
      PurchaseOrderStatus.SUBMITTED,
      userId,
      input.comments
    );

    // Emit event
    await this.eventService.emit({
      eventType: 'PurchaseOrderSubmitted',
      eventCategory: 'PROCUREMENT',
      aggregateType: 'PurchaseOrder',
      aggregateId: input.purchaseOrderId,
      data: { poNumber: po.poNumber, totalAmount: po.totalAmount },
    });

    return (await this.getPurchaseOrderById(input.purchaseOrderId))!;
  }

  /**
   * Approve or reject a purchase order
   */
  async approvePurchaseOrder(input: ApprovePurchaseOrderInput): Promise<PurchaseOrderWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const po = await this.getPurchaseOrderById(input.purchaseOrderId);
    if (!po) {
      throw new ServiceError('Purchase order not found', 'NOT_FOUND', 404);
    }

    // Only submitted POs can be approved/rejected
    if (po.status !== PurchaseOrderStatus.SUBMITTED) {
      throw new ServiceError(
        `Purchase order must be in SUBMITTED status to ${input.action.toLowerCase()}`,
        'VALIDATION_ERROR',
        400
      );
    }

    let newStatus: PurchaseOrderStatusValue;
    let actionType: (typeof POApprovalActionType)[keyof typeof POApprovalActionType];

    switch (input.action) {
      case 'APPROVE':
        newStatus = PurchaseOrderStatus.APPROVED;
        actionType = POApprovalActionType.APPROVED;
        break;
      case 'REJECT':
        newStatus = PurchaseOrderStatus.REJECTED;
        actionType = POApprovalActionType.REJECTED;
        break;
      case 'RETURN':
        newStatus = PurchaseOrderStatus.DRAFT;
        actionType = POApprovalActionType.RETURNED;
        break;
      default:
        throw new ServiceError(`Invalid action: ${input.action}`, 'VALIDATION_ERROR', 400);
    }

    // Update status
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedBy: userId,
      updatedAt: new Date(),
    };

    if (input.action === 'APPROVE') {
      updateData.approvedAt = new Date();
      updateData.approvedBy = userId;
    }

    await this.db
      .update(purchaseOrders)
      .set(updateData)
      .where(and(
        eq(purchaseOrders.id, input.purchaseOrderId),
        eq(purchaseOrders.organizationId, organizationId)
      ));

    // Record approval history
    await this.recordApprovalHistory(
      input.purchaseOrderId,
      actionType,
      po.status,
      newStatus,
      userId,
      input.comments
    );

    // Emit event
    await this.eventService.emit({
      eventType: `PurchaseOrder${input.action.charAt(0) + input.action.slice(1).toLowerCase()}d`,
      eventCategory: 'PROCUREMENT',
      aggregateType: 'PurchaseOrder',
      aggregateId: input.purchaseOrderId,
      data: { poNumber: po.poNumber, action: input.action },
    });

    return (await this.getPurchaseOrderById(input.purchaseOrderId))!;
  }

  /**
   * Cancel a purchase order
   */
  async cancelPurchaseOrder(id: string, reason: string): Promise<PurchaseOrderWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const po = await this.getPurchaseOrderById(id);
    if (!po) {
      throw new ServiceError('Purchase order not found', 'NOT_FOUND', 404);
    }

    // Validate transition
    this.validateStatusTransition(po.status, PurchaseOrderStatus.CANCELLED);

    // Update status
    await this.db
      .update(purchaseOrders)
      .set({
        status: PurchaseOrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, organizationId)));

    // Record history
    await this.recordApprovalHistory(
      id,
      POApprovalActionType.CANCELLED,
      po.status,
      PurchaseOrderStatus.CANCELLED,
      userId,
      reason
    );

    // Emit event
    await this.eventService.emit({
      eventType: 'PurchaseOrderCancelled',
      eventCategory: 'PROCUREMENT',
      aggregateType: 'PurchaseOrder',
      aggregateId: id,
      data: { poNumber: po.poNumber, reason },
    });

    return (await this.getPurchaseOrderById(id))!;
  }

  // ==========================================================================
  // RECEIPT Operations
  // ==========================================================================

  /**
   * Create a goods receipt against a purchase order
   */
  async createReceipt(input: CreateReceiptInput): Promise<ReceiptWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Get and validate PO
    const po = await this.getPurchaseOrderById(input.purchaseOrderId);
    if (!po) {
      throw new ServiceError('Purchase order not found', 'NOT_FOUND', 404);
    }

    // PO must be approved or partially received
    if (po.status !== PurchaseOrderStatus.APPROVED &&
        po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED) {
      throw new ServiceError(
        'Purchase order must be in APPROVED or PARTIALLY_RECEIVED status to create a receipt',
        'VALIDATION_ERROR',
        400
      );
    }

    // Generate receipt number
    const receiptNumber = await this.generateReceiptNumber();

    // Validate receipt lines against PO lines
    const poLineMap = new Map(po.lines?.map(l => [l.id, l]) || []);
    let totalReceivedValue = new Decimal(0);

    for (const line of input.lines) {
      const poLine = poLineMap.get(line.purchaseOrderLineId);
      if (!poLine) {
        throw new ServiceError(`PO line ${line.purchaseOrderLineId} not found`, 'NOT_FOUND', 404);
      }

      const qtyRemaining = new Decimal(poLine.quantity)
        .minus(poLine.quantityReceived)
        .toNumber();

      const qtyToReceive = Number(line.quantityReceived);
      if (qtyToReceive > qtyRemaining) {
        throw new ServiceError(
          `Cannot receive ${qtyToReceive} for line ${poLine.lineNumber}. Only ${qtyRemaining} remaining.`,
          'VALIDATION_ERROR',
          400
        );
      }

      totalReceivedValue = totalReceivedValue.plus(
        new Decimal(qtyToReceive).times(poLine.unitPrice)
      );
    }

    // Create receipt
    const [receipt] = await this.db
      .insert(purchaseOrderReceipts)
      .values({
        organizationId,
        subsidiaryId: input.subsidiaryId,
        receiptNumber,
        purchaseOrderId: input.purchaseOrderId,
        vendorId: po.vendorId,
        receiptDate: this.toDateString(input.receiptDate),
        status: ReceiptStatus.DRAFT,
        locationId: input.locationId,
        totalReceivedValue: totalReceivedValue.toFixed(2),
        memo: input.memo,
        shippingRef: input.shippingRef,
        carrierName: input.carrierName,
        createdBy: userId,
      })
      .returning();

    // Create receipt lines
    for (let i = 0; i < input.lines.length; i++) {
      const line = input.lines[i];
      const poLine = poLineMap.get(line.purchaseOrderLineId)!;

      await this.db.insert(purchaseOrderReceiptLines).values({
        receiptId: receipt.id,
        purchaseOrderLineId: line.purchaseOrderLineId,
        lineNumber: i + 1,
        itemId: poLine.itemId,
        itemName: poLine.itemName,
        quantityReceived: line.quantityReceived.toString(),
        unitOfMeasure: poLine.unitOfMeasure,
        unitCost: poLine.unitPrice,
        receivedValue: new Decimal(line.quantityReceived).times(poLine.unitPrice).toFixed(2),
        quantityAccepted: line.quantityAccepted?.toString(),
        quantityRejected: line.quantityRejected?.toString(),
        rejectionReason: line.rejectionReason,
        binLocation: line.binLocation,
        lotNumber: line.lotNumber,
        serialNumbers: line.serialNumbers ? JSON.stringify(line.serialNumbers) : null,
        memo: line.memo,
      });
    }

    // Emit event
    await this.eventService.emit({
      eventType: 'ReceiptCreated',
      eventCategory: 'PROCUREMENT',
      aggregateType: 'Receipt',
      aggregateId: receipt.id,
      data: {
        receiptNumber: receipt.receiptNumber,
        purchaseOrderId: input.purchaseOrderId,
        lineCount: input.lines.length,
      },
    });

    return (await this.getReceiptById(receipt.id))!;
  }

  /**
   * Post a receipt (finalize and update PO quantities)
   */
  async postReceipt(input: PostReceiptInput): Promise<ReceiptWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const receipt = await this.getReceiptById(input.receiptId);
    if (!receipt) {
      throw new ServiceError('Receipt not found', 'NOT_FOUND', 404);
    }

    if (receipt.status !== ReceiptStatus.DRAFT) {
      throw new ServiceError('Receipt is already posted or cancelled', 'VALIDATION_ERROR', 400);
    }

    // Update PO line quantities
    for (const line of receipt.lines || []) {
      // Update PO line received quantity
      await this.db.execute(sql`
        UPDATE purchase_order_lines
        SET quantity_received = quantity_received + ${line.quantityReceived}::decimal,
            updated_at = NOW()
        WHERE id = ${line.purchaseOrderLineId}
      `);
    }

    // Update PO received amount
    await this.db.execute(sql`
      UPDATE purchase_orders
      SET received_amount = received_amount + ${receipt.totalReceivedValue}::decimal,
          updated_at = NOW()
      WHERE id = ${receipt.purchaseOrderId}
    `);

    // Post the receipt
    await this.db
      .update(purchaseOrderReceipts)
      .set({
        status: ReceiptStatus.POSTED,
        postedAt: new Date(),
        postedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrderReceipts.id, input.receiptId));

    // Check if PO is fully received and update status
    await this.updatePOReceiptStatus(receipt.purchaseOrderId);

    // Emit event
    await this.eventService.emit({
      eventType: 'ReceiptPosted',
      eventCategory: 'PROCUREMENT',
      aggregateType: 'Receipt',
      aggregateId: input.receiptId,
      data: {
        receiptNumber: receipt.receiptNumber,
        purchaseOrderId: receipt.purchaseOrderId,
        totalReceivedValue: receipt.totalReceivedValue,
      },
    });

    return (await this.getReceiptById(input.receiptId))!;
  }

  /**
   * Get a receipt by ID
   */
  async getReceiptById(id: string): Promise<ReceiptWithDetails | null> {
    const organizationId = this.requireOrganizationContext();

    const receipt = await this.db
      .select()
      .from(purchaseOrderReceipts)
      .where(and(
        eq(purchaseOrderReceipts.id, id),
        eq(purchaseOrderReceipts.organizationId, organizationId)
      ))
      .limit(1);

    if (!receipt[0]) {
      return null;
    }

    return this.enrichReceiptWithDetails(receipt[0]);
  }

  /**
   * List receipts with filters
   */
  async listReceipts(
    params: PaginationParams = {},
    filters: ReceiptFilters = {}
  ): Promise<PaginatedResult<ReceiptWithDetails>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(params);

    const conditions = [eq(purchaseOrderReceipts.organizationId, organizationId)];

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(purchaseOrderReceipts.status, filters.status));
      } else {
        conditions.push(eq(purchaseOrderReceipts.status, filters.status));
      }
    }

    if (filters.purchaseOrderId) {
      conditions.push(eq(purchaseOrderReceipts.purchaseOrderId, filters.purchaseOrderId));
    }

    if (filters.vendorId) {
      conditions.push(eq(purchaseOrderReceipts.vendorId, filters.vendorId));
    }

    if (filters.subsidiaryId) {
      conditions.push(eq(purchaseOrderReceipts.subsidiaryId, filters.subsidiaryId));
    }

    // Count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseOrderReceipts)
      .where(and(...conditions));
    const total = Number(countResult[0]?.count || 0);

    // Fetch
    const receipts = await this.db
      .select()
      .from(purchaseOrderReceipts)
      .where(and(...conditions))
      .orderBy(desc(purchaseOrderReceipts.createdAt))
      .limit(take)
      .offset(skip);

    const receiptsWithDetails = await Promise.all(
      receipts.map(r => this.enrichReceiptWithDetails(r))
    );

    return this.createPaginatedResult(receiptsWithDetails, total, page, limit);
  }

  // ==========================================================================
  // SUMMARY & REPORTING
  // ==========================================================================

  /**
   * Get PO status summary
   */
  async getPOStatusSummary(subsidiaryId?: string): Promise<POStatusSummary> {
    const organizationId = this.requireOrganizationContext();

    const conditions = [eq(purchaseOrders.organizationId, organizationId)];
    if (subsidiaryId) {
      conditions.push(eq(purchaseOrders.subsidiaryId, subsidiaryId));
    }

    const result = await this.db
      .select({
        status: purchaseOrders.status,
        count: sql<number>`count(*)`,
        totalAmount: sql<string>`sum(total_amount::decimal)`,
        unreceivedAmount: sql<string>`sum((total_amount::decimal - received_amount::decimal))`,
      })
      .from(purchaseOrders)
      .where(and(...conditions))
      .groupBy(purchaseOrders.status);

    const summary: POStatusSummary = {
      draft: 0,
      submitted: 0,
      approved: 0,
      partiallyReceived: 0,
      received: 0,
      billed: 0,
      closed: 0,
      cancelled: 0,
      totalOpenValue: '0',
      totalUnreceivedValue: '0',
    };

    let totalOpen = new Decimal(0);
    let totalUnreceived = new Decimal(0);

    for (const row of result) {
      const count = Number(row.count);
      const amount = new Decimal(row.totalAmount || 0);
      const unreceived = new Decimal(row.unreceivedAmount || 0);

      switch (row.status) {
        case 'DRAFT':
          summary.draft = count;
          break;
        case 'SUBMITTED':
          summary.submitted = count;
          totalOpen = totalOpen.plus(amount);
          break;
        case 'APPROVED':
          summary.approved = count;
          totalOpen = totalOpen.plus(amount);
          totalUnreceived = totalUnreceived.plus(unreceived);
          break;
        case 'PARTIALLY_RECEIVED':
          summary.partiallyReceived = count;
          totalOpen = totalOpen.plus(amount);
          totalUnreceived = totalUnreceived.plus(unreceived);
          break;
        case 'RECEIVED':
          summary.received = count;
          break;
        case 'BILLED':
          summary.billed = count;
          break;
        case 'CLOSED':
          summary.closed = count;
          break;
        case 'CANCELLED':
          summary.cancelled = count;
          break;
      }
    }

    summary.totalOpenValue = totalOpen.toFixed(2);
    summary.totalUnreceivedValue = totalUnreceived.toFixed(2);

    return summary;
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async generatePONumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await this.db.execute(sql`
      SELECT COUNT(*) + 1 as seq
      FROM purchase_orders
      WHERE po_number LIKE ${`PO-${year}-%`}
    `);
    const seq = String((result.rows[0] as { seq: number }).seq).padStart(6, '0');
    return `PO-${year}-${seq}`;
  }

  private async generateReceiptNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await this.db.execute(sql`
      SELECT COUNT(*) + 1 as seq
      FROM purchase_order_receipts
      WHERE receipt_number LIKE ${`RCV-${year}-%`}
    `);
    const seq = String((result.rows[0] as { seq: number }).seq).padStart(6, '0');
    return `RCV-${year}-${seq}`;
  }

  private calculateLineTotals(lines: CreatePurchaseOrderInput['lines']) {
    let subtotal = new Decimal(0);
    let taxTotal = new Decimal(0);

    const calculatedLines = lines.map((line, index) => {
      const quantity = new Decimal(line.quantity);
      const unitPrice = new Decimal(line.unitPrice);
      const amount = quantity.times(unitPrice);
      const taxAmount = new Decimal(line.taxAmount || 0);

      subtotal = subtotal.plus(amount);
      taxTotal = taxTotal.plus(taxAmount);

      return {
        ...line,
        lineNumber: line.lineNumber || index + 1,
        quantity: quantity.toNumber(),
        unitPrice: unitPrice.toNumber(),
        amount: amount.toNumber(),
        taxAmount: taxAmount.toNumber(),
      };
    });

    return {
      lines: calculatedLines,
      subtotal: subtotal.toNumber(),
      taxTotal: taxTotal.toNumber(),
    };
  }

  private validateStatusTransition(
    currentStatus: PurchaseOrderStatusValue,
    newStatus: PurchaseOrderStatusValue
  ): void {
    const allowedTransitions = VALID_PURCHASE_ORDER_TRANSITIONS[currentStatus];
    if (!allowedTransitions.includes(newStatus)) {
      throw new ServiceError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
        'VALIDATION_ERROR',
        400
      );
    }
  }

  private async recordApprovalHistory(
    purchaseOrderId: string,
    action: (typeof POApprovalActionType)[keyof typeof POApprovalActionType],
    fromStatus: PurchaseOrderStatusValue | undefined,
    toStatus: PurchaseOrderStatusValue,
    userId: string,
    comments?: string
  ): Promise<void> {
    await this.db.insert(purchaseOrderApprovalHistory).values({
      purchaseOrderId,
      action,
      fromStatus,
      toStatus,
      performedBy: userId,
      comments,
    });
  }

  private async updatePOReceiptStatus(purchaseOrderId: string): Promise<void> {
    const po = await this.db
      .select({
        id: purchaseOrders.id,
        status: purchaseOrders.status,
        totalAmount: purchaseOrders.totalAmount,
        receivedAmount: purchaseOrders.receivedAmount,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, purchaseOrderId))
      .limit(1);

    if (!po[0]) return;

    const total = new Decimal(po[0].totalAmount);
    const received = new Decimal(po[0].receivedAmount);

    let newStatus: PurchaseOrderStatusValue | null = null;

    if (received.gte(total)) {
      newStatus = PurchaseOrderStatus.RECEIVED;
    } else if (received.gt(0)) {
      newStatus = PurchaseOrderStatus.PARTIALLY_RECEIVED;
    }

    if (newStatus && newStatus !== po[0].status) {
      await this.db
        .update(purchaseOrders)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(purchaseOrders.id, purchaseOrderId));
    }
  }

  private async enrichPOWithDetails(
    po: typeof purchaseOrders.$inferSelect,
    includeAll = false
  ): Promise<PurchaseOrderWithDetails> {
    // Get vendor
    const vendor = await this.db
      .select({ id: entities.id, name: entities.name })
      .from(entities)
      .where(eq(entities.id, po.vendorId))
      .limit(1);

    // Get lines
    const lines = await this.db
      .select()
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.purchaseOrderId, po.id))
      .orderBy(asc(purchaseOrderLines.lineNumber));

    // Get receipts summary
    const receiptsSummary: ReceiptSummary[] = includeAll
      ? await this.db
          .select({
            id: purchaseOrderReceipts.id,
            receiptNumber: purchaseOrderReceipts.receiptNumber,
            receiptDate: purchaseOrderReceipts.receiptDate,
            status: purchaseOrderReceipts.status,
            totalReceivedValue: purchaseOrderReceipts.totalReceivedValue,
          })
          .from(purchaseOrderReceipts)
          .where(eq(purchaseOrderReceipts.purchaseOrderId, po.id))
          .orderBy(desc(purchaseOrderReceipts.receiptDate))
      : [];

    // Get approval history
    const approvalHistory = includeAll
      ? await this.db
          .select()
          .from(purchaseOrderApprovalHistory)
          .where(eq(purchaseOrderApprovalHistory.purchaseOrderId, po.id))
          .orderBy(desc(purchaseOrderApprovalHistory.performedAt))
      : [];

    return {
      id: po.id,
      organizationId: po.organizationId,
      subsidiaryId: po.subsidiaryId,
      poNumber: po.poNumber,
      vendorId: po.vendorId,
      vendor: vendor[0] ? { id: vendor[0].id, name: vendor[0].name } : undefined,
      vendorName: po.vendorName || undefined,
      orderDate: po.orderDate,
      expectedDeliveryDate: po.expectedDeliveryDate || undefined,
      status: po.status as PurchaseOrderStatusValue,
      subtotal: po.subtotal,
      taxAmount: po.taxAmount,
      shippingAmount: po.shippingAmount,
      totalAmount: po.totalAmount,
      receivedAmount: po.receivedAmount,
      billedAmount: po.billedAmount,
      shipToLocationId: po.shipToLocationId || undefined,
      shippingAddress: po.shippingAddress || undefined,
      shippingMethod: po.shippingMethod || undefined,
      paymentTerms: po.paymentTerms || undefined,
      currencyCode: po.currencyCode || 'USD',
      exchangeRate: po.exchangeRate || '1',
      currentApproverId: po.currentApproverId || undefined,
      approvedAt: po.approvedAt?.toISOString(),
      approvedBy: po.approvedBy || undefined,
      memo: po.memo || undefined,
      internalNotes: po.internalNotes || undefined,
      createdBy: po.createdBy,
      createdAt: po.createdAt.toISOString(),
      updatedBy: po.updatedBy || undefined,
      updatedAt: po.updatedAt.toISOString(),
      closedAt: po.closedAt?.toISOString(),
      cancelledAt: po.cancelledAt?.toISOString(),
      cancellationReason: po.cancellationReason || undefined,
      lines: lines.map(line => ({
        id: line.id,
        purchaseOrderId: line.purchaseOrderId,
        lineNumber: line.lineNumber,
        itemId: line.itemId || undefined,
        itemName: line.itemName,
        itemDescription: line.itemDescription || undefined,
        quantity: line.quantity,
        unitOfMeasure: line.unitOfMeasure || undefined,
        unitPrice: line.unitPrice,
        amount: line.amount,
        taxAmount: line.taxAmount,
        quantityReceived: line.quantityReceived,
        quantityBilled: line.quantityBilled,
        accountId: line.accountId || undefined,
        departmentId: line.departmentId || undefined,
        locationId: line.locationId || undefined,
        classId: line.classId || undefined,
        projectId: line.projectId || undefined,
        expectedDeliveryDate: line.expectedDeliveryDate || undefined,
        memo: line.memo || undefined,
        isClosed: line.isClosed,
        createdAt: line.createdAt.toISOString(),
        updatedAt: line.updatedAt.toISOString(),
      })),
      receipts: receiptsSummary,
      approvalHistory: approvalHistory.map(ah => ({
        id: ah.id,
        purchaseOrderId: ah.purchaseOrderId,
        action: ah.action as POApprovalActionTypeValue,
        performedBy: ah.performedBy,
        performedByName: ah.performedByName || undefined,
        fromStatus: ah.fromStatus as PurchaseOrderStatusValue | undefined,
        toStatus: ah.toStatus as PurchaseOrderStatusValue,
        comments: ah.comments || undefined,
        performedAt: ah.performedAt.toISOString(),
      })),
    };
  }

  private async enrichReceiptWithDetails(
    receipt: typeof purchaseOrderReceipts.$inferSelect
  ): Promise<ReceiptWithDetails> {
    // Get PO info
    const po = await this.db
      .select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber, vendorId: purchaseOrders.vendorId })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, receipt.purchaseOrderId))
      .limit(1);

    // Get vendor
    const vendor = await this.db
      .select({ id: entities.id, name: entities.name })
      .from(entities)
      .where(eq(entities.id, receipt.vendorId))
      .limit(1);

    // Get location
    const location = receipt.locationId
      ? await this.db
          .select({ id: locations.id, name: locations.name })
          .from(locations)
          .where(eq(locations.id, receipt.locationId))
          .limit(1)
      : [];

    // Get lines
    const lines = await this.db
      .select()
      .from(purchaseOrderReceiptLines)
      .where(eq(purchaseOrderReceiptLines.receiptId, receipt.id))
      .orderBy(asc(purchaseOrderReceiptLines.lineNumber));

    return {
      id: receipt.id,
      organizationId: receipt.organizationId,
      subsidiaryId: receipt.subsidiaryId,
      receiptNumber: receipt.receiptNumber,
      purchaseOrderId: receipt.purchaseOrderId,
      purchaseOrder: po[0]
        ? { id: po[0].id, poNumber: po[0].poNumber, vendorId: po[0].vendorId }
        : undefined,
      vendorId: receipt.vendorId,
      vendor: vendor[0] ? { id: vendor[0].id, name: vendor[0].name } : undefined,
      receiptDate: receipt.receiptDate,
      status: receipt.status as ReceiptStatusValue,
      locationId: receipt.locationId || undefined,
      location: location[0] ? { id: location[0].id, name: location[0].name } : undefined,
      totalReceivedValue: receipt.totalReceivedValue,
      memo: receipt.memo || undefined,
      shippingRef: receipt.shippingRef || undefined,
      carrierName: receipt.carrierName || undefined,
      createdBy: receipt.createdBy,
      createdAt: receipt.createdAt.toISOString(),
      updatedAt: receipt.updatedAt.toISOString(),
      postedAt: receipt.postedAt?.toISOString(),
      postedBy: receipt.postedBy || undefined,
      cancelledAt: receipt.cancelledAt?.toISOString(),
      lines: lines.map(line => ({
        id: line.id,
        receiptId: line.receiptId,
        purchaseOrderLineId: line.purchaseOrderLineId,
        lineNumber: line.lineNumber,
        itemId: line.itemId || undefined,
        itemName: line.itemName,
        quantityReceived: line.quantityReceived,
        unitOfMeasure: line.unitOfMeasure || undefined,
        unitCost: line.unitCost,
        receivedValue: line.receivedValue,
        quantityAccepted: line.quantityAccepted || undefined,
        quantityRejected: line.quantityRejected || undefined,
        rejectionReason: line.rejectionReason || undefined,
        binLocation: line.binLocation || undefined,
        lotNumber: line.lotNumber || undefined,
        serialNumbers: line.serialNumbers ? JSON.parse(line.serialNumbers) : undefined,
        memo: line.memo || undefined,
        createdAt: line.createdAt.toISOString(),
        updatedAt: line.updatedAt.toISOString(),
      })),
    };
  }

  private toDateString(date: string | Date): string {
    if (typeof date === 'string') {
      return date.split('T')[0];
    }
    return date.toISOString().split('T')[0];
  }
}
