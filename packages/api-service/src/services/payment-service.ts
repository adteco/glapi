import { BaseService } from './base-service';
import { ServiceContext, ServiceError, PaginatedResult } from '../types';
import { 
  PaymentRepository,
  InvoiceRepository,
  type Payment,
  type NewPayment
} from '@glapi/database';

export interface CreatePaymentData extends Omit<NewPayment, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> {
  organizationId?: string;
}

export interface ListPaymentsInput {
  invoiceId?: string;
  entityId?: string;
  dateFrom?: Date | string;
  dateTo?: Date | string;
  status?: 'pending' | 'completed' | 'failed' | 'refunded';
  page?: number;
  limit?: number;
}

export class PaymentService extends BaseService {
  private paymentRepository: PaymentRepository;
  private invoiceRepository: InvoiceRepository;

  constructor(context: ServiceContext = {}) {
    super(context);
    this.paymentRepository = new PaymentRepository();
    this.invoiceRepository = new InvoiceRepository();
  }

  async listPayments(input: ListPaymentsInput = {}): Promise<PaginatedResult<Payment>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(input);

    const result = await this.paymentRepository.list({
      organizationId,
      invoiceId: input.invoiceId,
      status: input.status,
      paymentDateFrom: input.dateFrom ? (typeof input.dateFrom === 'string' ? input.dateFrom : input.dateFrom.toISOString().split('T')[0]) : undefined,
      paymentDateTo: input.dateTo ? (typeof input.dateTo === 'string' ? input.dateTo : input.dateTo.toISOString().split('T')[0]) : undefined,
      limit: take,
      offset: skip
    });

