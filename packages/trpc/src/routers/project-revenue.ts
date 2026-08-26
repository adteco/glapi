import {
  ProjectRevenuePlanService,
  ProjectRevenueRecognitionRunService,
  ProjectRevenueGlPostingService,
  ProjectContractModificationService,
  ProjectRevenueRecognitionReversalService,
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
const modificationInput = z.object({
  priorVersionId: uuidSchema,
  revisedVersionId: uuidSchema,
  method: z.enum(['prospective', 'cumulative_catch_up', 'separate_contract']),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  progressPercentage: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  reason: z.string().trim().min(1).max(2000),
});

export const projectRevenueRouter = router({
  previewContractModification: authenticatedProcedure
    .meta({
      ai: createReadOnlyAIMeta(
        'preview_project_contract_modification',
        'Classify and preview the ASC 606 catch-up and replacement schedules for a project-contract modification',
        {
          scopes: ['project-revenue', 'project-contracts', 'asc-606'],
          permissions: ['read:revenue'],
        },
      ),
    })
    .input(modificationInput)
    .query(({ ctx, input }) => {
      const service = new ProjectContractModificationService(ctx.serviceContext, { db: ctx.db });
      return service.previewModification({
        priorVersionId: input.priorVersionId!,
        revisedVersionId: input.revisedVersionId!,
        method: input.method!,
        effectiveDate: input.effectiveDate!,
        progressPercentage: input.progressPercentage,
        reason: input.reason!,
      });
    }),

  applyContractModification: authenticatedProcedure
    .meta({
      ai: createWriteAIMeta(
        'apply_project_contract_modification',
        'Atomically supersede future schedules, approve a replacement contract version, and record the ASC 606 catch-up',
        {
          scopes: ['project-revenue', 'project-contracts', 'asc-606'],
          permissions: ['write:revenue'],
          riskLevel: 'HIGH',
        },
      ),
    })
    .input(modificationInput.extend({ idempotencyKey: z.string().trim().min(1).max(255) }))
    .mutation(({ ctx, input }) => {
      const { idempotencyKey, ...request } = input;
      const service = new ProjectContractModificationService(ctx.serviceContext, { db: ctx.db });
      return service.applyModification({
        priorVersionId: request.priorVersionId!,
        revisedVersionId: request.revisedVersionId!,
        method: request.method!,
        effectiveDate: request.effectiveDate!,
        progressPercentage: request.progressPercentage,
        reason: request.reason!,
      }, idempotencyKey);
    }),

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

  reverseRecognitionRun: authenticatedProcedure
    .meta({
      ai: createWriteAIMeta(
        'reverse_project_revenue_recognition_run',
        'Reverse a posted project revenue recognition run into an open period with exact opposite GL lines',
        {
          scopes: ['project-revenue', 'accounting', 'general-ledger'],
          permissions: ['write:revenue', 'write:gl'],
          riskLevel: 'HIGH',
        },
      ),
    })
    .input(z.object({
      subsidiaryId: uuidSchema,
      originalRunId: uuidSchema,
      accountingPeriodId: uuidSchema,
      reversalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reason: z.string().trim().min(1).max(2000),
      idempotencyKey: z.string().trim().min(1).max(255),
    }))
    .mutation(({ ctx, input }) => {
      const { idempotencyKey, ...request } = input;
      const service = new ProjectRevenueRecognitionReversalService(ctx.serviceContext, { db: ctx.db });
      return service.reverseRun({
        subsidiaryId: request.subsidiaryId!,
        originalRunId: request.originalRunId!,
        accountingPeriodId: request.accountingPeriodId!,
        reversalDate: request.reversalDate!,
        reason: request.reason!,
      }, idempotencyKey);
    }),

  postRecognitionRun: authenticatedProcedure
    .meta({
      ai: createWriteAIMeta(
        'post_project_revenue_recognition_run',
        'Post a completed project revenue recognition run to balanced GL transactions',
        {
          scopes: ['project-revenue', 'accounting', 'general-ledger'],
          permissions: ['write:revenue', 'write:gl'],
          riskLevel: 'HIGH',
        },
      ),
    })
    .input(
      z.object({
        recognitionRunId: uuidSchema,
        idempotencyKey: z.string().trim().min(1).max(255),
      }),
    )
    .mutation(({ ctx, input }) => {
      const service = new ProjectRevenueGlPostingService(ctx.serviceContext, { db: ctx.db });
      return service.postRecognitionRun(input.recognitionRunId!, input.idempotencyKey);
    }),

  postProjectInvoice: authenticatedProcedure
    .meta({
      ai: createWriteAIMeta(
        'post_project_invoice_to_gl',
        'Post an issued project invoice to AR and the contract asset or liability position',
        {
          scopes: ['project-billing', 'accounting', 'general-ledger'],
          permissions: ['write:billing', 'write:gl'],
          riskLevel: 'HIGH',
        },
      ),
    })
    .input(
      z.object({
        invoiceId: uuidSchema,
        idempotencyKey: z.string().trim().min(1).max(255),
      }),
    )
    .mutation(({ ctx, input }) => {
      const service = new ProjectRevenueGlPostingService(ctx.serviceContext, { db: ctx.db });
      return service.postProjectInvoice(input.invoiceId!, input.idempotencyKey);
    }),
});
