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
});
