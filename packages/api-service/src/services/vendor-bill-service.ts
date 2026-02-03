/**
 * Vendor Bill Service
 *
 * Handles vendor bill lifecycle:
 * - Bill creation and management
 * - 3-way match validation (PO ↔ Receipt ↔ Bill)
 * - Approval workflow
 * - Payment tracking
 *
 * NOTE: Data access is delegated to VendorBillRepository and VendorBillLineRepository.
 * This service focuses on business logic, orchestration, and event emission.
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
} from '@glapi/database/schema';
import { type ContextualDatabase } from '@glapi/database';
import {
  VendorBillRepository,
  VendorBillLineRepository,
} from '@glapi/database/repositories';
import Decimal from 'decimal.js';

export interface VendorBillServiceOptions {
  db?: ContextualDatabase;
  vendorBillRepository?: VendorBillRepository;
  vendorBillLineRepository?: VendorBillLineRepository;
}

// ============================================================================
// Vendor Bill Service
// ============================================================================

export class VendorBillService extends BaseService {
  private vendorBillRepo: VendorBillRepository;
  private vendorBillLineRepo: VendorBillLineRepository;
  private eventService: EventService;

  // Tolerance thresholds for 3-way match
  private readonly QUANTITY_TOLERANCE_PERCENT = 0; // 0% tolerance - must match exactly
  private readonly PRICE_TOLERANCE_PERCENT = 0.01; // 1% tolerance for price variances

  constructor(context: ServiceContext = {}, options: VendorBillServiceOptions = {}) {
    super(context);
    // Initialize repositories with optional db context for RLS
    this.vendorBillRepo = options.vendorBillRepository ?? new VendorBillRepository(options.db);
    this.vendorBillLineRepo = options.vendorBillLineRepository ?? new VendorBillLineRepository(options.db);
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

    // Use repository to fetch bills
    const { results: bills, total } = await this.vendorBillRepo.findAll(
      organizationId,
      { skip, take },
      filters
    );

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

    const bill = await this.vendorBillRepo.findById(id, organizationId);
    if (!bill) {
      return null;
    }

    return this.enrichBillWithDetails(bill, true);
  }

  /**
   * Create a new vendor bill (manual entry)
   */
  async createVendorBill(input: CreateVendorBillInput): Promise<VendorBillWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Validate vendor exists
    const vendor = await this.vendorBillRepo.getVendor(input.vendorId);
    if (!vendor) {
      throw new ServiceError('Vendor not found', 'NOT_FOUND', 404);
    }

    // Generate bill number
    const billNumber = await this.vendorBillRepo.generateBillNumber();

    // Calculate line totals
    const { lines, subtotal, taxTotal } = this.calculateLineTotals(input.lines);
    const shippingAmount = 0; // Shipping handled per-line
    const totalAmount = new Decimal(subtotal).plus(taxTotal).plus(shippingAmount).toFixed(2);

    // Determine 3-way match requirement
    const threeWayMatchStatus = input.purchaseOrderId
      ? ThreeWayMatchStatus.PENDING
      : ThreeWayMatchStatus.NOT_REQUIRED;

    // Create bill via repository
    const bill = await this.vendorBillRepo.create({
      organizationId,
      subsidiaryId: input.subsidiaryId,
      billNumber,
      vendorInvoiceNumber: input.vendorInvoiceNumber,
      vendorId: input.vendorId,
      vendorName: vendor.name,
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
    });

    // Create lines via repository
    const lineData = lines.map((line, i) => ({
      vendorBillId: bill.id,
      lineNumber: line.lineNumber || i + 1,
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
    }));
    await this.vendorBillLineRepo.createMany(lineData);

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

    // Get PO via repository
    const po = await this.vendorBillRepo.getPurchaseOrderFull(input.purchaseOrderId, organizationId);
    if (!po) {
      throw new ServiceError('Purchase order not found', 'NOT_FOUND', 404);
    }

    // PO must be received
    if (po.status !== 'RECEIVED' && po.status !== 'PARTIALLY_RECEIVED') {
      throw new ServiceError(
        'Purchase order must be in RECEIVED or PARTIALLY_RECEIVED status to create a bill',
        'VALIDATION_ERROR',
        400
      );
    }

    // Get PO lines via repository
    const poLines = await this.vendorBillLineRepo.getPurchaseOrderLines(input.purchaseOrderId);

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
      subsidiaryId: po.subsidiaryId,
      vendorId: po.vendorId,
      vendorInvoiceNumber: input.vendorInvoiceNumber,
      purchaseOrderId: input.purchaseOrderId,
      billDate: input.billDate,
      dueDate: input.dueDate,
      discountDate: input.discountDate,
      discountPercent: input.discountPercent,
      paymentTerms: po.paymentTerms || undefined,
      currencyCode: po.currencyCode || 'USD',
      exchangeRate: po.exchangeRate || undefined,
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
        // Get PO line via repository
        const poLine = await this.vendorBillLineRepo.getPurchaseOrderLine(billLine.purchaseOrderLineId);

        if (poLine) {
          lineResult.poQuantity = poLine.quantity;
          lineResult.poUnitPrice = poLine.unitPrice;

          // Get received quantity for this PO line via repository
          lineResult.receivedQuantity = await this.vendorBillLineRepo.getReceivedQuantity(
            billLine.purchaseOrderLineId
          );

          // Calculate variances
          const billedQty = new Decimal(billLine.quantity);
          const receivedQty = new Decimal(lineResult.receivedQuantity);
          const billedPrice = new Decimal(billLine.unitPrice);
          const poPrice = new Decimal(poLine.unitPrice);

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

      // Update line match status via repository
      await this.vendorBillLineRepo.updateMatchStatus(billLine.id, {
        poQuantity: lineResult.poQuantity,
        poUnitPrice: lineResult.poUnitPrice,
        receivedQuantity: lineResult.receivedQuantity,
        quantityVariance: lineResult.quantityVariance,
        priceVariance: lineResult.priceVariance,
        matchStatus: lineResult.matchStatus,
      });

      lineResults.push(lineResult);
    }

    // Update bill match status via repository
    const overallStatus = hasExceptions
      ? ThreeWayMatchStatus.EXCEPTION
      : ThreeWayMatchStatus.MATCHED;

    await this.vendorBillRepo.updateMatchStatus(billId, overallStatus, totalVariance.toFixed(2));

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
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const bill = await this.getVendorBillById(input.vendorBillId);
    if (!bill) {
      throw new ServiceError('Vendor bill not found', 'NOT_FOUND', 404);
    }

    if (bill.threeWayMatchStatus !== ThreeWayMatchStatus.EXCEPTION) {
      throw new ServiceError('Bill does not have match exceptions to override', 'VALIDATION_ERROR', 400);
    }

    // Update match status to override via repository
    await this.vendorBillRepo.update(input.vendorBillId, organizationId, {
      threeWayMatchStatus: ThreeWayMatchStatus.OVERRIDE,
      matchOverrideReason: input.reason,
      matchOverrideBy: userId,
      matchOverrideAt: new Date(),
      updatedBy: userId,
    });

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

    // Update status via repository
    await this.vendorBillRepo.updateStatus(
      input.vendorBillId,
      organizationId,
      VendorBillStatus.PENDING_APPROVAL,
      userId
    );

    // Record approval history via repository
    await this.vendorBillRepo.recordApprovalHistory({
      vendorBillId: input.vendorBillId,
      action: BillApprovalActionType.SUBMITTED,
      fromStatus: bill.status,
      toStatus: VendorBillStatus.PENDING_APPROVAL,
      performedBy: userId,
      comments: input.comments,
    });

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

    // Build additional fields for approve action
    const additionalFields: Record<string, unknown> = {};
    if (input.action === 'APPROVE') {
      additionalFields.approvedAt = new Date();
      additionalFields.approvedBy = userId;
    }

    // Update status via repository
    await this.vendorBillRepo.updateStatus(
      input.vendorBillId,
      organizationId,
      newStatus,
      userId,
      additionalFields
    );

    // Update PO billed amounts if approved
    if (input.action === 'APPROVE' && bill.purchaseOrderId) {
      await this.updatePOBilledAmounts(input.vendorBillId);
    }

    // Record approval history via repository
    await this.vendorBillRepo.recordApprovalHistory({
      vendorBillId: input.vendorBillId,
      action: actionType,
      fromStatus: bill.status,
      toStatus: newStatus,
      performedBy: userId,
      comments: input.comments,
    });

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

    // Update status via repository
    await this.vendorBillRepo.updateStatus(id, organizationId, VendorBillStatus.VOIDED, userId, {
      voidedAt: new Date(),
      voidedBy: userId,
      voidReason: reason,
    });

    // Reverse PO billed amounts if applicable
    if (bill.purchaseOrderId && bill.status === VendorBillStatus.APPROVED) {
      await this.reversePOBilledAmounts(id);
    }

    // Record history via repository
    await this.vendorBillRepo.recordApprovalHistory({
      vendorBillId: id,
      action: BillApprovalActionType.VOIDED,
      fromStatus: bill.status,
      toStatus: VendorBillStatus.VOIDED,
      performedBy: userId,
      comments: reason,
    });

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

    // Update via repository
    await this.vendorBillRepo.updatePaymentAmounts(
      billId,
      newPaid.toFixed(2),
      newDiscount.toFixed(2),
      newBalance.lt(0) ? '0' : newBalance.toFixed(2),
      newStatus
    );
  }

  // ==========================================================================
  // REPORTING
  // ==========================================================================

  /**
   * Get vendor account summary
   */
  async getVendorAccountSummary(vendorId: string): Promise<VendorAccountSummary> {
    const organizationId = this.requireOrganizationContext();

    // Get vendor info via repository
    const vendor = await this.vendorBillRepo.getVendor(vendorId);
    if (!vendor) {
      throw new ServiceError('Vendor not found', 'NOT_FOUND', 404);
    }

    // Get bill totals via repository
    const billStats = await this.vendorBillRepo.getVendorAccountSummary(
      vendorId,
      organizationId,
      [VendorBillStatus.APPROVED, VendorBillStatus.PARTIALLY_PAID]
    );

    // Get unapplied credits
    // (would need vendor credit memo query here)
    const totalUnappliedCredits = '0';

    return {
      vendorId,
      vendorName: vendor.name,
      totalOutstanding: billStats?.totalOutstanding || '0',
      totalOverdue: billStats?.totalOverdue || '0',
      totalUnappliedCredits,
      oldestBillDate: billStats?.oldestBillDate,
      billCount: Number(billStats?.billCount || 0),
      overdueBillCount: Number(billStats?.overdueBillCount || 0),
    };
  }

  /**
   * Get AP aging summary
   */
  async getAPAgingSummary(subsidiaryId?: string): Promise<APAgingSummary> {
    const organizationId = this.requireOrganizationContext();

    // Get aging data via repository
    const agingResult = await this.vendorBillRepo.getAPAgingSummary(
      organizationId,
      [VendorBillStatus.APPROVED, VendorBillStatus.PARTIALLY_PAID],
      subsidiaryId
    );

    return {
      current: agingResult?.current || '0',
      days1to30: agingResult?.days1to30 || '0',
      days31to60: agingResult?.days31to60 || '0',
      days61to90: agingResult?.days61to90 || '0',
      over90: agingResult?.over90 || '0',
      total: agingResult?.total || '0',
    };
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

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

  private async updatePOBilledAmounts(billId: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    // Get bill lines via repository
    const lines = await this.vendorBillLineRepo.findByBillId(billId);

    for (const line of lines) {
      if (line.purchaseOrderLineId) {
        await this.vendorBillLineRepo.updatePOLineBilledQuantity(
          line.purchaseOrderLineId,
          line.quantity
        );
      }
    }

    // Update PO header billed amount
    const bill = await this.vendorBillRepo.findById(billId, organizationId);
    if (bill?.purchaseOrderId) {
      await this.vendorBillRepo.updatePOBilledAmount(bill.purchaseOrderId, bill.totalAmount);
    }
  }

  private async reversePOBilledAmounts(billId: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    // Get bill lines via repository
    const lines = await this.vendorBillLineRepo.findByBillId(billId);

    for (const line of lines) {
      if (line.purchaseOrderLineId) {
        await this.vendorBillLineRepo.reversePOLineBilledQuantity(
          line.purchaseOrderLineId,
          line.quantity
        );
      }
    }

    // Update PO header billed amount
    const bill = await this.vendorBillRepo.findById(billId, organizationId);
    if (bill?.purchaseOrderId) {
      await this.vendorBillRepo.reversePOBilledAmount(bill.purchaseOrderId, bill.totalAmount);
    }
  }

  private async enrichBillWithDetails(
    bill: Parameters<typeof this.vendorBillRepo.findById> extends [infer _, infer __] ? Awaited<ReturnType<typeof this.vendorBillRepo.findById>> : never,
    includeAll = false
  ): Promise<VendorBillWithDetails> {
    if (!bill) {
      throw new ServiceError('Bill not found', 'NOT_FOUND', 404);
    }

    // Get vendor via repository
    const vendor = await this.vendorBillRepo.getVendor(bill.vendorId);

    // Get PO if linked via repository
    const po = bill.purchaseOrderId
      ? await this.vendorBillRepo.getPurchaseOrder(bill.purchaseOrderId)
      : null;

    // Get lines via repository
    const lines = await this.vendorBillLineRepo.findByBillId(bill.id);

    // Get payment applications if requested via repository
    const paymentApps = includeAll
      ? await this.vendorBillRepo.getPaymentApplications(bill.id)
      : [];

    // Get approval history if requested via repository
    const approvalHistory = includeAll
      ? await this.vendorBillRepo.getApprovalHistory(bill.id)
      : [];

    return {
      id: bill.id,
      organizationId: bill.organizationId,
      subsidiaryId: bill.subsidiaryId,
      billNumber: bill.billNumber,
      vendorInvoiceNumber: bill.vendorInvoiceNumber || undefined,
      vendorId: bill.vendorId,
      vendor: vendor ? { id: vendor.id, name: vendor.name } : undefined,
      vendorName: bill.vendorName || undefined,
      purchaseOrderId: bill.purchaseOrderId || undefined,
      purchaseOrder: po ? { id: po.id, poNumber: po.poNumber } : undefined,
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
