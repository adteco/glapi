import { BaseService } from './base-service';
import { InvoiceService } from './invoice-service';
import { GlPostingEngine } from './gl-posting-engine';
import { AccountingPeriodService } from './accounting-period-service';
import { EventService } from './event-service';
import {
  ServiceContext,
  ServiceError,
  PaginatedResult,
  PaginationParams,
} from '../types';
import {
  CreateSalesOrderInput,
  UpdateSalesOrderInput,
  ApprovalActionInput,
  CreateInvoiceFromOrderInput,
  SalesOrderFilters,
  SalesOrderWithDetails,
  SalesOrderLineWithDetails,
  ApprovalHistoryEntry,
  StatusTransitionResult,
  CreateInvoiceFromOrderResult,
  SalesOrderStatusValue,
  ApprovalActionTypeValue,
} from '../types/sales-orders.types';
import {
  SalesOrderStatus,
  ApprovalActionType,
  VALID_SALES_ORDER_TRANSITIONS,
} from '@glapi/database/schema';
import { db } from '@glapi/database';
import {
  salesOrders,
  salesOrderLines,
  salesOrderApprovalHistory,
  salesOrderInvoices,
} from '@glapi/database/schema';
import { eq, and, desc, asc, sql, inArray, gte, lte, or, ilike } from 'drizzle-orm';

// ============================================================================
// Sales Order Service
// ============================================================================

export class SalesOrderService extends BaseService {
  private invoiceService: InvoiceService;
  private postingEngine: GlPostingEngine;
  private periodService: AccountingPeriodService;
  private eventService: EventService;

  constructor(context: ServiceContext = {}) {
    super(context);
    this.invoiceService = new InvoiceService(context);
    this.postingEngine = new GlPostingEngine(context);
    this.periodService = new AccountingPeriodService(context);
    this.eventService = new EventService(context);
  }

  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  /**
   * List sales orders with filters and pagination
   */
  async listSalesOrders(
    params: PaginationParams = {},
    filters: SalesOrderFilters = {}
  ): Promise<PaginatedResult<SalesOrderWithDetails>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(params);

