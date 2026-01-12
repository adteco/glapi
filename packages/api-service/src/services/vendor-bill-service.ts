/**
 * Vendor Bill Service
 *
 * Handles vendor bill lifecycle:
 * - Bill creation and management
 * - 3-way match validation (PO ↔ Receipt ↔ Bill)
 * - Approval workflow
 * - Payment tracking
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
  CreateVendorBillInput,
  CreateBillFromPOInput,
  SubmitVendorBillInput,
  ApproveVendorBillInput,
  OverrideMatchExceptionInput,
  VendorBillFilters,
  VendorBillWithDetails,
  VendorBillLineWithDetails,
  VendorBillApprovalEntry,
  ThreeWayMatchResult,
  ThreeWayMatchLineResult,
  VendorAccountSummary,
  APAgingSummary,
  VendorBillStatusValue,
  ThreeWayMatchStatusValue,
  BillApprovalActionTypeValue,
} from '../types/procure-to-pay.types';
import {
  VendorBillStatus,
  ThreeWayMatchStatus,
  BillApprovalActionType,
  VALID_VENDOR_BILL_TRANSITIONS,
} from '@glapi/database/schema';
import { db } from '@glapi/database';
import {
  vendorBills,
  vendorBillLines,
  vendorBillApprovalHistory,
  billPaymentApplications,
  purchaseOrders,
  purchaseOrderLines,
  purchaseOrderReceiptLines,
  entities,
  accounts,
} from '@glapi/database/schema';
import { eq, and, desc, asc, sql, inArray, gte, lte, or, ilike, lt, isNull } from 'drizzle-orm';
import Decimal from 'decimal.js';

// ============================================================================
// Vendor Bill Service
// ============================================================================

export class VendorBillService extends BaseService {
  private eventService: EventService;

  // Tolerance thresholds for 3-way match
  private readonly QUANTITY_TOLERANCE_PERCENT = 0; // 0% tolerance - must match exactly
  private readonly PRICE_TOLERANCE_PERCENT = 0.01; // 1% tolerance for price variances

  constructor(context: ServiceContext = {}) {
    super(context);
    this.eventService = new EventService(context);
  }

  // ==========================================================================
  // VENDOR BILL CRUD Operations
  // ==========================================================================

  /**
   * List vendor bills with filters and pagination
   */
  async listVendorBills(
    params: PaginationParams = {},
    filters: VendorBillFilters = {}
  ): Promise<PaginatedResult<VendorBillWithDetails>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(params);

    // Build where conditions
    const conditions = [eq(vendorBills.organizationId, organizationId)];

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(vendorBills.status, filters.status));
      } else {
        conditions.push(eq(vendorBills.status, filters.status));
      }
    }

    if (filters.vendorId) {
      conditions.push(eq(vendorBills.vendorId, filters.vendorId));
    }

    if (filters.subsidiaryId) {
      conditions.push(eq(vendorBills.subsidiaryId, filters.subsidiaryId));
    }

    if (filters.purchaseOrderId) {
      conditions.push(eq(vendorBills.purchaseOrderId, filters.purchaseOrderId));
    }

    if (filters.threeWayMatchStatus) {
      conditions.push(eq(vendorBills.threeWayMatchStatus, filters.threeWayMatchStatus));
    }

    if (filters.billDateFrom) {
      const dateFrom = typeof filters.billDateFrom === 'string'
        ? filters.billDateFrom
        : filters.billDateFrom.toISOString().split('T')[0];
      conditions.push(gte(vendorBills.billDate, dateFrom));
    }

    if (filters.billDateTo) {
      const dateTo = typeof filters.billDateTo === 'string'
        ? filters.billDateTo
        : filters.billDateTo.toISOString().split('T')[0];
      conditions.push(lte(vendorBills.billDate, dateTo));
    }

    if (filters.hasBalance) {
      conditions.push(sql`${vendorBills.balanceDue}::decimal > 0`);
    }

    if (filters.search) {
      conditions.push(
        or(
          ilike(vendorBills.billNumber, `%${filters.search}%`),
          ilike(vendorBills.vendorInvoiceNumber, `%${filters.search}%`),
          ilike(vendorBills.vendorName, `%${filters.search}%`),
          ilike(vendorBills.memo, `%${filters.search}%`)
        )!
      );
    }

    // Count total
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(vendorBills)
      .where(and(...conditions));
    const total = Number(countResult[0]?.count || 0);

    // Fetch bills
    const bills = await db
      .select()
      .from(vendorBills)
      .where(and(...conditions))
      .orderBy(desc(vendorBills.createdAt))
      .limit(take)
      .offset(skip);

    // Enrich with details
    const billsWithDetails = await Promise.all(
      bills.map(async (bill) => this.enrichBillWithDetails(bill))
    );

    return this.createPaginatedResult(billsWithDetails, total, page, limit);
  }

  /**
   * Get a single vendor bill by ID
   */
  async getVendorBillById(id: string): Promise<VendorBillWithDetails | null> {
    const organizationId = this.requireOrganizationContext();

    const bill = await db
      .select()
      .from(vendorBills)
      .where(and(eq(vendorBills.id, id), eq(vendorBills.organizationId, organizationId)))
      .limit(1);

    if (!bill[0]) {
      return null;
    }

    return this.enrichBillWithDetails(bill[0], true);
  }

  /**
   * Create a new vendor bill (manual entry)
   */
  async createVendorBill(input: CreateVendorBillInput): Promise<VendorBillWithDetails> {
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

    // Generate bill number
    const billNumber = await this.generateBillNumber();

    // Calculate line totals
    const { lines, subtotal, taxTotal } = this.calculateLineTotals(input.lines);
    const shippingAmount = 0; // Shipping handled per-line
    const totalAmount = new Decimal(subtotal).plus(taxTotal).plus(shippingAmount).toFixed(2);

    // Determine 3-way match requirement
    const threeWayMatchStatus = input.purchaseOrderId
      ? ThreeWayMatchStatus.PENDING
      : ThreeWayMatchStatus.NOT_REQUIRED;

    // Create bill
    const [bill] = await db
      .insert(vendorBills)
      .values({
        organizationId,
        subsidiaryId: input.subsidiaryId,
        billNumber,
        vendorInvoiceNumber: input.vendorInvoiceNumber,
        vendorId: input.vendorId,
        vendorName: vendor[0].name,
        purchaseOrderId: input.purchaseOrderId,
        billDate: this.toDateString(input.billDate),
        dueDate: this.toDateString(input.dueDate),
        receivedDate: input.receivedDate ? this.toDateString(input.receivedDate) : null,
        status: VendorBillStatus.DRAFT,
        threeWayMatchStatus,
        subtotal: subtotal.toString(),
        taxAmount: taxTotal.toString(),
        shippingAmount: shippingAmount.toString(),
        totalAmount,
        paidAmount: '0',
        balanceDue: totalAmount,
        discountDate: input.discountDate ? this.toDateString(input.discountDate) : null,
        discountPercent: input.discountPercent?.toString(),
        discountAmount: input.discountAmount?.toString(),
        discountTaken: '0',
        apAccountId: input.apAccountId,
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

      await db.insert(vendorBillLines).values({
        vendorBillId: bill.id,
        lineNumber,
        purchaseOrderLineId: line.purchaseOrderLineId,
        receiptLineId: line.receiptLineId,
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
      });
    }

    // Perform 3-way match if linked to PO
    if (input.purchaseOrderId) {
      await this.performThreeWayMatch(bill.id);
    }

    // Emit event
    await this.eventService.emit({
      eventType: 'VendorBillCreated',
      eventCategory: 'PROCUREMENT',
      aggregateType: 'VendorBill',
      aggregateId: bill.id,
      data: {
        billNumber: bill.billNumber,
        vendorId: bill.vendorId,
        totalAmount: bill.totalAmount,
        purchaseOrderId: input.purchaseOrderId,
      },
    });

    return (await this.getVendorBillById(bill.id))!;
  }

  /**
   * Create a vendor bill from a purchase order
   */
  async createBillFromPO(input: CreateBillFromPOInput): Promise<VendorBillWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Get PO
    const po = await db
      .select()
      .from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.id, input.purchaseOrderId),
        eq(purchaseOrders.organizationId, organizationId)
      ))
      .limit(1);

    if (!po[0]) {
      throw new ServiceError('Purchase order not found', 'NOT_FOUND', 404);
    }

    // PO must be received
    if (po[0].status !== 'RECEIVED' && po[0].status !== 'PARTIALLY_RECEIVED') {
      throw new ServiceError(
        'Purchase order must be in RECEIVED or PARTIALLY_RECEIVED status to create a bill',
        'VALIDATION_ERROR',
        400
      );
    }

    // Get PO lines
    const poLines = await db
      .select()
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.purchaseOrderId, input.purchaseOrderId))
      .orderBy(asc(purchaseOrderLines.lineNumber));

    // Build bill lines from PO lines (received but not yet billed)
    const billLines: CreateVendorBillInput['lines'] = [];

    for (const poLine of poLines) {
      const qtyReceived = new Decimal(poLine.quantityReceived);
      const qtyBilled = new Decimal(poLine.quantityBilled);
      const qtyToBill = qtyReceived.minus(qtyBilled);

      if (qtyToBill.gt(0)) {
        billLines.push({
          lineNumber: poLine.lineNumber,
          purchaseOrderLineId: poLine.id,
          itemId: poLine.itemId || undefined,
          itemName: poLine.itemName,
          itemDescription: poLine.itemDescription || undefined,
          quantity: qtyToBill.toNumber(),
          unitOfMeasure: poLine.unitOfMeasure || undefined,
          unitPrice: Number(poLine.unitPrice),
          taxAmount: 0, // Will need to calculate proportionally
          accountId: poLine.accountId || undefined,
          departmentId: poLine.departmentId || undefined,
          locationId: poLine.locationId || undefined,
          classId: poLine.classId || undefined,
          projectId: poLine.projectId || undefined,
        });
      }
    }

    if (billLines.length === 0) {
      throw new ServiceError('No unbilled items on this purchase order', 'VALIDATION_ERROR', 400);
    }

    // Create the bill
    return this.createVendorBill({
      subsidiaryId: po[0].subsidiaryId,
      vendorId: po[0].vendorId,
      vendorInvoiceNumber: input.vendorInvoiceNumber,
      purchaseOrderId: input.purchaseOrderId,
      billDate: input.billDate,
      dueDate: input.dueDate,
      discountDate: input.discountDate,
      discountPercent: input.discountPercent,
      paymentTerms: po[0].paymentTerms || undefined,
      currencyCode: po[0].currencyCode || 'USD',
      exchangeRate: po[0].exchangeRate || undefined,
      memo: input.memo,
      lines: billLines,
    });
  }

  // ==========================================================================
  // 3-WAY MATCH
  // ==========================================================================

  /**
   * Perform 3-way match validation on a vendor bill
   */
  async performThreeWayMatch(billId: string): Promise<ThreeWayMatchResult> {
    const bill = await this.getVendorBillById(billId);
    if (!bill) {
      throw new ServiceError('Vendor bill not found', 'NOT_FOUND', 404);
    }

    if (!bill.purchaseOrderId) {
      return {
        vendorBillId: billId,
        overallStatus: ThreeWayMatchStatus.NOT_REQUIRED,
        totalVariance: '0',
        lineResults: [],
        canApprove: true,
        requiresOverride: false,
      };
    }

    const lineResults: ThreeWayMatchLineResult[] = [];
    let totalVariance = new Decimal(0);
    let hasExceptions = false;

    // Get bill lines with PO line references
    const billLines = bill.lines || [];

    for (const billLine of billLines) {
      const lineResult: ThreeWayMatchLineResult = {
        vendorBillLineId: billLine.id,
        purchaseOrderLineId: billLine.purchaseOrderLineId,
        receiptLineId: billLine.receiptLineId,
        matchStatus: ThreeWayMatchStatus.MATCHED,
        billedQuantity: billLine.quantity,
        billedUnitPrice: billLine.unitPrice,
        totalVariance: '0',
        exceptions: [],
      };

      if (billLine.purchaseOrderLineId) {
        // Get PO line
        const poLine = await db
          .select()
          .from(purchaseOrderLines)
          .where(eq(purchaseOrderLines.id, billLine.purchaseOrderLineId))
          .limit(1);

        if (poLine[0]) {
          lineResult.poQuantity = poLine[0].quantity;
          lineResult.poUnitPrice = poLine[0].unitPrice;

          // Get received quantity for this PO line
          const receivedResult = await db
            .select({ total: sql<string>`sum(quantity_received)` })
            .from(purchaseOrderReceiptLines)
            .where(eq(purchaseOrderReceiptLines.purchaseOrderLineId, billLine.purchaseOrderLineId));

          lineResult.receivedQuantity = receivedResult[0]?.total || '0';

          // Calculate variances
          const billedQty = new Decimal(billLine.quantity);
          const poQty = new Decimal(poLine[0].quantity);
          const receivedQty = new Decimal(lineResult.receivedQuantity);
          const billedPrice = new Decimal(billLine.unitPrice);
          const poPrice = new Decimal(poLine[0].unitPrice);

          // Quantity variance (billed vs received)
          const qtyVariance = billedQty.minus(receivedQty);
          if (!qtyVariance.eq(0)) {
            lineResult.quantityVariance = qtyVariance.toFixed(4);
            lineResult.receivedVariance = qtyVariance.toFixed(4);

            const toleranceQty = receivedQty.times(this.QUANTITY_TOLERANCE_PERCENT);
            if (qtyVariance.abs().gt(toleranceQty)) {
              lineResult.exceptions.push(
                `Quantity variance: billed ${billedQty.toFixed(2)} vs received ${receivedQty.toFixed(2)}`
              );
            }
          }

          // Price variance (billed vs PO)
          const priceVariance = billedPrice.minus(poPrice);
          if (!priceVariance.eq(0)) {
            lineResult.priceVariance = priceVariance.times(billedQty).toFixed(2);

            const tolerancePrice = poPrice.times(this.PRICE_TOLERANCE_PERCENT);
            if (priceVariance.abs().gt(tolerancePrice)) {
              lineResult.exceptions.push(
                `Price variance: billed ${billedPrice.toFixed(4)} vs PO ${poPrice.toFixed(4)}`
              );
            }
          }

          // Total line variance
          const lineVariance = qtyVariance.times(billedPrice).plus(
            priceVariance.times(billedQty)
          );
          lineResult.totalVariance = lineVariance.toFixed(2);
          totalVariance = totalVariance.plus(lineVariance.abs());

          // Determine line match status
          if (lineResult.exceptions.length > 0) {
            lineResult.matchStatus = ThreeWayMatchStatus.EXCEPTION;
            hasExceptions = true;
          }
        }
      }

      // Update line match status in DB
      await db
        .update(vendorBillLines)
        .set({
          poQuantity: lineResult.poQuantity,
          poUnitPrice: lineResult.poUnitPrice,
          receivedQuantity: lineResult.receivedQuantity,
          quantityVariance: lineResult.quantityVariance,
          priceVariance: lineResult.priceVariance,
          matchStatus: lineResult.matchStatus,
          updatedAt: new Date(),
        })
        .where(eq(vendorBillLines.id, billLine.id));

      lineResults.push(lineResult);
    }

    // Update bill match status
    const overallStatus = hasExceptions
      ? ThreeWayMatchStatus.EXCEPTION
      : ThreeWayMatchStatus.MATCHED;

    await db
      .update(vendorBills)
      .set({
        threeWayMatchStatus: overallStatus,
        matchVarianceAmount: totalVariance.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(vendorBills.id, billId));

    // Emit event
    await this.eventService.emit({
      eventType: 'ThreeWayMatchCompleted',
      eventCategory: 'PROCUREMENT',
      aggregateType: 'VendorBill',
      aggregateId: billId,
      data: {
        billNumber: bill.billNumber,
        overallStatus,
        totalVariance: totalVariance.toFixed(2),
        exceptionCount: lineResults.filter(l => l.exceptions.length > 0).length,
      },
    });

    return {
      vendorBillId: billId,
      overallStatus,
      totalVariance: totalVariance.toFixed(2),
      lineResults,
      canApprove: overallStatus === ThreeWayMatchStatus.MATCHED,
      requiresOverride: hasExceptions,
    };
  }

  /**
   * Override a 3-way match exception (with approval)
   */
  async overrideMatchException(input: OverrideMatchExceptionInput): Promise<VendorBillWithDetails> {
    const userId = this.requireUserContext();

    const bill = await this.getVendorBillById(input.vendorBillId);
    if (!bill) {
      throw new ServiceError('Vendor bill not found', 'NOT_FOUND', 404);
    }

    if (bill.threeWayMatchStatus !== ThreeWayMatchStatus.EXCEPTION) {
      throw new ServiceError('Bill does not have match exceptions to override', 'VALIDATION_ERROR', 400);
    }

    // Update match status to override
    await db
      .update(vendorBills)
      .set({
        threeWayMatchStatus: ThreeWayMatchStatus.OVERRIDE,
        matchOverrideReason: input.reason,
        matchOverrideBy: userId,
        matchOverrideAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(vendorBills.id, input.vendorBillId));

    // Emit event
    await this.eventService.emit({
      eventType: 'MatchExceptionOverridden',
      eventCategory: 'PROCUREMENT',
      aggregateType: 'VendorBill',
      aggregateId: input.vendorBillId,
      data: {
        billNumber: bill.billNumber,
        reason: input.reason,
        varianceAmount: bill.matchVarianceAmount,
      },
    });

    return (await this.getVendorBillById(input.vendorBillId))!;
  }

  // ==========================================================================
  // APPROVAL WORKFLOW
  // ==========================================================================

  /**
   * Submit a vendor bill for approval
   */
  async submitVendorBill(input: SubmitVendorBillInput): Promise<VendorBillWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const bill = await this.getVendorBillById(input.vendorBillId);
    if (!bill) {
      throw new ServiceError('Vendor bill not found', 'NOT_FOUND', 404);
    }

    // Validate current status
    if (bill.status !== VendorBillStatus.DRAFT && bill.status !== VendorBillStatus.REJECTED) {
      throw new ServiceError(
        `Cannot submit bill in ${bill.status} status`,
        'VALIDATION_ERROR',
        400
      );
    }

    // Check 3-way match status
    if (bill.threeWayMatchStatus === ThreeWayMatchStatus.EXCEPTION) {
      throw new ServiceError(
        'Cannot submit bill with unresolved 3-way match exceptions. Override or correct the exceptions first.',
        'VALIDATION_ERROR',
        400
      );
    }

    // Update status
    await db
      .update(vendorBills)
      .set({
        status: VendorBillStatus.PENDING_APPROVAL,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(vendorBills.id, input.vendorBillId),
        eq(vendorBills.organizationId, organizationId)
      ));

    // Record approval history
    await this.recordApprovalHistory(
      input.vendorBillId,
      BillApprovalActionType.SUBMITTED,
      bill.status,
      VendorBillStatus.PENDING_APPROVAL,
      userId,
      input.comments
    );

    // Emit event
    await this.eventService.emit({
      eventType: 'VendorBillSubmitted',
      eventCategory: 'PROCUREMENT',
      aggregateType: 'VendorBill',
      aggregateId: input.vendorBillId,
      data: { billNumber: bill.billNumber, totalAmount: bill.totalAmount },
    });

    return (await this.getVendorBillById(input.vendorBillId))!;
  }

  /**
   * Approve or reject a vendor bill
   */
  async approveVendorBill(input: ApproveVendorBillInput): Promise<VendorBillWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const bill = await this.getVendorBillById(input.vendorBillId);
    if (!bill) {
      throw new ServiceError('Vendor bill not found', 'NOT_FOUND', 404);
    }

    // Only pending bills can be approved/rejected
    if (bill.status !== VendorBillStatus.PENDING_APPROVAL) {
      throw new ServiceError(
        `Vendor bill must be in PENDING_APPROVAL status to ${input.action.toLowerCase()}`,
        'VALIDATION_ERROR',
        400
      );
    }

    let newStatus: VendorBillStatusValue;
    let actionType: (typeof BillApprovalActionType)[keyof typeof BillApprovalActionType];

    switch (input.action) {
      case 'APPROVE':
        newStatus = VendorBillStatus.APPROVED;
        actionType = BillApprovalActionType.APPROVED;
        break;
      case 'REJECT':
        newStatus = VendorBillStatus.REJECTED;
        actionType = BillApprovalActionType.REJECTED;
        break;
      case 'RETURN':
        newStatus = VendorBillStatus.DRAFT;
        actionType = BillApprovalActionType.RETURNED;
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

    await db
      .update(vendorBills)
      .set(updateData)
      .where(and(
        eq(vendorBills.id, input.vendorBillId),
        eq(vendorBills.organizationId, organizationId)
      ));

    // Update PO billed amounts if approved
    if (input.action === 'APPROVE' && bill.purchaseOrderId) {
      await this.updatePOBilledAmounts(input.vendorBillId);
    }

    // Record approval history
    await this.recordApprovalHistory(
      input.vendorBillId,
      actionType,
      bill.status,
      newStatus,
      userId,
      input.comments
    );

    // Emit event
    await this.eventService.emit({
      eventType: `VendorBill${input.action.charAt(0) + input.action.slice(1).toLowerCase()}d`,
      eventCategory: 'PROCUREMENT',
      aggregateType: 'VendorBill',
      aggregateId: input.vendorBillId,
      data: { billNumber: bill.billNumber, action: input.action },
    });

    return (await this.getVendorBillById(input.vendorBillId))!;
  }

  /**
   * Void a vendor bill
   */
  async voidVendorBill(id: string, reason: string): Promise<VendorBillWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const bill = await this.getVendorBillById(id);
    if (!bill) {
      throw new ServiceError('Vendor bill not found', 'NOT_FOUND', 404);
    }

    // Check if bill has payments
    const paidAmount = new Decimal(bill.paidAmount);
    if (paidAmount.gt(0)) {
      throw new ServiceError(
        'Cannot void a bill that has payments applied. Reverse the payments first.',
        'VALIDATION_ERROR',
        400
      );
    }

    // Update status
    await db
      .update(vendorBills)
      .set({
        status: VendorBillStatus.VOIDED,
        voidedAt: new Date(),
        voidedBy: userId,
        voidReason: reason,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(vendorBills.id, id), eq(vendorBills.organizationId, organizationId)));

    // Reverse PO billed amounts if applicable
    if (bill.purchaseOrderId && bill.status === VendorBillStatus.APPROVED) {
      await this.reversePOBilledAmounts(id);
    }

    // Record history
    await this.recordApprovalHistory(
      id,
      BillApprovalActionType.VOIDED,
      bill.status,
      VendorBillStatus.VOIDED,
      userId,
      reason
    );

    // Emit event
    await this.eventService.emit({
      eventType: 'VendorBillVoided',
      eventCategory: 'PROCUREMENT',
      aggregateType: 'VendorBill',
      aggregateId: id,
      data: { billNumber: bill.billNumber, reason },
    });

    return (await this.getVendorBillById(id))!;
  }

  // ==========================================================================
  // PAYMENT TRACKING
  // ==========================================================================

  /**
   * Update bill payment amounts (called by BillPaymentService)
   */
  async updatePaymentAmounts(
    billId: string,
    appliedAmount: Decimal,
    discountTaken: Decimal
  ): Promise<void> {
    const bill = await this.getVendorBillById(billId);
    if (!bill) {
      throw new ServiceError('Vendor bill not found', 'NOT_FOUND', 404);
    }

    const currentPaid = new Decimal(bill.paidAmount);
    const currentDiscount = new Decimal(bill.discountTaken);
    const total = new Decimal(bill.totalAmount);

    const newPaid = currentPaid.plus(appliedAmount);
    const newDiscount = currentDiscount.plus(discountTaken);
    const newBalance = total.minus(newPaid).minus(newDiscount);

    // Determine new status
    let newStatus = bill.status;
    if (newBalance.lte(0)) {
      newStatus = VendorBillStatus.PAID;
    } else if (newPaid.gt(0)) {
      newStatus = VendorBillStatus.PARTIALLY_PAID;
    }

    await db
      .update(vendorBills)
      .set({
        paidAmount: newPaid.toFixed(2),
        discountTaken: newDiscount.toFixed(2),
        balanceDue: newBalance.lt(0) ? '0' : newBalance.toFixed(2),
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(vendorBills.id, billId));
  }

  // ==========================================================================
  // REPORTING
  // ==========================================================================

  /**
   * Get vendor account summary
   */
  async getVendorAccountSummary(vendorId: string): Promise<VendorAccountSummary> {
    const organizationId = this.requireOrganizationContext();

    // Get vendor info
    const vendor = await db
      .select({ id: entities.id, name: entities.name })
      .from(entities)
      .where(eq(entities.id, vendorId))
      .limit(1);

    if (!vendor[0]) {
      throw new ServiceError('Vendor not found', 'NOT_FOUND', 404);
    }

    // Get bill totals
    const billStats = await db
      .select({
        totalOutstanding: sql<string>`sum(balance_due::decimal)`,
        totalOverdue: sql<string>`sum(case when due_date < current_date and balance_due::decimal > 0 then balance_due::decimal else 0 end)`,
        oldestBillDate: sql<string>`min(bill_date)`,
        billCount: sql<number>`count(*)`,
        overdueBillCount: sql<number>`count(case when due_date < current_date and balance_due::decimal > 0 then 1 end)`,
      })
      .from(vendorBills)
      .where(and(
        eq(vendorBills.organizationId, organizationId),
        eq(vendorBills.vendorId, vendorId),
        inArray(vendorBills.status, [
          VendorBillStatus.APPROVED,
          VendorBillStatus.PARTIALLY_PAID,
        ])
      ));

    // Get unapplied credits
    // (would need vendor credit memo query here)
    const totalUnappliedCredits = '0';

    return {
      vendorId,
      vendorName: vendor[0].name,
      totalOutstanding: billStats[0]?.totalOutstanding || '0',
      totalOverdue: billStats[0]?.totalOverdue || '0',
      totalUnappliedCredits,
      oldestBillDate: billStats[0]?.oldestBillDate,
      billCount: Number(billStats[0]?.billCount || 0),
      overdueBillCount: Number(billStats[0]?.overdueBillCount || 0),
    };
  }

  /**
   * Get AP aging summary
   */
  async getAPAgingSummary(subsidiaryId?: string): Promise<APAgingSummary> {
    const organizationId = this.requireOrganizationContext();
    const today = new Date().toISOString().split('T')[0];

    const conditions = [
      eq(vendorBills.organizationId, organizationId),
      inArray(vendorBills.status, [
        VendorBillStatus.APPROVED,
        VendorBillStatus.PARTIALLY_PAID,
      ]),
      sql`${vendorBills.balanceDue}::decimal > 0`,
    ];

    if (subsidiaryId) {
      conditions.push(eq(vendorBills.subsidiaryId, subsidiaryId));
    }

    const agingResult = await db
      .select({
        current: sql<string>`sum(case when due_date >= current_date then balance_due::decimal else 0 end)`,
        days1to30: sql<string>`sum(case when due_date < current_date and due_date >= current_date - interval '30 days' then balance_due::decimal else 0 end)`,
        days31to60: sql<string>`sum(case when due_date < current_date - interval '30 days' and due_date >= current_date - interval '60 days' then balance_due::decimal else 0 end)`,
        days61to90: sql<string>`sum(case when due_date < current_date - interval '60 days' and due_date >= current_date - interval '90 days' then balance_due::decimal else 0 end)`,
        over90: sql<string>`sum(case when due_date < current_date - interval '90 days' then balance_due::decimal else 0 end)`,
        total: sql<string>`sum(balance_due::decimal)`,
      })
      .from(vendorBills)
      .where(and(...conditions));

    return {
      current: agingResult[0]?.current || '0',
      days1to30: agingResult[0]?.days1to30 || '0',
      days31to60: agingResult[0]?.days31to60 || '0',
      days61to90: agingResult[0]?.days61to90 || '0',
      over90: agingResult[0]?.over90 || '0',
      total: agingResult[0]?.total || '0',
    };
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async generateBillNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await db.execute(sql`
      SELECT COUNT(*) + 1 as seq
      FROM vendor_bills
      WHERE bill_number LIKE ${`BILL-${year}-%`}
    `);
    const seq = String((result.rows[0] as { seq: number }).seq).padStart(6, '0');
    return `BILL-${year}-${seq}`;
  }

  private calculateLineTotals(lines: CreateVendorBillInput['lines']) {
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

  private async recordApprovalHistory(
    vendorBillId: string,
    action: (typeof BillApprovalActionType)[keyof typeof BillApprovalActionType],
    fromStatus: VendorBillStatusValue | undefined,
    toStatus: VendorBillStatusValue,
    userId: string,
    comments?: string
  ): Promise<void> {
    await db.insert(vendorBillApprovalHistory).values({
      vendorBillId,
      action,
      fromStatus,
      toStatus,
      performedBy: userId,
      comments,
    });
  }

  private async updatePOBilledAmounts(billId: string): Promise<void> {
    const lines = await db
      .select()
      .from(vendorBillLines)
      .where(eq(vendorBillLines.vendorBillId, billId));

    for (const line of lines) {
      if (line.purchaseOrderLineId) {
        await db.execute(sql`
          UPDATE purchase_order_lines
          SET quantity_billed = quantity_billed + ${line.quantity}::decimal,
              updated_at = NOW()
          WHERE id = ${line.purchaseOrderLineId}
        `);
      }
    }

    // Update PO header billed amount
    const bill = await db
      .select({ purchaseOrderId: vendorBills.purchaseOrderId, totalAmount: vendorBills.totalAmount })
      .from(vendorBills)
      .where(eq(vendorBills.id, billId))
      .limit(1);

    if (bill[0]?.purchaseOrderId) {
      await db.execute(sql`
        UPDATE purchase_orders
        SET billed_amount = billed_amount + ${bill[0].totalAmount}::decimal,
            status = CASE
              WHEN billed_amount + ${bill[0].totalAmount}::decimal >= total_amount::decimal THEN 'BILLED'
              ELSE status
            END,
            updated_at = NOW()
        WHERE id = ${bill[0].purchaseOrderId}
      `);
    }
  }

  private async reversePOBilledAmounts(billId: string): Promise<void> {
    const lines = await db
      .select()
      .from(vendorBillLines)
      .where(eq(vendorBillLines.vendorBillId, billId));

    for (const line of lines) {
      if (line.purchaseOrderLineId) {
        await db.execute(sql`
          UPDATE purchase_order_lines
          SET quantity_billed = GREATEST(0, quantity_billed - ${line.quantity}::decimal),
              updated_at = NOW()
          WHERE id = ${line.purchaseOrderLineId}
        `);
      }
    }

    // Update PO header billed amount
    const bill = await db
      .select({ purchaseOrderId: vendorBills.purchaseOrderId, totalAmount: vendorBills.totalAmount })
      .from(vendorBills)
      .where(eq(vendorBills.id, billId))
      .limit(1);

    if (bill[0]?.purchaseOrderId) {
      await db.execute(sql`
        UPDATE purchase_orders
        SET billed_amount = GREATEST(0, billed_amount - ${bill[0].totalAmount}::decimal),
            status = CASE
              WHEN status = 'BILLED' THEN 'RECEIVED'
              ELSE status
            END,
            updated_at = NOW()
        WHERE id = ${bill[0].purchaseOrderId}
      `);
    }
  }

  private async enrichBillWithDetails(
    bill: typeof vendorBills.$inferSelect,
    includeAll = false
  ): Promise<VendorBillWithDetails> {
    // Get vendor
    const vendor = await db
      .select({ id: entities.id, name: entities.name })
      .from(entities)
      .where(eq(entities.id, bill.vendorId))
      .limit(1);

    // Get PO if linked
    const po = bill.purchaseOrderId
      ? await db
          .select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber })
          .from(purchaseOrders)
          .where(eq(purchaseOrders.id, bill.purchaseOrderId))
          .limit(1)
      : [];

    // Get lines
    const lines = await db
      .select()
      .from(vendorBillLines)
      .where(eq(vendorBillLines.vendorBillId, bill.id))
      .orderBy(asc(vendorBillLines.lineNumber));

    // Get payment applications if requested
    const paymentApps = includeAll
      ? await db
          .select()
          .from(billPaymentApplications)
          .where(and(
            eq(billPaymentApplications.vendorBillId, bill.id),
            isNull(billPaymentApplications.reversedAt)
          ))
      : [];

    // Get approval history if requested
    const approvalHistory = includeAll
      ? await db
          .select()
          .from(vendorBillApprovalHistory)
          .where(eq(vendorBillApprovalHistory.vendorBillId, bill.id))
          .orderBy(desc(vendorBillApprovalHistory.performedAt))
      : [];

    return {
      id: bill.id,
      organizationId: bill.organizationId,
      subsidiaryId: bill.subsidiaryId,
      billNumber: bill.billNumber,
      vendorInvoiceNumber: bill.vendorInvoiceNumber || undefined,
      vendorId: bill.vendorId,
      vendor: vendor[0] ? { id: vendor[0].id, name: vendor[0].name } : undefined,
      vendorName: bill.vendorName || undefined,
      purchaseOrderId: bill.purchaseOrderId || undefined,
      purchaseOrder: po[0] ? { id: po[0].id, poNumber: po[0].poNumber } : undefined,
      billDate: bill.billDate,
      dueDate: bill.dueDate,
      receivedDate: bill.receivedDate || undefined,
      status: bill.status as VendorBillStatusValue,
      threeWayMatchStatus: bill.threeWayMatchStatus as ThreeWayMatchStatusValue,
      matchVarianceAmount: bill.matchVarianceAmount || undefined,
      matchOverrideReason: bill.matchOverrideReason || undefined,
      matchOverrideBy: bill.matchOverrideBy || undefined,
      matchOverrideAt: bill.matchOverrideAt?.toISOString(),
      subtotal: bill.subtotal,
      taxAmount: bill.taxAmount,
      shippingAmount: bill.shippingAmount,
      totalAmount: bill.totalAmount,
      paidAmount: bill.paidAmount,
      balanceDue: bill.balanceDue,
      discountDate: bill.discountDate || undefined,
      discountPercent: bill.discountPercent || undefined,
      discountAmount: bill.discountAmount || undefined,
      discountTaken: bill.discountTaken,
      apAccountId: bill.apAccountId || undefined,
      paymentTerms: bill.paymentTerms || undefined,
      currencyCode: bill.currencyCode || 'USD',
      exchangeRate: bill.exchangeRate || '1',
      currentApproverId: bill.currentApproverId || undefined,
      approvedAt: bill.approvedAt?.toISOString(),
      approvedBy: bill.approvedBy || undefined,
      memo: bill.memo || undefined,
      internalNotes: bill.internalNotes || undefined,
      createdBy: bill.createdBy,
      createdAt: bill.createdAt.toISOString(),
      updatedBy: bill.updatedBy || undefined,
      updatedAt: bill.updatedAt.toISOString(),
      voidedAt: bill.voidedAt?.toISOString(),
      voidedBy: bill.voidedBy || undefined,
      voidReason: bill.voidReason || undefined,
      lines: lines.map(line => ({
        id: line.id,
        vendorBillId: line.vendorBillId,
        lineNumber: line.lineNumber,
        purchaseOrderLineId: line.purchaseOrderLineId || undefined,
        receiptLineId: line.receiptLineId || undefined,
        itemId: line.itemId || undefined,
        itemName: line.itemName,
        itemDescription: line.itemDescription || undefined,
        quantity: line.quantity,
        unitOfMeasure: line.unitOfMeasure || undefined,
        unitPrice: line.unitPrice,
        amount: line.amount,
        taxAmount: line.taxAmount,
        poQuantity: line.poQuantity || undefined,
        poUnitPrice: line.poUnitPrice || undefined,
        receivedQuantity: line.receivedQuantity || undefined,
        quantityVariance: line.quantityVariance || undefined,
        priceVariance: line.priceVariance || undefined,
        matchStatus: line.matchStatus as ThreeWayMatchStatusValue | undefined,
        accountId: line.accountId || undefined,
        departmentId: line.departmentId || undefined,
        locationId: line.locationId || undefined,
        classId: line.classId || undefined,
        projectId: line.projectId || undefined,
        memo: line.memo || undefined,
        createdAt: line.createdAt.toISOString(),
        updatedAt: line.updatedAt.toISOString(),
      })),
      paymentApplications: paymentApps.map(pa => ({
        id: pa.id,
        billPaymentId: pa.billPaymentId,
        vendorBillId: pa.vendorBillId,
        appliedAmount: pa.appliedAmount,
        discountAmount: pa.discountAmount,
        writeOffAmount: pa.writeOffAmount,
        createdBy: pa.createdBy,
        createdAt: pa.createdAt.toISOString(),
        reversedAt: pa.reversedAt?.toISOString(),
        reversedBy: pa.reversedBy || undefined,
        reversalReason: pa.reversalReason || undefined,
      })),
      approvalHistory: approvalHistory.map(ah => ({
        id: ah.id,
        vendorBillId: ah.vendorBillId,
        action: ah.action as BillApprovalActionTypeValue,
        performedBy: ah.performedBy,
        performedByName: ah.performedByName || undefined,
        fromStatus: ah.fromStatus as VendorBillStatusValue | undefined,
        toStatus: ah.toStatus as VendorBillStatusValue,
        comments: ah.comments || undefined,
        performedAt: ah.performedAt.toISOString(),
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
