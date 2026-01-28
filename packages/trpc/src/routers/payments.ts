import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { PaymentService, type CreatePaymentData } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

// Zod schemas for validation
const paymentSchema = z.object({
  invoiceId: z.string().uuid(),
  paymentDate: z.coerce.date(),
  amount: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Amount must be a positive number"
  }),
  paymentMethod: z.string().optional(),
  transactionReference: z.string().optional(),
  status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
  metadata: z.record(z.any()).optional()
});

export const paymentsRouter = router({
  // List payments
  list: authenticatedProcedure
    .input(z.object({
      invoiceId: z.string().uuid().optional(),
      entityId: z.string().uuid().optional(),
      dateFrom: z.coerce.date().optional(),
      dateTo: z.coerce.date().optional(),
      status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50)
    }).optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new PaymentService(ctx.serviceContext, { db: ctx.db });
      return service.listPayments(input);
    }),

  // Get payment details
  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new PaymentService(ctx.serviceContext, { db: ctx.db });
      const payment = await service.getPaymentById(input.id);
      
      if (!payment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Payment not found'
        });
      }
      
      return payment;
    }),

  // Create payment
  create: authenticatedProcedure
    .input(paymentSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new PaymentService(ctx.serviceContext, { db: ctx.db });
      
      try {
        const payment = await service.createPayment({
          ...input,
          organizationId: ctx.organizationId
        } as unknown as CreatePaymentData);

        // Trigger revenue recognition if payment completes invoice
        if (payment.status === 'completed' && payment.invoiceId) {
          await service.triggerRevenueRecognition(payment.invoiceId);
        }

        return payment;
      } catch (error: any) {
        if (error.code === 'INVOICE_NOT_FOUND' || error.code === 'NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message
          });
        }
        if (error.code === 'INVOICE_VOID' || error.code === 'PAYMENT_EXCEEDS_BALANCE') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message
          });
        }
        throw error;
      }
    }),

  // Process refund
  refund: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      amount: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
        message: "Amount must be a positive number"
      }),
      reason: z.string().min(1)
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PaymentService(ctx.serviceContext, { db: ctx.db });
      
      try {
        return await service.processRefund(input.id, parseFloat(input.amount), input.reason);
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message
          });
        }
        if (error.code === 'INVALID_STATUS' || error.code === 'REFUND_EXCEEDS_PAYMENT') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message
          });
        }
        throw error;
      }
    }),

  // Get payments for an invoice
  getByInvoice: authenticatedProcedure
    .input(z.object({ invoiceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new PaymentService(ctx.serviceContext, { db: ctx.db });
      
      try {
        return await service.getPaymentsByInvoice(input.invoiceId);
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message
          });
        }
        throw error;
      }
    }),

  // Get payment summary for an invoice
  getSummaryByInvoice: authenticatedProcedure
    .input(z.object({ invoiceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new PaymentService(ctx.serviceContext, { db: ctx.db });
      
      try {
        return await service.getPaymentSummary(input.invoiceId);
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message
          });
        }
        throw error;
      }
    }),

  // Batch payment creation (for processing multiple payments)
  createBatch: authenticatedProcedure
    .input(z.object({
      payments: z.array(paymentSchema).min(1).max(100)
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PaymentService(ctx.serviceContext, { db: ctx.db });
      
      const results = {
        successful: [] as any[],
        failed: [] as { payment: any; error: string }[]
      };
      
      for (const paymentData of input.payments) {
        try {
          const payment = await service.createPayment({
            ...paymentData,
            organizationId: ctx.organizationId
          } as unknown as CreatePaymentData);

          // Trigger revenue recognition if payment completes invoice
          if (payment.status === 'completed' && payment.invoiceId) {
            await service.triggerRevenueRecognition(payment.invoiceId);
          }

          results.successful.push(payment);
        } catch (error: any) {
          results.failed.push({
            payment: paymentData,
            error: error.message || 'Unknown error'
          });
        }
      }
      
      return results;
    }),

  // Get payment statistics
  statistics: authenticatedProcedure
    .input(z.object({
      entityId: z.string().uuid().optional(),
      dateFrom: z.coerce.date().optional(),
      dateTo: z.coerce.date().optional()
    }).optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new PaymentService(ctx.serviceContext, { db: ctx.db });
      
      // Get all payments for the period
      const payments = await service.listPayments({
        entityId: input.entityId,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        page: 1,
        limit: 1000
      });
      
      // Calculate statistics
      const stats = {
        totalPayments: payments.total,
        totalAmount: 0,
        totalRefunded: 0,
        netAmount: 0,
        averagePayment: 0,
        byStatus: {
          pending: 0,
          completed: 0,
          failed: 0,
          refunded: 0,
          partial_refund: 0,
        },
        byMethod: {} as Record<string, number>
      };

      payments.data.forEach(payment => {
        const amount = parseFloat(payment.amount || '0');

        if (payment.status === 'completed' && amount > 0) {
          stats.totalAmount += amount;
        } else if (payment.status === 'refunded' || amount < 0) {
          stats.totalRefunded += Math.abs(amount);
        }

        if (payment.status && payment.status in stats.byStatus) {
          stats.byStatus[payment.status as keyof typeof stats.byStatus]++;
        }

        if (payment.paymentMethod) {
          stats.byMethod[payment.paymentMethod] = (stats.byMethod[payment.paymentMethod] || 0) + 1;
        }
      });
      
      stats.netAmount = stats.totalAmount - stats.totalRefunded;
      stats.averagePayment = stats.totalPayments > 0 ? stats.netAmount / stats.totalPayments : 0;
      
      return stats;
    })
});