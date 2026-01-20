import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { SubscriptionService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

// Zod schemas for validation
const subscriptionItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  discountPercentage: z.number().min(0).max(1).default(0),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable()
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
    .input(z.object({
      entityId: z.string().uuid().optional(),
      status: z.enum(['draft', 'active', 'suspended', 'cancelled']).optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50)
    }).optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new SubscriptionService(ctx.serviceContext);
      return service.listSubscriptions(input);
    }),

  // Get single subscription with items
  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext);
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
    .input(subscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext);
      
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
    .input(z.object({
      id: z.string().uuid(),
      data: subscriptionSchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext);
      
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
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext);
      
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
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext);
      
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
    .input(z.object({
      id: z.string().uuid(),
      cancellationDate: z.coerce.date(),
      reason: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext);
      
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
      const service = new SubscriptionService(ctx.serviceContext);

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
      const service = new SubscriptionService(ctx.serviceContext);

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
      const service = new SubscriptionService(ctx.serviceContext);

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
      const service = new SubscriptionService(ctx.serviceContext);

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
      const service = new SubscriptionService(ctx.serviceContext);

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
      const service = new SubscriptionService(ctx.serviceContext);

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
      const service = new SubscriptionService(ctx.serviceContext);
      
      try {
        return await service.calculateRevenue(
          input.id, 
          input.calculationType, 
          input.effectiveDate
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
      const service = new SubscriptionService(ctx.serviceContext);
      
      try {
        return await service.getRevenueSchedule(input.id);
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

  // Get subscription metrics
  getMetrics: authenticatedProcedure
    .input(z.object({
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional()
    }).optional())
    .query(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext);
      
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