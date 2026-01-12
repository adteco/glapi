import { eq, and, desc, sql, gte, lte, or, inArray } from 'drizzle-orm';
import { BaseService } from './base-service';
import { ServiceError, type PaginatedResult, type PaginationParams } from '../types';
import { EventService } from './event-service';
import { db } from '@glapi/database';
import {
  customerPayments,
  customerPaymentApplications,
  customerCreditMemos,
  invoices,
  entities,
  CustomerPaymentStatus,
  type NewCustomerPayment,
  type NewCustomerPaymentApplication,
  type NewCustomerCreditMemo,
} from '@glapi/database/schema';
import type {
  ReceiveCustomerPaymentInput,
  PaymentApplicationInput,
  CreateCreditMemoInput,
  ApplyCreditMemoInput,
  CustomerPaymentFilters,
  CustomerPaymentWithDetails,
  PaymentApplicationWithDetails,
  CreditMemoWithDetails,
  AutoApplyResult,
  CustomerAccountSummary,
  CashReceiptsSummary,
  CustomerPaymentStatusValue,
} from '../types';

/**
 * CustomerPaymentService - Handles customer payment processing and cash application
 *
 * Key responsibilities:
 * - Receive customer payments
 * - Apply payments to invoices (manual or auto-apply)
 * - Handle unapplied balances and on-account credits
 * - Manage credit memos
 * - Void payments
 */
export class CustomerPaymentService extends BaseService {
  private eventService: EventService;

  constructor(context: { organizationId?: string; userId?: string } = {}) {
    super(context);
    this.eventService = new EventService(context);
  }

  // ==========================================================================
  // Payment Number Generation
  // ==========================================================================

  private async generatePaymentNumber(subsidiaryId: string): Promise<string> {
    const organizationId = this.requireOrganizationContext();
    const year = new Date().getFullYear();
    const prefix = `PMT-${year}-`;

    const [result] = await db
      .select({
        maxNumber: sql<string>`MAX(${customerPayments.paymentNumber})`,
      })
      .from(customerPayments)
      .where(
        and(
          eq(customerPayments.organizationId, organizationId),
          sql`${customerPayments.paymentNumber} LIKE ${prefix + '%'}`
        )
      );

    let nextNumber = 1;
    if (result?.maxNumber) {
      const currentNum = parseInt(result.maxNumber.replace(prefix, ''), 10);
      if (!isNaN(currentNum)) {
        nextNumber = currentNum + 1;
      }
    }

    return `${prefix}${String(nextNumber).padStart(6, '0')}`;
  }

  // ==========================================================================
  // Receive Payment
  // ==========================================================================

  /**
   * Receive a customer payment
   */
  async receivePayment(input: ReceiveCustomerPaymentInput): Promise<CustomerPaymentWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Generate payment number
    const paymentNumber = await this.generatePaymentNumber(input.subsidiaryId);

    // Parse amounts
    const paymentAmount = String(parseFloat(String(input.paymentAmount)).toFixed(2));
    const exchangeRate = input.exchangeRate ? String(parseFloat(String(input.exchangeRate)).toFixed(6)) : '1.000000';

    // Create payment record
    const paymentData: NewCustomerPayment = {
      organizationId,
      subsidiaryId: input.subsidiaryId,
      paymentNumber,
      externalReference: input.externalReference,
      entityId: input.entityId,
      paymentDate: typeof input.paymentDate === 'string'
        ? input.paymentDate
        : input.paymentDate.toISOString().split('T')[0],
      paymentMethod: input.paymentMethod,
      checkNumber: input.checkNumber,
      bankRoutingNumber: input.bankRoutingNumber,
      bankAccountLast4: input.bankAccountLast4,
      currencyCode: input.currencyCode || 'USD',
      exchangeRate,
      paymentAmount,
      appliedAmount: '0.00',
      unappliedAmount: paymentAmount,
      status: 'RECEIVED',
      cashAccountId: input.cashAccountId,
      arAccountId: input.arAccountId,
      memo: input.memo,
      internalNotes: input.internalNotes,
      metadata: input.metadata,
      createdBy: userId,
    };

