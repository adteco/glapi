/**
 * Sales Order Hybrid Service
 *
 * Manages sales orders using the hybrid transaction model.
 * Uses transaction_headers + transaction_lines with sales_order_ext + sales_order_line_ext.
 */

import { BaseTransactionService } from './base-transaction-service';
import { ServiceContext, ServiceError, PaginatedResult, PaginationParams } from '../types';
import {
  TransactionTypeCode,
  TransactionTypeCodeValue,
  TransactionFilters,
  CreateTransactionLineInput,
} from '../types/transaction.types';
import { EventCategoryType } from '@glapi/database';
import { db } from '@glapi/database';
import {
  transactionHeaders,
  transactionLines,
  TransactionHeader,
  TransactionLine,
  salesOrderExt,
  salesOrderLineExt,
  SalesOrderExtRecord,
  SalesOrderLineExtRecord,
  NewSalesOrderExtRecord,
  NewSalesOrderLineExtRecord,
  salesOrderApprovalHistory2,
  HybridSalesOrderStatus,
  HybridSalesOrderStatusValue,
  invoiceExt,
  entities,
} from '@glapi/database/schema';
import { eq, and, desc, asc, sql, inArray, gte, lte, or, ilike } from 'drizzle-orm';
import Decimal from 'decimal.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SalesOrderHeader {
  id: string;
  organizationId: string;
  subsidiaryId: string;
  transactionType: TransactionTypeCodeValue;
  transactionNumber: string;
  customerId: string;
  customerName?: string;
  orderDate: string;
  status: HybridSalesOrderStatusValue;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  currencyCode: string;
  exchangeRate: string;
  memo?: string;
  internalNotes?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface SalesOrderExtension {
  externalReference?: string;
  billingAddressId?: string;
  shippingAddressId?: string;
  requestedDeliveryDate?: string;
  promisedDeliveryDate?: string;
  expirationDate?: string;
  previousStatus?: string;
  discountAmount: string;
  discountPercent: string;
  shippingAmount: string;
  shippingMethod?: string;
  fulfilledAmount: string;
  invoicedAmount: string;
  remainingAmount: string;
  paymentTerms?: string;
  requiresApproval: boolean;
  approvalThreshold?: string;
  currentApproverId?: string;
  approvalLevel: number;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  closedAt?: string;
  closedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
}

