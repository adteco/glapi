import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { InvoiceService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

// Zod schemas for validation
const invoiceLineItemSchema = z.object({
  subscriptionItemId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  amount: z.number().positive()
});

const invoiceSchema = z.object({
  entityId: z.string().uuid(),
  subscriptionId: z.string().uuid().optional(),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  billingPeriodStart: z.coerce.date().optional(),
  billingPeriodEnd: z.coerce.date().optional(),
  subtotal: z.number().min(0).optional(),
  taxAmount: z.number().min(0).optional(),
  totalAmount: z.number().min(0).optional(),
  paidAmount: z.number().min(0).optional(),
  balanceDue: z.number().min(0).optional(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'void']).optional(),
  lineItems: z.array(invoiceLineItemSchema).min(1).optional(),
  metadata: z.record(z.any()).optional()
});

export const invoicesRouter = router({
  // List invoices with filtering
  list: authenticatedProcedure
    .input(z.object({
      entityId: z.string().uuid().optional(),
      subscriptionId: z.string().uuid().optional(),
      status: z.enum(['draft', 'sent', 'paid', 'overdue', 'void']).optional(),
      dateFrom: z.coerce.date().optional(),
      dateTo: z.coerce.date().optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50)
    }).optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new InvoiceService(ctx.serviceContext);
      return service.listInvoices(input);
    }),

  // Get invoice with line items
  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new InvoiceService(ctx.serviceContext);
      const invoice = await service.getInvoiceById(input.id);
      
      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found'
        });
      }
      
      return invoice;
    }),

  // Create invoice manually
  create: authenticatedProcedure
    .input(invoiceSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new InvoiceService(ctx.serviceContext);
      
      try {
        return await service.createInvoice(input);
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

  // Generate invoice from subscription
  generateFromSubscription: authenticatedProcedure
    .input(z.object({
      subscriptionId: z.string().uuid(),
      billingPeriodStart: z.coerce.date(),
      billingPeriodEnd: z.coerce.date(),
      invoiceDate: z.coerce.date().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new InvoiceService(ctx.serviceContext);
      
      try {
        return await service.generateFromSubscription(input);
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message
          });
        }
        if (error.code === 'NO_ITEMS') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message
          });
        }
        throw error;
      }
    }),

  // Update invoice
  update: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: invoiceSchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new InvoiceService(ctx.serviceContext);
      
      try {
        const updated = await service.updateInvoice(input.id, input.data);
        
        if (!updated) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Invoice not found'
          });
        }
        
        return updated;
      } catch (error: any) {
        if (error.code === 'INVALID_STATUS') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message
          });
        }
        throw error;
      }
    }),

  // Send invoice
  send: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new InvoiceService(ctx.serviceContext);
      
      try {
        return await service.sendInvoice(input.id);
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message
          });
        }
        if (error.code === 'INVALID_STATUS') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message
          });
        }
        throw error;
      }
    }),

  // Void invoice
  void: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      reason: z.string().min(1)
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new InvoiceService(ctx.serviceContext);
      
      try {
        return await service.voidInvoice(input.id, input.reason);
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message
          });
        }
        if (error.code === 'ALREADY_VOID' || error.code === 'CANNOT_VOID_PAID') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message
          });
        }
        throw error;
      }
    }),

  // Get invoice aging report
  aging: authenticatedProcedure
    .input(z.object({
      asOfDate: z.coerce.date().optional()
    }).optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new InvoiceService(ctx.serviceContext);
      return service.getAgingReport(input.asOfDate || new Date());
    }),

  // Get invoice summary statistics
  summary: authenticatedProcedure
    .input(z.object({
      entityId: z.string().uuid().optional(),
      dateFrom: z.coerce.date().optional(),
      dateTo: z.coerce.date().optional()
    }).optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new InvoiceService(ctx.serviceContext);
      
      // Get all invoices for the period
      const invoices = await service.listInvoices({
        entityId: input.entityId,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        page: 1,
        limit: 1000
      });
      
      // Calculate summary statistics
      const summary = {
        totalInvoices: invoices.total,
        totalAmount: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        byStatus: {
          draft: 0,
          sent: 0,
          paid: 0,
          overdue: 0,
          void: 0
        }
      };
      
      invoices.data.forEach(invoice => {
        const total = parseFloat(invoice.totalAmount || '0');
        const paid = parseFloat(invoice.paidAmount || '0');
        const balance = parseFloat(invoice.balanceDue || '0');
        
        summary.totalAmount += total;
        summary.totalPaid += paid;
        summary.totalOutstanding += balance;
        
        if (invoice.status) {
          summary.byStatus[invoice.status]++;
        }
      });
      
      return summary;
    })
});