import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { RevenueService, SubscriptionService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';
import { and, eq, items, subscriptionItems, subscriptions } from '@glapi/database';

// Zod schemas for validation
const subscriptionItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  discountPercentage: z.number().min(0).max(1).default(0),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});

const subscriptionSchema = z.object({
  entityId: z.string().uuid(),
  subscriptionNumber: z.string().min(1).optional(),
  status: z.enum(['draft', 'active', 'suspended', 'cancelled', 'expired']).default('draft'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  contractValue: z.number().positive().optional().nullable(),
  billingFrequency: z.enum(['monthly', 'quarterly', 'annual']).optional().nullable(),
  autoRenew: z.boolean().default(false),
  renewalTermMonths: z.number().positive().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
  items: z.array(subscriptionItemSchema).min(1).optional()
});

const licenseChangeSchema = z.object({
  subscriptionId: z.string().uuid(),
  itemId: z.string().uuid(),
  action: z.enum(['add', 'remove']),
  quantity: z.number().positive(),
  unitPrice: z.number().positive().optional(),
  effectiveDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  reason: z.string().optional(),
});

function num(value: string | number | null | undefined, fallback: number = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function getItemRevenueDefaults(
  ctx: any,
  organizationId: string,
  itemId: string
): Promise<{ listPrice?: number; revenueBehavior?: string | null; defaultSspAmount?: number }> {
  const [row] = await ctx.db
    .select({
      defaultPrice: items.defaultPrice,
      revenueBehavior: items.revenueBehavior,
      defaultSspAmount: items.defaultSspAmount,
    })
    .from(items)
    .where(
      and(
        eq(items.organizationId, organizationId),
        eq(items.id, itemId)
      )
    )
    .limit(1);

  if (!row) {
    return {};
  }

  return {
    listPrice: row.defaultPrice ? Number(row.defaultPrice) : undefined,
    revenueBehavior: row.revenueBehavior,
    defaultSspAmount: row.defaultSspAmount ? Number(row.defaultSspAmount) : undefined,
  };
}

// Helper to map service errors to TRPC errors
function handleServiceError(error: any): never {
  if (error.code === 'NOT_FOUND') {
    throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
  }
  if (error.code === 'INVALID_STATE' || error.code === 'INVALID_STATE_TRANSITION' || error.code === 'MISSING_ITEMS') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
  }
  if (error.code === 'ALREADY_CANCELLED') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
  }
  throw error;
}

