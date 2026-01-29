import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { payments, type Payment, type NewPayment, type UpdatePayment } from "../db/schema/payments";
import { invoices } from "../db/schema/invoices";
import { BaseRepository } from "./base-repository";
import { InvoiceRepository } from "./invoice-repository";
import type { ContextualDatabase } from "../context";

export interface PaymentWithInvoice extends Payment {
  invoice?: {
    id: string;
    invoiceNumber: string;
    totalAmount: string;
    entityId: string;
  };
}

export interface PaymentListOptions {
  organizationId: string;
  invoiceId?: string;
  status?: string;
  paymentDateFrom?: string;
  paymentDateTo?: string;
  limit?: number;
  offset?: number;
  paymentMethod?: string;
}

export class PaymentRepository extends BaseRepository {
  private invoiceRepository: InvoiceRepository;

  constructor(db?: ContextualDatabase) {
    super(db);
    this.invoiceRepository = new InvoiceRepository(db);
  }

  /**
   * Create a new payment
   */
  async create(data: NewPayment): Promise<Payment> {
    const [result] = await this.db
      .insert(payments)
      .values(data)
      .returning();
    return result;
  }

  /**
   * Find payment by ID with invoice details
   */
  async findByIdWithInvoice(id: string): Promise<PaymentWithInvoice | null> {
    const [result] = await this.db
      .select({
        payment: payments,
        invoice: {
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          totalAmount: invoices.totalAmount,
          entityId: invoices.entityId
        }
      })
      .from(payments)
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(eq(payments.id, id))
      .limit(1);

    if (!result) return null;

    return {
      ...result.payment,
      invoice: result.invoice || undefined
    };
  }

  /**
   * List payments with filtering
   */
  async list(options: PaymentListOptions): Promise<{ data: PaymentWithInvoice[]; total: number }> {
    const conditions = [eq(payments.organizationId, options.organizationId)];

    if (options.invoiceId) {
      conditions.push(eq(payments.invoiceId, options.invoiceId));
    }

    if (options.status) {
      conditions.push(eq(payments.status, options.status as any));
    }

    if (options.paymentMethod) {
      conditions.push(eq(payments.paymentMethod, options.paymentMethod as any));
    }

    if (options.paymentDateFrom) {
      conditions.push(gte(payments.paymentDate, options.paymentDateFrom));
    }

    if (options.paymentDateTo) {
      conditions.push(lte(payments.paymentDate, options.paymentDateTo));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(payments)
      .where(whereClause);

    // Get paginated results with invoice details
    const results = await this.db
      .select({
        payment: payments,
        invoice: {
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          totalAmount: invoices.totalAmount,
          entityId: invoices.entityId
        }
      })
      .from(payments)
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(whereClause)
      .orderBy(desc(payments.paymentDate))
      .limit(options.limit || 50)
      .offset(options.offset || 0);

    const data = results.map(row => ({
      ...row.payment,
      invoice: row.invoice || undefined
    }));

    return {
      data,
      total: Number(count)
    };
  }

  /**
   * Create payment and update invoice status
   */
  async createPayment(payment: NewPayment): Promise<Payment> {
    return await this.db.transaction(async (tx) => {
      // Validate payment amount doesn't exceed invoice balance
      if (payment.invoiceId) {
        const invoice = await this.invoiceRepository.findByIdWithDetails(payment.invoiceId);
        if (invoice) {
          const balanceDue = parseFloat(invoice.balanceDue || "0");
          const paymentAmount = parseFloat(payment.amount);

          if (paymentAmount > balanceDue) {
            throw new Error(`Payment amount ${paymentAmount} exceeds invoice balance ${balanceDue}`);
          }
        }
      }

      // Create payment
      const [newPayment] = await tx
        .insert(payments)
        .values(payment)
        .returning();

      // Update invoice status if payment is completed
      if (payment.invoiceId && payment.status === "completed") {
        await this.invoiceRepository.updateInvoiceStatus(payment.invoiceId);
      }

      return newPayment;
    });
  }

  /**
   * Update payment
   */
  async update(id: string, data: UpdatePayment): Promise<Payment | null> {
    const [updated] = await this.db
      .update(payments)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(payments.id, id))
      .returning();

    // If status changed, update invoice status
    if (updated && updated.invoiceId && data.status) {
      await this.invoiceRepository.updateInvoiceStatus(updated.invoiceId);
    }

    return updated || null;
  }

