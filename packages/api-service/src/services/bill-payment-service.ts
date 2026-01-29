/**
 * Bill Payment Service
 *
 * Handles vendor bill payments:
 * - Payment creation
 * - Application to vendor bills
 * - Payment void/reversal
 * - Payment tracking and reporting
 */

import { BaseService } from './base-service';
import { VendorBillService } from './vendor-bill-service';
import { EventService } from './event-service';
import {
  ServiceContext,
  ServiceError,
  PaginatedResult,
  PaginationParams,
} from '../types';
import {
  CreateBillPaymentInput,
  VoidBillPaymentInput,
  BillPaymentFilters,
  BillPaymentWithDetails,
  BillPaymentApplicationWithDetails,
  BillPaymentSummary,
  BillPaymentStatusValue,
  VendorPaymentMethodValue,
} from '../types/procure-to-pay.types';
import {
  BillPaymentStatus,
  VendorBillStatus,
} from '@glapi/database/schema';
import { db as globalDb, type ContextualDatabase } from '@glapi/database';
import {
  billPayments,
  billPaymentApplications,
  vendorBills,
  entities,
  accounts,
} from '@glapi/database/schema';
import { eq, and, desc, asc, sql, inArray, gte, lte, or, ilike, isNull } from 'drizzle-orm';
import Decimal from 'decimal.js';

export interface BillPaymentServiceOptions {
  db?: ContextualDatabase;
}

// ============================================================================
// Bill Payment Service
// ============================================================================

export class BillPaymentService extends BaseService {
  private db: ContextualDatabase;
  private vendorBillService: VendorBillService;
  private eventService: EventService;

  constructor(context: ServiceContext = {}, options: BillPaymentServiceOptions = {}) {
    super(context);
    this.db = options.db ?? globalDb;
    this.vendorBillService = new VendorBillService(context, { db: options.db });
    this.eventService = new EventService(context);
  }

  // ==========================================================================
  // BILL PAYMENT Operations
  // ==========================================================================

  /**
   * List bill payments with filters and pagination
   */
  async listBillPayments(
    params: PaginationParams = {},
    filters: BillPaymentFilters = {}
  ): Promise<PaginatedResult<BillPaymentWithDetails>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(params);