    return this.createPaginatedResult(result.data, result.total, page, limit);
  }

  async getPaymentById(id: string): Promise<Payment | null> {
    const organizationId = this.requireOrganizationContext();
    
    const payment = await this.paymentRepository.findByIdWithInvoice(id);
    if (!payment || payment.organizationId !== organizationId) {
      return null;
    }
    
    return payment;
  }

  async createPayment(data: CreatePaymentData): Promise<Payment> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate invoice exists
    const invoice = await this.invoiceRepository.findByIdWithDetails(data.invoiceId);
    if (!invoice || invoice.organizationId !== organizationId) {
      throw new ServiceError('Invoice not found', 'INVOICE_NOT_FOUND', 404);
    }

    // Check invoice status
    if (invoice.status === 'void') {
      throw new ServiceError('Cannot make payment to void invoice', 'INVOICE_VOID', 400);
    }

    // Validate payment amount
    const paymentAmount = parseFloat(String(data.amount));
    const balanceDue = parseFloat(invoice.balanceDue);
    
    if (paymentAmount > balanceDue) {
      throw new ServiceError(
        `Payment amount exceeds balance due. Balance: ${balanceDue}, Payment: ${paymentAmount}`,
        'PAYMENT_EXCEEDS_BALANCE',
        400
      );
    }

    // Create payment
    const paymentToCreate = {
      ...data,
      organizationId,
      paymentDate: typeof data.paymentDate === 'string' ? data.paymentDate : (data.paymentDate as Date).toISOString().split('T')[0],
      amount: String(paymentAmount),
      status: data.status || 'completed'
    } as NewPayment;

    const payment = await this.paymentRepository.create(paymentToCreate);

    // Update invoice status based on payments
    const currentPaidAmount = parseFloat(invoice.paidAmount || '0');
    const newPaidAmount = currentPaidAmount + paymentAmount;
    const newBalanceDue = parseFloat(invoice.totalAmount) - newPaidAmount;
    
    await this.invoiceRepository.update(invoice.id, {
      status: newBalanceDue <= 0.01 ? 'paid' : invoice.status,
      metadata: {
        ...(invoice.metadata as any || {}),
        lastPaymentDate: new Date().toISOString(),
        lastPaymentAmount: paymentAmount
      }
    });

    return payment;
  }

  async processRefund(paymentId: string, amount: number, reason: string): Promise<Payment> {
    const organizationId = this.requireOrganizationContext();
    
    // Get original payment
    const originalPayment = await this.paymentRepository.findByIdWithInvoice(paymentId);
    if (!originalPayment || originalPayment.organizationId !== organizationId) {
      throw new ServiceError('Payment not found', 'NOT_FOUND', 404);
    }

    if (originalPayment.status !== 'completed') {
      throw new ServiceError('Can only refund completed payments', 'INVALID_STATUS', 400);
    }

    const originalAmount = parseFloat(originalPayment.amount);
    if (amount > originalAmount) {
      throw new ServiceError(
        `Refund amount exceeds original payment. Original: ${originalAmount}, Refund: ${amount}`,
        'REFUND_EXCEEDS_PAYMENT',
        400
      );
    }

    // Create refund payment (negative amount)
    const refundPayment = await this.paymentRepository.create({
      organizationId,
      invoiceId: originalPayment.invoiceId,
      paymentDate: new Date().toISOString().split('T')[0],
      amount: String(-amount),
      paymentMethod: originalPayment.paymentMethod,
      transactionReference: `REFUND-${originalPayment.transactionReference}`,
      status: 'refunded',
      metadata: {
        originalPaymentId: paymentId,
        refundReason: reason,
        refundDate: new Date().toISOString()
      }
    });

    // Update original payment status if fully refunded
    if (amount >= originalAmount - 0.01) {
      await this.paymentRepository.update(paymentId, {
        status: 'refunded',
        metadata: {
          ...(originalPayment.metadata as any || {}),
          refundedAmount: amount,
          refundDate: new Date().toISOString()
        }
      });
    }

    // Update invoice status
    const invoice = await this.invoiceRepository.findByIdWithDetails(originalPayment.invoiceId);
    if (invoice) {
      const currentPaidAmount = parseFloat(invoice.paidAmount || '0');
      const newPaidAmount = currentPaidAmount - amount;
      const newBalanceDue = parseFloat(invoice.totalAmount) - newPaidAmount;
      
      await this.invoiceRepository.update(invoice.id, {
        status: newBalanceDue > 0.01 ? 'sent' : 'paid',
        metadata: {
          ...(invoice.metadata as any || {}),
          lastRefundDate: new Date().toISOString(),
          lastRefundAmount: amount
        }
      });
    }

    return refundPayment;
  }

  async triggerRevenueRecognition(invoiceId: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    // Get invoice with line items
    const invoice = await this.invoiceRepository.findByIdWithDetails(invoiceId);
    if (!invoice || invoice.organizationId !== organizationId) {
      throw new ServiceError('Invoice not found', 'NOT_FOUND', 404);
    }

    // Check if invoice is fully paid
    const balanceDue = parseFloat(invoice.balanceDue);
    if (balanceDue > 0.01) {
      return; // Not fully paid, don't trigger revenue recognition
    }

    // TODO: Implement revenue recognition logic
    // This will be implemented in TASK-007 and TASK-009
    // 1. Get related subscription and performance obligations
    // 2. Determine satisfaction method (point in time vs over time)
    // 3. Create revenue schedules
    // 4. Generate journal entries
    
    console.log(`Revenue recognition triggered for invoice ${invoiceId}`);
  }

  async getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
    const organizationId = this.requireOrganizationContext();
    
    const invoice = await this.invoiceRepository.findByIdWithDetails(invoiceId);
    if (!invoice || invoice.organizationId !== organizationId) {
      throw new ServiceError('Invoice not found', 'NOT_FOUND', 404);
    }

    return await this.paymentRepository.getByInvoice(invoiceId);
  }

  async getPaymentSummary(invoiceId: string): Promise<{
    totalPaid: number;
    totalRefunded: number;
    netPaid: number;
    payments: Payment[];
  }> {
    const payments = await this.getPaymentsByInvoice(invoiceId);
    
    const totalPaid = payments
      .filter(p => p.status === 'completed' && parseFloat(p.amount) > 0)
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    
    const totalRefunded = payments
      .filter(p => p.status === 'refunded' && parseFloat(p.amount) < 0)
      .reduce((sum, p) => sum + Math.abs(parseFloat(p.amount)), 0);
    
    return {
      totalPaid,
      totalRefunded,
      netPaid: totalPaid - totalRefunded,
      payments
    };
  }
}