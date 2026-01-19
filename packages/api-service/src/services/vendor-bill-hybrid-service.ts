/**
 * Vendor Bill Hybrid Service
 *
 * Handles vendor bill lifecycle using the hybrid transaction model:
 * - Uses transaction_headers + transaction_lines (core tables)
 * - Uses vendor_bill_ext + vendor_bill_line_ext (extension tables)
 *
 * Features:
 * - Bill creation (manual or from PO)
 * - 3-way match validation (PO ↔ Receipt ↔ Bill)
 * - Approval workflow
 * - Payment tracking
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
} from '../types/transaction.types';
import { db } from '@glapi/database';
import {
  transactionHeaders,
  transactionLines,
  TransactionHeader,
  TransactionLine,
  vendorBillExt,
  vendorBillLineExt,
  VendorBillExtRecord,
  VendorBillLineExtRecord,
  HybridVendorBillStatus,
  HybridVendorBillStatusValue,
  HybridThreeWayMatchStatus,
  HybridLineMatchStatus,
  HybridLineMatchStatusValue,
  purchaseOrderExt,
  purchaseOrderLineExt,
  entities,
  accounts,
} from '@glapi/database/schema';
import { eq, and, desc, asc, sql, inArray, gte, lte, or, ilike } from 'drizzle-orm';
import Decimal from 'decimal.js';

// ============================================================================
// Types
// ============================================================================

export interface VendorBillHeader extends BaseTransactionHeader {
  vendorInvoiceNumber?: string;
  purchaseOrderId?: string;
  dueDate: string;
  receivedDate?: string;
  shippingAmount: string;
  threeWayMatchStatus: string;
  matchVarianceAmount?: string;
  matchOverrideReason?: string;
  matchOverrideBy?: string;
  matchOverrideAt?: string;
  paidAmount: string;
  balanceDue: string;
  discountDate?: string;
  discountPercent?: string;
  discountAmount?: string;
  discountTaken: string;
  apAccountId?: string;
  currentApproverId?: string;
  approvedAt?: string;
  approvedBy?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
}

export interface VendorBillLine extends BaseTransactionLine {
  purchaseOrderLineId?: string;
  receiptLineId?: string;
  poQuantity?: string;
  poUnitPrice?: string;
  receivedQuantity?: string;
  quantityVariance?: string;
  priceVariance?: string;
  matchStatus: string;
}

export interface VendorBillWithDetails {
  header: VendorBillHeader;
  lines: VendorBillLine[];
  vendor?: { id: string; name: string };
  purchaseOrder?: { id: string; transactionNumber: string };
}

export interface CreateVendorBillHybridInput {
  subsidiaryId: string;
  vendorId: string;
  vendorInvoiceNumber?: string;
  purchaseOrderId?: string;
  billDate: string | Date;
  dueDate: string | Date;
  receivedDate?: string | Date;
  discountDate?: string | Date;
  discountPercent?: number;
  discountAmount?: number;
  apAccountId?: string;
  paymentTerms?: string;
  currencyCode?: string;
  exchangeRate?: number;
  memo?: string;
  internalNotes?: string;
  lines: CreateVendorBillLineInput[];
}

export interface CreateVendorBillLineInput {
  lineNumber?: number;
  purchaseOrderLineId?: string;
  receiptLineId?: string;
  itemId?: string;
  itemName: string;
  itemDescription?: string;
  quantity: number;
  unitOfMeasure?: string;
  unitPrice: number;
  taxAmount?: number;
  accountId?: string;
  departmentId?: string;
  locationId?: string;
  classId?: string;
  projectId?: string;
  memo?: string;
}

export interface VendorBillHybridFilters extends TransactionFilters {
  vendorId?: string;
  purchaseOrderId?: string;
  threeWayMatchStatus?: string;
  billDateFrom?: string | Date;
  billDateTo?: string | Date;
  hasBalance?: boolean;
}

export interface ThreeWayMatchResult {
  vendorBillId: string;
  overallStatus: string;
  totalVariance: string;
  lineResults: ThreeWayMatchLineResult[];
  canApprove: boolean;
  requiresOverride: boolean;
}

export interface ThreeWayMatchLineResult {
  vendorBillLineId: string;
  purchaseOrderLineId?: string;
  receiptLineId?: string;
  matchStatus: string;
  billedQuantity: string;
  billedUnitPrice: string;
  poQuantity?: string;
  poUnitPrice?: string;
  receivedQuantity?: string;
  quantityVariance?: string;
  priceVariance?: string;
  totalVariance: string;
  exceptions: string[];
}

// Valid status transitions for vendor bills
const VALID_BILL_TRANSITIONS: Record<HybridVendorBillStatusValue, HybridVendorBillStatusValue[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['PARTIALLY_PAID', 'PAID', 'VOIDED'],
  PENDING_MATCH: ['MATCHED', 'MATCH_EXCEPTION', 'CANCELLED'],
  MATCHED: ['PENDING_APPROVAL', 'APPROVED', 'CANCELLED'],
  MATCH_EXCEPTION: ['MATCHED', 'PENDING_APPROVAL', 'CANCELLED'],
  PARTIALLY_PAID: ['PAID', 'VOIDED'],
  PAID: ['VOIDED'],
  VOIDED: [],
  CANCELLED: [],
};

// ============================================================================
// Vendor Bill Hybrid Service
// ============================================================================

export class VendorBillHybridService extends BaseTransactionService {
  protected transactionType = TransactionTypeCode.VENDOR_BILL;
  protected eventCategory = 'PROCUREMENT' as const;

  // Tolerance thresholds for 3-way match
  private readonly QUANTITY_TOLERANCE_PERCENT = 0; // 0% tolerance - must match exactly
  private readonly PRICE_TOLERANCE_PERCENT = 0.01; // 1% tolerance for price variances

  constructor(context: ServiceContext = {}) {
    super(context);
  }

  // ==========================================================================
  // LIST Operations
  // ==========================================================================

  /**
   * List vendor bills with filters and pagination
   */
  async listVendorBills(
    params: PaginationParams = {},
    filters: VendorBillHybridFilters = {}
  ): Promise<PaginatedResult<VendorBillWithDetails>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(params);

    // Build where conditions for core header
    const conditions = [
      eq(transactionHeaders.organizationId, organizationId),
      eq(transactionHeaders.transactionType, TransactionTypeCode.VENDOR_BILL),
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

    if (filters.dateFrom || filters.billDateFrom) {
      const dateFrom = filters.dateFrom || filters.billDateFrom!;
      const dateStr = typeof dateFrom === 'string'
        ? dateFrom
        : dateFrom.toISOString().split('T')[0];
      conditions.push(gte(transactionHeaders.transactionDate, dateStr));
    }

    if (filters.dateTo || filters.billDateTo) {
      const dateTo = filters.dateTo || filters.billDateTo!;
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
        ext: vendorBillExt,
      })
      .from(transactionHeaders)
      .leftJoin(vendorBillExt, eq(transactionHeaders.id, vendorBillExt.transactionId))
      .where(and(...conditions))
      .orderBy(desc(transactionHeaders.createdAt))
      .limit(take)
      .offset(skip);

    // Enrich with details
    const billsWithDetails = await Promise.all(
      rows.map(async (row) => this.enrichWithDetails(row.header, row.ext))
    );

    return this.createPaginatedResult(billsWithDetails, total, page, limit);
  }

  // ==========================================================================
  // GET Operations
  // ==========================================================================

  /**
   * Get a single vendor bill by ID
   */
  async getVendorBillById(id: string): Promise<VendorBillWithDetails | null> {
    const organizationId = this.requireOrganizationContext();

    const rows = await db
      .select({
        header: transactionHeaders,
        ext: vendorBillExt,
      })
      .from(transactionHeaders)
      .leftJoin(vendorBillExt, eq(transactionHeaders.id, vendorBillExt.transactionId))
      .where(
        and(
          eq(transactionHeaders.id, id),
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.transactionType, TransactionTypeCode.VENDOR_BILL)
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
   * Create a new vendor bill using hybrid model
   */
  async createVendorBill(input: CreateVendorBillHybridInput): Promise<VendorBillWithDetails> {
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
    const billNumber = await this.generateTransactionNumber();

    // Calculate line totals
    const { lines, subtotal, taxTotal, totalAmount } = this.calculateLineTotals(input.lines);

    // Determine 3-way match requirement
    const threeWayMatchStatus = input.purchaseOrderId
      ? HybridThreeWayMatchStatus.PENDING
      : HybridThreeWayMatchStatus.NOT_REQUIRED;

    // Create transaction header (core table)
    const header = await this.createHeader({
      subsidiaryId: input.subsidiaryId,
      transactionType: TransactionTypeCode.VENDOR_BILL,
      transactionNumber: billNumber,
      entityId: input.vendorId,
      entityName: vendor[0].name,
      transactionDate: this.toDateString(input.billDate),
      status: HybridVendorBillStatus.DRAFT,
      subtotal: subtotal.toString(),
      taxAmount: taxTotal.toString(),
      totalAmount: totalAmount.toString(),
      currencyCode: input.currencyCode || 'USD',
      exchangeRate: (input.exchangeRate || 1).toString(),
      memo: input.memo,
      internalNotes: input.internalNotes,
      createdBy: userId,
    });

    // Create vendor bill extension (type-specific fields)
    await db.insert(vendorBillExt).values({
      transactionId: header.id,
      vendorInvoiceNumber: input.vendorInvoiceNumber,
      purchaseOrderId: input.purchaseOrderId,
      dueDate: this.toDateString(input.dueDate),
      receivedDate: input.receivedDate ? this.toDateString(input.receivedDate) : null,
      shippingAmount: '0',
      threeWayMatchStatus,
      paidAmount: '0',
      balanceDue: totalAmount.toString(),
      discountDate: input.discountDate ? this.toDateString(input.discountDate) : null,
      discountPercent: input.discountPercent?.toString(),
      discountAmount: input.discountAmount?.toString(),
      discountTaken: '0',
      apAccountId: input.apAccountId,
    });

    // Create transaction lines (core table)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const originalLine = input.lines[i];
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

      // Create line extension (bill-specific fields for 3-way match)
      await db.insert(vendorBillLineExt).values({
        lineId: createdLine.id,
        purchaseOrderLineId: originalLine.purchaseOrderLineId,
        receiptLineId: originalLine.receiptLineId,
        matchStatus: HybridLineMatchStatus.NOT_REQUIRED,
      });
    }

    // Perform 3-way match if linked to PO
    if (input.purchaseOrderId) {
      await this.performThreeWayMatch(header.id);
    }

    // Emit event
    await this.emitEvent('VendorBillCreated', header.id, {
      billNumber: header.transactionNumber,
      vendorId: input.vendorId,
      totalAmount: header.totalAmount,
      purchaseOrderId: input.purchaseOrderId,
      lineCount: lines.length,
    });

    return (await this.getVendorBillById(header.id))!;
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

    const ext = await db
      .select()
      .from(vendorBillExt)
      .where(eq(vendorBillExt.transactionId, billId))
      .limit(1);

    if (!ext[0]?.purchaseOrderId) {
      return {
        vendorBillId: billId,
        overallStatus: HybridThreeWayMatchStatus.NOT_REQUIRED,
        totalVariance: '0',
        lineResults: [],
        canApprove: true,
        requiresOverride: false,
      };
    }

    const lineResults: ThreeWayMatchLineResult[] = [];
    let totalVariance = new Decimal(0);
    let hasExceptions = false;

    // Get bill lines with extensions
    const billLines = await this.getBillLinesWithExtensions(billId);

    for (const billLine of billLines) {
      const lineResult: ThreeWayMatchLineResult = {
        vendorBillLineId: billLine.line.id,
        purchaseOrderLineId: billLine.ext?.purchaseOrderLineId || undefined,
        receiptLineId: billLine.ext?.receiptLineId || undefined,
        matchStatus: HybridThreeWayMatchStatus.MATCHED,
        billedQuantity: billLine.line.quantity,
        billedUnitPrice: billLine.line.unitPrice,
        totalVariance: '0',
        exceptions: [],
      };

      if (billLine.ext?.purchaseOrderLineId) {
        // Get PO line with extension
        const poLineData = await this.getPOLineWithExtension(billLine.ext.purchaseOrderLineId);

        if (poLineData) {
          lineResult.poQuantity = poLineData.line.quantity;
          lineResult.poUnitPrice = poLineData.line.unitPrice;
          lineResult.receivedQuantity = poLineData.ext?.quantityReceived || '0';

          // Calculate variances
          const billedQty = new Decimal(billLine.line.quantity);
          const billedPrice = new Decimal(billLine.line.unitPrice);
          const poPrice = new Decimal(poLineData.line.unitPrice);
          const poQty = new Decimal(poLineData.line.quantity);
          const receivedQty = new Decimal(lineResult.receivedQuantity);

          // Determine match type: 2-way (PO only) or 3-way (with receipt)
          const hasReceipt = billLine.ext?.receiptLineId || receivedQty.gt(0);

          // Quantity variance
          // 3-way match: billed vs received (if receipt exists)
          // 2-way match: billed vs PO ordered (if no receipt)
          const compareQty = hasReceipt ? receivedQty : poQty;
          const compareQtyLabel = hasReceipt ? 'received' : 'ordered';

          const qtyVariance = billedQty.minus(compareQty);
          if (!qtyVariance.eq(0)) {
            lineResult.quantityVariance = qtyVariance.toFixed(4);

            const toleranceQty = compareQty.times(this.QUANTITY_TOLERANCE_PERCENT);
            if (qtyVariance.abs().gt(toleranceQty)) {
              lineResult.exceptions.push(
                `Quantity variance: billed ${billedQty.toFixed(2)} vs ${compareQtyLabel} ${compareQty.toFixed(2)}`
              );
            }
          }

          // Price variance (billed vs PO)
          const priceVariance = billedPrice.minus(poPrice);
          if (!priceVariance.eq(0)) {
            lineResult.priceVariance = priceVariance.times(billedQty).toFixed(4);

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
          lineResult.totalVariance = lineVariance.toFixed(4);
          totalVariance = totalVariance.plus(lineVariance.abs());

          // Determine line match status
          if (lineResult.exceptions.length > 0) {
            lineResult.matchStatus = HybridThreeWayMatchStatus.VARIANCE_EXCEPTION;
            hasExceptions = true;
          }
        }
      }

      // Update line extension with match results
      await db
        .update(vendorBillLineExt)
        .set({
          poQuantity: lineResult.poQuantity,
          poUnitPrice: lineResult.poUnitPrice,
          receivedQuantity: lineResult.receivedQuantity,
          quantityVariance: lineResult.quantityVariance,
          priceVariance: lineResult.priceVariance,
          matchStatus: this.mapMatchStatusToLineStatus(lineResult),
        })
        .where(eq(vendorBillLineExt.lineId, billLine.line.id));

      lineResults.push(lineResult);
    }

    // Update bill match status
    const overallStatus = hasExceptions
      ? HybridThreeWayMatchStatus.VARIANCE_EXCEPTION
      : HybridThreeWayMatchStatus.MATCHED;

    await db
      .update(vendorBillExt)
      .set({
        threeWayMatchStatus: overallStatus,
        matchVarianceAmount: totalVariance.toFixed(4),
      })
      .where(eq(vendorBillExt.transactionId, billId));

    // Emit event
    await this.emitEvent('ThreeWayMatchCompleted', billId, {
      billNumber: bill.header.transactionNumber,
      overallStatus,
      totalVariance: totalVariance.toFixed(4),
      exceptionCount: lineResults.filter(l => l.exceptions.length > 0).length,
    });

    return {
      vendorBillId: billId,
      overallStatus,
      totalVariance: totalVariance.toFixed(4),
      lineResults,
      canApprove: overallStatus === HybridThreeWayMatchStatus.MATCHED,
      requiresOverride: hasExceptions,
    };
  }

  /**
   * Override a 3-way match exception (with approval)
   */
  async overrideMatchException(
    billId: string,
    reason: string
  ): Promise<VendorBillWithDetails> {
    const userId = this.requireUserContext();

    const bill = await this.getVendorBillById(billId);
    if (!bill) {
      throw new ServiceError('Vendor bill not found', 'NOT_FOUND', 404);
    }

    if (bill.header.threeWayMatchStatus !== HybridThreeWayMatchStatus.VARIANCE_EXCEPTION) {
      throw new ServiceError('Bill does not have match exceptions to override', 'VALIDATION_ERROR', 400);
    }

    // Update match status to override
    await db
      .update(vendorBillExt)
      .set({
        threeWayMatchStatus: HybridThreeWayMatchStatus.OVERRIDE_APPROVED,
        matchOverrideReason: reason,
        matchOverrideBy: userId,
        matchOverrideAt: new Date(),
      })
      .where(eq(vendorBillExt.transactionId, billId));

    // Emit event
    await this.emitEvent('MatchExceptionOverridden', billId, {
      billNumber: bill.header.transactionNumber,
      reason,
      varianceAmount: bill.header.matchVarianceAmount,
    });

    return (await this.getVendorBillById(billId))!;
  }

  // ==========================================================================
  // APPROVAL WORKFLOW
  // ==========================================================================

  /**
   * Submit a vendor bill for approval
   */
  async submitVendorBill(
    billId: string,
    comments?: string
  ): Promise<VendorBillWithDetails> {
    const userId = this.requireUserContext();

    const bill = await this.getVendorBillById(billId);
    if (!bill) {
      throw new ServiceError('Vendor bill not found', 'NOT_FOUND', 404);
    }

    // Validate current status
    if (bill.header.status !== HybridVendorBillStatus.DRAFT) {
      throw new ServiceError(
        `Cannot submit bill in ${bill.header.status} status`,
        'VALIDATION_ERROR',
        400
      );
    }

    // Check 3-way match status
    if (bill.header.threeWayMatchStatus === HybridThreeWayMatchStatus.VARIANCE_EXCEPTION) {
      throw new ServiceError(
        'Cannot submit bill with unresolved 3-way match exceptions. Override or correct the exceptions first.',
        'VALIDATION_ERROR',
        400
      );
    }

    // Update status
    await this.updateStatus(billId, HybridVendorBillStatus.PENDING_APPROVAL);

    // Emit event
    await this.emitEvent('VendorBillSubmitted', billId, {
      billNumber: bill.header.transactionNumber,
      totalAmount: bill.header.totalAmount,
      submittedBy: userId,
      comments,
    });

    return (await this.getVendorBillById(billId))!;
  }

  /**
   * Approve or reject a vendor bill
   */
  async approveVendorBill(
    billId: string,
    action: 'APPROVE' | 'REJECT' | 'RETURN',
    comments?: string
  ): Promise<VendorBillWithDetails> {
    const userId = this.requireUserContext();

    const bill = await this.getVendorBillById(billId);
    if (!bill) {
      throw new ServiceError('Vendor bill not found', 'NOT_FOUND', 404);
    }

    // Only pending bills can be approved/rejected
    if (bill.header.status !== HybridVendorBillStatus.PENDING_APPROVAL) {
      throw new ServiceError(
        `Vendor bill must be in PENDING_APPROVAL status to ${action.toLowerCase()}`,
        'VALIDATION_ERROR',
        400
      );
    }

    let newStatus: HybridVendorBillStatusValue;

    switch (action) {
      case 'APPROVE':
        newStatus = HybridVendorBillStatus.APPROVED;
        break;
      case 'REJECT':
        newStatus = HybridVendorBillStatus.CANCELLED;
        break;
      case 'RETURN':
        newStatus = HybridVendorBillStatus.DRAFT;
        break;
      default:
        throw new ServiceError(`Invalid action: ${action}`, 'VALIDATION_ERROR', 400);
    }

    // Update status
    await this.updateStatus(billId, newStatus);

    // Update extension with approval info
    if (action === 'APPROVE') {
      await db
        .update(vendorBillExt)
        .set({
          approvedAt: new Date(),
          approvedBy: userId,
        })
        .where(eq(vendorBillExt.transactionId, billId));

      // Update PO billed amounts
      const ext = await db
        .select({ purchaseOrderId: vendorBillExt.purchaseOrderId })
        .from(vendorBillExt)
        .where(eq(vendorBillExt.transactionId, billId))
        .limit(1);

      if (ext[0]?.purchaseOrderId) {
        await this.updatePOBilledAmounts(billId, ext[0].purchaseOrderId);
      }
    }

    // Emit event
    await this.emitEvent(`VendorBill${action.charAt(0) + action.slice(1).toLowerCase()}d`, billId, {
      billNumber: bill.header.transactionNumber,
      action,
      approvedBy: userId,
      comments,
    });

    return (await this.getVendorBillById(billId))!;
  }

  /**
   * Void a vendor bill
   */
  async voidVendorBill(
    billId: string,
    reason: string
  ): Promise<VendorBillWithDetails> {
    const userId = this.requireUserContext();

    const bill = await this.getVendorBillById(billId);
    if (!bill) {
      throw new ServiceError('Vendor bill not found', 'NOT_FOUND', 404);
    }

    // Check if bill has payments
    const paidAmount = new Decimal(bill.header.paidAmount);
    if (paidAmount.gt(0)) {
      throw new ServiceError(
        'Cannot void a bill that has payments applied. Reverse the payments first.',
        'VALIDATION_ERROR',
        400
      );
    }

    // Update status
    await this.updateStatus(billId, HybridVendorBillStatus.VOIDED);

    // Update extension
    await db
      .update(vendorBillExt)
      .set({
        voidedAt: new Date(),
        voidedBy: userId,
        voidReason: reason,
      })
      .where(eq(vendorBillExt.transactionId, billId));

    // Reverse PO billed amounts if applicable
    const ext = await db
      .select({ purchaseOrderId: vendorBillExt.purchaseOrderId })
      .from(vendorBillExt)
      .where(eq(vendorBillExt.transactionId, billId))
      .limit(1);

    if (ext[0]?.purchaseOrderId && bill.header.status === HybridVendorBillStatus.APPROVED) {
      await this.reversePOBilledAmounts(billId, ext[0].purchaseOrderId);
    }

    // Emit event
    await this.emitEvent('VendorBillVoided', billId, {
      billNumber: bill.header.transactionNumber,
      reason,
      voidedBy: userId,
    });

    return (await this.getVendorBillById(billId))!;
  }

  // ==========================================================================
  // PAYMENT TRACKING (called by BillPaymentHybridService)
  // ==========================================================================

  /**
   * Update bill payment amounts
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

    const currentPaid = new Decimal(bill.header.paidAmount);
    const currentDiscount = new Decimal(bill.header.discountTaken);
    const total = new Decimal(bill.header.totalAmount);

    const newPaid = currentPaid.plus(appliedAmount);
    const newDiscount = currentDiscount.plus(discountTaken);
    const newBalance = total.minus(newPaid).minus(newDiscount);

    // Determine new status
    let newStatus = bill.header.status;
    if (newBalance.lte(0)) {
      newStatus = HybridVendorBillStatus.PAID;
    } else if (newPaid.gt(0)) {
      newStatus = HybridVendorBillStatus.PARTIALLY_PAID;
    }

    // Update header status
    await this.updateStatus(billId, newStatus);

    // Update extension payment fields
    await db
      .update(vendorBillExt)
      .set({
        paidAmount: newPaid.toFixed(4),
        discountTaken: newDiscount.toFixed(4),
        balanceDue: newBalance.lt(0) ? '0' : newBalance.toFixed(4),
      })
      .where(eq(vendorBillExt.transactionId, billId));
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async getBillLinesWithExtensions(billId: string): Promise<Array<{
    line: TransactionLine;
    ext: VendorBillLineExtRecord | null;
  }>> {
    const rows = await db
      .select({
        line: transactionLines,
        ext: vendorBillLineExt,
      })
      .from(transactionLines)
      .leftJoin(vendorBillLineExt, eq(transactionLines.id, vendorBillLineExt.lineId))
      .where(eq(transactionLines.transactionId, billId))
      .orderBy(asc(transactionLines.lineNumber));

    return rows;
  }

  private async getPOLineWithExtension(poLineId: string): Promise<{
    line: TransactionLine;
    ext: typeof purchaseOrderLineExt.$inferSelect | null;
  } | null> {
    const rows = await db
      .select({
        line: transactionLines,
        ext: purchaseOrderLineExt,
      })
      .from(transactionLines)
      .leftJoin(purchaseOrderLineExt, eq(transactionLines.id, purchaseOrderLineExt.lineId))
      .where(eq(transactionLines.id, poLineId))
      .limit(1);

    return rows[0] || null;
  }

  private mapMatchStatusToLineStatus(result: ThreeWayMatchLineResult): HybridLineMatchStatusValue {
    if (result.exceptions.length === 0) {
      return HybridLineMatchStatus.MATCHED;
    }

    const hasQtyVariance = result.quantityVariance && new Decimal(result.quantityVariance).abs().gt(0);
    const hasPriceVariance = result.priceVariance && new Decimal(result.priceVariance).abs().gt(0);

    if (hasQtyVariance && hasPriceVariance) {
      return HybridLineMatchStatus.BOTH_VARIANCE;
    } else if (hasQtyVariance) {
      return HybridLineMatchStatus.QUANTITY_VARIANCE;
    } else if (hasPriceVariance) {
      return HybridLineMatchStatus.PRICE_VARIANCE;
    }

    return HybridLineMatchStatus.MATCHED;
  }

  private async updatePOBilledAmounts(billId: string, purchaseOrderId: string): Promise<void> {
    // Get bill lines
    const lines = await this.getBillLinesWithExtensions(billId);

    // Update PO line billed quantities
    for (const { line, ext } of lines) {
      if (ext?.purchaseOrderLineId) {
        await db.execute(sql`
          UPDATE purchase_order_line_ext
          SET quantity_billed = quantity_billed + ${line.quantity}::decimal
          WHERE line_id = ${ext.purchaseOrderLineId}
        `);
      }
    }

    // Update PO header billed amount
    const header = await db
      .select({ totalAmount: transactionHeaders.totalAmount })
      .from(transactionHeaders)
      .where(eq(transactionHeaders.id, billId))
      .limit(1);

    if (header[0]) {
      await db.execute(sql`
        UPDATE purchase_order_ext
        SET billed_amount = billed_amount + ${header[0].totalAmount}::decimal
        WHERE transaction_id = ${purchaseOrderId}
      `);
    }
  }

  private async reversePOBilledAmounts(billId: string, purchaseOrderId: string): Promise<void> {
    // Get bill lines
    const lines = await this.getBillLinesWithExtensions(billId);

    // Reverse PO line billed quantities
    for (const { line, ext } of lines) {
      if (ext?.purchaseOrderLineId) {
        await db.execute(sql`
          UPDATE purchase_order_line_ext
          SET quantity_billed = GREATEST(0, quantity_billed - ${line.quantity}::decimal)
          WHERE line_id = ${ext.purchaseOrderLineId}
        `);
      }
    }

    // Reverse PO header billed amount
    const header = await db
      .select({ totalAmount: transactionHeaders.totalAmount })
      .from(transactionHeaders)
      .where(eq(transactionHeaders.id, billId))
      .limit(1);

    if (header[0]) {
      await db.execute(sql`
        UPDATE purchase_order_ext
        SET billed_amount = GREATEST(0, billed_amount - ${header[0].totalAmount}::decimal)
        WHERE transaction_id = ${purchaseOrderId}
      `);
    }
  }

  /**
   * Enrich header and extension with full details
   */
  private async enrichWithDetails(
    header: TransactionHeader,
    ext: VendorBillExtRecord | null,
    includeAll = false
  ): Promise<VendorBillWithDetails> {
    // Get vendor
    const vendor = await db
      .select({ id: entities.id, name: entities.name })
      .from(entities)
      .where(eq(entities.id, header.entityId))
      .limit(1);

    // Get PO if linked
    const po = ext?.purchaseOrderId
      ? await db
          .select({ id: transactionHeaders.id, transactionNumber: transactionHeaders.transactionNumber })
          .from(transactionHeaders)
          .where(eq(transactionHeaders.id, ext.purchaseOrderId))
          .limit(1)
      : [];

    // Get lines with extensions
    const lineRows = await db
      .select({
        line: transactionLines,
        ext: vendorBillLineExt,
      })
      .from(transactionLines)
      .leftJoin(vendorBillLineExt, eq(transactionLines.id, vendorBillLineExt.lineId))
      .where(eq(transactionLines.transactionId, header.id))
      .orderBy(asc(transactionLines.lineNumber));

    // Transform to output format
    const billHeader: VendorBillHeader = {
      ...this.transformHeader(header),
      vendorInvoiceNumber: ext?.vendorInvoiceNumber || undefined,
      purchaseOrderId: ext?.purchaseOrderId || undefined,
      dueDate: ext?.dueDate || '',
      receivedDate: ext?.receivedDate || undefined,
      shippingAmount: ext?.shippingAmount || '0',
      threeWayMatchStatus: ext?.threeWayMatchStatus || HybridThreeWayMatchStatus.NOT_REQUIRED,
      matchVarianceAmount: ext?.matchVarianceAmount || undefined,
      matchOverrideReason: ext?.matchOverrideReason || undefined,
      matchOverrideBy: ext?.matchOverrideBy || undefined,
      matchOverrideAt: ext?.matchOverrideAt?.toISOString(),
      paidAmount: ext?.paidAmount || '0',
      balanceDue: ext?.balanceDue || header.totalAmount || '0',
      discountDate: ext?.discountDate || undefined,
      discountPercent: ext?.discountPercent || undefined,
      discountAmount: ext?.discountAmount || undefined,
      discountTaken: ext?.discountTaken || '0',
      apAccountId: ext?.apAccountId || undefined,
      currentApproverId: ext?.currentApproverId || undefined,
      approvedAt: ext?.approvedAt?.toISOString(),
      approvedBy: ext?.approvedBy || undefined,
      voidedAt: ext?.voidedAt?.toISOString(),
      voidedBy: ext?.voidedBy || undefined,
      voidReason: ext?.voidReason || undefined,
    };

    const billLines: VendorBillLine[] = lineRows.map(row => ({
      ...this.transformLine(row.line),
      purchaseOrderLineId: row.ext?.purchaseOrderLineId || undefined,
      receiptLineId: row.ext?.receiptLineId || undefined,
      poQuantity: row.ext?.poQuantity || undefined,
      poUnitPrice: row.ext?.poUnitPrice || undefined,
      receivedQuantity: row.ext?.receivedQuantity || undefined,
      quantityVariance: row.ext?.quantityVariance || undefined,
      priceVariance: row.ext?.priceVariance || undefined,
      matchStatus: row.ext?.matchStatus || HybridLineMatchStatus.NOT_REQUIRED,
    }));

    return {
      header: billHeader,
      lines: billLines,
      vendor: vendor[0] ? { id: vendor[0].id, name: vendor[0].name } : undefined,
      purchaseOrder: po[0] ? { id: po[0].id, transactionNumber: po[0].transactionNumber } : undefined,
    };
  }
}
