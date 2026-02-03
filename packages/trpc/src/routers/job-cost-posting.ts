import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { JobCostPostingService } from '@glapi/api-service';
import { createWriteAIMeta } from '../ai-meta';

const laborEntrySchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  costCodeId: z.string().uuid(),
  amount: z.number(),
  entryDate: z.string(),
  subsidiaryId: z.string().uuid(),
  description: z.string().nullish(),
  currencyCode: z.string().nullish(),
});

const expenseEntrySchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  costCodeId: z.string().uuid(),
  amount: z.number(),
  expenseDate: z.string(),
  subsidiaryId: z.string().uuid(),
  description: z.string().nullish(),
  currencyCode: z.string().nullish(),
});

export const jobCostPostingRouter = router({
  /**
   * Post labor entries to the GL
   * Routes labor costs to WIP and expense accounts based on cost code configuration
   */
  postLabor: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('post_labor_entries', 'Post labor entries to the GL - routes labor costs to WIP and expense accounts', {
      scopes: ['job-costing', 'accounting', 'projects'],
      permissions: ['write:job-cost-posting'],
      riskLevel: 'MEDIUM',
    }) })
    .input(
      z.object({
        entries: z.array(laborEntrySchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new JobCostPostingService(ctx.serviceContext);
      const entries = input.entries.map((e) => ({
        id: e.id,
        projectId: e.projectId,
        costCodeId: e.costCodeId,
        amount: e.amount,
        entryDate: e.entryDate,
        subsidiaryId: e.subsidiaryId,
        description: e.description,
        currencyCode: e.currencyCode,
      }));
      return service.postLaborEntries(entries);
    }),

  /**
   * Post expense entries to the GL
   * Routes expense costs to WIP and expense accounts based on cost code configuration
   */
  postExpenses: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('post_expense_entries', 'Post expense entries to the GL - routes expense costs to WIP and expense accounts', {
      scopes: ['job-costing', 'accounting', 'projects'],
      permissions: ['write:job-cost-posting'],
      riskLevel: 'MEDIUM',
    }) })
    .input(
      z.object({
        entries: z.array(expenseEntrySchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new JobCostPostingService(ctx.serviceContext);
      const entries = input.entries.map((e) => ({
        id: e.id,
        projectId: e.projectId,
        costCodeId: e.costCodeId,
        amount: e.amount,
        expenseDate: e.expenseDate,
        subsidiaryId: e.subsidiaryId,
        description: e.description,
        currencyCode: e.currencyCode,
      }));
      return service.postExpenseEntries(entries);
    }),
});
