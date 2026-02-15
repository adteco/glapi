import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { RevenueService, SalesOrderService, SubscriptionService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';
import {
  SalesOrderStatus,
  ApprovalActionType,
  items,
  and,
  eq,
  inArray,
} from '@glapi/database';
import { createReadOnlyAIMeta, createWriteAIMeta } from '../ai-meta';

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
  revenueBehavior: z.enum(['point_in_time', 'over_time']).optional(),
  sspAmount: z.union([z.number().min(0), z.string()]).optional(),
  listPrice: z.union([z.number().min(0), z.string()]).optional(),
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

const revenuePlanConfigSchema = z.object({
  billingFrequency: z.enum(['monthly', 'quarterly', 'annual']).default('monthly'),
  termMonths: z.number().int().min(1).max(120).default(12),
  autoActivateSubscription: z.boolean().default(true),
  contractStartDate: z.coerce.date().optional(),
  contractEndDate: z.coerce.date().optional(),
  recognitionEffectiveDate: z.coerce.date().optional(),
});

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() - 1);
  return d;
}

function parseDateLike(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

function toNumber(value: unknown, fallback: number = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function buildRevenueLineMetadata(line: Record<string, unknown>) {
  return {
    ...(line.metadata && typeof line.metadata === 'object' ? line.metadata as Record<string, unknown> : {}),
    revenueBehavior: line.revenueBehavior as string | undefined,
    sspAmount: toOptionalNumber(line.sspAmount),
    listPrice: toOptionalNumber(line.listPrice),
  };
}

// ============================================================================
// Sales Orders Router
// ============================================================================

async function generateRevenuePlanFromOrder(
  params: {
    order: any;
    serviceContext: any;
    db: any;
    planInput: z.infer<typeof revenuePlanConfigSchema>;
  }
) {
  const { order, serviceContext, db, planInput } = params;
  const subscriptionService = new SubscriptionService(serviceContext, { db });
  const revenueService = new RevenueService(serviceContext, { db });

  const fallbackStart = parseDateLike(order.orderDate) || new Date();
  const contractStart =
    planInput.contractStartDate ||
    parseDateLike(order.requestedDeliveryDate) ||
    fallbackStart;
  const contractEnd =
    planInput.contractEndDate ||
    parseDateLike(order.promisedDeliveryDate) ||
    addMonths(contractStart, planInput.termMonths);

  const orderLines = (order.lines || []) as Array<Record<string, unknown>>;
  const itemIds = Array.from(
    new Set(
      orderLines
        .map((line) => (typeof line.itemId === 'string' ? line.itemId : undefined))
        .filter((id): id is string => !!id)
    )
  );
  const itemDefaultsById = new Map<
    string,
    { revenueBehavior?: string | null; defaultSspAmount?: number; listPrice?: number }
  >();
  const organizationId = typeof order.organizationId === 'string' ? order.organizationId : undefined;

  if (itemIds.length > 0 && organizationId) {
    let defaultRows: Array<{
      id: string;
      revenueBehavior: string | null;
      defaultSspAmount: unknown;
      defaultPrice: unknown;
    }> = [];

    try {
      // Work around intermittent Next.js RSC bundling issues with `select({ ... })`
      // by selecting full rows and projecting in JS.
      defaultRows = await db
        .select()
        .from(items)
        .where(
          and(
            eq(items.organizationId, organizationId),
            inArray(items.id, itemIds)
          )
        );
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed loading item defaults for ASC606 planning: ${asErrorMessage(error)}`,
        cause: error,
      });
    }

    for (const row of defaultRows) {
      itemDefaultsById.set(row.id, {
        revenueBehavior: row.revenueBehavior,
        defaultSspAmount: toOptionalNumber(row.defaultSspAmount),
        listPrice: toOptionalNumber(row.defaultPrice),
      });
    }
  }

  const lineItems = orderLines.map((line: any) => {
    if (!line.itemId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Sales order line "${line.description}" is missing itemId. Item IDs are required for ASC 606 plan generation.`,
      });
    }

    const metadata = (line.metadata || {}) as Record<string, unknown>;
    const lineStart =
      parseDateLike(metadata.serviceStartDate) ||
      parseDateLike(line.requestedDeliveryDate) ||
      contractStart;
    const lineEnd =
      parseDateLike(metadata.serviceEndDate) ||
      parseDateLike(line.promisedDeliveryDate) ||
      contractEnd;
    const itemDefaults = itemDefaultsById.get(line.itemId);
    const revenueBehavior =
      typeof line.revenueBehavior === 'string'
        ? line.revenueBehavior
        : typeof metadata.revenueBehavior === 'string'
          ? metadata.revenueBehavior
          : itemDefaults?.revenueBehavior || undefined;
    const sspAmount =
      toOptionalNumber(line.sspAmount) ??
      toOptionalNumber(metadata.sspAmount) ??
      itemDefaults?.defaultSspAmount;
    const listPrice =
      toOptionalNumber(line.listPrice) ??
      toOptionalNumber(metadata.listPrice) ??
      itemDefaults?.listPrice;
    const unitPrice = toNumber(line.unitPrice, listPrice ?? 0);

    return {
      itemId: line.itemId,
      quantity: toNumber(line.quantity, 1),
      unitPrice,
      discountPercentage: toNumber(line.discountPercent, 0),
      startDate: lineStart,
      endDate: lineEnd,
      metadata: {
        ...metadata,
        serviceStartDate: lineStart.toISOString().split('T')[0],
        serviceEndDate: lineEnd.toISOString().split('T')[0],
        revenueBehavior,
        sspAmount,
        listPrice,
      },
    };
  });

  let subscription: any;
  try {
    subscription = await subscriptionService.createSubscription({
      entityId: order.entityId,
      subscriptionNumber: `SO-${order.orderNumber}-${Date.now().toString().slice(-6)}`,
      status: planInput.autoActivateSubscription ? 'active' : 'draft',
      startDate: contractStart.toISOString().split('T')[0],
      endDate: contractEnd.toISOString().split('T')[0],
      contractValue: String(toNumber(order.totalAmount, 0)),
      billingFrequency: planInput.billingFrequency,
      autoRenew: false,
      renewalTermMonths: planInput.termMonths,
      metadata: {
        source: 'sales_order',
        salesOrderId: order.id,
        salesOrderNumber: order.orderNumber,
      },
      items: lineItems,
    });
  } catch (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed creating subscription from sales order for ASC606 planning: ${asErrorMessage(error)}`,
      cause: error,
    });
  }

  if (planInput.autoActivateSubscription && subscription.status !== 'active') {
    await subscriptionService.activateSubscription(subscription.id);
  }

  const effectiveDate = planInput.recognitionEffectiveDate || contractStart;
  let calculation: any;
  try {
    calculation = await revenueService.calculateRevenue(
      subscription.id,
      'initial',
      effectiveDate,
      { forceRecalculation: true }
    );
  } catch (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed calculating subscription revenue for ASC606 planning: ${asErrorMessage(error)}`,
      cause: error,
    });
  }

  let plan: any;
  try {
    plan = await revenueService.getSubscriptionPlan({
      subscriptionId: subscription.id,
      startDate: contractStart,
      endDate: contractEnd,
    });
  } catch (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed building subscription plan (waterfall/schedule) for ASC606 planning: ${asErrorMessage(error)}`,
      cause: error,
    });
  }

  return {
    subscription,
    calculation,
    plan,
  };
}

export const salesOrdersRouter = router({
  // ========================================================================
  // CRUD Operations
  // ========================================================================

  /**
   * List sales orders with filtering and pagination
   */
  list: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_sales_orders', 'Search and list sales orders', {
      scopes: ['sales', 'orders', 'global'],
      permissions: ['read:sales-orders'],
    }) })
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
    .meta({ ai: createReadOnlyAIMeta('get_sales_order', 'Get a single sales order by ID', {
      scopes: ['sales', 'orders', 'global'],
      permissions: ['read:sales-orders'],
    }) })
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
    .meta({ ai: createWriteAIMeta('create_sales_order', 'Create a new sales order', {
      scopes: ['sales', 'orders'],
      permissions: ['write:sales-orders'],
      riskLevel: 'MEDIUM',
    }) })
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
            metadata: buildRevenueLineMetadata(line as Record<string, unknown>),
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
   * Create sales order and immediately generate ASC 606 plan + waterfall
   */
  createWithRevenuePlan: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('create_sales_order_with_revenue_plan', 'Create sales order and return ASC 606 plan', {
      scopes: ['sales', 'orders', 'revenue'],
      permissions: ['write:sales-orders', 'write:subscriptions', 'write:revenue'],
      riskLevel: 'HIGH',
    }) })
    .input(
      z.object({
        order: createSalesOrderSchema,
        revenuePlan: revenuePlanConfigSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new SalesOrderService(ctx.serviceContext, { db: ctx.db });
      const revenuePlan = input.revenuePlan || revenuePlanConfigSchema.parse({});

      let order: any;
      try {
        order = await service.createSalesOrder({
          subsidiaryId: input.order.subsidiaryId,
          entityId: input.order.entityId,
          orderDate: input.order.orderDate,
          externalReference: input.order.externalReference,
          billingAddressId: input.order.billingAddressId,
          shippingAddressId: input.order.shippingAddressId,
          requestedDeliveryDate: input.order.requestedDeliveryDate,
          promisedDeliveryDate: input.order.promisedDeliveryDate,
          expirationDate: input.order.expirationDate,
          currencyCode: input.order.currencyCode,
          exchangeRate: input.order.exchangeRate,
          discountAmount: input.order.discountAmount,
          discountPercent: input.order.discountPercent,
          shippingAmount: input.order.shippingAmount,
          paymentTerms: input.order.paymentTerms,
          shippingMethod: input.order.shippingMethod,
          memo: input.order.memo,
          internalNotes: input.order.internalNotes,
          metadata: input.order.metadata,
          requiresApproval: input.order.requiresApproval,
          approvalThreshold: input.order.approvalThreshold,
          lines: input.order.lines.map((line) => ({
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
            metadata: buildRevenueLineMetadata(line as Record<string, unknown>),
          })),
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed creating sales order for ASC606 planning: ${asErrorMessage(error)}`,
          cause: error,
        });
      }

      let revenue: any;
      try {
        revenue = await generateRevenuePlanFromOrder({
          order,
          serviceContext: ctx.serviceContext,
          db: ctx.db,
          planInput: revenuePlan,
        });
      } catch (error) {
        // generateRevenuePlanFromOrder already throws TRPCError with stage-specific messages
        throw error;
      }

      return {
        order,
        subscription: revenue.subscription,
        calculation: revenue.calculation,
        plan: revenue.plan,
      };
    }),

  /**
   * Generate ASC 606 plan for an existing sales order
   */
  generateRevenuePlan: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('generate_sales_order_revenue_plan', 'Generate ASC 606 plan for existing sales order', {
      scopes: ['sales', 'orders', 'revenue'],
      permissions: ['read:sales-orders', 'write:subscriptions', 'write:revenue'],
      riskLevel: 'HIGH',
    }) })
    .input(
      z.object({
        salesOrderId: z.string().uuid(),
        revenuePlan: revenuePlanConfigSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new SalesOrderService(ctx.serviceContext, { db: ctx.db });
      const order = await service.getSalesOrderById(input.salesOrderId);

      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sales order not found',
        });
      }

      const revenuePlan = input.revenuePlan || revenuePlanConfigSchema.parse({});
      const revenue = await generateRevenuePlanFromOrder({
        order,
        serviceContext: ctx.serviceContext,
        db: ctx.db,
        planInput: revenuePlan,
      });

      return {
        order,
        subscription: revenue.subscription,
        calculation: revenue.calculation,
        plan: revenue.plan,
      };
    }),

  /**
   * Update a sales order (only in DRAFT or REJECTED status)
   */
  update: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('update_sales_order', 'Update an existing sales order', {
      scopes: ['sales', 'orders'],
      permissions: ['write:sales-orders'],
      riskLevel: 'MEDIUM',
    }) })
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateSalesOrderSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new SalesOrderService(ctx.serviceContext);
      const normalizedData = input.data.lines
        ? {
            ...input.data,
            lines: input.data.lines.map((line) => ({
              ...line,
              metadata: buildRevenueLineMetadata(line as Record<string, unknown>),
            })),
          }
        : input.data;

      try {
        const updated = await service.updateSalesOrder(input.id, normalizedData);

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
    .meta({ ai: createWriteAIMeta('approve_sales_order', 'Approve a sales order', {
      scopes: ['sales', 'orders', 'approvals'],
      permissions: ['approve:sales-orders'],
      riskLevel: 'MEDIUM',
      minimumRole: 'manager',
    }) })
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
    .meta({ ai: createWriteAIMeta('cancel_sales_order', 'Cancel a sales order', {
      scopes: ['sales', 'orders'],
      permissions: ['write:sales-orders'],
      riskLevel: 'HIGH',
    }) })
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