  /**
   * Get payments for invoice
   */
  async getByInvoice(invoiceId: string): Promise<Payment[]> {
    return await this.db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId))
      .orderBy(desc(payments.paymentDate));
  }

  /**
   * Calculate total paid for invoice
   */
  async getTotalPaidForInvoice(invoiceId: string): Promise<number> {
    const [result] = await this.db
      .select({
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)::text`
      })
      .from(payments)
      .where(
        and(
          eq(payments.invoiceId, invoiceId),
          eq(payments.status, "completed")
        )
      );

    return parseFloat(result?.total || "0");
  }

  /**
   * Process refund
   */
  async processRefund(paymentId: string, refundAmount: string): Promise<Payment> {
    return await this.db.transaction(async (tx) => {
      // Get original payment
      const [originalPayment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .limit(1);

      if (!originalPayment) {
        throw new Error("Payment not found");
      }

      if (originalPayment.status !== "completed") {
        throw new Error("Can only refund completed payments");
      }

      const originalAmount = parseFloat(originalPayment.amount);
      const refundAmountNum = parseFloat(refundAmount);

      if (refundAmountNum > originalAmount) {
        throw new Error("Refund amount cannot exceed original payment amount");
      }

      // Create refund payment (negative amount)
      const [refundPayment] = await tx
        .insert(payments)
        .values({
          organizationId: originalPayment.organizationId,
          invoiceId: originalPayment.invoiceId,
          paymentDate: new Date().toISOString().split('T')[0],
          amount: (-refundAmountNum).toFixed(2),
          paymentMethod: originalPayment.paymentMethod,
          transactionReference: `REFUND-${originalPayment.transactionReference || originalPayment.id}`,
          status: "completed" as const,
          metadata: {
            originalPaymentId: originalPayment.id,
            refundReason: "Customer refund"
          }
        })
        .returning();

      // Update original payment status
      const newStatus = refundAmountNum === originalAmount ? "refunded" : "partial_refund";
      await tx
        .update(payments)
        .set({
          status: newStatus as any,
          updatedAt: new Date()
        })
        .where(eq(payments.id, paymentId));

      // Update invoice status
      if (originalPayment.invoiceId) {
        await this.invoiceRepository.updateInvoiceStatus(originalPayment.invoiceId);
      }

      return refundPayment;
    });
  }

  /**
   * Get payment summary for organization
   */
  async getPaymentSummary(
    organizationId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    totalPayments: number;
    totalAmount: number;
    pendingAmount: number;
    completedAmount: number;
    refundedAmount: number;
  }> {
    const conditions = [eq(payments.organizationId, organizationId)];

    if (startDate) {
      conditions.push(gte(payments.paymentDate, startDate));
    }

    if (endDate) {
      conditions.push(lte(payments.paymentDate, endDate));
    }

    const [summary] = await this.db
      .select({
        totalPayments: sql<number>`COUNT(*)::int`,
        totalAmount: sql<string>`COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::text`,
        pendingAmount: sql<string>`COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0)::text`,
        completedAmount: sql<string>`COALESCE(SUM(CASE WHEN status = 'completed' AND amount > 0 THEN amount ELSE 0 END), 0)::text`,
        refundedAmount: sql<string>`COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)::text`
      })
      .from(payments)
      .where(and(...conditions));

    return {
      totalPayments: summary?.totalPayments || 0,
      totalAmount: parseFloat(summary?.totalAmount || "0"),
      pendingAmount: parseFloat(summary?.pendingAmount || "0"),
      completedAmount: parseFloat(summary?.completedAmount || "0"),
      refundedAmount: parseFloat(summary?.refundedAmount || "0")
    };
  }

  /**
   * Apply payment to multiple invoices
   */
  async applyPaymentToMultipleInvoices(
    payment: NewPayment,
    invoiceAllocations: { invoiceId: string; amount: string }[]
  ): Promise<Payment[]> {
    return await this.db.transaction(async (tx) => {
      const createdPayments: Payment[] = [];
      const totalAllocated = invoiceAllocations.reduce((sum, alloc) => sum + parseFloat(alloc.amount), 0);

      if (totalAllocated !== parseFloat(payment.amount)) {
        throw new Error("Total allocation must equal payment amount");
      }

      for (const allocation of invoiceAllocations) {
        const [allocatedPayment] = await tx
          .insert(payments)
          .values({
            ...payment,
            invoiceId: allocation.invoiceId,
            amount: allocation.amount,
            metadata: {
              ...(payment.metadata as Record<string, any> || {}),
              splitPayment: true,
              originalAmount: payment.amount
            }
          })
          .returning();

        createdPayments.push(allocatedPayment);

        // Update each invoice status
        if (payment.status === "completed") {
          await this.invoiceRepository.updateInvoiceStatus(allocation.invoiceId);
        }
      }

      return createdPayments;
    });
  }
}