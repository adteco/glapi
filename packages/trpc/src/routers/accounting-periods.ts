import { z } from 'zod';
import { authenticatedProcedure, adminProcedure, router } from '../trpc';
import { AccountingPeriodService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';

const PeriodStatusEnum = z.enum(['OPEN', 'SOFT_CLOSED', 'CLOSED', 'LOCKED']);
const PeriodTypeEnum = z.enum(['MONTH', 'QUARTER', 'YEAR', 'ADJUSTMENT']);

const createPeriodSchema = z.object({
  subsidiaryId: z.string().uuid(),
  periodName: z.string().min(1),
  fiscalYear: z.string().min(1),
  periodNumber: z.number().int().positive(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodType: PeriodTypeEnum,
  isAdjustmentPeriod: z.boolean().default(false),
});

const periodFiltersSchema = z.object({
  status: z.union([PeriodStatusEnum, z.array(PeriodStatusEnum)]).optional(),
  fiscalYear: z.string().optional(),
  periodType: PeriodTypeEnum.optional(),
  isAdjustmentPeriod: z.boolean().optional(),
  startDateFrom: z.string().optional(),
  startDateTo: z.string().optional(),
}).optional();

export const accountingPeriodsRouter = router({
  /**
   * List all accounting periods with optional filters
   */
  list: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_accounting_periods', 'Search and list accounting periods', {
      scopes: ['accounting', 'periods', 'global'],
      permissions: ['read:accounting-periods'],
    }) })
    .input(
      z.object({
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(100).optional(),
        orderBy: z.enum(['periodName', 'startDate', 'fiscalYear', 'status']).optional(),
        orderDirection: z.enum(['asc', 'desc']).optional(),
        filters: periodFiltersSchema,
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new AccountingPeriodService(ctx.serviceContext, { db: ctx.db });
      return service.listPeriods(
        { page: input?.page, limit: input?.limit },
        input?.filters || {},
        input?.orderBy || 'startDate',
        input?.orderDirection || 'desc'
      );
    }),

  /**
   * Get a single accounting period by ID
   */
  get: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_accounting_period', 'Get a single accounting period by ID', {
      scopes: ['accounting', 'periods', 'global'],
      permissions: ['read:accounting-periods'],
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new AccountingPeriodService(ctx.serviceContext, { db: ctx.db });
      const period = await service.getPeriodById(input.id);

      if (!period) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Accounting period not found',
        });
      }

      return period;
    }),

  /**
   * Get period for a specific date
   */
  getByDate: authenticatedProcedure
    .input(
      z.object({
        subsidiaryId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new AccountingPeriodService(ctx.serviceContext, { db: ctx.db });
      return service.getPeriodForDate(input.subsidiaryId, input.date);
    }),

  /**
   * Check if posting is allowed for a date
   */
  checkPostingAllowed: authenticatedProcedure
    .input(
      z.object({
        subsidiaryId: z.string().uuid(),
        postingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        isAdjustment: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new AccountingPeriodService(ctx.serviceContext, { db: ctx.db });
      return service.checkPostingAllowed(input);
    }),

  /**
   * Get available fiscal years
   */
  fiscalYears: authenticatedProcedure.query(async ({ ctx }) => {
    const service = new AccountingPeriodService(ctx.serviceContext, { db: ctx.db });
    return service.getFiscalYears();
  }),

  /**
   * Get current open period for a subsidiary
   */
  currentOpen: authenticatedProcedure
    .input(z.object({ subsidiaryId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new AccountingPeriodService(ctx.serviceContext, { db: ctx.db });
      return service.getCurrentOpenPeriod(input.subsidiaryId);
    }),

  /**
   * Create a new accounting period
   */
  create: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('create_accounting_period', 'Create a new accounting period', {
      scopes: ['accounting', 'periods'],
      permissions: ['write:accounting-periods'],
      riskLevel: 'MEDIUM',
    }) })
    .input(createPeriodSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new AccountingPeriodService(ctx.serviceContext, { db: ctx.db });
      return service.createPeriod(input);
    }),

  /**
   * Create periods for an entire fiscal year
   */
  createFiscalYear: authenticatedProcedure
    .input(
      z.object({
        subsidiaryId: z.string().uuid(),
        fiscalYear: z.string().min(1),
        startMonth: z.number().int().min(1).max(12).default(1),
        yearStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        includeAdjustmentPeriod: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new AccountingPeriodService(ctx.serviceContext, { db: ctx.db });
      try {
        return await service.createFiscalYearPeriods(input);
      } catch (err: any) {
        // Log detailed error information to aid debugging, without changing client behaviour
        console.error('[accountingPeriods.createFiscalYear] Failed to create fiscal year periods', {
          input,
          message: err?.message,
          code: err?.code,
          stack: err?.stack,
        });
        throw err;
      }
    }),

  /**
   * Update period status (generic) - ADMIN ONLY
   * Status changes affect financial controls and require admin privileges
   */
  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: PeriodStatusEnum,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new AccountingPeriodService(ctx.serviceContext, { db: ctx.db });
      return service.updatePeriodStatus(input.id, { status: input.status });
    }),

  /**
   * Soft close a period - ADMIN ONLY
   * Prevents normal entries, allows adjustments
   */
  softClose: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new AccountingPeriodService(ctx.serviceContext, { db: ctx.db });
      return service.softClosePeriod(input.id);
    }),

  /**
   * Hard close a period - ADMIN ONLY
   * Prevents all entries except flagged adjustments
   */
  close: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new AccountingPeriodService(ctx.serviceContext, { db: ctx.db });
      return service.closePeriod(input.id);
    }),

  /**
   * Lock a period (permanent) - ADMIN ONLY
   * No further changes allowed - use with caution
   */
  lock: adminProcedure
    .meta({ ai: createWriteAIMeta('lock_accounting_period', 'Permanently lock an accounting period', {
      scopes: ['accounting', 'periods'],
      permissions: ['admin:accounting-periods'],
      riskLevel: 'HIGH',
      minimumRole: 'admin',
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new AccountingPeriodService(ctx.serviceContext, { db: ctx.db });
      return service.lockPeriod(input.id);
    }),

  /**
   * Reopen a soft-closed period - ADMIN ONLY
   * Allows normal entries again
   */
  reopen: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new AccountingPeriodService(ctx.serviceContext, { db: ctx.db });
      return service.reopenPeriod(input.id);
    }),

  /**
   * Delete a period (only if OPEN) - ADMIN ONLY
   */
  delete: adminProcedure
    .meta({ ai: createDeleteAIMeta('delete_accounting_period', 'Delete an open accounting period', {
      scopes: ['accounting', 'periods'],
      permissions: ['delete:accounting-periods'],
      riskLevel: 'HIGH',
      minimumRole: 'admin',
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new AccountingPeriodService(ctx.serviceContext, { db: ctx.db });
      await service.deletePeriod(input.id);
      return { success: true };
    }),
});
