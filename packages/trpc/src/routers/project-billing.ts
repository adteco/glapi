import { z } from 'zod';
import { ProjectBillingQueueService } from '@glapi/api-service';
import { uuidSchema } from '@glapi/types';
import { createReadOnlyAIMeta } from '../ai-meta';
import { authenticatedProcedure, router } from '../trpc';

const sourceTypeSchema = z.enum([
  'TIME_ENTRY',
  'PROJECT_TASK',
  'PROJECT_MILESTONE',
  'PROJECT_PROGRESS',
]);

const filtersSchema = z.object({
  customerId: uuidSchema.optional(),
  projectId: uuidSchema.optional(),
  sourceTypes: z.array(sourceTypeSchema).min(1).optional(),
  asOfDate: z.string().date().optional(),
});

export const projectBillingRouter = router({
  listCandidates: authenticatedProcedure
    .meta({
      ai: createReadOnlyAIMeta(
        'list_project_billing_candidates',
        'List approved, unallocated project work eligible for billing',
        {
          scopes: ['project-billing', 'projects', 'invoices'],
          permissions: ['read:invoices'],
        },
      ),
    })
    .input(
      filtersSchema.extend({
        page: z.number().int().positive().default(1),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(({ ctx, input }) => {
      const service = new ProjectBillingQueueService(ctx.serviceContext, { db: ctx.db });
      const { page, limit, ...filters } = input;
      return service.listCandidates({ page, limit }, filters);
    }),

  previewInvoiceDrafts: authenticatedProcedure
    .meta({
      ai: createReadOnlyAIMeta(
        'preview_project_invoice_drafts',
        'Preview project invoice grouping, line calculations, and totals without creating invoices',
        {
          scopes: ['project-billing', 'projects', 'invoices'],
          permissions: ['read:invoices'],
        },
      ),
    })
    .input(
      filtersSchema.extend({
        candidateIds: z
          .array(z.string().regex(/^(TIME_ENTRY|PROJECT_TASK|PROJECT_MILESTONE|PROJECT_PROGRESS):[0-9a-f-]{36}$/i))
          .min(1)
          .optional(),
      }),
    )
    .query(({ ctx, input }) => {
      const service = new ProjectBillingQueueService(ctx.serviceContext, { db: ctx.db });
      return service.previewInvoiceDrafts(input);
    }),
});
