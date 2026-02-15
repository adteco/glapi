import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { InvoiceService, type CreateInvoiceData, type GenerateInvoiceParams, type UpdateInvoiceData } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';

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
    .meta({ ai: createReadOnlyAIMeta('list_invoices', 'Search and list invoices with filtering', {
      scopes: ['invoices', 'billing', 'ar', 'global'],
      permissions: ['read:invoices'],
    }) })
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
      const service = new InvoiceService(ctx.serviceContext, { db: ctx.db });
      return service.listInvoices(input);
    }),

  // Get invoice with line items
  get: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_invoice', 'Get a single invoice by ID with line items', {
      scopes: ['invoices', 'billing', 'ar', 'global'],
      permissions: ['read:invoices'],
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new InvoiceService(ctx.serviceContext, { db: ctx.db });
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
    .meta({ ai: createWriteAIMeta('create_invoice', 'Create a new invoice manually', {
      scopes: ['invoices', 'billing', 'ar'],
      permissions: ['write:invoices'],
      riskLevel: 'MEDIUM',
      minimumRole: 'staff',
    }) })
    .input(invoiceSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new InvoiceService(ctx.serviceContext, { db: ctx.db });
      
      try {
        return await service.createInvoice(input as CreateInvoiceData);
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
    .meta({ ai: createWriteAIMeta('generate_invoice_from_subscription', 'Generate an invoice from a subscription billing period', {
      scopes: ['invoices', 'subscriptions', 'billing'],
      permissions: ['write:invoices', 'read:subscriptions'],
      riskLevel: 'MEDIUM',
      minimumRole: 'staff',
    }) })
    .input(z.object({
      subscriptionId: z.string().uuid(),
      billingPeriodStart: z.coerce.date(),
      billingPeriodEnd: z.coerce.date(),
      invoiceDate: z.coerce.date().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new InvoiceService(ctx.serviceContext, { db: ctx.db });
      
      try {
        return await service.generateFromSubscription(input as GenerateInvoiceParams);
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

  // Generate invoice from billable tasks
  createFromTasks: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('create_invoice_from_tasks', 'Create an invoice from completed billable project tasks', {
      scopes: ['invoices', 'project-tasks', 'billing'],
      permissions: ['write:invoices', 'read:project-tasks'],
      riskLevel: 'MEDIUM',
      minimumRole: 'staff',
    }) })
    .input(z.object({
      projectId: z.string().uuid(),
      entityId: z.string().uuid(),
      taskIds: z.array(z.string().uuid()).min(1),
      invoiceDate: z.coerce.date().optional(),
      dueDate: z.coerce.date().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new InvoiceService(ctx.serviceContext, { db: ctx.db });

      try {
        return await service.createInvoiceFromBillableTasks({
          projectId: input.projectId,
          entityId: input.entityId,
          taskIds: input.taskIds,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate,
        });
      } catch (error: any) {
        if (error.code === 'TASK_NOT_FOUND' || error.code === 'NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message
          });
        }
        if (error.code === 'NO_TASKS' || error.code === 'TASK_NOT_COMPLETED' ||
            error.code === 'TASK_NOT_BILLABLE' || error.code === 'TASK_ALREADY_INVOICED' ||
            error.code === 'TASK_PROJECT_MISMATCH') {
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
    .meta({ ai: createWriteAIMeta('update_invoice', 'Update an existing invoice', {
      scopes: ['invoices', 'billing', 'ar'],
      permissions: ['write:invoices'],
      riskLevel: 'MEDIUM',
    }) })
    .input(z.object({
      id: z.string().uuid(),
      data: invoiceSchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new InvoiceService(ctx.serviceContext, { db: ctx.db });
      
      try {
        const updated = await service.updateInvoice(input.id, input.data as unknown as UpdateInvoiceData);
        
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
    .meta({ ai: createWriteAIMeta('send_invoice', 'Send an invoice to the customer', {
      scopes: ['invoices', 'billing'],
      permissions: ['write:invoices'],
      riskLevel: 'MEDIUM',
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new InvoiceService(ctx.serviceContext, { db: ctx.db });
      
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
    .meta({ ai: createWriteAIMeta('void_invoice', 'Void an invoice with a reason', {
      scopes: ['invoices', 'billing'],
      permissions: ['write:invoices'],
      riskLevel: 'HIGH',
      minimumRole: 'manager',
    }) })
    .input(z.object({
      id: z.string().uuid(),
      reason: z.string().min(1)
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new InvoiceService(ctx.serviceContext, { db: ctx.db });
      
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
      const service = new InvoiceService(ctx.serviceContext, { db: ctx.db });
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
      const service = new InvoiceService(ctx.serviceContext, { db: ctx.db });
      
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
          void: 0,
          cancelled: 0,
          partial: 0,
        }
      };

      invoices.data.forEach(invoice => {
        const total = parseFloat(invoice.totalAmount || '0');
        // TODO: Calculate paid amount from payments table
        const paid = invoice.status === 'paid' ? total : 0;
        const balance = invoice.status === 'paid' ? 0 : total;

        summary.totalAmount += total;
        summary.totalPaid += paid;
        summary.totalOutstanding += balance;

        if (invoice.status && invoice.status in summary.byStatus) {
          summary.byStatus[invoice.status as keyof typeof summary.byStatus]++;
        }
      });
      
      return summary;
    })
});
