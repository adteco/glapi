/**
 * Bill Payment Hybrid Service
 *
 * Manages bill payments using the hybrid transaction model.
 * Bill payments use transaction_headers + bill_payment_ext (no lines - uses applications instead).
 */

import { BaseTransactionService } from './base-transaction-service';
import { ServiceContext, ServiceError, PaginatedResult, PaginationParams, GlPostingResult } from '../types';
import {
  TransactionTypeCode,
  TransactionTypeCodeValue,
  TransactionFilters,
} from '../types/transaction.types';
import { GlPostingEngine } from './gl-posting-engine';
import { EventCategoryType } from '@glapi/database';
import { db } from '@glapi/database';
import {
  transactionHeaders,
  TransactionHeader,
  billPaymentExt,
  BillPaymentExtRecord,
  NewBillPaymentExtRecord,
  billPaymentApplications2,
  BillPaymentApplication2,
  NewBillPaymentApplication2,
  HybridBillPaymentStatus,
  HybridBillPaymentStatusValue,
  vendorBillExt,
  entities,
  accounts,
} from '@glapi/database/schema';
import { eq, and, desc, sql, inArray, gte, lte, or, ilike } from 'drizzle-orm';
import Decimal from 'decimal.js';

// ============================================================================
// TYPES
// ============================================================================

export interface BillPaymentHeader {
  id: string;
  organizationId: string;
  subsidiaryId: string;
  transactionType: TransactionTypeCodeValue;
  transactionNumber: string;
  vendorId: string;
  vendorName?: string;
  paymentDate: string;
  status: HybridBillPaymentStatusValue;
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

export interface BillPaymentExtension {
  paymentMethod: string;
  paymentAmount: string;
  appliedAmount: string;
  unappliedAmount: string;
  discountTaken: string;
  bankAccountId?: string;
  checkNumber?: string;
  achTraceNumber?: string;
  wireReference?: string;
  externalRef?: string;
  payeeName?: string;
  payeeAddress?: string;
  clearedDate?: string;
  clearedAmount?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
}

export interface BillPaymentWithExtension {
  header: BillPaymentHeader;
  extension: BillPaymentExtension;
  applications: BillPaymentApplicationDetail[];
}

export interface BillPaymentApplicationDetail {
  id: string;
  billId: string;
  billNumber: string;
  vendorInvoiceNumber?: string;
  appliedAmount: string;
  discountTaken: string;
  applicationDate: string;
}

export interface CreateBillPaymentInput {
  subsidiaryId: string;
  vendorId: string;
  vendorName?: string;
  paymentDate: string | Date;
  paymentMethod: string;
  bankAccountId?: string;
  checkNumber?: string;
  achTraceNumber?: string;
  wireReference?: string;
  externalRef?: string;
  payeeName?: string;
  payeeAddress?: string;
  currencyCode?: string;
  exchangeRate?: number;
  memo?: string;
  internalNotes?: string;
  applications: CreateBillPaymentApplicationInput[];
}

export interface CreateBillPaymentApplicationInput {
  billId: string;
  appliedAmount: number;
  discountTaken?: number;
}

export interface UpdateBillPaymentInput {
  paymentDate?: string | Date;
  paymentMethod?: string;
  bankAccountId?: string;
  checkNumber?: string;
  achTraceNumber?: string;
  wireReference?: string;
  externalRef?: string;
  payeeName?: string;
  payeeAddress?: string;
  memo?: string;
  internalNotes?: string;
}

export interface BillPaymentFilters extends TransactionFilters {
  paymentMethod?: string;
  bankAccountId?: string;
  isCleared?: boolean;
}

export interface VendorBillForPayment {
  billId: string;
  billNumber: string;
  vendorInvoiceNumber?: string;
  billDate: string;
  dueDate: string;
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
  discountDate?: string;
  discountAmount?: string;
}

export interface BillPaymentSummary {
  totalPayments: number;
  totalAmount: string;
  totalApplied: string;
  totalUnapplied: string;
  totalDiscountsTaken: string;
  byPaymentMethod: Record<string, { count: number; amount: string }>;
  byStatus: Record<string, { count: number; amount: string }>;
}

// ============================================================================
// STATUS TRANSITIONS
// ============================================================================

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  [HybridBillPaymentStatus.DRAFT]: [HybridBillPaymentStatus.PENDING, HybridBillPaymentStatus.VOIDED],
  [HybridBillPaymentStatus.PENDING]: [HybridBillPaymentStatus.POSTED, HybridBillPaymentStatus.VOIDED],
  [HybridBillPaymentStatus.POSTED]: [HybridBillPaymentStatus.CLEARED, HybridBillPaymentStatus.VOIDED],
  [HybridBillPaymentStatus.CLEARED]: [HybridBillPaymentStatus.VOIDED],
  [HybridBillPaymentStatus.VOIDED]: [],
};

