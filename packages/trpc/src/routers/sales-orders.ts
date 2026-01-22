import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { SalesOrderService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';
import {
  SalesOrderStatus,
  ApprovalActionType,
} from '@glapi/database';

// ============================================================================
// Zod Schemas
// ============================================================================

const salesOrderStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'CLOSED',
  'CANCELLED',
  'ON_HOLD',
]);

const approvalActionSchema = z.enum([
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'RETURN_FOR_REVISION',
  'ESCALATE',
  'DELEGATE',
]);

const salesOrderLineInputSchema = z.object({
  id: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  description: z.string().min(1),
  sku: z.string().optional(),
  quantity: z.union([z.number().positive(), z.string()]),
  unitOfMeasure: z.string().optional(),
  unitPrice: z.union([z.number().min(0), z.string()]),
  discountAmount: z.union([z.number().min(0), z.string()]).optional(),
  discountPercent: z.union([z.number().min(0).max(100), z.string()]).optional(),
  taxAmount: z.union([z.number().min(0), z.string()]).optional(),
  taxCode: z.string().optional(),
  requestedDeliveryDate: z.coerce.date().optional(),
  promisedDeliveryDate: z.coerce.date().optional(),
  departmentId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  revenueAccountId: z.string().uuid().optional(),
  deferredRevenueAccountId: z.string().uuid().optional(),
  memo: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  _delete: z.boolean().optional(),
});

const createSalesOrderSchema = z.object({
  subsidiaryId: z.string().uuid(),
  entityId: z.string().uuid(),
  orderDate: z.coerce.date(),
  externalReference: z.string().optional(),
  billingAddressId: z.string().uuid().optional(),
  shippingAddressId: z.string().uuid().optional(),
  requestedDeliveryDate: z.coerce.date().optional(),
  promisedDeliveryDate: z.coerce.date().optional(),
  expirationDate: z.coerce.date().optional(),
  currencyCode: z.string().length(3).optional(),
  exchangeRate: z.union([z.number().positive(), z.string()]).optional(),
  discountAmount: z.union([z.number().min(0), z.string()]).optional(),
  discountPercent: z.union([z.number().min(0).max(100), z.string()]).optional(),
  shippingAmount: z.union([z.number().min(0), z.string()]).optional(),
  paymentTerms: z.string().optional(),
  shippingMethod: z.string().optional(),
  memo: z.string().optional(),
  internalNotes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  requiresApproval: z.boolean().optional(),
  approvalThreshold: z.union([z.number().min(0), z.string()]).optional(),
  lines: z.array(salesOrderLineInputSchema).min(1),
});

const updateSalesOrderSchema = z.object({
  entityId: z.string().uuid().optional(),
  orderDate: z.coerce.date().optional(),
  externalReference: z.string().optional(),
  billingAddressId: z.string().uuid().optional(),
  shippingAddressId: z.string().uuid().optional(),
  requestedDeliveryDate: z.coerce.date().optional(),
  promisedDeliveryDate: z.coerce.date().optional(),
  expirationDate: z.coerce.date().optional(),
  currencyCode: z.string().length(3).optional(),
  exchangeRate: z.union([z.number().positive(), z.string()]).optional(),
  discountAmount: z.union([z.number().min(0), z.string()]).optional(),
  discountPercent: z.union([z.number().min(0).max(100), z.string()]).optional(),
  shippingAmount: z.union([z.number().min(0), z.string()]).optional(),
  paymentTerms: z.string().optional(),
  shippingMethod: z.string().optional(),
  memo: z.string().optional(),
  internalNotes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  requiresApproval: z.boolean().optional(),
  approvalThreshold: z.union([z.number().min(0), z.string()]).optional(),
  lines: z.array(salesOrderLineInputSchema).optional(),
});

const salesOrderFiltersSchema = z.object({
  status: z.union([salesOrderStatusSchema, z.array(salesOrderStatusSchema)]).optional(),
  entityId: z.string().uuid().optional(),
  subsidiaryId: z.string().uuid().optional(),
  orderDateFrom: z.coerce.date().optional(),
  orderDateTo: z.coerce.date().optional(),
  minAmount: z.union([z.number().min(0), z.string()]).optional(),
  maxAmount: z.union([z.number().min(0), z.string()]).optional(),
  search: z.string().optional(),
  requiresApproval: z.boolean().optional(),
  pendingApproval: z.boolean().optional(),
});

// ============================================================================
// Sales Orders Router
// ============================================================================