    const [payment] = await db.insert(customerPayments).values(paymentData).returning();

    // Emit event
    await this.eventService.emit({
      eventType: 'CustomerPaymentReceived',
      eventCategory: 'PAYMENT',
      aggregateType: 'CustomerPayment',
      aggregateId: payment.id,
      data: {
        paymentNumber: payment.paymentNumber,
        entityId: payment.entityId,
        paymentAmount: payment.paymentAmount,
        paymentMethod: payment.paymentMethod,
      },
    });

    // Auto-apply if requested (only for valid auto-apply methods)
    if (input.autoApply && input.applicationMethod) {
      const validAutoApplyMethods: string[] = ['OLDEST_FIRST', 'LARGEST_FIRST', 'PROPORTIONAL'];
      if (validAutoApplyMethods.includes(input.applicationMethod)) {
        const result = await this.autoApplyPayment(
          payment.id,
          input.applicationMethod as 'OLDEST_FIRST' | 'LARGEST_FIRST' | 'PROPORTIONAL'
        );
        return result.payment;
      }
    }

    // Manual applications if provided
    if (input.applications && input.applications.length > 0) {
      await this.applyPaymentToInvoices(payment.id, input.applications);
    }

    return this.getPaymentById(payment.id) as Promise<CustomerPaymentWithDetails>;
  }

  // ==========================================================================
  // Apply Payment to Invoices
  // ==========================================================================

  /**
   * Apply payment to specific invoices
   */
  async applyPaymentToInvoices(
    paymentId: string,
    applications: PaymentApplicationInput[]
  ): Promise<PaymentApplicationWithDetails[]> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Get payment
    const payment = await this.getPaymentById(paymentId);
    if (!payment) {
      throw new ServiceError('Payment not found', 'NOT_FOUND', 404);
    }

    if (payment.status === CustomerPaymentStatus.VOIDED) {
      throw new ServiceError('Cannot apply voided payment', 'PAYMENT_VOIDED', 400);
    }

    // Calculate total application amount
    const totalToApply = applications.reduce((sum, app) => {
      const applied = parseFloat(String(app.appliedAmount));
      const discount = parseFloat(String(app.discountAmount || 0));
      const writeOff = parseFloat(String(app.writeOffAmount || 0));
      return sum + applied + discount + writeOff;
    }, 0);

    const unapplied = parseFloat(payment.unappliedAmount);
    if (totalToApply > unapplied + 0.01) {
      throw new ServiceError(
        `Application amount ${totalToApply} exceeds unapplied balance ${unapplied}`,
        'EXCEEDS_UNAPPLIED',
        400
      );
    }

    const createdApplications: PaymentApplicationWithDetails[] = [];

    for (const app of applications) {
      // Validate invoice
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, app.invoiceId), eq(invoices.organizationId, organizationId)))
        .limit(1);

      if (!invoice) {
        throw new ServiceError(`Invoice ${app.invoiceId} not found`, 'INVOICE_NOT_FOUND', 404);
      }

      // Create application
      const applicationData: NewCustomerPaymentApplication = {
        organizationId,
        customerPaymentId: paymentId,
        invoiceId: app.invoiceId,
        applicationDate: new Date().toISOString().split('T')[0],
        appliedAmount: String(parseFloat(String(app.appliedAmount)).toFixed(2)),
        discountAmount: String(parseFloat(String(app.discountAmount || 0)).toFixed(2)),
        writeOffAmount: String(parseFloat(String(app.writeOffAmount || 0)).toFixed(2)),
        discountAccountId: app.discountAccountId,
        writeOffAccountId: app.writeOffAccountId,
        memo: app.memo,
        createdBy: userId,
      };

      const [application] = await db
        .insert(customerPaymentApplications)
        .values(applicationData)
        .returning();

      createdApplications.push({
        id: application.id,
        customerPaymentId: application.customerPaymentId,
        invoiceId: application.invoiceId,
        applicationDate: application.applicationDate,
        appliedAmount: application.appliedAmount,
        discountAmount: application.discountAmount,
        writeOffAmount: application.writeOffAmount,
        memo: application.memo ?? undefined,
        createdBy: application.createdBy,
        createdAt: application.createdAt.toISOString(),
      });

      // Update invoice status
      await this.updateInvoiceAfterPayment(app.invoiceId);
    }

    // Update payment amounts
    await this.updatePaymentAmounts(paymentId);

    // Emit event
    await this.eventService.emit({
      eventType: 'PaymentApplied',
      eventCategory: 'PAYMENT',
      aggregateType: 'CustomerPayment',
      aggregateId: paymentId,
      data: {
        applicationsCount: createdApplications.length,
        totalApplied: totalToApply,
      },
    });

    return createdApplications;
  }

  /**
   * Auto-apply payment to invoices based on method
   */
  async autoApplyPayment(
    paymentId: string,
    method: 'OLDEST_FIRST' | 'LARGEST_FIRST' | 'PROPORTIONAL'
  ): Promise<AutoApplyResult> {
    const organizationId = this.requireOrganizationContext();

    const payment = await this.getPaymentById(paymentId);
    if (!payment) {
      throw new ServiceError('Payment not found', 'NOT_FOUND', 404);
    }

    // Get open invoices for this customer
    const openInvoices = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, organizationId),
          eq(invoices.entityId, payment.entityId),
          or(
            eq(invoices.status, 'sent'),
            eq(invoices.status, 'partial'),
            eq(invoices.status, 'overdue')
          )
        )
      )
      .orderBy(
        method === 'OLDEST_FIRST'
          ? invoices.invoiceDate
          : method === 'LARGEST_FIRST'
          ? desc(invoices.totalAmount)
          : invoices.invoiceDate
      );

    if (openInvoices.length === 0) {
      return {
        payment,
        applicationsCreated: 0,
        totalApplied: '0.00',
        remainingUnapplied: payment.unappliedAmount,
        invoicesFullyPaid: [],
        invoicesPartiallyPaid: [],
      };
    }

    let remainingAmount = parseFloat(payment.unappliedAmount);
    const applications: PaymentApplicationInput[] = [];
    const invoicesFullyPaid: string[] = [];
    const invoicesPartiallyPaid: string[] = [];

    if (method === 'PROPORTIONAL') {
      // Calculate total outstanding
      const totalOutstanding = openInvoices.reduce(
        (sum, inv) => sum + parseFloat(inv.totalAmount),
        0
      );

      for (const invoice of openInvoices) {
        if (remainingAmount <= 0.01) break;

        const invoiceBalance = parseFloat(invoice.totalAmount);
        const proportion = invoiceBalance / totalOutstanding;
        const toApply = Math.min(remainingAmount * proportion, invoiceBalance);

        if (toApply > 0.01) {
          applications.push({
            invoiceId: invoice.id,
            appliedAmount: toApply.toFixed(2),
          });

          if (toApply >= invoiceBalance - 0.01) {
            invoicesFullyPaid.push(invoice.invoiceNumber);
          } else {
            invoicesPartiallyPaid.push(invoice.invoiceNumber);
          }
        }
      }
    } else {
      // OLDEST_FIRST or LARGEST_FIRST
      for (const invoice of openInvoices) {
        if (remainingAmount <= 0.01) break;

        const invoiceBalance = parseFloat(invoice.totalAmount);
        const toApply = Math.min(remainingAmount, invoiceBalance);

        applications.push({
          invoiceId: invoice.id,
          appliedAmount: toApply.toFixed(2),
        });

        remainingAmount -= toApply;

        if (toApply >= invoiceBalance - 0.01) {
          invoicesFullyPaid.push(invoice.invoiceNumber);
        } else {
          invoicesPartiallyPaid.push(invoice.invoiceNumber);
        }
      }
    }

    // Apply the payments
    if (applications.length > 0) {
      await this.applyPaymentToInvoices(paymentId, applications);
    }

    const updatedPayment = await this.getPaymentById(paymentId);

    return {
      payment: updatedPayment!,
      applicationsCreated: applications.length,
      totalApplied: applications.reduce((sum, app) => sum + parseFloat(String(app.appliedAmount)), 0).toFixed(2),
      remainingUnapplied: updatedPayment!.unappliedAmount,
      invoicesFullyPaid,
      invoicesPartiallyPaid,
    };
  }

  // ==========================================================================
  // Unapply Payment
  // ==========================================================================

  /**
   * Reverse a payment application
   */
  async unapplyPayment(applicationId: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const [application] = await db
      .select()
      .from(customerPaymentApplications)
      .where(
        and(
          eq(customerPaymentApplications.id, applicationId),
          eq(customerPaymentApplications.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!application) {
      throw new ServiceError('Application not found', 'NOT_FOUND', 404);
    }

    if (application.reversedAt) {
      throw new ServiceError('Application already reversed', 'ALREADY_REVERSED', 400);
    }

    // Mark as reversed
    await db
      .update(customerPaymentApplications)
      .set({
        reversedAt: new Date(),
        reversedBy: userId,
      })
      .where(eq(customerPaymentApplications.id, applicationId));

    // Update payment amounts
    await this.updatePaymentAmounts(application.customerPaymentId);

    // Update invoice status
    await this.updateInvoiceAfterPayment(application.invoiceId);

    // Emit event
    await this.eventService.emit({
      eventType: 'PaymentApplicationReversed',
      eventCategory: 'PAYMENT',
      aggregateType: 'CustomerPayment',
      aggregateId: application.customerPaymentId,
      data: {
        applicationId,
        invoiceId: application.invoiceId,
        appliedAmount: application.appliedAmount,
      },
    });
  }

  // ==========================================================================
  // Void Payment
  // ==========================================================================

  /**
   * Void a customer payment
   */
  async voidPayment(paymentId: string, reason: string): Promise<CustomerPaymentWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const payment = await this.getPaymentById(paymentId);
    if (!payment) {
      throw new ServiceError('Payment not found', 'NOT_FOUND', 404);
    }

    if (payment.status === CustomerPaymentStatus.VOIDED) {
      throw new ServiceError('Payment already voided', 'ALREADY_VOIDED', 400);
    }

    if (payment.status === CustomerPaymentStatus.RECONCILED) {
      throw new ServiceError('Cannot void reconciled payment', 'RECONCILED', 400);
    }

    // Reverse all applications
    const activeApplications = await db
      .select()
      .from(customerPaymentApplications)
      .where(
        and(
          eq(customerPaymentApplications.customerPaymentId, paymentId),
          sql`${customerPaymentApplications.reversedAt} IS NULL`
        )
      );

    for (const app of activeApplications) {
      await this.unapplyPayment(app.id);
    }

    // Void the payment
    await db
      .update(customerPayments)
      .set({
        status: 'VOIDED',
        voidedAt: new Date(),
        voidedBy: userId,
        voidReason: reason,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(customerPayments.id, paymentId));

    // Emit event
    await this.eventService.emit({
      eventType: 'CustomerPaymentVoided',
      eventCategory: 'PAYMENT',
      aggregateType: 'CustomerPayment',
      aggregateId: paymentId,
      data: {
        paymentNumber: payment.paymentNumber,
        reason,
      },
    });

    return this.getPaymentById(paymentId) as Promise<CustomerPaymentWithDetails>;
  }

  // ==========================================================================
  // Credit Memos
  // ==========================================================================

  /**
   * Create a credit memo from overpayment or adjustment
   */
  async createCreditMemo(input: CreateCreditMemoInput): Promise<CreditMemoWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Generate credit memo number
    const year = new Date().getFullYear();
    const prefix = `CM-${year}-`;

    const [result] = await db
      .select({
        maxNumber: sql<string>`MAX(${customerCreditMemos.creditMemoNumber})`,
      })
      .from(customerCreditMemos)
      .where(
        and(
          eq(customerCreditMemos.organizationId, organizationId),
          sql`${customerCreditMemos.creditMemoNumber} LIKE ${prefix + '%'}`
        )
      );

    let nextNumber = 1;
    if (result?.maxNumber) {
      const currentNum = parseInt(result.maxNumber.replace(prefix, ''), 10);
      if (!isNaN(currentNum)) {
        nextNumber = currentNum + 1;
      }
    }

    const creditMemoNumber = `${prefix}${String(nextNumber).padStart(6, '0')}`;
    const originalAmount = String(parseFloat(String(input.originalAmount)).toFixed(2));

    const creditMemoData: NewCustomerCreditMemo = {
      organizationId,
      subsidiaryId: input.subsidiaryId,
      creditMemoNumber,
      entityId: input.entityId,
      sourceType: input.sourceType,
      sourcePaymentId: input.sourcePaymentId,
      sourceInvoiceId: input.sourceInvoiceId,
      creditDate: typeof input.creditDate === 'string'
        ? input.creditDate
        : input.creditDate.toISOString().split('T')[0],
      currencyCode: 'USD',
      originalAmount,
      appliedAmount: '0.00',
      remainingAmount: originalAmount,
      isFullyApplied: false,
      creditAccountId: input.creditAccountId,
      reason: input.reason,
      memo: input.memo,
      metadata: input.metadata,
      createdBy: userId,
    };

    const [creditMemo] = await db.insert(customerCreditMemos).values(creditMemoData).returning();

    // Emit event
    await this.eventService.emit({
      eventType: 'CreditMemoCreated',
      eventCategory: 'PAYMENT',
      aggregateType: 'CreditMemo',
      aggregateId: creditMemo.id,
      data: {
        creditMemoNumber: creditMemo.creditMemoNumber,
        entityId: creditMemo.entityId,
        originalAmount: creditMemo.originalAmount,
        sourceType: creditMemo.sourceType,
      },
    });

    return this.getCreditMemoById(creditMemo.id) as Promise<CreditMemoWithDetails>;
  }

  /**
   * Apply credit memo to invoice
   */
  async applyCreditMemo(input: ApplyCreditMemoInput): Promise<CreditMemoWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const creditMemo = await this.getCreditMemoById(input.creditMemoId);
    if (!creditMemo) {
      throw new ServiceError('Credit memo not found', 'NOT_FOUND', 404);
    }

    if (creditMemo.isFullyApplied) {
      throw new ServiceError('Credit memo fully applied', 'FULLY_APPLIED', 400);
    }

    const applyAmount = parseFloat(String(input.amount));
    const remaining = parseFloat(creditMemo.remainingAmount);

    if (applyAmount > remaining + 0.01) {
      throw new ServiceError(
        `Amount ${applyAmount} exceeds remaining ${remaining}`,
        'EXCEEDS_REMAINING',
        400
      );
    }

    // Create a payment application for the credit
    // This effectively applies the credit as a payment
    const newApplied = parseFloat(creditMemo.appliedAmount) + applyAmount;
    const newRemaining = parseFloat(creditMemo.originalAmount) - newApplied;

    await db
      .update(customerCreditMemos)
      .set({
        appliedAmount: newApplied.toFixed(2),
        remainingAmount: newRemaining.toFixed(2),
        isFullyApplied: newRemaining < 0.01,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(customerCreditMemos.id, input.creditMemoId));

    // Update invoice
    await this.updateInvoiceAfterPayment(input.invoiceId);

    return this.getCreditMemoById(input.creditMemoId) as Promise<CreditMemoWithDetails>;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private async updatePaymentAmounts(paymentId: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    // Calculate total applied from active applications
    const [totals] = await db
      .select({
        totalApplied: sql<string>`COALESCE(SUM(${customerPaymentApplications.appliedAmount}), 0)::text`,
      })
      .from(customerPaymentApplications)
      .where(
        and(
          eq(customerPaymentApplications.customerPaymentId, paymentId),
          sql`${customerPaymentApplications.reversedAt} IS NULL`
        )
      );

    const totalApplied = parseFloat(totals?.totalApplied || '0');

    // Get payment amount
    const [payment] = await db
      .select({ paymentAmount: customerPayments.paymentAmount })
      .from(customerPayments)
      .where(eq(customerPayments.id, paymentId))
      .limit(1);

    const paymentAmount = parseFloat(payment?.paymentAmount || '0');
    const unapplied = paymentAmount - totalApplied;

    // Determine status
    let status: string;
    if (unapplied < 0.01) {
      status = CustomerPaymentStatus.FULLY_APPLIED;
    } else if (totalApplied > 0.01) {
      status = CustomerPaymentStatus.PARTIALLY_APPLIED;
    } else {
      status = CustomerPaymentStatus.RECEIVED;
    }

    await db
      .update(customerPayments)
      .set({
        appliedAmount: totalApplied.toFixed(2),
        unappliedAmount: unapplied.toFixed(2),
        status: status as any,
        updatedAt: new Date(),
      })
      .where(eq(customerPayments.id, paymentId));
  }

  private async updateInvoiceAfterPayment(invoiceId: string): Promise<void> {
    // Calculate total payments applied to this invoice
    const [totals] = await db
      .select({
        totalApplied: sql<string>`COALESCE(SUM(${customerPaymentApplications.appliedAmount}), 0)::text`,
      })
      .from(customerPaymentApplications)
      .where(
        and(
          eq(customerPaymentApplications.invoiceId, invoiceId),
          sql`${customerPaymentApplications.reversedAt} IS NULL`
        )
      );

    const totalPaid = parseFloat(totals?.totalApplied || '0');

    // Get invoice total
    const [invoice] = await db
      .select({ totalAmount: invoices.totalAmount })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    const invoiceTotal = parseFloat(invoice?.totalAmount || '0');
    const balance = invoiceTotal - totalPaid;

    // Determine status
    let status: string;
    if (balance < 0.01) {
      status = 'paid';
    } else if (totalPaid > 0.01) {
      status = 'partial';
    } else {
      status = 'sent'; // or keep current status
    }

    await db
      .update(invoices)
      .set({
        status: status as any,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId));
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Get payment by ID with details
   */
  async getPaymentById(id: string): Promise<CustomerPaymentWithDetails | null> {
    const organizationId = this.requireOrganizationContext();

    const [result] = await db
      .select({
        payment: customerPayments,
        entity: {
          id: entities.id,
          name: entities.name,
          email: entities.email,
        },
      })
      .from(customerPayments)
      .leftJoin(entities, eq(customerPayments.entityId, entities.id))
      .where(
        and(
          eq(customerPayments.id, id),
          eq(customerPayments.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!result) return null;

    // Get applications
    const applications = await db
      .select({
        application: customerPaymentApplications,
        invoice: {
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          totalAmount: invoices.totalAmount,
          entityId: invoices.entityId,
        },
      })
      .from(customerPaymentApplications)
      .leftJoin(invoices, eq(customerPaymentApplications.invoiceId, invoices.id))
      .where(eq(customerPaymentApplications.customerPaymentId, id));

    return {
      ...this.mapPaymentToDetails(result.payment),
      entity: result.entity || undefined,
      applications: applications.map((a) => ({
        id: a.application.id,
        customerPaymentId: a.application.customerPaymentId,
        invoiceId: a.application.invoiceId,
        invoice: a.invoice || undefined,
        applicationDate: a.application.applicationDate,
        appliedAmount: a.application.appliedAmount,
        discountAmount: a.application.discountAmount,
        writeOffAmount: a.application.writeOffAmount,
        memo: a.application.memo ?? undefined,
        createdBy: a.application.createdBy,
        createdAt: a.application.createdAt.toISOString(),
        reversedAt: a.application.reversedAt?.toISOString(),
        reversedBy: a.application.reversedBy ?? undefined,
      })),
    };
  }

  /**
   * List customer payments
   */
  async listPayments(
    pagination: PaginationParams,
    filters: CustomerPaymentFilters = {}
  ): Promise<PaginatedResult<CustomerPaymentWithDetails>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(pagination);

    const conditions = [eq(customerPayments.organizationId, organizationId)];

    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      conditions.push(inArray(customerPayments.status, statuses as any));
    }

    if (filters.entityId) {
      conditions.push(eq(customerPayments.entityId, filters.entityId));
    }

    if (filters.subsidiaryId) {
      conditions.push(eq(customerPayments.subsidiaryId, filters.subsidiaryId));
    }

    if (filters.paymentDateFrom) {
      const dateFrom = typeof filters.paymentDateFrom === 'string'
        ? filters.paymentDateFrom
        : filters.paymentDateFrom.toISOString().split('T')[0];
      conditions.push(gte(customerPayments.paymentDate, dateFrom));
    }

    if (filters.paymentDateTo) {
      const dateTo = typeof filters.paymentDateTo === 'string'
        ? filters.paymentDateTo
        : filters.paymentDateTo.toISOString().split('T')[0];
      conditions.push(lte(customerPayments.paymentDate, dateTo));
    }

    if (filters.hasUnappliedBalance) {
      conditions.push(sql`CAST(${customerPayments.unappliedAmount} AS NUMERIC) > 0.01`);
    }

    if (filters.bankDepositId) {
      conditions.push(eq(customerPayments.bankDepositId, filters.bankDepositId));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(customerPayments)
      .where(whereClause);

    // Get paginated results
    const results = await db
      .select({
        payment: customerPayments,
        entity: {
          id: entities.id,
          name: entities.name,
          email: entities.email,
        },
      })
      .from(customerPayments)
      .leftJoin(entities, eq(customerPayments.entityId, entities.id))
      .where(whereClause)
      .orderBy(desc(customerPayments.paymentDate), desc(customerPayments.createdAt))
      .limit(take)
      .offset(skip);

    const data = results.map((r) => ({
      ...this.mapPaymentToDetails(r.payment),
      entity: r.entity || undefined,
    }));

    return this.createPaginatedResult(data, Number(count), page, limit);
  }

  /**
   * Get customer account summary
   */
  async getCustomerAccountSummary(entityId: string): Promise<CustomerAccountSummary> {
    const organizationId = this.requireOrganizationContext();

    // Get entity name
    const [entity] = await db
      .select({ name: entities.name })
      .from(entities)
      .where(eq(entities.id, entityId))
      .limit(1);

    // Get outstanding invoices
    const [invoiceTotals] = await db
      .select({
        totalOutstanding: sql<string>`COALESCE(SUM(${invoices.totalAmount}), 0)::text`,
        invoiceCount: sql<number>`COUNT(*)::int`,
        overdueCount: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} = 'overdue')::int`,
        overdueAmount: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'overdue' THEN ${invoices.totalAmount} ELSE 0 END), 0)::text`,
        oldestDate: sql<string>`MIN(${invoices.invoiceDate})::text`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, organizationId),
          eq(invoices.entityId, entityId),
          or(
            eq(invoices.status, 'sent'),
            eq(invoices.status, 'partial'),
            eq(invoices.status, 'overdue')
          )
        )
      );

    // Get unapplied payments
    const [paymentTotals] = await db
      .select({
        totalUnapplied: sql<string>`COALESCE(SUM(CAST(${customerPayments.unappliedAmount} AS NUMERIC)), 0)::text`,
      })
      .from(customerPayments)
      .where(
        and(
          eq(customerPayments.organizationId, organizationId),
          eq(customerPayments.entityId, entityId),
          sql`CAST(${customerPayments.unappliedAmount} AS NUMERIC) > 0.01`
        )
      );

    // Get credit balance
    const [creditTotals] = await db
      .select({
        totalCredits: sql<string>`COALESCE(SUM(CAST(${customerCreditMemos.remainingAmount} AS NUMERIC)), 0)::text`,
      })
      .from(customerCreditMemos)
      .where(
        and(
          eq(customerCreditMemos.organizationId, organizationId),
          eq(customerCreditMemos.entityId, entityId),
          eq(customerCreditMemos.isFullyApplied, false)
        )
      );

    return {
      entityId,
      entityName: entity?.name || 'Unknown',
      totalOutstanding: invoiceTotals?.totalOutstanding || '0.00',
      totalOverdue: invoiceTotals?.overdueAmount || '0.00',
      totalUnappliedPayments: paymentTotals?.totalUnapplied || '0.00',
      totalCredits: creditTotals?.totalCredits || '0.00',
      oldestInvoiceDate: invoiceTotals?.oldestDate || undefined,
      invoiceCount: invoiceTotals?.invoiceCount || 0,
      overdueInvoiceCount: invoiceTotals?.overdueCount || 0,
    };
  }

  /**
   * Get credit memo by ID
   */
  async getCreditMemoById(id: string): Promise<CreditMemoWithDetails | null> {
    const organizationId = this.requireOrganizationContext();

    const [result] = await db
      .select({
        creditMemo: customerCreditMemos,
        entity: {
          id: entities.id,
          name: entities.name,
        },
      })
      .from(customerCreditMemos)
      .leftJoin(entities, eq(customerCreditMemos.entityId, entities.id))
      .where(
        and(
          eq(customerCreditMemos.id, id),
          eq(customerCreditMemos.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!result) return null;

    const cm = result.creditMemo;
    return {
      id: cm.id,
      organizationId: cm.organizationId,
      subsidiaryId: cm.subsidiaryId,
      creditMemoNumber: cm.creditMemoNumber,
      entityId: cm.entityId,
      entity: result.entity || undefined,
      sourceType: cm.sourceType,
      sourcePaymentId: cm.sourcePaymentId ?? undefined,
      sourceInvoiceId: cm.sourceInvoiceId ?? undefined,
      creditDate: cm.creditDate,
      currencyCode: cm.currencyCode,
      originalAmount: cm.originalAmount,
      appliedAmount: cm.appliedAmount,
      remainingAmount: cm.remainingAmount,
      isFullyApplied: cm.isFullyApplied,
      creditAccountId: cm.creditAccountId ?? undefined,
      glTransactionId: cm.glTransactionId ?? undefined,
      reason: cm.reason ?? undefined,
      memo: cm.memo ?? undefined,
      metadata: cm.metadata as Record<string, unknown> | undefined,
      createdBy: cm.createdBy,
      createdAt: cm.createdAt.toISOString(),
      updatedBy: cm.updatedBy ?? undefined,
      updatedAt: cm.updatedAt.toISOString(),
    };
  }

  // ==========================================================================
  // Mapping Helpers
  // ==========================================================================

  private mapPaymentToDetails(payment: typeof customerPayments.$inferSelect): CustomerPaymentWithDetails {
    return {
      id: payment.id,
      organizationId: payment.organizationId,
      subsidiaryId: payment.subsidiaryId,
      paymentNumber: payment.paymentNumber,
      externalReference: payment.externalReference ?? undefined,
      entityId: payment.entityId,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      checkNumber: payment.checkNumber ?? undefined,
      currencyCode: payment.currencyCode,
      exchangeRate: payment.exchangeRate,
      paymentAmount: payment.paymentAmount,
      appliedAmount: payment.appliedAmount,
      unappliedAmount: payment.unappliedAmount,
      status: payment.status as CustomerPaymentStatusValue,
      cashAccountId: payment.cashAccountId ?? undefined,
      arAccountId: payment.arAccountId ?? undefined,
      glTransactionId: payment.glTransactionId ?? undefined,
      postedAt: payment.postedAt?.toISOString(),
      bankDepositId: payment.bankDepositId ?? undefined,
      memo: payment.memo ?? undefined,
      internalNotes: payment.internalNotes ?? undefined,
      metadata: payment.metadata as Record<string, unknown> | undefined,
      createdBy: payment.createdBy,
      createdAt: payment.createdAt.toISOString(),
      updatedBy: payment.updatedBy ?? undefined,
      updatedAt: payment.updatedAt.toISOString(),
      voidedAt: payment.voidedAt?.toISOString(),
      voidedBy: payment.voidedBy ?? undefined,
      voidReason: payment.voidReason ?? undefined,
    };
  }
}