export const subscriptionsRouter = router({
  // List subscriptions with filtering
  list: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_subscriptions', 'Search and list subscriptions', {
      scopes: ['subscriptions', 'billing', 'global'],
      permissions: ['read:subscriptions'],
    }) })
    .input(z.object({
      entityId: z.string().uuid().optional(),
      status: z.enum(['draft', 'active', 'suspended', 'cancelled']).optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50)
    }).optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new SubscriptionService(ctx.serviceContext, { db: ctx.db });
      return service.listSubscriptions(input);
    }),

  // Get single subscription with items
  get: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_subscription', 'Get a single subscription by ID with items', {
      scopes: ['subscriptions', 'billing', 'global'],
      permissions: ['read:subscriptions'],
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext, { db: ctx.db });
      const subscription = await service.getSubscriptionById(input.id);
      
      if (!subscription) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subscription not found'
        });
      }
      
      return subscription;
    }),

  // Create subscription with items
  create: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('create_subscription', 'Create a new subscription', {
      scopes: ['subscriptions', 'billing'],
      permissions: ['write:subscriptions'],
      riskLevel: 'MEDIUM',
    }) })
    .input(subscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext, { db: ctx.db });
      
      // Convert nullable fields to undefined for service
      const dataForService = {
        ...input,
        endDate: input.endDate || undefined,
        contractValue: input.contractValue ? String(input.contractValue) : undefined,
        billingFrequency: input.billingFrequency || undefined,
        renewalTermMonths: input.renewalTermMonths || undefined,
        metadata: input.metadata || undefined,
        items: input.items?.map(item => ({
          ...item,
          endDate: item.endDate || undefined
        }))
      };
      
      return service.createSubscription(dataForService as any);
    }),

  // Update subscription
  update: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('update_subscription', 'Update an existing subscription', {
      scopes: ['subscriptions', 'billing'],
      permissions: ['write:subscriptions'],
      riskLevel: 'MEDIUM',
    }) })
    .input(z.object({
      id: z.string().uuid(),
      data: subscriptionSchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext, { db: ctx.db });
      
      // Convert nullable fields to undefined for service
      const dataForService = {
        ...input.data,
        startDate: input.data.startDate ? (typeof input.data.startDate === 'string' ? input.data.startDate : input.data.startDate.toISOString().split('T')[0]) : undefined,
        endDate: input.data.endDate === null ? undefined : (input.data.endDate ? (typeof input.data.endDate === 'string' ? input.data.endDate : input.data.endDate.toISOString().split('T')[0]) : undefined),
        contractValue: input.data.contractValue === null ? undefined : (input.data.contractValue ? String(input.data.contractValue) : undefined),
        billingFrequency: input.data.billingFrequency === null ? undefined : input.data.billingFrequency,
        renewalTermMonths: input.data.renewalTermMonths === null ? undefined : input.data.renewalTermMonths,
        metadata: input.data.metadata === null ? undefined : input.data.metadata,
        items: input.data.items?.map(item => ({
          ...item,
          endDate: item.endDate === null ? undefined : item.endDate
        }))
      };
      
      const updated = await service.updateSubscription(input.id, dataForService as any);
      
      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND', 
          message: 'Subscription not found'
        });
      }
      
      return updated;
    }),

  // Delete subscription
  delete: authenticatedProcedure
    .meta({ ai: createDeleteAIMeta('delete_subscription', 'Cancel a subscription', {
      scopes: ['subscriptions'],
      permissions: ['delete:subscriptions'],
      riskLevel: 'HIGH',
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext, { db: ctx.db });
      
      // First check if subscription exists
      const subscription = await service.getSubscriptionById(input.id);
      if (!subscription) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subscription not found'
        });
      }
      
      // For now, we'll cancel instead of hard delete
      const cancellationDate = new Date();
      return service.cancelSubscription(input.id, cancellationDate, 'Deleted via API');
    }),

  // Activate subscription
  activate: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('activate_subscription', 'Activate a draft subscription', {
      scopes: ['subscriptions', 'billing'],
      permissions: ['write:subscriptions'],
      riskLevel: 'MEDIUM',
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext, { db: ctx.db });
      
      try {
        return await service.activateSubscription(input.id);
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message
          });
        }
        if (error.code === 'INVALID_STATE_TRANSITION' || error.code === 'MISSING_ITEMS') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message
          });
        }
        throw error;
      }
    }),

  // Cancel subscription
  cancel: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('cancel_subscription', 'Cancel an active subscription', {
      scopes: ['subscriptions', 'billing'],
      permissions: ['write:subscriptions'],
      riskLevel: 'HIGH',
    }) })
    .input(z.object({
      id: z.string().uuid(),
      cancellationDate: z.coerce.date(),
      reason: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext, { db: ctx.db });
      
      try {
        return await service.cancelSubscription(
          input.id, 
          input.cancellationDate, 
          input.reason
        );
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message
          });
        }
        if (error.code === 'ALREADY_CANCELLED') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message
          });
        }
        throw error;
      }
    }),

  // Suspend subscription
  suspend: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      reason: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext, { db: ctx.db });

      try {
        return await service.suspendSubscription(input.id, input.reason);
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // Resume suspended subscription
  resume: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext, { db: ctx.db });

      try {
        return await service.resumeSubscription(input.id);
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // Renew subscription
  renew: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      renewalTermMonths: z.number().positive(),
      newEndDate: z.coerce.date()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext, { db: ctx.db });

      try {
        return await service.renewSubscription(
          input.id,
          input.renewalTermMonths,
          input.newEndDate
        );
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // Amend subscription (contract modification)
  amend: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      effectiveDate: z.coerce.date(),
      reason: z.string().min(1),
      changes: subscriptionSchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext, { db: ctx.db });

      try {
        // Convert nullable fields to undefined for service
        const changesForService = {
          ...input.changes,
          startDate: input.changes.startDate ? (typeof input.changes.startDate === 'string' ? input.changes.startDate : input.changes.startDate.toISOString().split('T')[0]) : undefined,
          endDate: input.changes.endDate === null ? undefined : (input.changes.endDate ? (typeof input.changes.endDate === 'string' ? input.changes.endDate : input.changes.endDate.toISOString().split('T')[0]) : undefined),
          contractValue: input.changes.contractValue === null ? undefined : (input.changes.contractValue ? String(input.changes.contractValue) : undefined),
          billingFrequency: input.changes.billingFrequency === null ? undefined : input.changes.billingFrequency,
          renewalTermMonths: input.changes.renewalTermMonths === null ? undefined : input.changes.renewalTermMonths,
          metadata: input.changes.metadata === null ? undefined : input.changes.metadata,
          items: input.changes.items?.map(item => ({
            ...item,
            endDate: item.endDate === null ? undefined : item.endDate
          }))
        };

        return await service.amendSubscription({
          subscriptionId: input.id,
          changes: changesForService as any,
          effectiveDate: input.effectiveDate,
          reason: input.reason
        });
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // Get version history
  getVersionHistory: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50)
    }))
    .query(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext, { db: ctx.db });

      try {
        return await service.getVersionHistory(input.id, {
          page: input.page,
          limit: input.limit
        });
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // Get specific version
  getVersion: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      versionNumber: z.number().positive()
    }))
    .query(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext, { db: ctx.db });

      try {
        const version = await service.getVersion(input.id, input.versionNumber);

        if (!version) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Version ${input.versionNumber} not found for this subscription`
          });
        }

        return version;
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        handleServiceError(error);
      }
    }),

  // Calculate revenue recognition
  calculateRevenue: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      calculationType: z.enum(['initial', 'modification', 'renewal']),
      effectiveDate: z.coerce.date()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new RevenueService(ctx.serviceContext, { db: ctx.db });
      
      try {
        return await service.calculateRevenue(
          input.id, 
          input.calculationType,
          input.effectiveDate,
          { forceRecalculation: true }
        );
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

  // Get revenue schedule
  getRevenueSchedule: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new RevenueService(ctx.serviceContext, { db: ctx.db });
      
      try {
        const plan = await service.getSubscriptionPlan({
          subscriptionId: input.id,
        });
        return {
          subscriptionId: input.id,
          schedules: plan.schedules,
          waterfall: plan.waterfall,
          summary: plan.summary,
        };
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

  // Preview license add/remove impact without persisting changes
  previewLicenseChange: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('preview_license_change', 'Preview add/remove license impact on ASC 606 plan', {
      scopes: ['subscriptions', 'revenue'],
      permissions: ['read:subscriptions', 'read:revenue'],
    }) })
    .input(licenseChangeSchema)
    .mutation(async ({ ctx, input }) => {
      const subscriptionService = new SubscriptionService(ctx.serviceContext, { db: ctx.db });
      const revenueService = new RevenueService(ctx.serviceContext, { db: ctx.db });

      const current = await subscriptionService.getSubscriptionById(input.subscriptionId);
      if (!current) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subscription not found',
        });
      }

      const currentItems = [...(current.items || [])];
      const target = currentItems.find((i) => i.itemId === input.itemId);

      if (input.action === 'remove') {
        if (!target) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot remove licenses for an item that is not on the subscription',
          });
        }
        const remaining = num(target.quantity) - input.quantity;
        if (remaining < 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Removal quantity exceeds currently licensed quantity',
          });
        }
        if (remaining === 0) {
          const index = currentItems.findIndex((i) => i.id === target.id);
          if (index >= 0) currentItems.splice(index, 1);
        } else {
          target.quantity = String(remaining);
        }
      } else {
        if (target) {
          target.quantity = String(num(target.quantity) + input.quantity);
        } else {
          const itemDefaults = await getItemRevenueDefaults(ctx, current.organizationId, input.itemId);
          const resolvedUnitPrice = input.unitPrice ?? itemDefaults.listPrice;
          if (!resolvedUnitPrice) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'unitPrice is required when adding a new licensed item (or set item listPrice)',
            });
          }
          currentItems.push({
            id: `preview-${Date.now()}`,
            itemId: input.itemId,
            quantity: String(input.quantity),
            unitPrice: String(resolvedUnitPrice),
            discountPercentage: '0',
            startDate: input.effectiveDate.toISOString().split('T')[0],
            endDate: (input.endDate || current.endDate || null) as any,
            metadata: {
              revenueBehavior: itemDefaults.revenueBehavior,
              sspAmount: itemDefaults.defaultSspAmount,
              listPrice: itemDefaults.listPrice,
            },
          });
        }
      }

      const baseline = await revenueService.previewAllocation(current.id, input.effectiveDate);
      const baselinePrice = num((baseline as any).transactionPrice, 0);

      // Build a temporary subscription snapshot for scenario preview.
      const [tempSubscription] = await ctx.db.insert(subscriptions).values({
        organizationId: current.organizationId,
        entityId: current.entityId,
        subscriptionNumber: `WHATIF-${Date.now()}`,
        status: 'active',
        startDate: current.startDate,
        endDate: (current.endDate || input.endDate || null) as any,
        contractValue: String(currentItems.reduce((sum, item) => {
          return sum + (num(item.quantity) * num(item.unitPrice));
        }, 0)),
        billingFrequency: current.billingFrequency || 'monthly',
        autoRenew: false,
        renewalTermMonths: current.renewalTermMonths,
        metadata: {
          whatIf: true,
          sourceSubscriptionId: current.id,
        },
      }).returning();

      try {
        await ctx.db.insert(subscriptionItems).values(
          currentItems.map((item) => ({
            organizationId: current.organizationId,
            subscriptionId: tempSubscription.id,
            itemId: item.itemId,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
            discountPercentage: item.discountPercentage || '0',
            startDate: item.startDate,
            endDate: (item.endDate || null) as any,
            metadata: (item.metadata || null) as any,
          }))
        );

        const scenario = await revenueService.previewAllocation(tempSubscription.id, input.effectiveDate);
        const scenarioPrice = num((scenario as any).transactionPrice, 0);

        return {
          baseline,
          scenario,
          delta: {
            transactionPrice: scenarioPrice - baselinePrice,
          },
        };
      } finally {
        await ctx.db.delete(subscriptionItems).where(eq(subscriptionItems.subscriptionId, tempSubscription.id));
        await ctx.db.delete(subscriptions).where(eq(subscriptions.id, tempSubscription.id));
      }
    }),

  // Apply license add/remove and recalculate ASC 606 schedules
  applyLicenseChange: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('apply_license_change', 'Apply license quantity change and recalculate revenue', {
      scopes: ['subscriptions', 'revenue'],
      permissions: ['write:subscriptions', 'write:revenue'],
      riskLevel: 'HIGH',
    }) })
    .input(licenseChangeSchema)
    .mutation(async ({ ctx, input }) => {
      const subscriptionService = new SubscriptionService(ctx.serviceContext, { db: ctx.db });
      const revenueService = new RevenueService(ctx.serviceContext, { db: ctx.db });

      const current = await subscriptionService.getSubscriptionById(input.subscriptionId);
      if (!current) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subscription not found',
        });
      }

      const nextItems = (current.items || []).map((item) => ({
        itemId: item.itemId,
        quantity: num(item.quantity, 0),
        unitPrice: num(item.unitPrice, 0),
        discountPercentage: num(item.discountPercentage || 0, 0),
        startDate: new Date(item.startDate),
        endDate: item.endDate ? new Date(item.endDate) : undefined,
        metadata: (item.metadata || undefined) as Record<string, unknown> | undefined,
      }));

      const target = nextItems.find((i) => i.itemId === input.itemId);

      if (input.action === 'remove') {
        if (!target) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot remove licenses for an item that is not on the subscription',
          });
        }

        const nextQty = target.quantity - input.quantity;
        if (nextQty < 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Removal quantity exceeds currently licensed quantity',
          });
        }
        if (nextQty === 0) {
          const idx = nextItems.findIndex((i) => i.itemId === input.itemId);
          nextItems.splice(idx, 1);
        } else {
          target.quantity = nextQty;
        }
      } else {
        if (target) {
          target.quantity += input.quantity;
        } else {
          const itemDefaults = await getItemRevenueDefaults(ctx, current.organizationId, input.itemId);
          const resolvedUnitPrice = input.unitPrice ?? itemDefaults.listPrice;
          if (!resolvedUnitPrice) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'unitPrice is required when adding a new licensed item (or set item listPrice)',
            });
          }
          nextItems.push({
            itemId: input.itemId,
            quantity: input.quantity,
            unitPrice: resolvedUnitPrice,
            discountPercentage: 0,
            startDate: input.effectiveDate,
            endDate: input.endDate || (current.endDate ? new Date(current.endDate) : undefined),
            metadata: {
              revenueBehavior: itemDefaults.revenueBehavior,
              sspAmount: itemDefaults.defaultSspAmount,
              listPrice: itemDefaults.listPrice,
            },
          });
        }
      }

      if (nextItems.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Subscription must keep at least one licensed item',
        });
      }

      const amended = await subscriptionService.amendSubscription({
        subscriptionId: input.subscriptionId,
        effectiveDate: input.effectiveDate,
        reason: input.reason || `License ${input.action} (${input.quantity})`,
        changes: {
          contractValue: String(nextItems.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0)),
          items: nextItems.map((i) => ({
            itemId: i.itemId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discountPercentage: i.discountPercentage,
            startDate: i.startDate,
            endDate: i.endDate,
            metadata: i.metadata,
          })),
        },
      });

      const calculation = await revenueService.calculateRevenue(
        input.subscriptionId,
        'modification',
        input.effectiveDate,
        { forceRecalculation: true }
      );

      const plan = await revenueService.getSubscriptionPlan({
        subscriptionId: input.subscriptionId,
      });

      return {
        subscription: amended,
        calculation,
        plan,
      };
    }),

  // Get subscription metrics
  getMetrics: authenticatedProcedure
    .input(z.object({
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional()
    }).optional())
    .query(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext, { db: ctx.db });
      
      // TODO: Implement metrics calculation
      // This would aggregate subscription data for reporting
      
      return {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        totalContractValue: 0,
        averageContractValue: 0,
        message: 'Metrics calculation will be implemented in reporting phase'
      };
    })
});