export const salesOrdersRouter = router({
  // ========================================================================
  // CRUD Operations
  // ========================================================================

  /**
   * List sales orders with filtering and pagination
   */
  list: authenticatedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
        filters: salesOrderFiltersSchema.optional(),
      }).optional()
    )
    .query(async ({ ctx, input = {} }) => {
      const service = new SalesOrderService(ctx.serviceContext);
      return service.listSalesOrders(
        { page: input.page ?? 1, limit: input.limit ?? 50 },
        input.filters ?? {}
      );
    }),

  /**
   * Get a single sales order by ID
   */
  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new SalesOrderService(ctx.serviceContext);
      const order = await service.getSalesOrderById(input.id);

      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sales order not found',
        });
      }

      return order;
    }),

  /**
   * Get sales order by order number
   */
  getByOrderNumber: authenticatedProcedure
    .input(z.object({ orderNumber: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new SalesOrderService(ctx.serviceContext);
      const result = await service.listSalesOrders(
        { page: 1, limit: 1 },
        { search: input.orderNumber }
      );

      const order = result.data.find((o) => o.orderNumber === input.orderNumber);
      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Sales order ${input.orderNumber} not found`,
        });
      }

      return order;
    }),

  /**
   * Create a new sales order
   */
  create: authenticatedProcedure
    .input(createSalesOrderSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new SalesOrderService(ctx.serviceContext);

      try {
        return await service.createSalesOrder({
          subsidiaryId: input.subsidiaryId,
          entityId: input.entityId,
          orderDate: input.orderDate,
          externalReference: input.externalReference,
          billingAddressId: input.billingAddressId,
          shippingAddressId: input.shippingAddressId,
          requestedDeliveryDate: input.requestedDeliveryDate,
          promisedDeliveryDate: input.promisedDeliveryDate,
          expirationDate: input.expirationDate,
          currencyCode: input.currencyCode,
          exchangeRate: input.exchangeRate,
          discountAmount: input.discountAmount,
          discountPercent: input.discountPercent,
          shippingAmount: input.shippingAmount,
          paymentTerms: input.paymentTerms,
          shippingMethod: input.shippingMethod,
          memo: input.memo,
          internalNotes: input.internalNotes,
          metadata: input.metadata,
          requiresApproval: input.requiresApproval,
          approvalThreshold: input.approvalThreshold,
          lines: input.lines.map((line) => ({
            itemId: line.itemId,
            description: line.description,
            sku: line.sku,
            quantity: line.quantity,
            unitOfMeasure: line.unitOfMeasure,
            unitPrice: line.unitPrice,
            discountAmount: line.discountAmount,
            discountPercent: line.discountPercent,
            taxAmount: line.taxAmount,
            taxCode: line.taxCode,
            requestedDeliveryDate: line.requestedDeliveryDate,
            promisedDeliveryDate: line.promisedDeliveryDate,
            departmentId: line.departmentId,
            locationId: line.locationId,
            classId: line.classId,
            projectId: line.projectId,
            revenueAccountId: line.revenueAccountId,
            deferredRevenueAccountId: line.deferredRevenueAccountId,
            memo: line.memo,
            metadata: line.metadata,
          })),
        });
      } catch (error: any) {
        if (error.code === 'VALIDATION_ERROR') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Update a sales order (only in DRAFT or REJECTED status)
   */
  update: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateSalesOrderSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new SalesOrderService(ctx.serviceContext);

      try {
        const updated = await service.updateSalesOrder(input.id, input.data);

        if (!updated) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Sales order not found',
          });
        }

        return updated;
      } catch (error: any) {
        if (error.code === 'INVALID_STATUS_FOR_UPDATE') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  // ========================================================================
  // Status Transition Operations
  // ========================================================================

  /**
   * Submit sales order for approval
   */
  submit: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SalesOrderService(ctx.serviceContext);

      try {
        return await service.submitForApproval(input.id);
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
        }
        if (error.code === 'INVALID_STATUS_TRANSITION') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
        }
        throw error;
      }
    }),

  /**
   * Approve a sales order
   */
  approve: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        comments: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new SalesOrderService(ctx.serviceContext);

      try {
        return await service.processApprovalAction(input.id, {
          action: ApprovalActionType.APPROVE,
          comments: input.comments,
        });
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
        }
        if (error.code === 'INVALID_STATUS_TRANSITION') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
        }
        throw error;
      }
    }),

  /**
   * Reject a sales order
   */
  reject: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().min(1),
        comments: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new SalesOrderService(ctx.serviceContext);

      try {
        return await service.processApprovalAction(input.id, {
          action: ApprovalActionType.REJECT,
          reason: input.reason,
          comments: input.comments,
        });
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
        }
        if (error.code === 'INVALID_STATUS_TRANSITION') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
        }
        throw error;
      }
    }),

  /**
   * Return sales order for revision
   */
  returnForRevision: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().min(1),
        comments: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new SalesOrderService(ctx.serviceContext);

      try {
        return await service.processApprovalAction(input.id, {
          action: ApprovalActionType.RETURN_FOR_REVISION,
          reason: input.reason,
          comments: input.comments,
        });
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
        }
        if (error.code === 'INVALID_STATUS_TRANSITION') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
        }
        throw error;
      }
    }),

  /**
   * Put sales order on hold
   */
  hold: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new SalesOrderService(ctx.serviceContext);

      try {
        return await service.putOnHold(input.id, input.reason);
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
        }
        if (error.code === 'INVALID_STATUS_TRANSITION') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
        }
        throw error;
      }
    }),

  /**
   * Release sales order from hold
   */
  release: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SalesOrderService(ctx.serviceContext);

      try {
        return await service.releaseFromHold(input.id);
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
        }
        if (error.code === 'NOT_ON_HOLD') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
        }
        throw error;
      }
    }),

  /**
   * Cancel sales order
   */
  cancel: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new SalesOrderService(ctx.serviceContext);

      try {
        return await service.cancelSalesOrder(input.id, input.reason);
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
        }
        if (error.code === 'INVALID_STATUS_TRANSITION') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
        }
        throw error;
      }
    }),

  /**
   * Close fulfilled sales order
   */
  close: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SalesOrderService(ctx.serviceContext);

      try {
        return await service.closeSalesOrder(input.id);
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
        }
        if (error.code === 'INVALID_STATUS_TRANSITION') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
        }
        throw error;
      }
    }),

  // ========================================================================
  // Invoice Operations
  // ========================================================================

  /**
   * Create invoice from sales order
   */
  createInvoice: authenticatedProcedure
    .input(
      z.object({
        salesOrderId: z.string().uuid(),
        lineIds: z.array(z.string().uuid()).optional(),
        quantities: z.record(z.union([z.number().positive(), z.string()])).optional(),
        invoiceDate: z.coerce.date().optional(),
        dueDate: z.coerce.date().optional(),
        memo: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new SalesOrderService(ctx.serviceContext);

      try {
        return await service.createInvoiceFromOrder({
          salesOrderId: input.salesOrderId,
          lineIds: input.lineIds,
          quantities: input.quantities,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate,
          memo: input.memo,
        });
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
        }
        if (error.code === 'INVALID_STATUS_FOR_INVOICE' || error.code === 'NO_LINES_TO_INVOICE') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
        }
        throw error;
      }
    }),

  // ========================================================================
  // Status Validation
  // ========================================================================

  /**
   * Check if a status transition is valid
   */
  validateTransition: authenticatedProcedure
    .input(
      z.object({
        currentStatus: salesOrderStatusSchema,
        targetStatus: salesOrderStatusSchema,
      })
    )
    .query(({ input }) => {
      const service = new SalesOrderService({});
      return service.validateStatusTransition(input.currentStatus, input.targetStatus);
    }),

  /**
   * Get valid transitions for a given status
   */
  getValidTransitions: authenticatedProcedure
    .input(z.object({ status: salesOrderStatusSchema }))
    .query(({ input }) => {
      const service = new SalesOrderService({});
      const transitions: Array<{ status: string; valid: boolean }> = [];

      for (const targetStatus of Object.values(SalesOrderStatus) as string[]) {
        const result = service.validateStatusTransition(input.status, targetStatus as any);
        if (result.valid) {
          transitions.push({ status: targetStatus, valid: true });
        }
      }

      return {
        currentStatus: input.status,
        validTransitions: transitions.map((t) => t.status),
      };
    }),

  // ========================================================================
  // Summary & Reporting
  // ========================================================================

  /**
   * Get sales order summary statistics
   */
  summary: authenticatedProcedure
    .input(
      z.object({
        entityId: z.string().uuid().optional(),
        subsidiaryId: z.string().uuid().optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
      }).optional()
    )
    .query(async ({ ctx, input = {} }) => {
      const service = new SalesOrderService(ctx.serviceContext);

      const orders = await service.listSalesOrders(
        { page: 1, limit: 1000 },
        {
          entityId: input.entityId,
          subsidiaryId: input.subsidiaryId,
          orderDateFrom: input.dateFrom,
          orderDateTo: input.dateTo,
        }
      );

      const summary = {
        totalOrders: orders.total,
        totalAmount: 0,
        totalInvoiced: 0,
        totalRemaining: 0,
        byStatus: {
          DRAFT: 0,
          SUBMITTED: 0,
          APPROVED: 0,
          REJECTED: 0,
          PARTIALLY_FULFILLED: 0,
          FULFILLED: 0,
          CLOSED: 0,
          CANCELLED: 0,
          ON_HOLD: 0,
        },
      };

      orders.data.forEach((order) => {
        summary.totalAmount += parseFloat(order.totalAmount || '0');
        summary.totalInvoiced += parseFloat(order.invoicedAmount || '0');
        summary.totalRemaining += parseFloat(order.remainingAmount || '0');

        if (order.status in summary.byStatus) {
          summary.byStatus[order.status as keyof typeof summary.byStatus]++;
        }
      });

      return summary;
    }),

  /**
   * Get orders pending approval
   */
  pendingApproval: authenticatedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ ctx, input = {} }) => {
      const service = new SalesOrderService(ctx.serviceContext);
      return service.listSalesOrders(
        { page: input.page ?? 1, limit: input.limit ?? 50 },
        { pendingApproval: true }
      );
    }),
});