    // Build where conditions
    const conditions = [eq(billPayments.organizationId, organizationId)];

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(billPayments.status, filters.status));
      } else {
        conditions.push(eq(billPayments.status, filters.status));
      }
    }

    if (filters.vendorId) {
      conditions.push(eq(billPayments.vendorId, filters.vendorId));
    }

    if (filters.subsidiaryId) {
      conditions.push(eq(billPayments.subsidiaryId, filters.subsidiaryId));
    }

    if (filters.paymentMethod) {
      conditions.push(eq(billPayments.paymentMethod, filters.paymentMethod));
    }

    if (filters.bankAccountId) {
      conditions.push(eq(billPayments.bankAccountId, filters.bankAccountId));
    }

    if (filters.paymentDateFrom) {
      const dateFrom = typeof filters.paymentDateFrom === 'string'
        ? filters.paymentDateFrom
        : filters.paymentDateFrom.toISOString().split('T')[0];
      conditions.push(gte(billPayments.paymentDate, dateFrom));
    }

    if (filters.paymentDateTo) {
      const dateTo = typeof filters.paymentDateTo === 'string'
        ? filters.paymentDateTo
        : filters.paymentDateTo.toISOString().split('T')[0];
      conditions.push(lte(billPayments.paymentDate, dateTo));
    }

    if (filters.search) {
      conditions.push(
        or(
          ilike(billPayments.paymentNumber, `%${filters.search}%`),
          ilike(billPayments.vendorName, `%${filters.search}%`),
          ilike(billPayments.checkNumber, `%${filters.search}%`),
          ilike(billPayments.memo, `%${filters.search}%`)
        )!
      );
    }

    // Count total
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(billPayments)
      .where(and(...conditions));
    const total = Number(countResult[0]?.count || 0);

    // Fetch payments
    const payments = await this.db
      .select()
      .from(billPayments)
      .where(and(...conditions))
      .orderBy(desc(billPayments.paymentDate))
      .limit(take)
      .offset(skip);

    // Enrich with details
    const paymentsWithDetails = await Promise.all(
      payments.map(async (payment) => this.enrichPaymentWithDetails(payment))
    );

    return this.createPaginatedResult(paymentsWithDetails, total, page, limit);
  }

  /**
   * Get a single bill payment by ID
   */
  async getBillPaymentById(id: string): Promise<BillPaymentWithDetails | null> {
    const organizationId = this.requireOrganizationContext();

    const payment = await this.db
      .select()
      .from(billPayments)
      .where(and(eq(billPayments.id, id), eq(billPayments.organizationId, organizationId)))
      .limit(1);

    if (!payment[0]) {
      return null;
    }

    return this.enrichPaymentWithDetails(payment[0], true);
  }

  /**
   * Create a bill payment with applications
   */
  async createBillPayment(input: CreateBillPaymentInput): Promise<BillPaymentWithDetails> {
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

    // Validate bank account exists
    if (input.bankAccountId) {
      const bankAccount = await this.db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.id, input.bankAccountId))
        .limit(1);

      if (!bankAccount[0]) {
        throw new ServiceError('Bank account not found', 'NOT_FOUND', 404);
      }
    }

    // Validate applications
    let totalApplied = new Decimal(0);
    let totalDiscount = new Decimal(0);

    for (const app of input.applications) {
      const bill = await this.vendorBillService.getVendorBillById(app.vendorBillId);
      if (!bill) {
        throw new ServiceError(`Vendor bill ${app.vendorBillId} not found`, 'NOT_FOUND', 404);
      }

      // Bill must be approved and have a balance
      if (bill.status !== VendorBillStatus.APPROVED &&
          bill.status !== VendorBillStatus.PARTIALLY_PAID) {
        throw new ServiceError(
          `Bill ${bill.billNumber} must be APPROVED or PARTIALLY_PAID to receive payment`,
          'VALIDATION_ERROR',
          400
        );
      }

      // Bill must belong to the same vendor
      if (bill.vendorId !== input.vendorId) {
        throw new ServiceError(
          `Bill ${bill.billNumber} belongs to a different vendor`,
          'VALIDATION_ERROR',
          400
        );
      }

      const balanceDue = new Decimal(bill.balanceDue);
      const appliedAmount = new Decimal(app.appliedAmount);
      const discountAmount = new Decimal(app.discountAmount || 0);
      const totalApplication = appliedAmount.plus(discountAmount);

      if (totalApplication.gt(balanceDue)) {
        throw new ServiceError(
          `Application amount ${totalApplication.toFixed(2)} exceeds balance due ${balanceDue.toFixed(2)} for bill ${bill.billNumber}`,
          'VALIDATION_ERROR',
          400
        );
      }

      totalApplied = totalApplied.plus(appliedAmount);
      totalDiscount = totalDiscount.plus(discountAmount);
    }

    const paymentAmount = new Decimal(input.paymentAmount);
    if (totalApplied.gt(paymentAmount)) {
      throw new ServiceError(
        `Total applied amount ${totalApplied.toFixed(2)} exceeds payment amount ${paymentAmount.toFixed(2)}`,
        'VALIDATION_ERROR',
        400
      );
    }

    // Generate payment number
    const paymentNumber = await this.generatePaymentNumber();

    // Create payment
    const [payment] = await this.db
      .insert(billPayments)
      .values({
        organizationId,
        subsidiaryId: input.subsidiaryId,
        paymentNumber,
        vendorId: input.vendorId,
        vendorName: vendor[0].name,
        paymentDate: this.toDateString(input.paymentDate),
        paymentMethod: input.paymentMethod,
        status: BillPaymentStatus.DRAFT,
        paymentAmount: paymentAmount.toFixed(2),
        appliedAmount: totalApplied.toFixed(2),
        unappliedAmount: paymentAmount.minus(totalApplied).toFixed(2),
        discountTaken: totalDiscount.toFixed(2),
        bankAccountId: input.bankAccountId,
        checkNumber: input.checkNumber,
        achTraceNumber: input.achTraceNumber,
        wireReference: input.wireReference,
        externalRef: input.externalRef,
        payeeName: input.payeeName,
        payeeAddress: input.payeeAddress,
        currencyCode: input.currencyCode || 'USD',
        exchangeRate: (input.exchangeRate || 1).toString(),
        memo: input.memo,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    // Create applications
    for (const app of input.applications) {
      await this.db.insert(billPaymentApplications).values({
        billPaymentId: payment.id,
        vendorBillId: app.vendorBillId,
        appliedAmount: app.appliedAmount.toString(),
        discountAmount: (app.discountAmount || 0).toString(),
        writeOffAmount: (app.writeOffAmount || 0).toString(),
        createdBy: userId,
      });

      // Update bill payment amounts
      await this.vendorBillService.updatePaymentAmounts(
        app.vendorBillId,
        new Decimal(app.appliedAmount),
        new Decimal(app.discountAmount || 0)
      );
    }

    // Emit event
    await this.eventService.emit({
      eventType: 'BillPaymentCreated',
      eventCategory: 'PROCUREMENT',
      aggregateType: 'BillPayment',
      aggregateId: payment.id,
      data: {
        paymentNumber: payment.paymentNumber,
        vendorId: payment.vendorId,
        paymentAmount: payment.paymentAmount,
        applicationCount: input.applications.length,
      },
    });

    return (await this.getBillPaymentById(payment.id))!;
  }

  /**
   * Process a bill payment (mark as processing/completed)
   */
  async processBillPayment(id: string): Promise<BillPaymentWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const payment = await this.getBillPaymentById(id);
    if (!payment) {
      throw new ServiceError('Bill payment not found', 'NOT_FOUND', 404);
    }

    if (payment.status !== BillPaymentStatus.DRAFT &&
        payment.status !== BillPaymentStatus.PENDING) {
      throw new ServiceError(
        `Cannot process payment in ${payment.status} status`,
        'VALIDATION_ERROR',
        400
      );
    }

    // For checks, mark as completed immediately
    // For ACH/Wire, mark as processing (will be completed later)
    const newStatus = payment.paymentMethod === 'CHECK' || payment.paymentMethod === 'CASH'
      ? BillPaymentStatus.COMPLETED
      : BillPaymentStatus.PROCESSING;

    await this.db
      .update(billPayments)
      .set({
        status: newStatus,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(billPayments.id, id), eq(billPayments.organizationId, organizationId)));

    // Emit event
    await this.eventService.emit({
      eventType: 'BillPaymentProcessed',
      eventCategory: 'PROCUREMENT',
      aggregateType: 'BillPayment',
      aggregateId: id,
      data: {
        paymentNumber: payment.paymentNumber,
        status: newStatus,
        paymentMethod: payment.paymentMethod,
      },
    });

    return (await this.getBillPaymentById(id))!;
  }

  /**
   * Complete a processing payment (e.g., when ACH clears)
   */
  async completeBillPayment(
    id: string,
    clearedDate: string | Date,
    clearedAmount?: number | string
  ): Promise<BillPaymentWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const payment = await this.getBillPaymentById(id);
    if (!payment) {
      throw new ServiceError('Bill payment not found', 'NOT_FOUND', 404);
    }

    if (payment.status !== BillPaymentStatus.PROCESSING) {
      throw new ServiceError(
        `Cannot complete payment in ${payment.status} status`,
        'VALIDATION_ERROR',
        400
      );
    }

    await this.db
      .update(billPayments)
      .set({
        status: BillPaymentStatus.COMPLETED,
        clearedDate: this.toDateString(clearedDate),
        clearedAmount: clearedAmount?.toString() || payment.paymentAmount,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(billPayments.id, id), eq(billPayments.organizationId, organizationId)));

    // Emit event
    await this.eventService.emit({
      eventType: 'BillPaymentCompleted',
      eventCategory: 'PROCUREMENT',
      aggregateType: 'BillPayment',
      aggregateId: id,
      data: {
        paymentNumber: payment.paymentNumber,
        clearedDate: this.toDateString(clearedDate),
        clearedAmount: clearedAmount || payment.paymentAmount,
      },
    });

    return (await this.getBillPaymentById(id))!;
  }

  /**
   * Void a bill payment
   */
  async voidBillPayment(input: VoidBillPaymentInput): Promise<BillPaymentWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const payment = await this.getBillPaymentById(input.billPaymentId);
    if (!payment) {
      throw new ServiceError('Bill payment not found', 'NOT_FOUND', 404);
    }

    if (payment.status === BillPaymentStatus.VOIDED) {
      throw new ServiceError('Payment is already voided', 'VALIDATION_ERROR', 400);
    }

    // Reverse all applications
    const applications = payment.applications || [];
    for (const app of applications) {
      // Mark application as reversed
      await this.db
        .update(billPaymentApplications)
        .set({
          reversedAt: new Date(),
          reversedBy: userId,
          reversalReason: input.reason,
          updatedAt: new Date(),
        })
        .where(eq(billPaymentApplications.id, app.id));

      // Reverse bill payment amounts
      await this.vendorBillService.updatePaymentAmounts(
        app.vendorBillId,
        new Decimal(app.appliedAmount).negated(),
        new Decimal(app.discountAmount).negated()
      );
    }

    // Void the payment
    await this.db
      .update(billPayments)
      .set({
        status: BillPaymentStatus.VOIDED,
        voidedAt: new Date(),
        voidedBy: userId,
        voidReason: input.reason,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(billPayments.id, input.billPaymentId), eq(billPayments.organizationId, organizationId)));

    // Emit event
    await this.eventService.emit({
      eventType: 'BillPaymentVoided',
      eventCategory: 'PROCUREMENT',
      aggregateType: 'BillPayment',
      aggregateId: input.billPaymentId,
      data: {
        paymentNumber: payment.paymentNumber,
        reason: input.reason,
        reversedApplications: applications.length,
      },
    });

    return (await this.getBillPaymentById(input.billPaymentId))!;
  }

  // ==========================================================================
  // REPORTING
  // ==========================================================================

  /**
   * Get bill payment summary for a period
   */
  async getBillPaymentSummary(
    periodStart: string | Date,
    periodEnd: string | Date,
    subsidiaryId?: string
  ): Promise<BillPaymentSummary> {
    const organizationId = this.requireOrganizationContext();
    const startDate = this.toDateString(periodStart);
    const endDate = this.toDateString(periodEnd);

    const conditions = [
      eq(billPayments.organizationId, organizationId),
      eq(billPayments.status, BillPaymentStatus.COMPLETED),
      gte(billPayments.paymentDate, startDate),
      lte(billPayments.paymentDate, endDate),
    ];

    if (subsidiaryId) {
      conditions.push(eq(billPayments.subsidiaryId, subsidiaryId));
    }

    // Get overall totals
    const totals = await this.db
      .select({
        totalPaid: sql<string>`sum(payment_amount::decimal)`,
        totalDiscount: sql<string>`sum(discount_taken::decimal)`,
        paymentCount: sql<number>`count(*)`,
      })
      .from(billPayments)
      .where(and(...conditions));

    // Get breakdown by payment method
    const byMethod = await this.db
      .select({
        method: billPayments.paymentMethod,
        amount: sql<string>`sum(payment_amount::decimal)`,
        count: sql<number>`count(*)`,
      })
      .from(billPayments)
      .where(and(...conditions))
      .groupBy(billPayments.paymentMethod);

    // Get breakdown by subsidiary
    const bySubsidiary = await this.db
      .select({
        subsidiaryId: billPayments.subsidiaryId,
        amount: sql<string>`sum(payment_amount::decimal)`,
        count: sql<number>`count(*)`,
      })
      .from(billPayments)
      .where(and(...conditions))
      .groupBy(billPayments.subsidiaryId);

    return {
      periodStart: startDate,
      periodEnd: endDate,
      totalPaid: totals[0]?.totalPaid || '0',
      totalDiscountTaken: totals[0]?.totalDiscount || '0',
      paymentCount: Number(totals[0]?.paymentCount || 0),
      byMethod: byMethod.map(m => ({
        method: m.method as VendorPaymentMethodValue,
        amount: m.amount || '0',
        count: Number(m.count),
      })),
      bySubsidiary: bySubsidiary.map(s => ({
        subsidiaryId: s.subsidiaryId,
        subsidiaryName: '', // Would need to join to get name
        amount: s.amount || '0',
        count: Number(s.count),
      })),
    };
  }

  /**
   * Get vendor bills available for payment
   */
  async getVendorBillsForPayment(
    vendorId: string,
    subsidiaryId?: string
  ): Promise<{
    vendorId: string;
    vendorName: string;
    bills: {
      id: string;
      billNumber: string;
      vendorInvoiceNumber?: string;
      billDate: string;
      dueDate: string;
      totalAmount: string;
      balanceDue: string;
      discountDate?: string;
      discountAmount?: string;
      isOverdue: boolean;
      isDiscountAvailable: boolean;
    }[];
    totalDue: string;
    totalAvailableDiscount: string;
  }> {
    const organizationId = this.requireOrganizationContext();
    const today = new Date().toISOString().split('T')[0];

    // Get vendor
    const vendor = await this.db
      .select({ id: entities.id, name: entities.name })
      .from(entities)
      .where(eq(entities.id, vendorId))
      .limit(1);

    if (!vendor[0]) {
      throw new ServiceError('Vendor not found', 'NOT_FOUND', 404);
    }

    const conditions = [
      eq(vendorBills.organizationId, organizationId),
      eq(vendorBills.vendorId, vendorId),
      inArray(vendorBills.status, [VendorBillStatus.APPROVED, VendorBillStatus.PARTIALLY_PAID]),
      sql`${vendorBills.balanceDue}::decimal > 0`,
    ];

    if (subsidiaryId) {
      conditions.push(eq(vendorBills.subsidiaryId, subsidiaryId));
    }

    const bills = await this.db
      .select()
      .from(vendorBills)
      .where(and(...conditions))
      .orderBy(asc(vendorBills.dueDate));

    let totalDue = new Decimal(0);
    let totalAvailableDiscount = new Decimal(0);

    const billsForPayment = bills.map(bill => {
      const balanceDue = new Decimal(bill.balanceDue);
      totalDue = totalDue.plus(balanceDue);

      const isOverdue = bill.dueDate < today;
      const isDiscountAvailable = bill.discountDate ? bill.discountDate >= today : false;

      if (isDiscountAvailable && bill.discountAmount) {
        totalAvailableDiscount = totalAvailableDiscount.plus(bill.discountAmount);
      }

      return {
        id: bill.id,
        billNumber: bill.billNumber,
        vendorInvoiceNumber: bill.vendorInvoiceNumber || undefined,
        billDate: bill.billDate,
        dueDate: bill.dueDate,
        totalAmount: bill.totalAmount,
        balanceDue: bill.balanceDue,
        discountDate: bill.discountDate || undefined,
        discountAmount: bill.discountAmount || undefined,
        isOverdue,
        isDiscountAvailable,
      };
    });

    return {
      vendorId,
      vendorName: vendor[0].name,
      bills: billsForPayment,
      totalDue: totalDue.toFixed(2),
      totalAvailableDiscount: totalAvailableDiscount.toFixed(2),
    };
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async generatePaymentNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await this.db.execute(sql`
      SELECT COUNT(*) + 1 as seq
      FROM bill_payments
      WHERE payment_number LIKE ${`VPMT-${year}-%`}
    `);
    const seq = String((result.rows[0] as { seq: number }).seq).padStart(6, '0');
    return `VPMT-${year}-${seq}`;
  }

  private async enrichPaymentWithDetails(
    payment: typeof billPayments.$inferSelect,
    includeAll = false
  ): Promise<BillPaymentWithDetails> {
    // Get vendor
    const vendor = await this.db
      .select({ id: entities.id, name: entities.name })
      .from(entities)
      .where(eq(entities.id, payment.vendorId))
      .limit(1);

    // Get bank account
    const bankAccount = payment.bankAccountId
      ? await this.db
          .select({ id: accounts.id, name: accounts.accountName })
          .from(accounts)
          .where(eq(accounts.id, payment.bankAccountId))
          .limit(1)
      : [];

    // Get applications
    const applications = await this.db
      .select()
      .from(billPaymentApplications)
      .where(eq(billPaymentApplications.billPaymentId, payment.id));

    // Enrich applications with bill details if requested
    const enrichedApplications: BillPaymentApplicationWithDetails[] = await Promise.all(
      applications.map(async (app) => {
        const bill = includeAll
          ? await this.db
              .select({
                id: vendorBills.id,
                billNumber: vendorBills.billNumber,
                vendorInvoiceNumber: vendorBills.vendorInvoiceNumber,
                totalAmount: vendorBills.totalAmount,
              })
              .from(vendorBills)
              .where(eq(vendorBills.id, app.vendorBillId))
              .limit(1)
          : [];

        return {
          id: app.id,
          billPaymentId: app.billPaymentId,
          vendorBillId: app.vendorBillId,
          vendorBill: bill[0]
            ? {
                id: bill[0].id,
                billNumber: bill[0].billNumber,
                vendorInvoiceNumber: bill[0].vendorInvoiceNumber || undefined,
                totalAmount: bill[0].totalAmount,
              }
            : undefined,
          appliedAmount: app.appliedAmount,
          discountAmount: app.discountAmount,
          writeOffAmount: app.writeOffAmount,
          createdBy: app.createdBy,
          createdAt: app.createdAt.toISOString(),
          reversedAt: app.reversedAt?.toISOString(),
          reversedBy: app.reversedBy || undefined,
          reversalReason: app.reversalReason || undefined,
        };
      })
    );

    return {
      id: payment.id,
      organizationId: payment.organizationId,
      subsidiaryId: payment.subsidiaryId,
      paymentNumber: payment.paymentNumber,
      vendorId: payment.vendorId,
      vendor: vendor[0] ? { id: vendor[0].id, name: vendor[0].name } : undefined,
      vendorName: payment.vendorName || undefined,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod as VendorPaymentMethodValue,
      status: payment.status as BillPaymentStatusValue,
      paymentAmount: payment.paymentAmount,
      appliedAmount: payment.appliedAmount,
      unappliedAmount: payment.unappliedAmount,
      discountTaken: payment.discountTaken,
      bankAccountId: payment.bankAccountId || undefined,
      bankAccount: bankAccount[0] ? { id: bankAccount[0].id, name: bankAccount[0].name } : undefined,
      checkNumber: payment.checkNumber || undefined,
      achTraceNumber: payment.achTraceNumber || undefined,
      wireReference: payment.wireReference || undefined,
      externalRef: payment.externalRef || undefined,
      payeeName: payment.payeeName || undefined,
      payeeAddress: payment.payeeAddress || undefined,
      currencyCode: payment.currencyCode || 'USD',
      exchangeRate: payment.exchangeRate || '1',
      clearedDate: payment.clearedDate || undefined,
      clearedAmount: payment.clearedAmount || undefined,
      memo: payment.memo || undefined,
      createdBy: payment.createdBy,
      createdAt: payment.createdAt.toISOString(),
      updatedBy: payment.updatedBy || undefined,
      updatedAt: payment.updatedAt.toISOString(),
      voidedAt: payment.voidedAt?.toISOString(),
      voidedBy: payment.voidedBy || undefined,
      voidReason: payment.voidReason || undefined,
      applications: enrichedApplications,
    };
  }

  private toDateString(date: string | Date): string {
    if (typeof date === 'string') {
      return date.split('T')[0];
    }
    return date.toISOString().split('T')[0];
  }
}
