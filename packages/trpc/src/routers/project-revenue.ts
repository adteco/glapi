import { ProjectRevenuePlanService } from '@glapi/api-service';
import { uuidSchema } from '@glapi/types';
import { z } from 'zod';
import { createReadOnlyAIMeta, createWriteAIMeta } from '../ai-meta';
import { authenticatedProcedure, router } from '../trpc';

const versionInput = z.object({ projectContractVersionId: uuidSchema });

export const projectRevenueRouter = router({
  previewPlan: authenticatedProcedure
    .meta({
      ai: createReadOnlyAIMeta(
        'preview_project_revenue_plan',
        'Preview ASC 606 obligations, SSP allocations, and revenue schedules for a project contract',
        {
          scopes: ['project-revenue', 'project-contracts', 'asc-606'],
          permissions: ['read:revenue'],
        },
      ),
    })
    .input(versionInput)
    .query(({ ctx, input }) => {
      const service = new ProjectRevenuePlanService(ctx.serviceContext, { db: ctx.db });
      return service.previewPlan(input.projectContractVersionId);
    }),

  generatePlan: authenticatedProcedure
    .meta({
      ai: createWriteAIMeta(
        'generate_project_revenue_plan',
        'Generate version-linked ASC 606 obligations, SSP allocations, and revenue schedules',
        {
          scopes: ['project-revenue', 'project-contracts', 'asc-606'],
          permissions: ['write:revenue'],
          riskLevel: 'MEDIUM',
        },
      ),
    })
    .input(versionInput)
    .mutation(({ ctx, input }) => {
      const service = new ProjectRevenuePlanService(ctx.serviceContext, { db: ctx.db });
      return service.generatePlan(input.projectContractVersionId);
    }),

  getPlan: authenticatedProcedure
    .meta({
      ai: createReadOnlyAIMeta(
        'get_project_revenue_plan',
        'Get project ASC 606 obligations, allocations, schedules, and waterfall',
        {
          scopes: ['project-revenue', 'project-contracts', 'asc-606'],
          permissions: ['read:revenue'],
        },
      ),
    })
    .input(versionInput)
    .query(({ ctx, input }) => {
      const service = new ProjectRevenuePlanService(ctx.serviceContext, { db: ctx.db });
      return service.getPlan(input.projectContractVersionId);
    }),
});
