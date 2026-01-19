/**
 * Customer Payment Hybrid Service
 *
 * Handles customer payment operations using the hybrid transaction model.
 * Uses transaction_headers + customer_payment_ext for payment data,
 * and customer_payment_applications for payment-to-invoice applications.
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
  CreateTransactionHeaderInput,
} from '../types/transaction.types';
import {
  EventCategoryType,
  HybridCustomerPaymentStatus,
  HybridCustomerPaymentStatusValue,
} from '@glapi/database';
import { db } from '@glapi/database';
import {
  transactionHeaders,
  TransactionHeader,
  customerPaymentExt,
  CustomerPaymentExtRecord,
  NewCustomerPaymentExtRecord,
  customerPaymentApplications2,
  CustomerPaymentApplication2,
  NewCustomerPaymentApplication2,
  invoiceExt,
} from '@glapi/database/schema';
import { eq, and, desc, asc, sql, inArray, gte, lte } from 'drizzle-orm';
import Decimal from 'decimal.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CustomerPaymentWithDetails {
  id: string;
  organizationId: string;
  subsidiaryId: string;
  transactionNumber: string;
  customerId: string;
  customerName?: string;
  paymentDate: string;
  status: HybridCustomerPaymentStatusValue;
  paymentMethod: string;
  paymentAmount: string;
  appliedAmount: string;
  unappliedAmount: string;
  currencyCode: string;
  exchangeRate: string;
  memo?: string;
  internalNotes?: string;
  // Extension fields
  externalReference?: string;
  checkNumber?: string;
  bankRoutingNumber?: string;
  bankAccountLast4?: string;
  cashAccountId?: string;
  arAccountId?: string;
  glTransactionId?: string;
  postedAt?: string;
  bankDepositId?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
  // Audit
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy?: string;
  // Applications
  applications?: PaymentApplicationDetails[];
}

export interface PaymentApplicationDetails {
  id: string;
  invoiceId: string;
  invoiceNumber?: string;
  appliedAmount: string;
  discountTaken: string;
  applicationDate: string;
  createdAt: string;
  createdBy: string;
}

export interface CreateCustomerPaymentInput extends CreateTransactionHeaderInput {
  paymentMethod: string;
  paymentAmount: number;
  externalReference?: string;
  checkNumber?: string;
  bankRoutingNumber?: string;
  bankAccountLast4?: string;
  cashAccountId?: string;
  arAccountId?: string;
}

export interface UpdateCustomerPaymentInput {
  paymentDate?: string | Date;
  memo?: string;
  internalNotes?: string;
  externalReference?: string;
  checkNumber?: string;
  bankRoutingNumber?: string;
  bankAccountLast4?: string;
  cashAccountId?: string;
  arAccountId?: string;
}

export interface ApplyPaymentInput {
  invoiceId: string;
  appliedAmount: number;
  discountTaken?: number;
}

export type AutoApplyStrategy = 'OLDEST_FIRST' | 'LARGEST_FIRST' | 'PROPORTIONAL';

export interface CustomerPaymentFilters extends TransactionFilters {
  paymentMethod?: string;
  customerId?: string;
  bankDepositId?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
}

export interface CustomerAccountSummary {
  customerId: string;
  customerName: string;
  totalOutstanding: string;
  totalPaid: string;
  totalUnapplied: string;
  invoiceCount: number;
  oldestInvoiceDate?: string;
  overdueAmount: string;
}

// ============================================================================
// STATUS TRANSITIONS
// ============================================================================

const VALID_STATUS_TRANSITIONS: Record<HybridCustomerPaymentStatusValue, HybridCustomerPaymentStatusValue[]> = {
  [HybridCustomerPaymentStatus.DRAFT]: [
    HybridCustomerPaymentStatus.PENDING,
    HybridCustomerPaymentStatus.POSTED,
    HybridCustomerPaymentStatus.VOIDED,
  ],
  [HybridCustomerPaymentStatus.PENDING]: [
    HybridCustomerPaymentStatus.POSTED,
    HybridCustomerPaymentStatus.VOIDED,
  ],
  [HybridCustomerPaymentStatus.POSTED]: [
    HybridCustomerPaymentStatus.DEPOSITED,
    HybridCustomerPaymentStatus.VOIDED,
  ],
  [HybridCustomerPaymentStatus.DEPOSITED]: [
    HybridCustomerPaymentStatus.CLEARED,
    HybridCustomerPaymentStatus.VOIDED,
  ],
  [HybridCustomerPaymentStatus.CLEARED]: [
    HybridCustomerPaymentStatus.VOIDED,
  ],
  [HybridCustomerPaymentStatus.VOIDED]: [],
};

// ============================================================================
// SERVICE
// ============================================================================

export class CustomerPaymentHybridService extends BaseTransactionService {
  protected transactionType = TransactionTypeCode.CUSTOMER_PAYMENT;
  protected eventCategory: EventCategoryType = 'TRANSACTION';

  constructor(context: ServiceContext = {}) {
    super(context);
  }

  // ==========================================================================
  // LIST
  // ==========================================================================

  async listPayments(
    params: PaginationParams = {},
    filters: CustomerPaymentFilters = {}
  ): Promise<PaginatedResult<CustomerPaymentWithDetails>> {
    const result = await this.listHeaders(params, {
      ...filters,
      transactionType: TransactionTypeCode.CUSTOMER_PAYMENT,
    });

    const paymentsWithDetails = await Promise.all(
      result.data.map(async (header) => this.getPaymentDetails(header))
    );

    return {
      ...result,
      data: paymentsWithDetails,
    };
  }

  // ==========================================================================
  // GET BY ID
  // ==========================================================================

  async getPaymentById(id: string): Promise<CustomerPaymentWithDetails> {
    const header = await this.getHeaderById(id);
    if (!header) {
      throw new ServiceError('Customer payment not found', 'NOT_FOUND', 404);
    }
    return this.getPaymentDetails(header, true);
  }

  // ==========================================================================
  // GET BY PAYMENT NUMBER
  // ==========================================================================

  async getPaymentByNumber(paymentNumber: string): Promise<CustomerPaymentWithDetails> {
    const header = await this.getHeaderByNumber(paymentNumber);
    if (!header) {
      throw new ServiceError('Customer payment not found', 'NOT_FOUND', 404);
    }
    return this.getPaymentDetails(header, true);
  }

  // ==========================================================================
  // RECEIVE PAYMENT (CREATE)
  // ==========================================================================

  async receivePayment(input: CreateCustomerPaymentInput): Promise<CustomerPaymentWithDetails> {
    const userId = this.requireUserContext();
    const paymentNumber = await this.generateTransactionNumber();
    const paymentDate = this.toDateString(input.transactionDate);
    const paymentAmount = new Decimal(input.paymentAmount);

    // Create header
    const header = await this.createHeader({
      subsidiaryId: input.subsidiaryId,
      transactionType: TransactionTypeCode.CUSTOMER_PAYMENT,
      transactionNumber: paymentNumber,
      entityId: input.entityId,
      entityName: input.entityName,
      transactionDate: paymentDate,
      status: HybridCustomerPaymentStatus.DRAFT,
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
    await db.insert(customerPaymentExt).values({
      transactionId: header.id,
      paymentMethod: input.paymentMethod,
      paymentAmount: paymentAmount.toFixed(4),
      appliedAmount: '0',
      unappliedAmount: paymentAmount.toFixed(4),
      externalReference: input.externalReference,
      checkNumber: input.checkNumber,
      bankRoutingNumber: input.bankRoutingNumber,
      bankAccountLast4: input.bankAccountLast4,
      cashAccountId: input.cashAccountId,
      arAccountId: input.arAccountId,
    });

    await this.emitEvent('CUSTOMER_PAYMENT_RECEIVED', header.id, {
      paymentNumber,
      customerId: input.entityId,
      paymentAmount: paymentAmount.toNumber(),
      paymentMethod: input.paymentMethod,
    });

    return this.getPaymentById(header.id);
  }

  // ==========================================================================
  // UPDATE PAYMENT
  // ==========================================================================

  async updatePayment(id: string, input: UpdateCustomerPaymentInput): Promise<CustomerPaymentWithDetails> {
    const payment = await this.getPaymentById(id);

    if (payment.status === HybridCustomerPaymentStatus.VOIDED) {
      throw new ServiceError('Cannot update voided payment', 'INVALID_STATUS', 400);
    }

    if (payment.status === HybridCustomerPaymentStatus.CLEARED) {
      throw new ServiceError('Cannot update cleared payment', 'INVALID_STATUS', 400);
    }

    // Update header
    if (input.paymentDate || input.memo !== undefined || input.internalNotes !== undefined) {
      await this.updateHeader(id, {
        transactionDate: input.paymentDate ? this.toDateString(input.paymentDate) : undefined,
        memo: input.memo,
        internalNotes: input.internalNotes,
      });
    }

    // Update extension
    const extUpdate: Partial<NewCustomerPaymentExtRecord> = {};
    if (input.externalReference !== undefined) extUpdate.externalReference = input.externalReference;
    if (input.checkNumber !== undefined) extUpdate.checkNumber = input.checkNumber;
    if (input.bankRoutingNumber !== undefined) extUpdate.bankRoutingNumber = input.bankRoutingNumber;
    if (input.bankAccountLast4 !== undefined) extUpdate.bankAccountLast4 = input.bankAccountLast4;
    if (input.cashAccountId !== undefined) extUpdate.cashAccountId = input.cashAccountId;
    if (input.arAccountId !== undefined) extUpdate.arAccountId = input.arAccountId;

    if (Object.keys(extUpdate).length > 0) {
      await db.update(customerPaymentExt)
        .set(extUpdate)
        .where(eq(customerPaymentExt.transactionId, id));
    }

    await this.emitEvent('CUSTOMER_PAYMENT_UPDATED', id, {
      paymentNumber: payment.transactionNumber,
    });

    return this.getPaymentById(id);
  }

  // ==========================================================================
  // APPLY PAYMENT TO INVOICE
  // ==========================================================================

  async applyPayment(
    paymentId: string,
    applications: ApplyPaymentInput[]
  ): Promise<CustomerPaymentWithDetails> {
    const userId = this.requireUserContext();
    const organizationId = this.requireOrganizationContext();
    const payment = await this.getPaymentById(paymentId);

    if (payment.status === HybridCustomerPaymentStatus.VOIDED) {
      throw new ServiceError('Cannot apply voided payment', 'INVALID_STATUS', 400);
    }

    let totalToApply = new Decimal(0);
    for (const app of applications) {
      totalToApply = totalToApply.plus(new Decimal(app.appliedAmount));
    }

    const currentUnapplied = new Decimal(payment.unappliedAmount);
    if (totalToApply.greaterThan(currentUnapplied)) {
      throw new ServiceError(
        `Cannot apply ${totalToApply.toFixed(2)} when only ${currentUnapplied.toFixed(2)} is unapplied`,
        'INSUFFICIENT_UNAPPLIED',
        400
      );
    }

    // Apply to each invoice
    for (const app of applications) {
      const appliedAmount = new Decimal(app.appliedAmount);
      const discountTaken = new Decimal(app.discountTaken || 0);

      // Verify invoice exists and is for same customer
      const [invoice] = await db
        .select()
        .from(transactionHeaders)
        .where(
          and(
            eq(transactionHeaders.id, app.invoiceId),
            eq(transactionHeaders.organizationId, organizationId),
            eq(transactionHeaders.transactionType, TransactionTypeCode.INVOICE),
            eq(transactionHeaders.entityId, payment.customerId)
          )
        )
        .limit(1);

      if (!invoice) {
        throw new ServiceError(`Invoice ${app.invoiceId} not found or not for this customer`, 'INVOICE_NOT_FOUND', 404);
      }

      // Create application
      await db.insert(customerPaymentApplications2).values({
        organizationId,
        paymentId,
        invoiceId: app.invoiceId,
        appliedAmount: appliedAmount.toFixed(4),
        discountTaken: discountTaken.toFixed(4),
        applicationDate: new Date().toISOString().split('T')[0],
        createdBy: userId,
      });

      // Update invoice paid amount and balance
      const [invExt] = await db
        .select()
        .from(invoiceExt)
        .where(eq(invoiceExt.transactionId, app.invoiceId))
        .limit(1);

      if (invExt) {
        const currentPaid = new Decimal(invExt.paidAmount || 0);
        const newPaid = currentPaid.plus(appliedAmount).plus(discountTaken);
        const invoiceTotal = new Decimal(invoice.totalAmount || 0);
        const newBalance = invoiceTotal.minus(newPaid);

        await db.update(invoiceExt)
          .set({
            paidAmount: newPaid.toFixed(4),
            balanceDue: newBalance.toFixed(4),
          })
          .where(eq(invoiceExt.transactionId, app.invoiceId));

        // Update invoice status if fully paid
        if (newBalance.lessThanOrEqualTo(0)) {
          await this.updateHeader(app.invoiceId, { status: 'PAID' });
        } else if (newPaid.greaterThan(0)) {
          await this.updateHeader(app.invoiceId, { status: 'PARTIALLY_PAID' });
        }
      }
    }

    // Update payment applied/unapplied amounts
    const currentApplied = new Decimal(payment.appliedAmount);
    const newApplied = currentApplied.plus(totalToApply);
    const newUnapplied = currentUnapplied.minus(totalToApply);

    await db.update(customerPaymentExt)
      .set({
        appliedAmount: newApplied.toFixed(4),
        unappliedAmount: newUnapplied.toFixed(4),
      })
      .where(eq(customerPaymentExt.transactionId, paymentId));

    await this.emitEvent('CUSTOMER_PAYMENT_APPLIED', paymentId, {
      paymentNumber: payment.transactionNumber,
      applicationsCount: applications.length,
      totalApplied: totalToApply.toNumber(),
    });

    return this.getPaymentById(paymentId);
  }

  // ==========================================================================
  // AUTO-APPLY PAYMENT
  // ==========================================================================

  async autoApplyPayment(
    paymentId: string,
    strategy: AutoApplyStrategy = 'OLDEST_FIRST'
  ): Promise<CustomerPaymentWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const payment = await this.getPaymentById(paymentId);

    if (payment.status === HybridCustomerPaymentStatus.VOIDED) {
      throw new ServiceError('Cannot auto-apply voided payment', 'INVALID_STATUS', 400);
    }

    let unapplied = new Decimal(payment.unappliedAmount);
    if (unapplied.lessThanOrEqualTo(0)) {
      return payment; // Nothing to apply
    }

    // Get open invoices for this customer
    const openInvoices = await db
      .select({
        invoice: transactionHeaders,
        ext: invoiceExt,
      })
      .from(transactionHeaders)
      .innerJoin(invoiceExt, eq(invoiceExt.transactionId, transactionHeaders.id))
      .where(
        and(
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.transactionType, TransactionTypeCode.INVOICE),
          eq(transactionHeaders.entityId, payment.customerId),
          inArray(transactionHeaders.status, ['SENT', 'PARTIALLY_PAID', 'OVERDUE'])
        )
      );

    if (openInvoices.length === 0) {
      return payment; // No open invoices
    }

    // Sort based on strategy
    let sortedInvoices = [...openInvoices];
    switch (strategy) {
      case 'OLDEST_FIRST':
        sortedInvoices.sort((a, b) =>
          new Date(a.ext.dueDate || a.invoice.transactionDate).getTime() -
          new Date(b.ext.dueDate || b.invoice.transactionDate).getTime()
        );
        break;
      case 'LARGEST_FIRST':
        sortedInvoices.sort((a, b) =>
          new Decimal(b.ext.balanceDue || b.invoice.totalAmount || 0)
            .minus(new Decimal(a.ext.balanceDue || a.invoice.totalAmount || 0))
            .toNumber()
        );
        break;
      case 'PROPORTIONAL':
        // For proportional, we'll calculate each invoice's share
        break;
    }

    const applications: ApplyPaymentInput[] = [];

    if (strategy === 'PROPORTIONAL') {
      // Calculate total outstanding
      let totalOutstanding = new Decimal(0);
      for (const inv of sortedInvoices) {
        totalOutstanding = totalOutstanding.plus(new Decimal(inv.ext.balanceDue || inv.invoice.totalAmount || 0));
      }

      if (totalOutstanding.greaterThan(0)) {
        for (const inv of sortedInvoices) {
          const balance = new Decimal(inv.ext.balanceDue || inv.invoice.totalAmount || 0);
          const proportion = balance.dividedBy(totalOutstanding);
          const toApply = Decimal.min(unapplied.times(proportion), balance);

          if (toApply.greaterThan(0)) {
            applications.push({
              invoiceId: inv.invoice.id,
              appliedAmount: toApply.toNumber(),
            });
          }
        }
      }
    } else {
      // OLDEST_FIRST or LARGEST_FIRST
      for (const inv of sortedInvoices) {
        if (unapplied.lessThanOrEqualTo(0)) break;

        const balance = new Decimal(inv.ext.balanceDue || inv.invoice.totalAmount || 0);
        const toApply = Decimal.min(unapplied, balance);

        if (toApply.greaterThan(0)) {
          applications.push({
            invoiceId: inv.invoice.id,
            appliedAmount: toApply.toNumber(),
          });
          unapplied = unapplied.minus(toApply);
        }
      }
    }

    if (applications.length > 0) {
      return this.applyPayment(paymentId, applications);
    }

    return payment;
  }

  // ==========================================================================
  // UNAPPLY PAYMENT
  // ==========================================================================

  async unapplyPayment(paymentId: string, applicationId: string): Promise<CustomerPaymentWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const payment = await this.getPaymentById(paymentId);

    if (payment.status === HybridCustomerPaymentStatus.VOIDED) {
      throw new ServiceError('Cannot unapply from voided payment', 'INVALID_STATUS', 400);
    }

    // Get the application
    const [application] = await db
      .select()
      .from(customerPaymentApplications2)
      .where(
        and(
          eq(customerPaymentApplications2.id, applicationId),
          eq(customerPaymentApplications2.paymentId, paymentId),
          eq(customerPaymentApplications2.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!application) {
      throw new ServiceError('Payment application not found', 'NOT_FOUND', 404);
    }

    const appliedAmount = new Decimal(application.appliedAmount);
    const discountTaken = new Decimal(application.discountTaken || 0);

    // Reverse the invoice's paid amount
    const [invExt] = await db
      .select()
      .from(invoiceExt)
      .where(eq(invoiceExt.transactionId, application.invoiceId))
      .limit(1);

    if (invExt) {
      const currentPaid = new Decimal(invExt.paidAmount || 0);
      const newPaid = Decimal.max(currentPaid.minus(appliedAmount).minus(discountTaken), 0);

      const [invoice] = await db
        .select()
        .from(transactionHeaders)
        .where(eq(transactionHeaders.id, application.invoiceId))
        .limit(1);

      const invoiceTotal = new Decimal(invoice?.totalAmount || 0);
      const newBalance = invoiceTotal.minus(newPaid);

      await db.update(invoiceExt)
        .set({
          paidAmount: newPaid.toFixed(4),
          balanceDue: newBalance.toFixed(4),
        })
        .where(eq(invoiceExt.transactionId, application.invoiceId));

      // Update invoice status
      if (newPaid.lessThanOrEqualTo(0)) {
        await this.updateHeader(application.invoiceId, { status: 'SENT' });
      } else if (newBalance.greaterThan(0)) {
        await this.updateHeader(application.invoiceId, { status: 'PARTIALLY_PAID' });
      }
    }

    // Delete the application
    await db.delete(customerPaymentApplications2)
      .where(eq(customerPaymentApplications2.id, applicationId));

    // Update payment amounts
    const currentApplied = new Decimal(payment.appliedAmount);
    const currentUnapplied = new Decimal(payment.unappliedAmount);
    const newApplied = Decimal.max(currentApplied.minus(appliedAmount), 0);
    const newUnapplied = currentUnapplied.plus(appliedAmount);

    await db.update(customerPaymentExt)
      .set({
        appliedAmount: newApplied.toFixed(4),
        unappliedAmount: newUnapplied.toFixed(4),
      })
      .where(eq(customerPaymentExt.transactionId, paymentId));

    await this.emitEvent('CUSTOMER_PAYMENT_UNAPPLIED', paymentId, {
      paymentNumber: payment.transactionNumber,
      invoiceId: application.invoiceId,
      unappliedAmount: appliedAmount.toNumber(),
    });

    return this.getPaymentById(paymentId);
  }

  // ==========================================================================
  // POST PAYMENT
  // ==========================================================================

  async postPayment(paymentId: string): Promise<CustomerPaymentWithDetails> {
    const userId = this.requireUserContext();
    const payment = await this.getPaymentById(paymentId);

    this.validateStatusTransition(
      payment.status,
      HybridCustomerPaymentStatus.POSTED,
      VALID_STATUS_TRANSITIONS
    );

    await this.updateStatus(paymentId, HybridCustomerPaymentStatus.POSTED);

    await db.update(customerPaymentExt)
      .set({
        postedAt: new Date(),
      })
      .where(eq(customerPaymentExt.transactionId, paymentId));

    await this.emitEvent('CUSTOMER_PAYMENT_POSTED', paymentId, {
      paymentNumber: payment.transactionNumber,
      paymentAmount: payment.paymentAmount,
      postedBy: userId,
    });

    return this.getPaymentById(paymentId);
  }

  // ==========================================================================
  // DEPOSIT PAYMENT
  // ==========================================================================

  async depositPayment(paymentId: string, bankDepositId: string): Promise<CustomerPaymentWithDetails> {
    const payment = await this.getPaymentById(paymentId);

    this.validateStatusTransition(
      payment.status,
      HybridCustomerPaymentStatus.DEPOSITED,
      VALID_STATUS_TRANSITIONS
    );

    await this.updateStatus(paymentId, HybridCustomerPaymentStatus.DEPOSITED);

    await db.update(customerPaymentExt)
      .set({
        bankDepositId,
      })
      .where(eq(customerPaymentExt.transactionId, paymentId));

    await this.emitEvent('CUSTOMER_PAYMENT_DEPOSITED', paymentId, {
      paymentNumber: payment.transactionNumber,
      bankDepositId,
    });

    return this.getPaymentById(paymentId);
  }

  // ==========================================================================
  // CLEAR PAYMENT
  // ==========================================================================

  async clearPayment(paymentId: string): Promise<CustomerPaymentWithDetails> {
    const payment = await this.getPaymentById(paymentId);

    this.validateStatusTransition(
      payment.status,
      HybridCustomerPaymentStatus.CLEARED,
      VALID_STATUS_TRANSITIONS
    );

    await this.updateStatus(paymentId, HybridCustomerPaymentStatus.CLEARED);

    await this.emitEvent('CUSTOMER_PAYMENT_CLEARED', paymentId, {
      paymentNumber: payment.transactionNumber,
    });

    return this.getPaymentById(paymentId);
  }

  // ==========================================================================
  // VOID PAYMENT
  // ==========================================================================

  async voidPayment(paymentId: string, reason: string): Promise<CustomerPaymentWithDetails> {
    const userId = this.requireUserContext();
    const payment = await this.getPaymentById(paymentId);

    if (payment.status === HybridCustomerPaymentStatus.VOIDED) {
      throw new ServiceError('Payment is already voided', 'ALREADY_VOIDED', 400);
    }

    // Unapply all applications first
    if (payment.applications && payment.applications.length > 0) {
      for (const app of payment.applications) {
        await this.unapplyPayment(paymentId, app.id);
      }
    }

    // Update status
    await this.updateStatus(paymentId, HybridCustomerPaymentStatus.VOIDED);

    // Update extension
    await db.update(customerPaymentExt)
      .set({
        voidedAt: new Date(),
        voidedBy: userId,
        voidReason: reason,
      })
      .where(eq(customerPaymentExt.transactionId, paymentId));

    await this.emitEvent('CUSTOMER_PAYMENT_VOIDED', paymentId, {
      paymentNumber: payment.transactionNumber,
      reason,
      voidedBy: userId,
    });

    return this.getPaymentById(paymentId);
  }

  // ==========================================================================
  // GET CUSTOMER ACCOUNT SUMMARY
  // ==========================================================================

  async getCustomerAccountSummary(customerId: string): Promise<CustomerAccountSummary> {
    const organizationId = this.requireOrganizationContext();

    // Get customer info
    const [customer] = await db
      .select()
      .from(transactionHeaders)
      .where(
        and(
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.entityId, customerId)
        )
      )
      .limit(1);

    const customerName = customer?.entityName || 'Unknown';

    // Get all invoices for this customer
    const invoices = await db
      .select({
        invoice: transactionHeaders,
        ext: invoiceExt,
      })
      .from(transactionHeaders)
      .innerJoin(invoiceExt, eq(invoiceExt.transactionId, transactionHeaders.id))
      .where(
        and(
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.transactionType, TransactionTypeCode.INVOICE),
          eq(transactionHeaders.entityId, customerId)
        )
      );

    let totalOutstanding = new Decimal(0);
    let totalPaid = new Decimal(0);
    let overdueAmount = new Decimal(0);
    let oldestInvoiceDate: string | undefined;
    let invoiceCount = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const inv of invoices) {
      if (['SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(inv.invoice.status)) {
        const balance = new Decimal(inv.ext.balanceDue || inv.invoice.totalAmount || 0);
        totalOutstanding = totalOutstanding.plus(balance);
        invoiceCount++;

        if (!oldestInvoiceDate || inv.invoice.transactionDate < oldestInvoiceDate) {
          oldestInvoiceDate = inv.invoice.transactionDate;
        }

        if (inv.ext.dueDate && inv.ext.dueDate < today) {
          overdueAmount = overdueAmount.plus(balance);
        }
      }

      totalPaid = totalPaid.plus(new Decimal(inv.ext.paidAmount || 0));
    }

    // Get unapplied payments
    const payments = await db
      .select({
        payment: transactionHeaders,
        ext: customerPaymentExt,
      })
      .from(transactionHeaders)
      .innerJoin(customerPaymentExt, eq(customerPaymentExt.transactionId, transactionHeaders.id))
      .where(
        and(
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.transactionType, TransactionTypeCode.CUSTOMER_PAYMENT),
          eq(transactionHeaders.entityId, customerId),
          inArray(transactionHeaders.status, [
            HybridCustomerPaymentStatus.DRAFT,
            HybridCustomerPaymentStatus.PENDING,
            HybridCustomerPaymentStatus.POSTED,
            HybridCustomerPaymentStatus.DEPOSITED,
            HybridCustomerPaymentStatus.CLEARED,
          ])
        )
      );

    let totalUnapplied = new Decimal(0);
    for (const pmt of payments) {
      totalUnapplied = totalUnapplied.plus(new Decimal(pmt.ext.unappliedAmount || 0));
    }

    return {
      customerId,
      customerName,
      totalOutstanding: totalOutstanding.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      totalUnapplied: totalUnapplied.toFixed(2),
      invoiceCount,
      oldestInvoiceDate,
      overdueAmount: overdueAmount.toFixed(2),
    };
  }

  // ==========================================================================
  // GET PAYMENT APPLICATIONS
  // ==========================================================================

  async getPaymentApplications(paymentId: string): Promise<PaymentApplicationDetails[]> {
    const organizationId = this.requireOrganizationContext();

    const applications = await db
      .select({
        app: customerPaymentApplications2,
        invoice: transactionHeaders,
      })
      .from(customerPaymentApplications2)
      .innerJoin(transactionHeaders, eq(transactionHeaders.id, customerPaymentApplications2.invoiceId))
      .where(
        and(
          eq(customerPaymentApplications2.paymentId, paymentId),
          eq(customerPaymentApplications2.organizationId, organizationId)
        )
      )
      .orderBy(asc(customerPaymentApplications2.applicationDate));

    return applications.map((row) => ({
      id: row.app.id,
      invoiceId: row.app.invoiceId,
      invoiceNumber: row.invoice.transactionNumber,
      appliedAmount: row.app.appliedAmount,
      discountTaken: row.app.discountTaken || '0',
      applicationDate: row.app.applicationDate,
      createdAt: row.app.createdAt.toISOString(),
      createdBy: row.app.createdBy,
    }));
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async getPaymentDetails(
    header: TransactionHeader,
    includeApplications = false
  ): Promise<CustomerPaymentWithDetails> {
    const [ext] = await db
      .select()
      .from(customerPaymentExt)
      .where(eq(customerPaymentExt.transactionId, header.id))
      .limit(1);

    let applications: PaymentApplicationDetails[] | undefined;
    if (includeApplications) {
      applications = await this.getPaymentApplications(header.id);
    }

    return {
      id: header.id,
      organizationId: header.organizationId,
      subsidiaryId: header.subsidiaryId,
      transactionNumber: header.transactionNumber,
      customerId: header.entityId,
      customerName: header.entityName || undefined,
      paymentDate: header.transactionDate,
      status: header.status as HybridCustomerPaymentStatusValue,
      paymentMethod: ext?.paymentMethod || 'UNKNOWN',
      paymentAmount: ext?.paymentAmount || header.totalAmount || '0',
      appliedAmount: ext?.appliedAmount || '0',
      unappliedAmount: ext?.unappliedAmount || '0',
      currencyCode: header.currencyCode || 'USD',
      exchangeRate: header.exchangeRate || '1',
      memo: header.memo || undefined,
      internalNotes: header.internalNotes || undefined,
      // Extension fields
      externalReference: ext?.externalReference || undefined,
      checkNumber: ext?.checkNumber || undefined,
      bankRoutingNumber: ext?.bankRoutingNumber || undefined,
      bankAccountLast4: ext?.bankAccountLast4 || undefined,
      cashAccountId: ext?.cashAccountId || undefined,
      arAccountId: ext?.arAccountId || undefined,
      glTransactionId: ext?.glTransactionId || undefined,
      postedAt: ext?.postedAt?.toISOString() || undefined,
      bankDepositId: ext?.bankDepositId || undefined,
      voidedAt: ext?.voidedAt?.toISOString() || undefined,
      voidedBy: ext?.voidedBy || undefined,
      voidReason: ext?.voidReason || undefined,
      // Audit
      createdAt: header.createdAt.toISOString(),
      createdBy: header.createdBy,
      updatedAt: header.updatedAt.toISOString(),
      updatedBy: header.updatedBy || undefined,
      // Applications
      applications,
    };
  }
}
