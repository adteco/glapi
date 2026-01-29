import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { BillingScheduleService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

// Helper to map service errors to TRPC errors
function handleServiceError(error: any): never {
  if (error.code === 'NOT_FOUND') {
    throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
  }
  if (error.code === 'INVALID_STATE') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
  }
  if (error.code === 'MISSING_ITEMS' || error.code === 'NO_PERIODS') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
  }
  if (error.code === 'UPDATE_FAILED') {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
  }
  throw error;
}

export const billingSchedulesRouter = router({
  // Generate billing schedule for a subscription
  generate: authenticatedProcedure
    .input(z.object({
      subscriptionId: z.string().uuid(),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
      billingDay: z.number().min(1).max(31).default(1),
      paymentTermsDays: z.number().min(0).default(30)
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new BillingScheduleService(ctx.serviceContext, { db: ctx.db });

      try {
        return await service.generateBillingSchedule({
          subscriptionId: input.subscriptionId,
          startDate: input.startDate,
          endDate: input.endDate,
          billingDay: input.billingDay,
          paymentTermsDays: input.paymentTermsDays
        });
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // Get billing schedule by ID
  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new BillingScheduleService(ctx.serviceContext, { db: ctx.db });

      const schedule = await service.getScheduleById(input.id);
      if (!schedule) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Billing schedule not found'
        });
      }

      return schedule;
    }),

  // Get active schedule for a subscription
  getBySubscription: authenticatedProcedure
    .input(z.object({ subscriptionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new BillingScheduleService(ctx.serviceContext, { db: ctx.db });

      try {
        return await service.getActiveScheduleBySubscription(input.subscriptionId);
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // List billing schedules
  list: authenticatedProcedure
    .input(z.object({
      subscriptionId: z.string().uuid().optional(),
      status: z.union([
        z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']),
        z.array(z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']))
      ]).optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50)
    }).optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new BillingScheduleService(ctx.serviceContext, { db: ctx.db });

      return service.listSchedules({
        subscriptionId: input.subscriptionId,
        status: input.status,
        page: input.page,
        limit: input.limit
      });
    }),

  // Get lines due for billing
  getLinesDueToBill: authenticatedProcedure
    .input(z.object({
      asOfDate: z.coerce.date().optional()
    }).optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new BillingScheduleService(ctx.serviceContext, { db: ctx.db });

      return service.getLinesDueToBill(input.asOfDate);
    }),

  // Get overdue billing lines
  getOverdueLines: authenticatedProcedure
    .input(z.object({
      asOfDate: z.coerce.date().optional()
    }).optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new BillingScheduleService(ctx.serviceContext, { db: ctx.db });

      return service.getOverdueLines(input.asOfDate);
    }),

  // Mark a billing line as invoiced
  markLineInvoiced: authenticatedProcedure
    .input(z.object({
      lineId: z.string().uuid(),
      invoiceId: z.string().uuid(),
      invoicedAmount: z.string().regex(/^\d+\.?\d*$/, 'Must be a valid decimal amount')
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new BillingScheduleService(ctx.serviceContext, { db: ctx.db });

      try {
        return await service.markLineInvoiced(
          input.lineId,
          input.invoiceId,
          input.invoicedAmount
        );
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // Mark a billing line as paid
  markLinePaid: authenticatedProcedure
    .input(z.object({
      lineId: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new BillingScheduleService(ctx.serviceContext, { db: ctx.db });

      try {
        return await service.markLinePaid(input.lineId);
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // Pause a billing schedule
  pause: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      reason: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new BillingScheduleService(ctx.serviceContext, { db: ctx.db });

      try {
        return await service.pauseSchedule(input.id, input.reason);
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // Resume a paused billing schedule
  resume: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new BillingScheduleService(ctx.serviceContext, { db: ctx.db });

      try {
        return await service.resumeSchedule(input.id);
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // Cancel a billing schedule
  cancel: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      reason: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new BillingScheduleService(ctx.serviceContext, { db: ctx.db });

      try {
        return await service.cancelSchedule(input.id, input.reason);
      } catch (error: any) {
        handleServiceError(error);
      }
    })
});