    // Build where conditions
    const conditions = [eq(salesOrders.organizationId, organizationId)];

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(salesOrders.status, filters.status));
      } else {
        conditions.push(eq(salesOrders.status, filters.status));
      }
    }

    if (filters.entityId) {
      conditions.push(eq(salesOrders.entityId, filters.entityId));
    }

    if (filters.subsidiaryId) {
      conditions.push(eq(salesOrders.subsidiaryId, filters.subsidiaryId));
    }

    if (filters.orderDateFrom) {
      const dateFrom = typeof filters.orderDateFrom === 'string'
        ? filters.orderDateFrom
        : filters.orderDateFrom.toISOString().split('T')[0];
      conditions.push(gte(salesOrders.orderDate, dateFrom));
    }

    if (filters.orderDateTo) {
      const dateTo = typeof filters.orderDateTo === 'string'
        ? filters.orderDateTo
        : filters.orderDateTo.toISOString().split('T')[0];
      conditions.push(lte(salesOrders.orderDate, dateTo));
    }

    if (filters.search) {
      conditions.push(
        or(
          ilike(salesOrders.orderNumber, `%${filters.search}%`),
          ilike(salesOrders.externalReference, `%${filters.search}%`),
          ilike(salesOrders.memo, `%${filters.search}%`)
        )!
      );
    }

    if (filters.requiresApproval !== undefined) {
      conditions.push(eq(salesOrders.requiresApproval, filters.requiresApproval));
    }

    if (filters.pendingApproval) {
      conditions.push(eq(salesOrders.status, SalesOrderStatus.SUBMITTED));
    }

    // Count total
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(salesOrders)
      .where(and(...conditions));
    const total = Number(countResult[0]?.count || 0);

    // Fetch orders
    const orders = await db
      .select()
      .from(salesOrders)
      .where(and(...conditions))
      .orderBy(desc(salesOrders.createdAt))
      .limit(take)
      .offset(skip);

    // Fetch lines for each order
    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => this.enrichOrderWithDetails(order))
    );

    return this.createPaginatedResult(ordersWithDetails, total, page, limit);
  }

  /**
   * Get a single sales order by ID
   */
  async getSalesOrderById(id: string): Promise<SalesOrderWithDetails | null> {
    const organizationId = this.requireOrganizationContext();

    const order = await db
      .select()
      .from(salesOrders)
      .where(and(eq(salesOrders.id, id), eq(salesOrders.organizationId, organizationId)))
      .limit(1);

    if (!order[0]) {
      return null;
    }

    return this.enrichOrderWithDetails(order[0]);
  }

  /**
   * Create a new sales order
   */
  async createSalesOrder(input: CreateSalesOrderInput): Promise<SalesOrderWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Generate order number
    const orderNumber = await this.generateOrderNumber();

    // Calculate line totals and order totals
    const { lines, subtotal, taxTotal } = this.calculateLineTotals(input.lines);

    const discountAmount = Number(input.discountAmount || 0);
    const shippingAmount = Number(input.shippingAmount || 0);
    const totalAmount = subtotal - discountAmount + taxTotal + shippingAmount;

    // Determine if approval is required
    const requiresApproval = input.requiresApproval ||
      (input.approvalThreshold && totalAmount >= Number(input.approvalThreshold));

    // Create order
    const [order] = await db
      .insert(salesOrders)
      .values({
        organizationId,
        subsidiaryId: input.subsidiaryId,
        orderNumber,
        externalReference: input.externalReference,
        entityId: input.entityId,
        billingAddressId: input.billingAddressId,
        shippingAddressId: input.shippingAddressId,
        orderDate: this.toDateString(input.orderDate),
        requestedDeliveryDate: input.requestedDeliveryDate
          ? this.toDateString(input.requestedDeliveryDate)
          : undefined,
        promisedDeliveryDate: input.promisedDeliveryDate
          ? this.toDateString(input.promisedDeliveryDate)
          : undefined,
        expirationDate: input.expirationDate
          ? this.toDateString(input.expirationDate)
          : undefined,
        status: SalesOrderStatus.DRAFT,
        currencyCode: input.currencyCode || 'USD',
        exchangeRate: String(input.exchangeRate || 1),
        subtotal: String(subtotal),
        discountAmount: String(discountAmount),
        discountPercent: String(input.discountPercent || 0),
        taxAmount: String(taxTotal),
        shippingAmount: String(shippingAmount),
        totalAmount: String(totalAmount),
        remainingAmount: String(totalAmount),
        paymentTerms: input.paymentTerms,
        shippingMethod: input.shippingMethod,
        memo: input.memo,
        internalNotes: input.internalNotes,
        metadata: input.metadata,
        requiresApproval: requiresApproval || false,
        approvalThreshold: input.approvalThreshold ? String(input.approvalThreshold) : undefined,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    // Create lines
    await this.createOrderLines(order.id, lines);

    // Emit event
    await this.eventService.emit({
      eventType: 'SalesOrderCreated',
      eventCategory: 'TRANSACTION',
      aggregateType: 'SalesOrder',
      aggregateId: order.id,
      data: {
        orderNumber,
        entityId: input.entityId,
        totalAmount,
        status: SalesOrderStatus.DRAFT,
      },
    });

    return this.getSalesOrderById(order.id) as Promise<SalesOrderWithDetails>;
  }

  /**
   * Update a sales order (only allowed in DRAFT or REJECTED status)
   */
  async updateSalesOrder(
    id: string,
    input: UpdateSalesOrderInput
  ): Promise<SalesOrderWithDetails | null> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const existingOrder = await this.getSalesOrderById(id);
    if (!existingOrder) {
      return null;
    }

    // Only allow updates in DRAFT or REJECTED status
    if (
      existingOrder.status !== SalesOrderStatus.DRAFT &&
      existingOrder.status !== SalesOrderStatus.REJECTED
    ) {
      throw new ServiceError(
        `Cannot update sales order in ${existingOrder.status} status`,
        'INVALID_STATUS_FOR_UPDATE',
        400
      );
    }

    // Recalculate totals if lines are updated
    let updateData: Record<string, unknown> = {
      updatedBy: userId,
      updatedAt: new Date(),
    };

    if (input.lines) {
      const { lines, subtotal, taxTotal } = this.calculateLineTotals(input.lines);

      const discountAmount = Number(input.discountAmount ?? existingOrder.discountAmount);
      const shippingAmount = Number(input.shippingAmount ?? existingOrder.shippingAmount);
      const totalAmount = subtotal - discountAmount + taxTotal + shippingAmount;

      updateData = {
        ...updateData,
        subtotal: String(subtotal),
        taxAmount: String(taxTotal),
        totalAmount: String(totalAmount),
        remainingAmount: String(totalAmount),
      };

      // Update lines
      await this.updateOrderLines(id, lines, input.lines);
    }

    // Update other fields
    if (input.entityId) updateData.entityId = input.entityId;
    if (input.orderDate) updateData.orderDate = this.toDateString(input.orderDate);
    if (input.externalReference !== undefined) updateData.externalReference = input.externalReference;
    if (input.billingAddressId !== undefined) updateData.billingAddressId = input.billingAddressId;
    if (input.shippingAddressId !== undefined) updateData.shippingAddressId = input.shippingAddressId;
    if (input.requestedDeliveryDate !== undefined) {
      updateData.requestedDeliveryDate = input.requestedDeliveryDate
        ? this.toDateString(input.requestedDeliveryDate)
        : null;
    }
    if (input.promisedDeliveryDate !== undefined) {
      updateData.promisedDeliveryDate = input.promisedDeliveryDate
        ? this.toDateString(input.promisedDeliveryDate)
        : null;
    }
    if (input.currencyCode) updateData.currencyCode = input.currencyCode;
    if (input.exchangeRate !== undefined) updateData.exchangeRate = String(input.exchangeRate);
    if (input.discountAmount !== undefined) updateData.discountAmount = String(input.discountAmount);
    if (input.discountPercent !== undefined) updateData.discountPercent = String(input.discountPercent);
    if (input.shippingAmount !== undefined) updateData.shippingAmount = String(input.shippingAmount);
    if (input.paymentTerms !== undefined) updateData.paymentTerms = input.paymentTerms;
    if (input.shippingMethod !== undefined) updateData.shippingMethod = input.shippingMethod;
    if (input.memo !== undefined) updateData.memo = input.memo;
    if (input.internalNotes !== undefined) updateData.internalNotes = input.internalNotes;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;

    // If previously rejected, reset to draft
    if (existingOrder.status === SalesOrderStatus.REJECTED) {
      updateData.status = SalesOrderStatus.DRAFT;
      updateData.previousStatus = SalesOrderStatus.REJECTED;
    }

    await db
      .update(salesOrders)
      .set(updateData)
      .where(and(eq(salesOrders.id, id), eq(salesOrders.organizationId, organizationId)));

    // Emit event
    await this.eventService.emit({
      eventType: 'SalesOrderUpdated',
      eventCategory: 'TRANSACTION',
      aggregateType: 'SalesOrder',
      aggregateId: id,
      data: {
        orderNumber: existingOrder.orderNumber,
        changes: Object.keys(input),
      },
    });

    return this.getSalesOrderById(id);
  }

  // ==========================================================================
  // State Machine Operations
  // ==========================================================================

  /**
   * Validate if a status transition is allowed
   */
  validateStatusTransition(
    currentStatus: SalesOrderStatusValue,
    targetStatus: SalesOrderStatusValue
  ): StatusTransitionResult {
    const allowedTransitions = VALID_SALES_ORDER_TRANSITIONS[currentStatus] || [];
    const valid = allowedTransitions.includes(targetStatus);

    return {
      valid,
      currentStatus,
      targetStatus,
      allowedTransitions,
      reason: valid
        ? undefined
        : `Cannot transition from ${currentStatus} to ${targetStatus}. Allowed: ${allowedTransitions.join(', ') || 'none'}`,
    };
  }

  /**
   * Submit sales order for approval
   */
  async submitForApproval(id: string): Promise<SalesOrderWithDetails> {
    const userId = this.requireUserContext();
    const order = await this.getSalesOrderById(id);

    if (!order) {
      throw new ServiceError('Sales order not found', 'NOT_FOUND', 404);
    }

    const transition = this.validateStatusTransition(order.status, SalesOrderStatus.SUBMITTED);
    if (!transition.valid) {
      throw new ServiceError(transition.reason!, 'INVALID_STATUS_TRANSITION', 400);
    }

    // Update status
    await db
      .update(salesOrders)
      .set({
        status: SalesOrderStatus.SUBMITTED,
        previousStatus: order.status,
        submittedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(salesOrders.id, id));

    // Record approval history
    await this.recordApprovalAction(id, {
      action: ApprovalActionType.SUBMIT,
      fromStatus: order.status,
      toStatus: SalesOrderStatus.SUBMITTED,
      actorId: userId,
    });

    // Emit event
    await this.eventService.emit({
      eventType: 'SalesOrderSubmitted',
      eventCategory: 'APPROVAL',
      aggregateType: 'SalesOrder',
      aggregateId: id,
      data: {
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        submittedBy: userId,
      },
    });

    return this.getSalesOrderById(id) as Promise<SalesOrderWithDetails>;
  }

  /**
   * Process approval action (approve, reject, etc.)
   */
  async processApprovalAction(
    id: string,
    input: ApprovalActionInput
  ): Promise<SalesOrderWithDetails> {
    const userId = this.requireUserContext();
    const order = await this.getSalesOrderById(id);

    if (!order) {
      throw new ServiceError('Sales order not found', 'NOT_FOUND', 404);
    }

    let targetStatus: SalesOrderStatusValue;
    let eventType: string;

    switch (input.action) {
      case ApprovalActionType.APPROVE:
        targetStatus = SalesOrderStatus.APPROVED;
        eventType = 'SalesOrderApproved';
        break;
      case ApprovalActionType.REJECT:
        targetStatus = SalesOrderStatus.REJECTED;
        eventType = 'SalesOrderRejected';
        break;
      case ApprovalActionType.RETURN_FOR_REVISION:
        targetStatus = SalesOrderStatus.DRAFT;
        eventType = 'SalesOrderReturnedForRevision';
        break;
      default:
        throw new ServiceError(`Unknown approval action: ${input.action}`, 'INVALID_ACTION', 400);
    }

    const transition = this.validateStatusTransition(order.status, targetStatus);
    if (!transition.valid) {
      throw new ServiceError(transition.reason!, 'INVALID_STATUS_TRANSITION', 400);
    }

    // Update status
    const updateData: Record<string, unknown> = {
      status: targetStatus,
      previousStatus: order.status,
      updatedBy: userId,
      updatedAt: new Date(),
    };

    if (input.action === ApprovalActionType.APPROVE) {
      updateData.approvedAt = new Date();
      updateData.approvedBy = userId;
    }

    await db.update(salesOrders).set(updateData).where(eq(salesOrders.id, id));

    // Record approval history
    await this.recordApprovalAction(id, {
      action: input.action,
      fromStatus: order.status,
      toStatus: targetStatus,
      actorId: userId,
      comments: input.comments,
      reason: input.reason,
    });

    // Emit event
    await this.eventService.emit({
      eventType,
      eventCategory: 'APPROVAL',
      aggregateType: 'SalesOrder',
      aggregateId: id,
      data: {
        orderNumber: order.orderNumber,
        action: input.action,
        reason: input.reason,
        actorId: userId,
      },
    });

    return this.getSalesOrderById(id) as Promise<SalesOrderWithDetails>;
  }

  /**
   * Put order on hold
   */
  async putOnHold(id: string, reason: string): Promise<SalesOrderWithDetails> {
    const userId = this.requireUserContext();
    const order = await this.getSalesOrderById(id);

    if (!order) {
      throw new ServiceError('Sales order not found', 'NOT_FOUND', 404);
    }

    const transition = this.validateStatusTransition(order.status, SalesOrderStatus.ON_HOLD);
    if (!transition.valid) {
      throw new ServiceError(transition.reason!, 'INVALID_STATUS_TRANSITION', 400);
    }

    await db
      .update(salesOrders)
      .set({
        status: SalesOrderStatus.ON_HOLD,
        previousStatus: order.status,
        internalNotes: `${order.internalNotes || ''}\n[HOLD] ${new Date().toISOString()}: ${reason}`,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(salesOrders.id, id));

    await this.eventService.emit({
      eventType: 'SalesOrderOnHold',
      eventCategory: 'APPROVAL',
      aggregateType: 'SalesOrder',
      aggregateId: id,
      data: { orderNumber: order.orderNumber, reason },
    });

    return this.getSalesOrderById(id) as Promise<SalesOrderWithDetails>;
  }

  /**
   * Release order from hold
   */
  async releaseFromHold(id: string): Promise<SalesOrderWithDetails> {
    const userId = this.requireUserContext();
    const order = await this.getSalesOrderById(id);

    if (!order) {
      throw new ServiceError('Sales order not found', 'NOT_FOUND', 404);
    }

    if (order.status !== SalesOrderStatus.ON_HOLD) {
      throw new ServiceError('Order is not on hold', 'NOT_ON_HOLD', 400);
    }

    // Return to previous status
    const targetStatus = order.previousStatus || SalesOrderStatus.APPROVED;

    await db
      .update(salesOrders)
      .set({
        status: targetStatus,
        previousStatus: SalesOrderStatus.ON_HOLD,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(salesOrders.id, id));

    await this.eventService.emit({
      eventType: 'SalesOrderReleasedFromHold',
      eventCategory: 'APPROVAL',
      aggregateType: 'SalesOrder',
      aggregateId: id,
      data: { orderNumber: order.orderNumber, newStatus: targetStatus },
    });

    return this.getSalesOrderById(id) as Promise<SalesOrderWithDetails>;
  }

  /**
   * Cancel sales order
   */
  async cancelSalesOrder(id: string, reason: string): Promise<SalesOrderWithDetails> {
    const userId = this.requireUserContext();
    const order = await this.getSalesOrderById(id);

    if (!order) {
      throw new ServiceError('Sales order not found', 'NOT_FOUND', 404);
    }

    const transition = this.validateStatusTransition(order.status, SalesOrderStatus.CANCELLED);
    if (!transition.valid) {
      throw new ServiceError(transition.reason!, 'INVALID_STATUS_TRANSITION', 400);
    }

    await db
      .update(salesOrders)
      .set({
        status: SalesOrderStatus.CANCELLED,
        previousStatus: order.status,
        cancelledAt: new Date(),
        cancelledBy: userId,
        cancellationReason: reason,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(salesOrders.id, id));

    await this.eventService.emit({
      eventType: 'SalesOrderCancelled',
      eventCategory: 'TRANSACTION',
      aggregateType: 'SalesOrder',
      aggregateId: id,
      data: { orderNumber: order.orderNumber, reason },
    });

    return this.getSalesOrderById(id) as Promise<SalesOrderWithDetails>;
  }

  /**
   * Close fulfilled sales order
   */
  async closeSalesOrder(id: string): Promise<SalesOrderWithDetails> {
    const userId = this.requireUserContext();
    const order = await this.getSalesOrderById(id);

    if (!order) {
      throw new ServiceError('Sales order not found', 'NOT_FOUND', 404);
    }

    const transition = this.validateStatusTransition(order.status, SalesOrderStatus.CLOSED);
    if (!transition.valid) {
      throw new ServiceError(transition.reason!, 'INVALID_STATUS_TRANSITION', 400);
    }

    await db
      .update(salesOrders)
      .set({
        status: SalesOrderStatus.CLOSED,
        previousStatus: order.status,
        closedAt: new Date(),
        closedBy: userId,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(salesOrders.id, id));

    await this.eventService.emit({
      eventType: 'SalesOrderClosed',
      eventCategory: 'TRANSACTION',
      aggregateType: 'SalesOrder',
      aggregateId: id,
      data: { orderNumber: order.orderNumber },
    });

    return this.getSalesOrderById(id) as Promise<SalesOrderWithDetails>;
  }

  // ==========================================================================
  // Invoice Creation with GL Posting
  // ==========================================================================

  /**
   * Create invoice from sales order with automatic GL posting
   */
  async createInvoiceFromOrder(
    input: CreateInvoiceFromOrderInput
  ): Promise<CreateInvoiceFromOrderResult> {
    const userId = this.requireUserContext();
    const order = await this.getSalesOrderById(input.salesOrderId);

    if (!order) {
      throw new ServiceError('Sales order not found', 'NOT_FOUND', 404);
    }

    // Only approved or partially fulfilled orders can be invoiced
    if (
      order.status !== SalesOrderStatus.APPROVED &&
      order.status !== SalesOrderStatus.PARTIALLY_FULFILLED
    ) {
      throw new ServiceError(
        `Cannot create invoice from order in ${order.status} status`,
        'INVALID_STATUS_FOR_INVOICE',
        400
      );
    }

    // Determine which lines to invoice
    const linesToInvoice = input.lineIds
      ? order.lines.filter((l) => input.lineIds!.includes(l.id))
      : order.lines.filter((l) => Number(l.remainingQuantity) > 0);

    if (linesToInvoice.length === 0) {
      throw new ServiceError('No lines available to invoice', 'NO_LINES_TO_INVOICE', 400);
    }

    // Calculate invoice amounts
    const invoiceLines = linesToInvoice.map((line) => {
      const quantity = input.quantities?.[line.id]
        ? Number(input.quantities[line.id])
        : Number(line.remainingQuantity);
      const unitPrice = Number(line.unitPrice);
      const amount = quantity * unitPrice;

      return {
        subscriptionItemId: undefined,
        itemId: line.itemId,
        description: line.description,
        quantity: String(quantity),
        unitPrice: String(unitPrice),
        amount: String(amount),
      };
    });

    const subtotal = invoiceLines.reduce((sum, l) => sum + Number(l.amount), 0);
    const taxAmount = 0; // TODO: Calculate tax based on lines
    const totalAmount = subtotal + taxAmount;

    // Create invoice
    const invoiceDate = input.invoiceDate
      ? this.toDateString(input.invoiceDate)
      : new Date().toISOString().split('T')[0];
    const dueDate = input.dueDate
      ? this.toDateString(input.dueDate)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const invoice = await this.invoiceService.createInvoice({
      entityId: order.entityId,
      invoiceDate,
      dueDate,
      subtotal: String(subtotal),
      taxAmount: String(taxAmount),
      totalAmount: String(totalAmount),
      balanceDue: String(totalAmount),
      status: 'draft',
      metadata: {
        salesOrderId: order.id,
        salesOrderNumber: order.orderNumber,
      },
      lineItems: invoiceLines,
    });

    // Link invoice to order
    await db.insert(salesOrderInvoices).values({
      salesOrderId: order.id,
      invoiceId: invoice.id,
      invoicedAmount: String(totalAmount),
      createdBy: userId,
    });

    // Update order line quantities
    for (const line of linesToInvoice) {
      const invoicedQty = input.quantities?.[line.id]
        ? Number(input.quantities[line.id])
        : Number(line.remainingQuantity);

      const newInvoicedQty = Number(line.invoicedQuantity) + invoicedQty;
      const newRemainingQty = Number(line.quantity) - newInvoicedQty;

      await db
        .update(salesOrderLines)
        .set({
          invoicedQuantity: String(newInvoicedQty),
          remainingQuantity: String(newRemainingQty),
          updatedAt: new Date(),
        })
        .where(eq(salesOrderLines.id, line.id));
    }

    // Update order totals and status
    const newInvoicedAmount = Number(order.invoicedAmount) + totalAmount;
    const newRemainingAmount = Number(order.totalAmount) - newInvoicedAmount;
    const allLinesInvoiced = order.lines.every(
      (l) => Number(l.remainingQuantity) <= (input.quantities?.[l.id] ? Number(input.quantities[l.id]) : Number(l.remainingQuantity))
    );

    const newStatus = allLinesInvoiced
      ? SalesOrderStatus.FULFILLED
      : SalesOrderStatus.PARTIALLY_FULFILLED;

    await db
      .update(salesOrders)
      .set({
        invoicedAmount: String(newInvoicedAmount),
        remainingAmount: String(newRemainingAmount),
        status: newStatus,
        previousStatus: order.status,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(salesOrders.id, order.id));

    // Emit event
    await this.eventService.emit({
      eventType: 'InvoiceCreatedFromSalesOrder',
      eventCategory: 'TRANSACTION',
      aggregateType: 'SalesOrder',
      aggregateId: order.id,
      data: {
        orderNumber: order.orderNumber,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoicedAmount: totalAmount,
        newOrderStatus: newStatus,
      },
    });

    return {
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: String(totalAmount),
      },
      salesOrder: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: newStatus,
        invoicedAmount: String(newInvoicedAmount),
        remainingAmount: String(newRemainingAmount),
      },
      linesInvoiced: linesToInvoice.length,
    };
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Enrich order with lines, approval history, and invoice links
   */
  private async enrichOrderWithDetails(order: any): Promise<SalesOrderWithDetails> {
    // Fetch lines
    const lines = await db
      .select()
      .from(salesOrderLines)
      .where(eq(salesOrderLines.salesOrderId, order.id))
      .orderBy(asc(salesOrderLines.lineNumber));

    // Fetch approval history
    const history = await db
      .select()
      .from(salesOrderApprovalHistory)
      .where(eq(salesOrderApprovalHistory.salesOrderId, order.id))
      .orderBy(desc(salesOrderApprovalHistory.createdAt));

    // Fetch invoice links
    const invoiceLinks = await db
      .select()
      .from(salesOrderInvoices)
      .where(eq(salesOrderInvoices.salesOrderId, order.id))
      .orderBy(desc(salesOrderInvoices.createdAt));

    return {
      ...order,
      orderDate: order.orderDate,
      requestedDeliveryDate: order.requestedDeliveryDate || undefined,
      promisedDeliveryDate: order.promisedDeliveryDate || undefined,
      expirationDate: order.expirationDate || undefined,
      exchangeRate: order.exchangeRate || '1',
      subtotal: order.subtotal || '0',
      discountAmount: order.discountAmount || '0',
      discountPercent: order.discountPercent || '0',
      taxAmount: order.taxAmount || '0',
      shippingAmount: order.shippingAmount || '0',
      totalAmount: order.totalAmount || '0',
      fulfilledAmount: order.fulfilledAmount || '0',
      invoicedAmount: order.invoicedAmount || '0',
      remainingAmount: order.remainingAmount || '0',
      requiresApproval: order.requiresApproval || false,
      approvalLevel: order.approvalLevel || 0,
      createdAt: order.createdAt?.toISOString?.() || order.createdAt,
      updatedAt: order.updatedAt?.toISOString?.() || order.updatedAt,
      submittedAt: order.submittedAt?.toISOString?.() || undefined,
      approvedAt: order.approvedAt?.toISOString?.() || undefined,
      closedAt: order.closedAt?.toISOString?.() || undefined,
      cancelledAt: order.cancelledAt?.toISOString?.() || undefined,
      lines: lines.map((l) => this.transformLine(l)),
      approvalHistory: history.map((h) => this.transformApprovalHistory(h)),
      invoiceLinks: invoiceLinks.map((link) => ({
        id: link.id,
        salesOrderId: link.salesOrderId,
        invoiceId: link.invoiceId,
        invoicedAmount: link.invoicedAmount,
        createdAt: link.createdAt?.toISOString?.() || link.createdAt,
        createdBy: link.createdBy,
      })),
    };
  }

  private transformLine(line: any): SalesOrderLineWithDetails {
    return {
      id: line.id,
      salesOrderId: line.salesOrderId,
      lineNumber: line.lineNumber,
      itemId: line.itemId || undefined,
      description: line.description,
      sku: line.sku || undefined,
      quantity: line.quantity,
      unitOfMeasure: line.unitOfMeasure || undefined,
      fulfilledQuantity: line.fulfilledQuantity || '0',
      invoicedQuantity: line.invoicedQuantity || '0',
      cancelledQuantity: line.cancelledQuantity || '0',
      remainingQuantity: line.remainingQuantity || line.quantity,
      unitPrice: line.unitPrice,
      discountAmount: line.discountAmount || '0',
      discountPercent: line.discountPercent || '0',
      taxAmount: line.taxAmount || '0',
      taxCode: line.taxCode || undefined,
      lineTotal: line.lineTotal,
      requestedDeliveryDate: line.requestedDeliveryDate || undefined,
      promisedDeliveryDate: line.promisedDeliveryDate || undefined,
      departmentId: line.departmentId || undefined,
      locationId: line.locationId || undefined,
      classId: line.classId || undefined,
      projectId: line.projectId || undefined,
      revenueAccountId: line.revenueAccountId || undefined,
      deferredRevenueAccountId: line.deferredRevenueAccountId || undefined,
      memo: line.memo || undefined,
      metadata: line.metadata || undefined,
      createdAt: line.createdAt?.toISOString?.() || line.createdAt,
      updatedAt: line.updatedAt?.toISOString?.() || line.updatedAt,
    };
  }

  private transformApprovalHistory(history: any): ApprovalHistoryEntry {
    return {
      id: history.id,
      salesOrderId: history.salesOrderId,
      action: history.action,
      fromStatus: history.fromStatus,
      toStatus: history.toStatus,
      actorId: history.actorId,
      delegatedFrom: history.delegatedFrom || undefined,
      approvalLevel: history.approvalLevel || 0,
      comments: history.comments || undefined,
      reason: history.reason || undefined,
      metadata: history.metadata || undefined,
      createdAt: history.createdAt?.toISOString?.() || history.createdAt,
    };
  }

  private calculateLineTotals(
    lines: any[]
  ): { lines: any[]; subtotal: number; taxTotal: number } {
    let subtotal = 0;
    let taxTotal = 0;

    const processedLines = lines.map((line, index) => {
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unitPrice);
      const discountAmount = Number(line.discountAmount || 0);
      const discountPercent = Number(line.discountPercent || 0);
      const taxAmount = Number(line.taxAmount || 0);

      let lineTotal = quantity * unitPrice;
      if (discountAmount > 0) {
        lineTotal -= discountAmount;
      } else if (discountPercent > 0) {
        lineTotal *= 1 - discountPercent / 100;
      }

      subtotal += lineTotal;
      taxTotal += taxAmount;

      return {
        ...line,
        lineNumber: index + 1,
        lineTotal: String(lineTotal),
        remainingQuantity: String(quantity),
      };
    });

    return { lines: processedLines, subtotal, taxTotal };
  }

  private async createOrderLines(orderId: string, lines: any[]): Promise<void> {
    for (const line of lines) {
      await db.insert(salesOrderLines).values({
        salesOrderId: orderId,
        lineNumber: line.lineNumber,
        itemId: line.itemId,
        description: line.description,
        sku: line.sku,
        quantity: String(line.quantity),
        unitOfMeasure: line.unitOfMeasure,
        unitPrice: String(line.unitPrice),
        discountAmount: String(line.discountAmount || 0),
        discountPercent: String(line.discountPercent || 0),
        taxAmount: String(line.taxAmount || 0),
        taxCode: line.taxCode,
        lineTotal: line.lineTotal,
        remainingQuantity: line.remainingQuantity,
        requestedDeliveryDate: line.requestedDeliveryDate
          ? this.toDateString(line.requestedDeliveryDate)
          : undefined,
        promisedDeliveryDate: line.promisedDeliveryDate
          ? this.toDateString(line.promisedDeliveryDate)
          : undefined,
        departmentId: line.departmentId,
        locationId: line.locationId,
        classId: line.classId,
        projectId: line.projectId,
        revenueAccountId: line.revenueAccountId,
        deferredRevenueAccountId: line.deferredRevenueAccountId,
        memo: line.memo,
        metadata: line.metadata,
      });
    }
  }

  private async updateOrderLines(
    orderId: string,
    calculatedLines: any[],
    inputLines: any[]
  ): Promise<void> {
    // Delete lines marked for deletion
    const linesToDelete = inputLines.filter((l) => l._delete && l.id);
    for (const line of linesToDelete) {
      await db.delete(salesOrderLines).where(eq(salesOrderLines.id, line.id));
    }

    // Update or create remaining lines
    for (const line of calculatedLines) {
      if (line.id) {
        // Update existing
        await db
          .update(salesOrderLines)
          .set({
            lineNumber: line.lineNumber,
            itemId: line.itemId,
            description: line.description,
            sku: line.sku,
            quantity: String(line.quantity),
            unitOfMeasure: line.unitOfMeasure,
            unitPrice: String(line.unitPrice),
            discountAmount: String(line.discountAmount || 0),
            discountPercent: String(line.discountPercent || 0),
            taxAmount: String(line.taxAmount || 0),
            taxCode: line.taxCode,
            lineTotal: line.lineTotal,
            remainingQuantity: line.remainingQuantity,
            updatedAt: new Date(),
          })
          .where(eq(salesOrderLines.id, line.id));
      } else {
        // Create new
        await db.insert(salesOrderLines).values({
          salesOrderId: orderId,
          lineNumber: line.lineNumber,
          itemId: line.itemId,
          description: line.description,
          sku: line.sku,
          quantity: String(line.quantity),
          unitOfMeasure: line.unitOfMeasure,
          unitPrice: String(line.unitPrice),
          discountAmount: String(line.discountAmount || 0),
          discountPercent: String(line.discountPercent || 0),
          taxAmount: String(line.taxAmount || 0),
          taxCode: line.taxCode,
          lineTotal: line.lineTotal,
          remainingQuantity: line.remainingQuantity,
        });
      }
    }
  }

  private async recordApprovalAction(
    orderId: string,
    data: {
      action: ApprovalActionTypeValue;
      fromStatus: SalesOrderStatusValue;
      toStatus: SalesOrderStatusValue;
      actorId: string;
      comments?: string;
      reason?: string;
      delegatedFrom?: string;
      approvalLevel?: number;
    }
  ): Promise<void> {
    await db.insert(salesOrderApprovalHistory).values({
      salesOrderId: orderId,
      action: data.action,
      fromStatus: data.fromStatus,
      toStatus: data.toStatus,
      actorId: data.actorId,
      comments: data.comments,
      reason: data.reason,
      delegatedFrom: data.delegatedFrom,
      approvalLevel: data.approvalLevel || 0,
    });
  }

  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, '0');
    return `SO-${year}-${timestamp}${random}`;
  }

  private toDateString(date: string | Date): string {
    if (typeof date === 'string') {
      return date.split('T')[0];
    }
    return date.toISOString().split('T')[0];
  }
}