// ============================================================================
// SERVICE
// ============================================================================

export class BillPaymentHybridService extends BaseTransactionService {
  protected transactionType = TransactionTypeCode.BILL_PAYMENT;
  protected eventCategory: EventCategoryType = 'PROCUREMENT';

  constructor(context: ServiceContext = {}) {
    super(context);
  }

  // ==========================================================================
  // LIST OPERATIONS
  // ==========================================================================

  /**
   * List bill payments with filters
   */
  async listBillPayments(
    params: PaginationParams = {},
    filters: BillPaymentFilters = {}
  ): Promise<PaginatedResult<BillPaymentWithExtension>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(params);

    // Build where conditions for headers
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
        extension: billPaymentExt,
      })
      .from(transactionHeaders)
      .innerJoin(billPaymentExt, eq(transactionHeaders.id, billPaymentExt.transactionId))
      .where(and(...headerConditions))
      .orderBy(desc(transactionHeaders.createdAt))
      .limit(take)
      .offset(skip);

    // Apply additional filters and transform
    let payments = results;

    if (filters.paymentMethod) {
      payments = payments.filter((p) => p.extension.paymentMethod === filters.paymentMethod);
    }

    if (filters.bankAccountId) {
      payments = payments.filter((p) => p.extension.bankAccountId === filters.bankAccountId);
    }

    if (filters.isCleared !== undefined) {
      if (filters.isCleared) {
        payments = payments.filter((p) => p.extension.clearedDate !== null);
      } else {
        payments = payments.filter((p) => p.extension.clearedDate === null);
      }
    }

    // Fetch applications for each payment
    const paymentIds = payments.map((p) => p.header.id);
    const applications = paymentIds.length > 0
      ? await this.getApplicationsForPayments(paymentIds)
      : [];

    // Group applications by payment ID
    const appsByPayment = new Map<string, BillPaymentApplicationDetail[]>();
    for (const app of applications) {
      const paymentApps = appsByPayment.get(app.paymentId) || [];
      paymentApps.push(app);
      appsByPayment.set(app.paymentId, paymentApps);
    }

    // Transform to response format
    const data = payments.map((p) => this.transformToResponse(
      p.header,
      p.extension,
      appsByPayment.get(p.header.id) || []
    ));

    return this.createPaginatedResult(data, total, page, limit);
  }

  // ==========================================================================
  // GET OPERATIONS
  // ==========================================================================

  /**
   * Get a bill payment by ID
   */
  async getBillPaymentById(id: string): Promise<BillPaymentWithExtension> {
    const organizationId = this.requireOrganizationContext();

    const [result] = await db
      .select({
        header: transactionHeaders,
        extension: billPaymentExt,
      })
      .from(transactionHeaders)
      .innerJoin(billPaymentExt, eq(transactionHeaders.id, billPaymentExt.transactionId))
      .where(
        and(
          eq(transactionHeaders.id, id),
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.transactionType, this.transactionType)
        )
      )
      .limit(1);

    if (!result) {
      throw new ServiceError('Bill payment not found', 'NOT_FOUND', 404);
    }

    // Fetch applications
    const applications = await this.getApplicationsByPaymentId(id);

    return this.transformToResponse(result.header, result.extension, applications);
  }

  /**
   * Get a bill payment by transaction number
   */
  async getBillPaymentByNumber(transactionNumber: string): Promise<BillPaymentWithExtension> {
    const organizationId = this.requireOrganizationContext();

    const [result] = await db
      .select({
        header: transactionHeaders,
        extension: billPaymentExt,
      })
      .from(transactionHeaders)
      .innerJoin(billPaymentExt, eq(transactionHeaders.id, billPaymentExt.transactionId))
      .where(
        and(
          eq(transactionHeaders.transactionNumber, transactionNumber),
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.transactionType, this.transactionType)
        )
      )
      .limit(1);

    if (!result) {
      throw new ServiceError('Bill payment not found', 'NOT_FOUND', 404);
    }

    const applications = await this.getApplicationsByPaymentId(result.header.id);

    return this.transformToResponse(result.header, result.extension, applications);
  }

  // ==========================================================================
  // CREATE OPERATIONS
  // ==========================================================================

  /**
   * Create a new bill payment
   */
  async createBillPayment(input: CreateBillPaymentInput): Promise<BillPaymentWithExtension> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Validate applications
    if (!input.applications || input.applications.length === 0) {
      throw new ServiceError('At least one bill application is required', 'VALIDATION_ERROR', 400);
    }

    // Validate each bill exists and belongs to the vendor
    const billIds = input.applications.map((a) => a.billId);
    const bills = await this.validateBillsForPayment(billIds, input.vendorId);

    // Calculate totals
    let totalApplied = new Decimal(0);
    let totalDiscount = new Decimal(0);

    for (const app of input.applications) {
      totalApplied = totalApplied.plus(new Decimal(app.appliedAmount));
      totalDiscount = totalDiscount.plus(new Decimal(app.discountTaken || 0));
    }

    const paymentAmount = totalApplied.plus(totalDiscount);

    // Generate transaction number
    const transactionNumber = await this.generateTransactionNumber();

    // Get vendor name if not provided
    let vendorName = input.vendorName;
    if (!vendorName) {
      const [vendor] = await db
        .select({ name: entities.name })
        .from(entities)
        .where(eq(entities.id, input.vendorId))
        .limit(1);
      vendorName = vendor?.name;
    }

    // Create header
    const header = await this.createHeader({
      subsidiaryId: input.subsidiaryId,
      transactionType: this.transactionType,
      transactionNumber,
      entityId: input.vendorId,
      entityName: vendorName,
      transactionDate: this.toDateString(input.paymentDate),
      status: HybridBillPaymentStatus.DRAFT,
      subtotal: paymentAmount.toFixed(4),
      taxAmount: '0',
      totalAmount: paymentAmount.toFixed(4),
      currencyCode: input.currencyCode || 'USD',
      exchangeRate: String(input.exchangeRate || 1),
      memo: input.memo,
      internalNotes: input.internalNotes,
      createdBy: userId,
    });

    // Create extension
    const [extension] = await db
      .insert(billPaymentExt)
      .values({
        transactionId: header.id,
        paymentMethod: input.paymentMethod,
        paymentAmount: paymentAmount.toFixed(4),
        appliedAmount: totalApplied.toFixed(4),
        unappliedAmount: '0',
        discountTaken: totalDiscount.toFixed(4),
        bankAccountId: input.bankAccountId,
        checkNumber: input.checkNumber,
        achTraceNumber: input.achTraceNumber,
        wireReference: input.wireReference,
        externalRef: input.externalRef,
        payeeName: input.payeeName,
        payeeAddress: input.payeeAddress,
      })
      .returning();

    // Create applications
    const applications: BillPaymentApplicationDetail[] = [];
    for (const app of input.applications) {
      const bill = bills.find((b) => b.id === app.billId);

      const [application] = await db
        .insert(billPaymentApplications2)
        .values({
          organizationId,
          paymentId: header.id,
          billId: app.billId,
          appliedAmount: String(app.appliedAmount),
          discountTaken: String(app.discountTaken || 0),
          applicationDate: this.toDateString(input.paymentDate),
          createdBy: userId,
        })
        .returning();

      applications.push({
        id: application.id,
        billId: app.billId,
        billNumber: bill?.transactionNumber || '',
        vendorInvoiceNumber: bill?.vendorInvoiceNumber,
        appliedAmount: application.appliedAmount,
        discountTaken: application.discountTaken || '0',
        applicationDate: application.applicationDate,
      });
    }

    // Emit event
    await this.emitEvent('BILL_PAYMENT_CREATED', header.id, {
      paymentNumber: transactionNumber,
      vendorId: input.vendorId,
      paymentAmount: paymentAmount.toNumber(),
      applicationCount: applications.length,
    });

    return this.transformToResponse(header, extension, applications);
  }

  // ==========================================================================
  // UPDATE OPERATIONS
  // ==========================================================================

  /**
   * Update a bill payment (only in DRAFT status)
   */
  async updateBillPayment(
    id: string,
    input: UpdateBillPaymentInput
  ): Promise<BillPaymentWithExtension> {
    const payment = await this.getBillPaymentById(id);

    if (payment.header.status !== HybridBillPaymentStatus.DRAFT) {
      throw new ServiceError(
        'Can only update bill payments in DRAFT status',
        'INVALID_STATUS',
        400
      );
    }

    // Update header
    const headerUpdates: Record<string, unknown> = {};
    if (input.paymentDate) {
      headerUpdates.transactionDate = this.toDateString(input.paymentDate);
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
    const extUpdates: Partial<NewBillPaymentExtRecord> = {};
    if (input.paymentMethod) {
      extUpdates.paymentMethod = input.paymentMethod;
    }
    if (input.bankAccountId !== undefined) {
      extUpdates.bankAccountId = input.bankAccountId;
    }
    if (input.checkNumber !== undefined) {
      extUpdates.checkNumber = input.checkNumber;
    }
    if (input.achTraceNumber !== undefined) {
      extUpdates.achTraceNumber = input.achTraceNumber;
    }
    if (input.wireReference !== undefined) {
      extUpdates.wireReference = input.wireReference;
    }
    if (input.externalRef !== undefined) {
      extUpdates.externalRef = input.externalRef;
    }
    if (input.payeeName !== undefined) {
      extUpdates.payeeName = input.payeeName;
    }
    if (input.payeeAddress !== undefined) {
      extUpdates.payeeAddress = input.payeeAddress;
    }

    if (Object.keys(extUpdates).length > 0) {
      await db
        .update(billPaymentExt)
        .set(extUpdates)
        .where(eq(billPaymentExt.transactionId, id));
    }

    return this.getBillPaymentById(id);
  }

  // ==========================================================================
  // STATUS OPERATIONS
  // ==========================================================================

  /**
   * Post a bill payment (DRAFT -> PENDING -> POSTED)
   * Creates GL entries: DR Accounts Payable, CR Cash/Bank
   */
  async postBillPayment(id: string): Promise<BillPaymentWithExtension> {
    const payment = await this.getBillPaymentById(id);
    const currentStatus = payment.header.status;

    // Validate transition
    if (currentStatus !== HybridBillPaymentStatus.DRAFT &&
        currentStatus !== HybridBillPaymentStatus.PENDING) {
      throw new ServiceError(
        'Can only post bill payments in DRAFT or PENDING status',
        'INVALID_STATUS',
        400
      );
    }

    // Validate bank account is set for GL posting
    if (!payment.extension.bankAccountId) {
      throw new ServiceError(
        'Bank account is required to post a bill payment',
        'VALIDATION_ERROR',
        400
      );
    }

    // Update bill balances
    await this.applyPaymentsToBills(id);

    // Create GL entries for the payment
    await this.createPaymentGlEntries(payment);

    // Update status
    await this.updateStatus(id, HybridBillPaymentStatus.POSTED);

    // Emit event
    await this.emitEvent('BILL_PAYMENT_POSTED', id, {
      paymentNumber: payment.header.transactionNumber,
      previousStatus: currentStatus,
      glPosted: true,
    });

    return this.getBillPaymentById(id);
  }

  /**
   * Mark a payment as cleared (bank reconciliation)
   */
  async clearBillPayment(
    id: string,
    clearedDate: string | Date,
    clearedAmount?: number
  ): Promise<BillPaymentWithExtension> {
    const payment = await this.getBillPaymentById(id);

    if (payment.header.status !== HybridBillPaymentStatus.POSTED) {
      throw new ServiceError(
        'Can only clear posted bill payments',
        'INVALID_STATUS',
        400
      );
    }

    const clearedAmountStr = clearedAmount
      ? String(clearedAmount)
      : payment.extension.paymentAmount;

    // Update extension with cleared info
    await db
      .update(billPaymentExt)
      .set({
        clearedDate: this.toDateString(clearedDate),
        clearedAmount: clearedAmountStr,
      })
      .where(eq(billPaymentExt.transactionId, id));

    // Update status
    await this.updateStatus(id, HybridBillPaymentStatus.CLEARED);

    // Emit event
    await this.emitEvent('BILL_PAYMENT_CLEARED', id, {
      paymentNumber: payment.header.transactionNumber,
      clearedDate: this.toDateString(clearedDate),
      clearedAmount: clearedAmountStr,
    });

    return this.getBillPaymentById(id);
  }

  /**
   * Void a bill payment
   */
  async voidBillPayment(id: string, reason: string): Promise<BillPaymentWithExtension> {
    const userId = this.requireUserContext();
    const payment = await this.getBillPaymentById(id);
    const currentStatus = payment.header.status;

    // Check if can void
    const allowedToVoid = VALID_STATUS_TRANSITIONS[currentStatus];
    if (!allowedToVoid?.includes(HybridBillPaymentStatus.VOIDED)) {
      throw new ServiceError(
        `Cannot void bill payment in ${currentStatus} status`,
        'INVALID_STATUS',
        400
      );
    }

    // Reverse bill balance updates if payment was posted or cleared
    if (currentStatus === HybridBillPaymentStatus.POSTED ||
        currentStatus === HybridBillPaymentStatus.CLEARED) {
      await this.reversePaymentApplications(id);
    }

    // Update extension with void info
    await db
      .update(billPaymentExt)
      .set({
        voidedAt: new Date(),
        voidedBy: userId,
        voidReason: reason,
      })
      .where(eq(billPaymentExt.transactionId, id));

    // Update status
    await this.updateStatus(id, HybridBillPaymentStatus.VOIDED);

    // Emit event
    await this.emitEvent('BILL_PAYMENT_VOIDED', id, {
      paymentNumber: payment.header.transactionNumber,
      previousStatus: currentStatus,
      voidReason: reason,
    });

    return this.getBillPaymentById(id);
  }

  // ==========================================================================
  // QUERY OPERATIONS
  // ==========================================================================

  /**
   * Get bills available for payment for a vendor
   */
  async getVendorBillsForPayment(vendorId: string): Promise<VendorBillForPayment[]> {
    const organizationId = this.requireOrganizationContext();

    // Get approved/partially paid bills for the vendor
    const bills = await db
      .select({
        header: transactionHeaders,
        extension: vendorBillExt,
      })
      .from(transactionHeaders)
      .innerJoin(vendorBillExt, eq(transactionHeaders.id, vendorBillExt.transactionId))
      .where(
        and(
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.transactionType, TransactionTypeCode.VENDOR_BILL),
          eq(transactionHeaders.entityId, vendorId),
          inArray(transactionHeaders.status, ['APPROVED', 'PARTIALLY_PAID'])
        )
      )
      .orderBy(desc(transactionHeaders.transactionDate));

    return bills.map((b) => ({
      billId: b.header.id,
      billNumber: b.header.transactionNumber,
      vendorInvoiceNumber: b.extension.vendorInvoiceNumber || undefined,
      billDate: b.header.transactionDate,
      dueDate: b.extension.dueDate,
      totalAmount: b.header.totalAmount || '0',
      paidAmount: b.extension.paidAmount || '0',
      balanceDue: b.extension.balanceDue || b.header.totalAmount || '0',
      discountDate: b.extension.discountDate || undefined,
      discountAmount: b.extension.discountAmount || undefined,
    }));
  }

  /**
   * Get payment summary for a date range
   */
  async getBillPaymentSummary(
    dateFrom: string | Date,
    dateTo: string | Date
  ): Promise<BillPaymentSummary> {
    const organizationId = this.requireOrganizationContext();

    const payments = await db
      .select({
        header: transactionHeaders,
        extension: billPaymentExt,
      })
      .from(transactionHeaders)
      .innerJoin(billPaymentExt, eq(transactionHeaders.id, billPaymentExt.transactionId))
      .where(
        and(
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.transactionType, this.transactionType),
          gte(transactionHeaders.transactionDate, this.toDateString(dateFrom)),
          lte(transactionHeaders.transactionDate, this.toDateString(dateTo))
        )
      );

    let totalAmount = new Decimal(0);
    let totalApplied = new Decimal(0);
    let totalUnapplied = new Decimal(0);
    let totalDiscounts = new Decimal(0);

    const byPaymentMethod: Record<string, { count: number; amount: string }> = {};
    const byStatus: Record<string, { count: number; amount: string }> = {};

    for (const payment of payments) {
      const amount = new Decimal(payment.extension.paymentAmount || 0);
      const applied = new Decimal(payment.extension.appliedAmount || 0);
      const unapplied = new Decimal(payment.extension.unappliedAmount || 0);
      const discounts = new Decimal(payment.extension.discountTaken || 0);

      totalAmount = totalAmount.plus(amount);
      totalApplied = totalApplied.plus(applied);
      totalUnapplied = totalUnapplied.plus(unapplied);
      totalDiscounts = totalDiscounts.plus(discounts);

      // By payment method
      const method = payment.extension.paymentMethod;
      if (!byPaymentMethod[method]) {
        byPaymentMethod[method] = { count: 0, amount: '0' };
      }
      byPaymentMethod[method].count++;
      byPaymentMethod[method].amount = new Decimal(byPaymentMethod[method].amount)
        .plus(amount)
        .toFixed(2);

      // By status
      const status = payment.header.status;
      if (!byStatus[status]) {
        byStatus[status] = { count: 0, amount: '0' };
      }
      byStatus[status].count++;
      byStatus[status].amount = new Decimal(byStatus[status].amount)
        .plus(amount)
        .toFixed(2);
    }

    return {
      totalPayments: payments.length,
      totalAmount: totalAmount.toFixed(2),
      totalApplied: totalApplied.toFixed(2),
      totalUnapplied: totalUnapplied.toFixed(2),
      totalDiscountsTaken: totalDiscounts.toFixed(2),
      byPaymentMethod,
      byStatus,
    };
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  /**
   * Get applications for a single payment
   */
  private async getApplicationsByPaymentId(paymentId: string): Promise<BillPaymentApplicationDetail[]> {
    const applications = await db
      .select({
        application: billPaymentApplications2,
        bill: transactionHeaders,
        billExt: vendorBillExt,
      })
      .from(billPaymentApplications2)
      .innerJoin(transactionHeaders, eq(billPaymentApplications2.billId, transactionHeaders.id))
      .leftJoin(vendorBillExt, eq(transactionHeaders.id, vendorBillExt.transactionId))
      .where(eq(billPaymentApplications2.paymentId, paymentId));

    return applications.map((a) => ({
      id: a.application.id,
      billId: a.application.billId,
      billNumber: a.bill.transactionNumber,
      vendorInvoiceNumber: a.billExt?.vendorInvoiceNumber || undefined,
      appliedAmount: a.application.appliedAmount,
      discountTaken: a.application.discountTaken || '0',
      applicationDate: a.application.applicationDate,
    }));
  }

  /**
   * Get applications for multiple payments
   */
  private async getApplicationsForPayments(
    paymentIds: string[]
  ): Promise<(BillPaymentApplicationDetail & { paymentId: string })[]> {
    if (paymentIds.length === 0) return [];

    const applications = await db
      .select({
        application: billPaymentApplications2,
        bill: transactionHeaders,
        billExt: vendorBillExt,
      })
      .from(billPaymentApplications2)
      .innerJoin(transactionHeaders, eq(billPaymentApplications2.billId, transactionHeaders.id))
      .leftJoin(vendorBillExt, eq(transactionHeaders.id, vendorBillExt.transactionId))
      .where(inArray(billPaymentApplications2.paymentId, paymentIds));

    return applications.map((a) => ({
      id: a.application.id,
      paymentId: a.application.paymentId,
      billId: a.application.billId,
      billNumber: a.bill.transactionNumber,
      vendorInvoiceNumber: a.billExt?.vendorInvoiceNumber || undefined,
      appliedAmount: a.application.appliedAmount,
      discountTaken: a.application.discountTaken || '0',
      applicationDate: a.application.applicationDate,
    }));
  }

  /**
   * Validate bills for payment
   */
  private async validateBillsForPayment(
    billIds: string[],
    vendorId: string
  ): Promise<Array<{ id: string; transactionNumber: string; vendorInvoiceNumber?: string }>> {
    const organizationId = this.requireOrganizationContext();

    const bills = await db
      .select({
        header: transactionHeaders,
        extension: vendorBillExt,
      })
      .from(transactionHeaders)
      .leftJoin(vendorBillExt, eq(transactionHeaders.id, vendorBillExt.transactionId))
      .where(
        and(
          inArray(transactionHeaders.id, billIds),
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.transactionType, TransactionTypeCode.VENDOR_BILL)
        )
      );

    // Check all bills exist
    if (bills.length !== billIds.length) {
      throw new ServiceError('One or more bills not found', 'NOT_FOUND', 404);
    }

    // Check all bills belong to the vendor
    for (const bill of bills) {
      if (bill.header.entityId !== vendorId) {
        throw new ServiceError(
          `Bill ${bill.header.transactionNumber} does not belong to the specified vendor`,
          'VALIDATION_ERROR',
          400
        );
      }

      // Check bill is in a payable status
      const payableStatuses = ['APPROVED', 'PARTIALLY_PAID'];
      if (!payableStatuses.includes(bill.header.status)) {
        throw new ServiceError(
          `Bill ${bill.header.transactionNumber} is not in a payable status`,
          'VALIDATION_ERROR',
          400
        );
      }
    }

    return bills.map((b) => ({
      id: b.header.id,
      transactionNumber: b.header.transactionNumber,
      vendorInvoiceNumber: b.extension?.vendorInvoiceNumber || undefined,
    }));
  }

  /**
   * Apply payments to bills (update bill balances)
   */
  private async applyPaymentsToBills(paymentId: string): Promise<void> {
    const applications = await db
      .select()
      .from(billPaymentApplications2)
      .where(eq(billPaymentApplications2.paymentId, paymentId));

    for (const app of applications) {
      // Get current bill extension
      const [billExt] = await db
        .select()
        .from(vendorBillExt)
        .where(eq(vendorBillExt.transactionId, app.billId))
        .limit(1);

      if (!billExt) continue;

      const currentPaid = new Decimal(billExt.paidAmount || 0);
      const appliedAmount = new Decimal(app.appliedAmount);
      const discountTaken = new Decimal(app.discountTaken || 0);

      const newPaidAmount = currentPaid.plus(appliedAmount).plus(discountTaken);
      const totalAmount = new Decimal(billExt.balanceDue || 0).plus(currentPaid);
      const newBalanceDue = totalAmount.minus(newPaidAmount);

      // Update bill extension
      await db
        .update(vendorBillExt)
        .set({
          paidAmount: newPaidAmount.toFixed(4),
          balanceDue: newBalanceDue.toFixed(4),
          discountTaken: new Decimal(billExt.discountTaken || 0)
            .plus(discountTaken)
            .toFixed(4),
        })
        .where(eq(vendorBillExt.transactionId, app.billId));

      // Update bill status if fully paid
      const newStatus = newBalanceDue.lessThanOrEqualTo(0) ? 'PAID' : 'PARTIALLY_PAID';
      await db
        .update(transactionHeaders)
        .set({ status: newStatus })
        .where(eq(transactionHeaders.id, app.billId));
    }
  }

  /**
   * Reverse payment applications (for voiding)
   */
  private async reversePaymentApplications(paymentId: string): Promise<void> {
    const applications = await db
      .select()
      .from(billPaymentApplications2)
      .where(eq(billPaymentApplications2.paymentId, paymentId));

    for (const app of applications) {
      // Get current bill extension
      const [billExt] = await db
        .select()
        .from(vendorBillExt)
        .where(eq(vendorBillExt.transactionId, app.billId))
        .limit(1);

      if (!billExt) continue;

      const currentPaid = new Decimal(billExt.paidAmount || 0);
      const appliedAmount = new Decimal(app.appliedAmount);
      const discountTaken = new Decimal(app.discountTaken || 0);

      const newPaidAmount = Decimal.max(currentPaid.minus(appliedAmount).minus(discountTaken), 0);
      const totalAmount = new Decimal(billExt.balanceDue || 0).plus(currentPaid);
      const newBalanceDue = totalAmount.minus(newPaidAmount);

      // Update bill extension
      await db
        .update(vendorBillExt)
        .set({
          paidAmount: newPaidAmount.toFixed(4),
          balanceDue: newBalanceDue.toFixed(4),
          discountTaken: Decimal.max(
            new Decimal(billExt.discountTaken || 0).minus(discountTaken),
            0
          ).toFixed(4),
        })
        .where(eq(vendorBillExt.transactionId, app.billId));

      // Update bill status
      const newStatus = newPaidAmount.greaterThan(0) ? 'PARTIALLY_PAID' : 'APPROVED';
      await db
        .update(transactionHeaders)
        .set({ status: newStatus })
        .where(eq(transactionHeaders.id, app.billId));
    }
  }

  /**
   * Transform database records to response format
   */
  private transformToResponse(
    header: TransactionHeader,
    extension: BillPaymentExtRecord,
    applications: BillPaymentApplicationDetail[]
  ): BillPaymentWithExtension {
    return {
      header: {
        id: header.id,
        organizationId: header.organizationId,
        subsidiaryId: header.subsidiaryId,
        transactionType: header.transactionType as TransactionTypeCodeValue,
        transactionNumber: header.transactionNumber,
        vendorId: header.entityId,
        vendorName: header.entityName || undefined,
        paymentDate: header.transactionDate,
        status: header.status as HybridBillPaymentStatusValue,
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
        paymentMethod: extension.paymentMethod,
        paymentAmount: extension.paymentAmount,
        appliedAmount: extension.appliedAmount || '0',
        unappliedAmount: extension.unappliedAmount || '0',
        discountTaken: extension.discountTaken || '0',
        bankAccountId: extension.bankAccountId || undefined,
        checkNumber: extension.checkNumber || undefined,
        achTraceNumber: extension.achTraceNumber || undefined,
        wireReference: extension.wireReference || undefined,
        externalRef: extension.externalRef || undefined,
        payeeName: extension.payeeName || undefined,
        payeeAddress: extension.payeeAddress || undefined,
        clearedDate: extension.clearedDate || undefined,
        clearedAmount: extension.clearedAmount || undefined,
        voidedAt: extension.voidedAt?.toISOString() || undefined,
        voidedBy: extension.voidedBy || undefined,
        voidReason: extension.voidReason || undefined,
      },
      applications,
    };
  }

  /**
   * Create GL entries for a bill payment
   * DR Accounts Payable (reduce liability)
   * CR Cash/Bank Account (reduce asset)
   */
  private async createPaymentGlEntries(payment: BillPaymentWithExtension): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    // Get the AP account from the first bill being paid
    // In a real implementation, this would come from bill-specific AP accounts
    let apAccountId: string | null = null;

    if (payment.applications.length > 0) {
      const firstBillId = payment.applications[0].billId;
      const [billExt] = await db
        .select({ apAccountId: vendorBillExt.apAccountId })
        .from(vendorBillExt)
        .where(eq(vendorBillExt.transactionId, firstBillId))
        .limit(1);
      apAccountId = billExt?.apAccountId || null;
    }

    // If no AP account found, try to get default AP account
    if (!apAccountId) {
      const [defaultAp] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.organizationId, organizationId),
            eq(accounts.accountCategory, 'Liability'),
            eq(accounts.accountSubcategory, 'ACCOUNTS_PAYABLE')
          )
        )
        .limit(1);
      apAccountId = defaultAp?.id || null;
    }

    if (!apAccountId) {
      throw new ServiceError(
        'No Accounts Payable account found for GL posting',
        'CONFIGURATION_ERROR',
        400
      );
    }

    const paymentAmount = new Decimal(payment.extension.appliedAmount);
    const discountAmount = new Decimal(payment.extension.discountTaken);
    const totalDebit = paymentAmount.plus(discountAmount);

    // Create GL posting context
    const glEngine = new GlPostingEngine(this.context);

    // For bill payments, we create a simple GL transaction:
    // DR Accounts Payable (total amount including discounts)
    // CR Cash/Bank (actual payment amount)
    // CR Purchase Discounts (if any discount taken)

    // Note: Full GL posting integration would use glEngine.generateGlEntries
    // with proper posting rules. For now, we emit an event that can be
    // handled by a GL posting subscriber.
    await this.emitEvent('BILL_PAYMENT_GL_READY', payment.header.id, {
      paymentNumber: payment.header.transactionNumber,
      paymentDate: payment.header.paymentDate,
      vendorId: payment.header.vendorId,
      vendorName: payment.header.vendorName,
      subsidiaryId: payment.header.subsidiaryId,
      entries: [
        {
          accountId: apAccountId,
          debit: totalDebit.toFixed(4),
          credit: '0',
          description: `Bill payment ${payment.header.transactionNumber}`,
        },
        {
          accountId: payment.extension.bankAccountId,
          debit: '0',
          credit: paymentAmount.toFixed(4),
          description: `Bill payment ${payment.header.transactionNumber}`,
        },
        ...(discountAmount.gt(0) ? [{
          accountId: 'PURCHASE_DISCOUNTS', // Would be configured account
          debit: '0',
          credit: discountAmount.toFixed(4),
          description: `Discount on payment ${payment.header.transactionNumber}`,
        }] : []),
      ],
      billsApplied: payment.applications.map(a => ({
        billId: a.billId,
        billNumber: a.billNumber,
        appliedAmount: a.appliedAmount,
        discountTaken: a.discountTaken,
      })),
    });
  }
}
