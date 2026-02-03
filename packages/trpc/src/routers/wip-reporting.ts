import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { WipReportingService } from '@glapi/api-service';
import { createReadOnlyAIMeta, createWriteAIMeta } from '../ai-meta';

export const wipReportingRouter = router({
  /**
   * Get WIP summary for all projects
   */
  getWipSummary: protectedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_wip_summary', 'Get WIP summary for projects', {
      scopes: ['wip-reporting', 'projects', 'construction', 'reporting'],
      permissions: ['read:wip-reporting'],
    }) })
    .input(
      z
        .object({
          projectId: z.string().uuid().optional(),
          subsidiaryId: z.string().uuid().optional(),
          status: z.string().optional(),
          hasUnderbillings: z.boolean().optional(),
          hasOverbillings: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new WipReportingService({ organizationId: ctx.organizationId });
      return service.getWipSummary(input ?? {});
    }),

  /**
   * Get percent complete data for all projects
   */
  getPercentComplete: protectedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_percent_complete', 'Get percent complete data for projects', {
      scopes: ['wip-reporting', 'projects', 'construction', 'reporting'],
      permissions: ['read:wip-reporting'],
    }) })
    .input(
      z
        .object({
          projectId: z.string().uuid().optional(),
          subsidiaryId: z.string().uuid().optional(),
          minPercentComplete: z.number().min(0).max(100).optional(),
          maxPercentComplete: z.number().min(0).max(100).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new WipReportingService({ organizationId: ctx.organizationId });
      return service.getPercentComplete(input ?? {});
    }),

  /**
   * Get retainage aging report
   */
  getRetainageAging: protectedProcedure
    .input(
      z
        .object({
          projectId: z.string().uuid().optional(),
          subsidiaryId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new WipReportingService({ organizationId: ctx.organizationId });
      return service.getRetainageAging(input ?? {});
    }),

  /**
   * Get combined WIP dashboard data
   */
  getWipDashboard: protectedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_wip_dashboard', 'Get combined WIP dashboard data', {
      scopes: ['wip-reporting', 'projects', 'construction', 'reporting'],
      permissions: ['read:wip-reporting'],
    }) })
    .input(
      z
        .object({
          projectId: z.string().uuid().optional(),
          subsidiaryId: z.string().uuid().optional(),
          status: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new WipReportingService({ organizationId: ctx.organizationId });
      return service.getWipDashboard(input ?? {});
    }),

  /**
   * Get combined percent complete dashboard data
   */
  getPercentCompleteDashboard: protectedProcedure
    .input(
      z
        .object({
          projectId: z.string().uuid().optional(),
          subsidiaryId: z.string().uuid().optional(),
          minPercentComplete: z.number().min(0).max(100).optional(),
          maxPercentComplete: z.number().min(0).max(100).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new WipReportingService({ organizationId: ctx.organizationId });
      return service.getPercentCompleteDashboard(input ?? {});
    }),

  /**
   * Trigger refresh of materialized views
   */
  refreshViews: protectedProcedure
    .meta({ ai: createWriteAIMeta('refresh_wip_views', 'Trigger refresh of WIP materialized views', {
      scopes: ['wip-reporting', 'reporting'],
      permissions: ['write:wip-reporting'],
      riskLevel: 'LOW',
    }) })
    .input(
      z
        .object({
          triggeredBy: z.string().optional(),
        })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      const service = new WipReportingService({ organizationId: ctx.organizationId });
      return service.refreshViews(input?.triggeredBy ?? `user:${ctx.user!.id}`);
    }),

  /**
   * Get refresh history for monitoring
   */
  getRefreshHistory: protectedProcedure
    .input(
      z
        .object({
          viewName: z.string().optional(),
          limit: z.number().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new WipReportingService({ organizationId: ctx.organizationId });
      return service.getRefreshHistory(input?.viewName, input?.limit ?? 10);
    }),

  /**
   * Get last refresh time for a specific view
   */
  getLastRefreshTime: protectedProcedure
    .input(
      z.object({
        viewName: z.enum([
          'project_wip_summary',
          'project_percent_complete',
          'project_retainage_aging',
        ]),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new WipReportingService({ organizationId: ctx.organizationId });
      return service.getLastRefreshTime(input.viewName);
    }),
});
