import {
  ProjectRevenuePlanService,
  ProjectRevenueRecognitionRunService,
} from '@glapi/api-service';
import { uuidSchema } from '@glapi/types';
import { z } from 'zod';
import { createReadOnlyAIMeta, createWriteAIMeta } from '../ai-meta';
import { authenticatedProcedure, router } from '../trpc';

const versionInput = z.object({ projectContractVersionId: uuidSchema });
const recognitionRunInput = z.object({
  subsidiaryId: uuidSchema,
  accountingPeriodId: uuidSchema,
  recognitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduleIds: z.array(uuidSchema).optional(),
});

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

  previewRecognitionRun: authenticatedProcedure
    .meta({
      ai: createReadOnlyAIMeta(
        'preview_project_revenue_recognition_run',
        'Preview eligible project schedules and reconciled recognition totals for an open period',
        {
          scopes: ['project-revenue', 'accounting', 'asc-606'],
          permissions: ['read:revenue'],
        },
      ),
    })
    .input(recognitionRunInput)
    .query(({ ctx, input }) => {
      const service = new ProjectRevenueRecognitionRunService(ctx.serviceContext, { db: ctx.db });
      return service.previewRun({
        subsidiaryId: input.subsidiaryId!,
        accountingPeriodId: input.accountingPeriodId!,
        recognitionDate: input.recognitionDate!,
        scheduleIds: input.scheduleIds,
      });
    }),

  executeRecognitionRun: authenticatedProcedure
    .meta({
      ai: createWriteAIMeta(
        'execute_project_revenue_recognition_run',
        'Atomically recognize eligible project revenue schedules for an open accounting period',
        {
          scopes: ['project-revenue', 'accounting', 'asc-606'],
          permissions: ['write:revenue'],
          riskLevel: 'HIGH',
        },
      ),
    })
    .input(
      recognitionRunInput.extend({
        idempotencyKey: z.string().trim().min(1).max(255),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { idempotencyKey, ...request } = input;
      const service = new ProjectRevenueRecognitionRunService(ctx.serviceContext, { db: ctx.db });
      return service.executeRun(
        {
          subsidiaryId: request.subsidiaryId!,
          accountingPeriodId: request.accountingPeriodId!,
          recognitionDate: request.recognitionDate!,
          scheduleIds: request.scheduleIds,
        },
        idempotencyKey,
      );
    }),
});
