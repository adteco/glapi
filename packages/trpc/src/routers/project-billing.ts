import { z } from 'zod';
import {
  ProjectBillingQueueService,
  ProjectBillingTransitionService,
  type CreateProjectInvoiceDraftsInput,
} from '@glapi/api-service';
import { uuidSchema } from '@glapi/types';
import { createReadOnlyAIMeta, createWriteAIMeta } from '../ai-meta';
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
  listInvoices: authenticatedProcedure
    .meta({
      ai: createReadOnlyAIMeta(
        'list_project_billing_invoices',
        'List project billing invoices with source allocation state and replacement lineage',
        {
          scopes: ['project-billing', 'invoices'],
          permissions: ['read:invoices'],
        },
      ),
    })
    .input(z.object({ status: z.enum(['draft', 'billed']).optional() }))
    .query(({ ctx, input }) => {
      const service = new ProjectBillingTransitionService(ctx.serviceContext, {
        db: ctx.db,
      });
      return service.listHistory(input.status);
    }),

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
      const service = new ProjectBillingQueueService(ctx.serviceContext, {
        db: ctx.db,
      });
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
          .array(
            z
              .string()
              .regex(
                /^(TIME_ENTRY|PROJECT_TASK|PROJECT_MILESTONE|PROJECT_PROGRESS):[0-9a-f-]{36}$/i,
              ),
          )
          .min(1)
          .optional(),
      }),
    )
    .query(({ ctx, input }) => {
      const service = new ProjectBillingQueueService(ctx.serviceContext, {
        db: ctx.db,
      });
      return service.previewInvoiceDrafts(input);
    }),

  createInvoiceDrafts: authenticatedProcedure
    .meta({
      ai: createWriteAIMeta(
        'create_project_invoice_drafts',
        'Create project invoice drafts transactionally from selected billing candidates',
        {
          scopes: ['project-billing', 'projects', 'invoices'],
          permissions: ['write:invoices'],
          riskLevel: 'HIGH',
        },
      ),
    })
    .input(
      filtersSchema.extend({
        idempotencyKey: z.string().trim().min(1).max(255),
        candidateIds: z
          .array(
            z
              .string()
              .regex(
                /^(TIME_ENTRY|PROJECT_TASK|PROJECT_MILESTONE|PROJECT_PROGRESS):[0-9a-f-]{36}$/i,
              ),
          )
          .min(1),
        invoiceDate: z.string().date(),
        dueDate: z.string().date().optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const service = new ProjectBillingQueueService(ctx.serviceContext, {
        db: ctx.db,
      });
      return service.createInvoiceDrafts(
        input as CreateProjectInvoiceDraftsInput,
      );
    }),

  transitionInvoice: authenticatedProcedure
    .meta({
      ai: createWriteAIMeta(
        'transition_project_billing_invoice',
        'Void, release, transfer, or rebill a project invoice while preserving allocation lineage',
        {
          scopes: ['project-billing', 'invoices'],
          permissions: ['write:invoices'],
          riskLevel: 'HIGH',
          minimumRole: 'manager',
        },
      ),
    })
    .input(
      z
        .object({
          invoiceId: uuidSchema,
          action: z.enum(['void', 'release', 'transfer', 'rebill']),
          reason: z.string().trim().min(3).max(1000),
          idempotencyKey: z.string().trim().min(1).max(255),
          targetInvoiceId: uuidSchema.optional(),
          invoiceDate: z.string().date().optional(),
          dueDate: z.string().date().optional(),
        })
        .superRefine((value, ctx) => {
          if (value.action === 'transfer' && !value.targetInvoiceId) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['targetInvoiceId'],
              message: 'Target draft invoice is required for transfer',
            });
          }
        }),
    )
    .mutation(({ ctx, input }) => {
      const service = new ProjectBillingTransitionService(ctx.serviceContext, {
        db: ctx.db,
      });
      return service.transition(input as {
        invoiceId: string;
        action: 'void' | 'release' | 'transfer' | 'rebill';
        reason: string;
        idempotencyKey: string;
        targetInvoiceId?: string;
        invoiceDate?: string;
        dueDate?: string;
      });
    }),
});