export interface SalesOrderLine {
  id: string;
  transactionId: string;
  lineNumber: number;
  itemId?: string;
  itemName: string;
  itemDescription?: string;
  quantity: string;
  unitOfMeasure?: string;
  unitPrice: string;
  amount: string;
  taxAmount: string;
  accountId?: string;
  departmentId?: string;
  locationId?: string;
  classId?: string;
  projectId?: string;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalesOrderLineExtension {
  sku?: string;
  fulfilledQuantity: string;
  invoicedQuantity: string;
  cancelledQuantity: string;
  remainingQuantity: string;
  discountAmount: string;
  discountPercent: string;
  taxCode?: string;
  lineTotal?: string;
  requestedDeliveryDate?: string;
  promisedDeliveryDate?: string;
  revenueAccountId?: string;
  deferredRevenueAccountId?: string;
}

export interface SalesOrderLineWithExtension {
  line: SalesOrderLine;
  extension: SalesOrderLineExtension;
}

export interface SalesOrderWithDetails {
  header: SalesOrderHeader;
  extension: SalesOrderExtension;
  lines: SalesOrderLineWithExtension[];
  approvalHistory: ApprovalHistoryEntry[];
}

export interface ApprovalHistoryEntry {
  id: string;
  salesOrderId: string;
  action: string;
  fromStatus?: string;
  toStatus: string;
  performedBy: string;
  performedAt: string;
  comments?: string;
  approvalLevel?: number;
  nextApproverId?: string;
}

export interface CreateSalesOrderInput {
  subsidiaryId: string;
  customerId: string;
  customerName?: string;
  orderDate: string | Date;
  externalReference?: string;
  billingAddressId?: string;
  shippingAddressId?: string;
  requestedDeliveryDate?: string | Date;
  promisedDeliveryDate?: string | Date;
  expirationDate?: string | Date;
  discountAmount?: number;
  discountPercent?: number;
  shippingAmount?: number;
  shippingMethod?: string;
  paymentTerms?: string;
  currencyCode?: string;
  exchangeRate?: number;
  memo?: string;
  internalNotes?: string;
  requiresApproval?: boolean;
  approvalThreshold?: number;
  lines: CreateSalesOrderLineInput[];
}

export interface CreateSalesOrderLineInput extends CreateTransactionLineInput {
  sku?: string;
  discountAmount?: number;
  discountPercent?: number;
  taxCode?: string;
  requestedDeliveryDate?: string | Date;
  promisedDeliveryDate?: string | Date;
  revenueAccountId?: string;
  deferredRevenueAccountId?: string;
}

export interface UpdateSalesOrderInput {
  orderDate?: string | Date;
  externalReference?: string;
  billingAddressId?: string;
  shippingAddressId?: string;
  requestedDeliveryDate?: string | Date;
  promisedDeliveryDate?: string | Date;
  expirationDate?: string | Date;
  discountAmount?: number;
  discountPercent?: number;
  shippingAmount?: number;
  shippingMethod?: string;
  paymentTerms?: string;
  currencyCode?: string;
  exchangeRate?: number;
  memo?: string;
  internalNotes?: string;
}

export interface SalesOrderFilters extends TransactionFilters {
  requiresApproval?: boolean;
  pendingApproval?: boolean;
  externalReference?: string;
}

// ============================================================================
// STATUS TRANSITIONS
// ============================================================================

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  [HybridSalesOrderStatus.DRAFT]: [
    HybridSalesOrderStatus.PENDING_APPROVAL,
    HybridSalesOrderStatus.APPROVED,
    HybridSalesOrderStatus.CANCELLED,
  ],
  [HybridSalesOrderStatus.PENDING_APPROVAL]: [
    HybridSalesOrderStatus.APPROVED,
    HybridSalesOrderStatus.DRAFT, // Return for revision
    HybridSalesOrderStatus.CANCELLED,
  ],
  [HybridSalesOrderStatus.APPROVED]: [
    HybridSalesOrderStatus.PARTIALLY_FULFILLED,
    HybridSalesOrderStatus.FULFILLED,
    HybridSalesOrderStatus.CANCELLED,
    HybridSalesOrderStatus.CLOSED,
  ],
  [HybridSalesOrderStatus.PARTIALLY_FULFILLED]: [
    HybridSalesOrderStatus.FULFILLED,
    HybridSalesOrderStatus.PARTIALLY_INVOICED,
    HybridSalesOrderStatus.CLOSED,
  ],
  [HybridSalesOrderStatus.FULFILLED]: [
    HybridSalesOrderStatus.PARTIALLY_INVOICED,
    HybridSalesOrderStatus.INVOICED,
    HybridSalesOrderStatus.CLOSED,
  ],
  [HybridSalesOrderStatus.PARTIALLY_INVOICED]: [
    HybridSalesOrderStatus.INVOICED,
    HybridSalesOrderStatus.CLOSED,
  ],
  [HybridSalesOrderStatus.INVOICED]: [HybridSalesOrderStatus.CLOSED],
  [HybridSalesOrderStatus.CLOSED]: [],
  [HybridSalesOrderStatus.CANCELLED]: [],
};

// Approval action types
const ApprovalAction = {
  SUBMIT: 'SUBMIT',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  RETURN_FOR_REVISION: 'RETURN_FOR_REVISION',
  CANCEL: 'CANCEL',
} as const;

// ============================================================================
// SERVICE
// ============================================================================

export class SalesOrderHybridService extends BaseTransactionService {
  protected transactionType = TransactionTypeCode.SALES_ORDER;
  protected eventCategory: EventCategoryType = 'TRANSACTION';

  constructor(context: ServiceContext = {}) {
    super(context);
  }

  // ==========================================================================
  // LIST OPERATIONS
  // ==========================================================================

  /**
   * List sales orders with filters
   */
  async listSalesOrders(
    params: PaginationParams = {},
    filters: SalesOrderFilters = {}
  ): Promise<PaginatedResult<SalesOrderWithDetails>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(params);

