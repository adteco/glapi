import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { ProjectReportingService } from '@glapi/api-service';

export const projectReportingRouter = router({
  jobCostSummary: authenticatedProcedure
    .input(
      z
        .object({
          projectId: z.string().uuid().optional(),
          subsidiaryId: z.string().uuid().optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new ProjectReportingService(ctx.serviceContext);
      return service.listJobCostSummary(input || {});
    }),

  progressHistory: authenticatedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        limit: z.number().int().positive().max(90).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new ProjectReportingService(ctx.serviceContext);
      return service.listProgressHistory(input.projectId, input.limit);
    }),

  /**
   * Get detailed budget vs actual variance report
   * Shows cost code level detail with variance analysis and cost type breakdown
   */
  budgetVariance: authenticatedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        budgetVersionId: z.string().uuid().optional(),
        costType: z.enum(['LABOR', 'MATERIAL', 'EQUIPMENT', 'SUBCONTRACT', 'OTHER']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new ProjectReportingService(ctx.serviceContext);
      return service.getBudgetVarianceReport({
        projectId: input.projectId,
        budgetVersionId: input.budgetVersionId,
        costType: input.costType,
      });
    }),
});