    // Build where conditions
    const headerConditions = [
      eq(transactionHeaders.organizationId, organizationId),
      eq(transactionHeaders.transactionType, this.transactionType),
    ];

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        headerConditions.push(inArray(transactionHeaders.status, filters.status));
      } else {
        headerConditions.push(eq(transactionHeaders.status, filters.status));
      }
    }

    if (filters.entityId) {
      headerConditions.push(eq(transactionHeaders.entityId, filters.entityId));
    }

    if (filters.subsidiaryId) {
      headerConditions.push(eq(transactionHeaders.subsidiaryId, filters.subsidiaryId));
    }

    if (filters.dateFrom) {
      const dateFrom = this.toDateString(filters.dateFrom);
      headerConditions.push(gte(transactionHeaders.transactionDate, dateFrom));
    }

    if (filters.dateTo) {
      const dateTo = this.toDateString(filters.dateTo);
      headerConditions.push(lte(transactionHeaders.transactionDate, dateTo));
    }

    if (filters.search) {
      headerConditions.push(
        or(
          ilike(transactionHeaders.transactionNumber, `%${filters.search}%`),
          ilike(transactionHeaders.entityName, `%${filters.search}%`),
          ilike(transactionHeaders.memo, `%${filters.search}%`)
        )!
      );
    }

    if (filters.pendingApproval) {
      headerConditions.push(eq(transactionHeaders.status, HybridSalesOrderStatus.PENDING_APPROVAL));
    }

    // Count total
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactionHeaders)
      .where(and(...headerConditions));
    const total = Number(countResult[0]?.count || 0);

    // Fetch headers with extension
    const results = await db
      .select({
        header: transactionHeaders,
        extension: salesOrderExt,
      })
      .from(transactionHeaders)
      .innerJoin(salesOrderExt, eq(transactionHeaders.id, salesOrderExt.transactionId))
      .where(and(...headerConditions))
      .orderBy(desc(transactionHeaders.createdAt))
      .limit(take)
      .offset(skip);

    // Apply additional filters
    let orders = results;

    if (filters.requiresApproval !== undefined) {
      orders = orders.filter((o) => o.extension.requiresApproval === filters.requiresApproval);
    }

    // Fetch lines and approval history for each order
    const data = await Promise.all(
      orders.map(async (o) => {
        const lines = await this.getLinesWithExtension(o.header.id);
        const history = await this.getApprovalHistory(o.header.id);
        return this.transformToResponse(o.header, o.extension, lines, history);
      })
    );

    return this.createPaginatedResult(data, total, page, limit);
  }

  // ==========================================================================
  // GET OPERATIONS
  // ==========================================================================

  /**
   * Get a sales order by ID
   */
  async getSalesOrderById(id: string): Promise<SalesOrderWithDetails> {
    const organizationId = this.requireOrganizationContext();

    const [result] = await db
      .select({
        header: transactionHeaders,
        extension: salesOrderExt,
      })
      .from(transactionHeaders)
      .innerJoin(salesOrderExt, eq(transactionHeaders.id, salesOrderExt.transactionId))
      .where(
        and(
          eq(transactionHeaders.id, id),
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.transactionType, this.transactionType)
        )
      )
      .limit(1);

    if (!result) {
      throw new ServiceError('Sales order not found', 'NOT_FOUND', 404);
    }

    const lines = await this.getLinesWithExtension(id);
    const history = await this.getApprovalHistory(id);

    return this.transformToResponse(result.header, result.extension, lines, history);
  }

  /**
   * Get a sales order by transaction number
   */
  async getSalesOrderByNumber(transactionNumber: string): Promise<SalesOrderWithDetails> {
    const organizationId = this.requireOrganizationContext();

    const [result] = await db
      .select({
        header: transactionHeaders,
        extension: salesOrderExt,
      })
      .from(transactionHeaders)
      .innerJoin(salesOrderExt, eq(transactionHeaders.id, salesOrderExt.transactionId))
      .where(
        and(
          eq(transactionHeaders.transactionNumber, transactionNumber),
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.transactionType, this.transactionType)
        )
      )
      .limit(1);

    if (!result) {
      throw new ServiceError('Sales order not found', 'NOT_FOUND', 404);
    }

    const lines = await this.getLinesWithExtension(result.header.id);
    const history = await this.getApprovalHistory(result.header.id);

    return this.transformToResponse(result.header, result.extension, lines, history);
  }

  // ==========================================================================
  // CREATE OPERATIONS
  // ==========================================================================

  /**
   * Create a new sales order
   */
  async createSalesOrder(input: CreateSalesOrderInput): Promise<SalesOrderWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Generate transaction number
    const transactionNumber = await this.generateTransactionNumber();

    // Calculate line totals
    const { lines, subtotal, taxTotal, totalAmount } = this.calculateLineTotals(input.lines);

    // Calculate order-level totals
    const discountAmount = new Decimal(input.discountAmount || 0);
    const shippingAmount = new Decimal(input.shippingAmount || 0);
    const finalTotal = new Decimal(totalAmount).minus(discountAmount).plus(shippingAmount);

    // Determine if approval is required
    const requiresApproval = input.requiresApproval ||
      (input.approvalThreshold && finalTotal.greaterThanOrEqualTo(input.approvalThreshold));

    // Get customer name if not provided
    let customerName = input.customerName;
    if (!customerName) {
      const [customer] = await db
        .select({ name: entities.name })
        .from(entities)
        .where(eq(entities.id, input.customerId))
        .limit(1);
      customerName = customer?.name;
    }

    // Create header
    const header = await this.createHeader({
      subsidiaryId: input.subsidiaryId,
      transactionType: this.transactionType,
      transactionNumber,
      entityId: input.customerId,
      entityName: customerName,
      transactionDate: this.toDateString(input.orderDate),
      status: HybridSalesOrderStatus.DRAFT,
      subtotal: subtotal.toFixed(4),
      taxAmount: taxTotal.toFixed(4),
      totalAmount: finalTotal.toFixed(4),
      currencyCode: input.currencyCode || 'USD',
      exchangeRate: String(input.exchangeRate || 1),
      memo: input.memo,
      internalNotes: input.internalNotes,
      createdBy: userId,
    });

    // Create extension
    await db.insert(salesOrderExt).values({
      transactionId: header.id,
      externalReference: input.externalReference,
      billingAddressId: input.billingAddressId,
      shippingAddressId: input.shippingAddressId,
      requestedDeliveryDate: input.requestedDeliveryDate
        ? this.toDateString(input.requestedDeliveryDate)
        : null,
      promisedDeliveryDate: input.promisedDeliveryDate
        ? this.toDateString(input.promisedDeliveryDate)
        : null,
      expirationDate: input.expirationDate
        ? this.toDateString(input.expirationDate)
        : null,
      discountAmount: discountAmount.toFixed(4),
      discountPercent: String(input.discountPercent || 0),
      shippingAmount: shippingAmount.toFixed(4),
      shippingMethod: input.shippingMethod,
      fulfilledAmount: '0',
      invoicedAmount: '0',
      remainingAmount: finalTotal.toFixed(4),
      paymentTerms: input.paymentTerms,
      requiresApproval: requiresApproval || false,
      approvalThreshold: input.approvalThreshold ? String(input.approvalThreshold) : null,
      approvalLevel: 0,
    });

    // Create lines with extensions
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const originalLine = input.lines[i];

      // Create core line
      const [createdLine] = await db
        .insert(transactionLines)
        .values({
          transactionId: header.id,
          lineNumber: line.lineNumber || i + 1,
          itemId: line.itemId,
          itemName: line.itemName,
          itemDescription: line.itemDescription,
          quantity: String(line.quantity),
          unitOfMeasure: line.unitOfMeasure,
          unitPrice: String(line.unitPrice),
          amount: String(line.amount),
          taxAmount: String(line.taxAmount || 0),
          accountId: line.accountId,
          departmentId: line.departmentId,
          locationId: line.locationId,
          classId: line.classId,
          projectId: line.projectId,
          memo: line.memo,
        })
        .returning();

      // Create line extension
      const lineDiscount = new Decimal(originalLine.discountAmount || 0);
      const lineDiscountPercent = originalLine.discountPercent || 0;
      let lineTotal = new Decimal(line.amount);
      if (lineDiscount.greaterThan(0)) {
        lineTotal = lineTotal.minus(lineDiscount);
      } else if (lineDiscountPercent > 0) {
        lineTotal = lineTotal.times(1 - lineDiscountPercent / 100);
      }

      await db.insert(salesOrderLineExt).values({
        lineId: createdLine.id,
        sku: originalLine.sku,
        fulfilledQuantity: '0',
        invoicedQuantity: '0',
        cancelledQuantity: '0',
        remainingQuantity: String(line.quantity),
        discountAmount: lineDiscount.toFixed(4),
        discountPercent: String(lineDiscountPercent),
        taxCode: originalLine.taxCode,
        lineTotal: lineTotal.toFixed(4),
        requestedDeliveryDate: originalLine.requestedDeliveryDate
          ? this.toDateString(originalLine.requestedDeliveryDate)
          : null,
        promisedDeliveryDate: originalLine.promisedDeliveryDate
          ? this.toDateString(originalLine.promisedDeliveryDate)
          : null,
        revenueAccountId: originalLine.revenueAccountId,
        deferredRevenueAccountId: originalLine.deferredRevenueAccountId,
      });
    }

    // Emit event
    await this.emitEvent('SALES_ORDER_CREATED', header.id, {
      orderNumber: transactionNumber,
      customerId: input.customerId,
      totalAmount: finalTotal.toNumber(),
      lineCount: lines.length,
    });

    return this.getSalesOrderById(header.id);
  }

  // ==========================================================================
  // UPDATE OPERATIONS
  // ==========================================================================

  /**
   * Update a sales order (only in DRAFT status)
   */
  async updateSalesOrder(
    id: string,
    input: UpdateSalesOrderInput
  ): Promise<SalesOrderWithDetails> {
    const order = await this.getSalesOrderById(id);

    if (order.header.status !== HybridSalesOrderStatus.DRAFT) {
      throw new ServiceError(
        'Can only update sales orders in DRAFT status',
        'INVALID_STATUS',
        400
      );
    }

    // Update header
    const headerUpdates: Record<string, unknown> = {};
    if (input.orderDate) {
      headerUpdates.transactionDate = this.toDateString(input.orderDate);
    }
    if (input.currencyCode) {
      headerUpdates.currencyCode = input.currencyCode;
    }
    if (input.exchangeRate !== undefined) {
      headerUpdates.exchangeRate = String(input.exchangeRate);
    }
    if (input.memo !== undefined) {
      headerUpdates.memo = input.memo;
    }
    if (input.internalNotes !== undefined) {
      headerUpdates.internalNotes = input.internalNotes;
    }

    if (Object.keys(headerUpdates).length > 0) {
      await this.updateHeader(id, headerUpdates);
    }

    // Update extension
    const extUpdates: Partial<NewSalesOrderExtRecord> = {};
    if (input.externalReference !== undefined) {
      extUpdates.externalReference = input.externalReference;
    }
    if (input.billingAddressId !== undefined) {
      extUpdates.billingAddressId = input.billingAddressId;
    }
    if (input.shippingAddressId !== undefined) {
      extUpdates.shippingAddressId = input.shippingAddressId;
    }
    if (input.requestedDeliveryDate !== undefined) {
      extUpdates.requestedDeliveryDate = input.requestedDeliveryDate
        ? this.toDateString(input.requestedDeliveryDate)
        : null;
    }
    if (input.promisedDeliveryDate !== undefined) {
      extUpdates.promisedDeliveryDate = input.promisedDeliveryDate
        ? this.toDateString(input.promisedDeliveryDate)
        : null;
    }
    if (input.expirationDate !== undefined) {
      extUpdates.expirationDate = input.expirationDate
        ? this.toDateString(input.expirationDate)
        : null;
    }
    if (input.discountAmount !== undefined) {
      extUpdates.discountAmount = String(input.discountAmount);
    }
    if (input.discountPercent !== undefined) {
      extUpdates.discountPercent = String(input.discountPercent);
    }
    if (input.shippingAmount !== undefined) {
      extUpdates.shippingAmount = String(input.shippingAmount);
    }
    if (input.shippingMethod !== undefined) {
      extUpdates.shippingMethod = input.shippingMethod;
    }
    if (input.paymentTerms !== undefined) {
      extUpdates.paymentTerms = input.paymentTerms;
    }

    if (Object.keys(extUpdates).length > 0) {
      await db
        .update(salesOrderExt)
        .set(extUpdates)
        .where(eq(salesOrderExt.transactionId, id));
    }

    return this.getSalesOrderById(id);
  }

  // ==========================================================================
  // APPROVAL WORKFLOW
  // ==========================================================================

  /**
   * Submit sales order for approval
   */
  async submitForApproval(id: string): Promise<SalesOrderWithDetails> {
    const userId = this.requireUserContext();
    const order = await this.getSalesOrderById(id);

    this.validateStatusTransition(
      order.header.status,
      HybridSalesOrderStatus.PENDING_APPROVAL,
      VALID_STATUS_TRANSITIONS
    );

    // Update header status
    await this.updateStatus(id, HybridSalesOrderStatus.PENDING_APPROVAL);

    // Update extension
    await db
      .update(salesOrderExt)
      .set({
        previousStatus: order.header.status,
        submittedAt: new Date(),
      })
      .where(eq(salesOrderExt.transactionId, id));

    // Record approval history
    await this.recordApprovalAction(id, {
      action: ApprovalAction.SUBMIT,
      fromStatus: order.header.status,
      toStatus: HybridSalesOrderStatus.PENDING_APPROVAL,
      performedBy: userId,
    });

    // Emit event
    await this.emitEvent('SALES_ORDER_SUBMITTED', id, {
      orderNumber: order.header.transactionNumber,
      submittedBy: userId,
    });

    return this.getSalesOrderById(id);
  }

  /**
   * Approve a sales order
   */
  async approveSalesOrder(id: string, comments?: string): Promise<SalesOrderWithDetails> {
    const userId = this.requireUserContext();
    const order = await this.getSalesOrderById(id);

    this.validateStatusTransition(
      order.header.status,
      HybridSalesOrderStatus.APPROVED,
      VALID_STATUS_TRANSITIONS
    );

    // Update header status
    await this.updateStatus(id, HybridSalesOrderStatus.APPROVED);

    // Update extension
    await db
      .update(salesOrderExt)
      .set({
        previousStatus: order.header.status,
        approvedAt: new Date(),
        approvedBy: userId,
      })
      .where(eq(salesOrderExt.transactionId, id));

    // Record approval history
    await this.recordApprovalAction(id, {
      action: ApprovalAction.APPROVE,
      fromStatus: order.header.status,
      toStatus: HybridSalesOrderStatus.APPROVED,
      performedBy: userId,
      comments,
    });

    // Emit event
    await this.emitEvent('SALES_ORDER_APPROVED', id, {
      orderNumber: order.header.transactionNumber,
      approvedBy: userId,
    });

    return this.getSalesOrderById(id);
  }

  /**
   * Reject a sales order
   */
  async rejectSalesOrder(id: string, reason: string): Promise<SalesOrderWithDetails> {
    const userId = this.requireUserContext();
    const order = await this.getSalesOrderById(id);

    // Return to DRAFT status on rejection
    this.validateStatusTransition(
      order.header.status,
      HybridSalesOrderStatus.DRAFT,
      VALID_STATUS_TRANSITIONS
    );

    // Update header status
    await this.updateStatus(id, HybridSalesOrderStatus.DRAFT);

    // Update extension
    await db
      .update(salesOrderExt)
      .set({
        previousStatus: order.header.status,
      })
      .where(eq(salesOrderExt.transactionId, id));

    // Record approval history
    await this.recordApprovalAction(id, {
      action: ApprovalAction.REJECT,
      fromStatus: order.header.status,
      toStatus: HybridSalesOrderStatus.DRAFT,
      performedBy: userId,
      comments: reason,
    });

    // Emit event
    await this.emitEvent('SALES_ORDER_REJECTED', id, {
      orderNumber: order.header.transactionNumber,
      rejectedBy: userId,
      reason,
    });

    return this.getSalesOrderById(id);
  }

  /**
   * Cancel a sales order
   */
  async cancelSalesOrder(id: string, reason: string): Promise<SalesOrderWithDetails> {
    const userId = this.requireUserContext();
    const order = await this.getSalesOrderById(id);

    this.validateStatusTransition(
      order.header.status,
      HybridSalesOrderStatus.CANCELLED,
      VALID_STATUS_TRANSITIONS
    );

    // Update header status
    await this.updateStatus(id, HybridSalesOrderStatus.CANCELLED);

    // Update extension
    await db
      .update(salesOrderExt)
      .set({
        previousStatus: order.header.status,
        cancelledAt: new Date(),
        cancelledBy: userId,
        cancellationReason: reason,
      })
      .where(eq(salesOrderExt.transactionId, id));

    // Record approval history
    await this.recordApprovalAction(id, {
      action: ApprovalAction.CANCEL,
      fromStatus: order.header.status,
      toStatus: HybridSalesOrderStatus.CANCELLED,
      performedBy: userId,
      comments: reason,
    });

    // Emit event
    await this.emitEvent('SALES_ORDER_CANCELLED', id, {
      orderNumber: order.header.transactionNumber,
      cancelledBy: userId,
      reason,
    });

    return this.getSalesOrderById(id);
  }

  /**
   * Close a completed sales order
   */
  async closeSalesOrder(id: string): Promise<SalesOrderWithDetails> {
    const userId = this.requireUserContext();
    const order = await this.getSalesOrderById(id);

    this.validateStatusTransition(
      order.header.status,
      HybridSalesOrderStatus.CLOSED,
      VALID_STATUS_TRANSITIONS
    );

    // Update header status
    await this.updateStatus(id, HybridSalesOrderStatus.CLOSED);

    // Update extension
    await db
      .update(salesOrderExt)
      .set({
        previousStatus: order.header.status,
        closedAt: new Date(),
        closedBy: userId,
      })
      .where(eq(salesOrderExt.transactionId, id));

    // Emit event
    await this.emitEvent('SALES_ORDER_CLOSED', id, {
      orderNumber: order.header.transactionNumber,
      closedBy: userId,
    });

    return this.getSalesOrderById(id);
  }

  // ==========================================================================
  // FULFILLMENT TRACKING
  // ==========================================================================

  /**
   * Update line fulfillment quantities
   */
  async updateLineFulfillment(
    salesOrderId: string,
    lineId: string,
    fulfilledQuantity: number
  ): Promise<SalesOrderWithDetails> {
    const userId = this.requireUserContext();
    const order = await this.getSalesOrderById(salesOrderId);

    // Find the line
    const lineData = order.lines.find((l) => l.line.id === lineId);
    if (!lineData) {
      throw new ServiceError('Line not found', 'NOT_FOUND', 404);
    }

    // Calculate new quantities
    const newFulfilled = new Decimal(fulfilledQuantity);
    const originalQty = new Decimal(lineData.line.quantity);
    const invoicedQty = new Decimal(lineData.extension.invoicedQuantity);
    const cancelledQty = new Decimal(lineData.extension.cancelledQuantity);
    const newRemaining = originalQty.minus(newFulfilled).minus(invoicedQty).minus(cancelledQty);

    // Update line extension
    await db
      .update(salesOrderLineExt)
      .set({
        fulfilledQuantity: newFulfilled.toFixed(4),
        remainingQuantity: Decimal.max(newRemaining, 0).toFixed(4),
      })
      .where(eq(salesOrderLineExt.lineId, lineId));

    // Recalculate order fulfillment totals
    await this.recalculateFulfillmentTotals(salesOrderId);

    return this.getSalesOrderById(salesOrderId);
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  /**
   * Get lines with their extensions
   */
  private async getLinesWithExtension(
    transactionId: string
  ): Promise<Array<{ line: TransactionLine; extension: SalesOrderLineExtRecord }>> {
    const results = await db
      .select({
        line: transactionLines,
        extension: salesOrderLineExt,
      })
      .from(transactionLines)
      .innerJoin(salesOrderLineExt, eq(transactionLines.id, salesOrderLineExt.lineId))
      .where(eq(transactionLines.transactionId, transactionId))
      .orderBy(asc(transactionLines.lineNumber));

    return results;
  }

  /**
   * Get approval history for a sales order
   */
  private async getApprovalHistory(salesOrderId: string): Promise<ApprovalHistoryEntry[]> {
    const history = await db
      .select()
      .from(salesOrderApprovalHistory2)
      .where(eq(salesOrderApprovalHistory2.salesOrderId, salesOrderId))
      .orderBy(desc(salesOrderApprovalHistory2.performedAt));

    return history.map((h) => ({
      id: h.id,
      salesOrderId: h.salesOrderId,
      action: h.action,
      fromStatus: h.fromStatus || undefined,
      toStatus: h.toStatus || '',
      performedBy: h.performedBy,
      performedAt: h.performedAt.toISOString(),
      comments: h.comments || undefined,
      approvalLevel: h.approvalLevel || undefined,
      nextApproverId: h.nextApproverId || undefined,
    }));
  }

  /**
   * Record an approval action
   */
  private async recordApprovalAction(
    salesOrderId: string,
    data: {
      action: string;
      fromStatus: string;
      toStatus: string;
      performedBy: string;
      comments?: string;
      approvalLevel?: number;
      nextApproverId?: string;
    }
  ): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    await db.insert(salesOrderApprovalHistory2).values({
      organizationId,
      salesOrderId,
      action: data.action,
      fromStatus: data.fromStatus,
      toStatus: data.toStatus,
      performedBy: data.performedBy,
      comments: data.comments,
      approvalLevel: data.approvalLevel,
      nextApproverId: data.nextApproverId,
    });
  }

  /**
   * Recalculate fulfillment totals for an order
   */
  private async recalculateFulfillmentTotals(salesOrderId: string): Promise<void> {
    const lines = await this.getLinesWithExtension(salesOrderId);

    let totalFulfilled = new Decimal(0);
    let allFulfilled = true;
    let anyFulfilled = false;

    for (const { line, extension } of lines) {
      const qty = new Decimal(line.quantity);
      const fulfilled = new Decimal(extension.fulfilledQuantity || 0);
      const unitPrice = new Decimal(line.unitPrice);

      totalFulfilled = totalFulfilled.plus(fulfilled.times(unitPrice));

      if (fulfilled.greaterThan(0)) {
        anyFulfilled = true;
      }
      if (fulfilled.lessThan(qty)) {
        allFulfilled = false;
      }
    }

    // Update extension
    await db
      .update(salesOrderExt)
      .set({
        fulfilledAmount: totalFulfilled.toFixed(4),
      })
      .where(eq(salesOrderExt.transactionId, salesOrderId));

    // Update status if needed
    const [currentHeader] = await db
      .select()
      .from(transactionHeaders)
      .where(eq(transactionHeaders.id, salesOrderId))
      .limit(1);

    if (currentHeader &&
        (currentHeader.status === HybridSalesOrderStatus.APPROVED ||
         currentHeader.status === HybridSalesOrderStatus.PARTIALLY_FULFILLED)) {
      let newStatus: HybridSalesOrderStatusValue;
      if (allFulfilled) {
        newStatus = HybridSalesOrderStatus.FULFILLED;
      } else if (anyFulfilled) {
        newStatus = HybridSalesOrderStatus.PARTIALLY_FULFILLED;
      } else {
        return; // No change needed
      }

      if (newStatus !== currentHeader.status) {
        await this.updateStatus(salesOrderId, newStatus);
        await db
          .update(salesOrderExt)
          .set({ previousStatus: currentHeader.status })
          .where(eq(salesOrderExt.transactionId, salesOrderId));
      }
    }
  }

  /**
   * Transform database records to response format
   */
  private transformToResponse(
    header: TransactionHeader,
    extension: SalesOrderExtRecord,
    lines: Array<{ line: TransactionLine; extension: SalesOrderLineExtRecord }>,
    approvalHistory: ApprovalHistoryEntry[]
  ): SalesOrderWithDetails {
    return {
      header: {
        id: header.id,
        organizationId: header.organizationId,
        subsidiaryId: header.subsidiaryId,
        transactionType: header.transactionType as TransactionTypeCodeValue,
        transactionNumber: header.transactionNumber,
        customerId: header.entityId,
        customerName: header.entityName || undefined,
        orderDate: header.transactionDate,
        status: header.status as HybridSalesOrderStatusValue,
        subtotal: header.subtotal || '0',
        taxAmount: header.taxAmount || '0',
        totalAmount: header.totalAmount || '0',
        currencyCode: header.currencyCode || 'USD',
        exchangeRate: header.exchangeRate || '1',
        memo: header.memo || undefined,
        internalNotes: header.internalNotes || undefined,
        createdAt: header.createdAt.toISOString(),
        createdBy: header.createdBy,
        updatedAt: header.updatedAt.toISOString(),
        updatedBy: header.updatedBy || undefined,
      },
      extension: {
        externalReference: extension.externalReference || undefined,
        billingAddressId: extension.billingAddressId || undefined,
        shippingAddressId: extension.shippingAddressId || undefined,
        requestedDeliveryDate: extension.requestedDeliveryDate || undefined,
        promisedDeliveryDate: extension.promisedDeliveryDate || undefined,
        expirationDate: extension.expirationDate || undefined,
        previousStatus: extension.previousStatus || undefined,
        discountAmount: extension.discountAmount || '0',
        discountPercent: extension.discountPercent || '0',
        shippingAmount: extension.shippingAmount || '0',
        shippingMethod: extension.shippingMethod || undefined,
        fulfilledAmount: extension.fulfilledAmount || '0',
        invoicedAmount: extension.invoicedAmount || '0',
        remainingAmount: extension.remainingAmount || '0',
        paymentTerms: extension.paymentTerms || undefined,
        requiresApproval: extension.requiresApproval || false,
        approvalThreshold: extension.approvalThreshold || undefined,
        currentApproverId: extension.currentApproverId || undefined,
        approvalLevel: extension.approvalLevel || 0,
        submittedAt: extension.submittedAt?.toISOString() || undefined,
        approvedAt: extension.approvedAt?.toISOString() || undefined,
        approvedBy: extension.approvedBy || undefined,
        closedAt: extension.closedAt?.toISOString() || undefined,
        closedBy: extension.closedBy || undefined,
        cancelledAt: extension.cancelledAt?.toISOString() || undefined,
        cancelledBy: extension.cancelledBy || undefined,
        cancellationReason: extension.cancellationReason || undefined,
      },
      lines: lines.map(({ line, extension: lineExt }) => ({
        line: {
          id: line.id,
          transactionId: line.transactionId,
          lineNumber: line.lineNumber,
          itemId: line.itemId || undefined,
          itemName: line.itemName,
          itemDescription: line.itemDescription || undefined,
          quantity: line.quantity,
          unitOfMeasure: line.unitOfMeasure || undefined,
          unitPrice: line.unitPrice,
          amount: line.amount,
          taxAmount: line.taxAmount || '0',
          accountId: line.accountId || undefined,
          departmentId: line.departmentId || undefined,
          locationId: line.locationId || undefined,
          classId: line.classId || undefined,
          projectId: line.projectId || undefined,
          memo: line.memo || undefined,
          createdAt: line.createdAt.toISOString(),
          updatedAt: line.updatedAt.toISOString(),
        },
        extension: {
          sku: lineExt.sku || undefined,
          fulfilledQuantity: lineExt.fulfilledQuantity || '0',
          invoicedQuantity: lineExt.invoicedQuantity || '0',
          cancelledQuantity: lineExt.cancelledQuantity || '0',
          remainingQuantity: lineExt.remainingQuantity || '0',
          discountAmount: lineExt.discountAmount || '0',
          discountPercent: lineExt.discountPercent || '0',
          taxCode: lineExt.taxCode || undefined,
          lineTotal: lineExt.lineTotal || undefined,
          requestedDeliveryDate: lineExt.requestedDeliveryDate || undefined,
          promisedDeliveryDate: lineExt.promisedDeliveryDate || undefined,
          revenueAccountId: lineExt.revenueAccountId || undefined,
          deferredRevenueAccountId: lineExt.deferredRevenueAccountId || undefined,
        },
      })),
      approvalHistory,
    };
  }
}
