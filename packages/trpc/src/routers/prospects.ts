import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { ProspectService } from '@glapi/api-service';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';

const prospectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  entityId: z.string().optional(),
  isActive: z.boolean().default(true),
  legalName: z.string().optional(),
  taxIdNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
  metadata: z.object({
    prospect_source: z.string().optional(),
    prospect_status: z.string().optional(),
    qualification_score: z.number().min(0).max(100).optional(),
    next_action: z.string().optional(),
    follow_up_date: z.string().optional(),
  }).optional(),
});

const updateProspectSchema = prospectSchema.partial();

const prospectQuerySchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  search: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const prospectsRouter = router({
  list: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_prospects', 'Search and list sales prospects', {
      scopes: ['crm', 'prospects', 'global'],
      permissions: ['read:prospects'],
    }) })
    .input(prospectQuerySchema.optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new ProspectService(ctx.serviceContext);
      const { page = 1, limit = 10, search, isActive } = input;

      return await service.listProspects({
        page,
        limit,
        orderBy: 'name' as const,
        orderDirection: 'asc' as const,
        search,
        isActive,
      });
    }),

  getById: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_prospect', 'Get a single prospect by ID', {
      scopes: ['crm', 'prospects', 'global'],
      permissions: ['read:prospects'],
    }) })
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new ProspectService(ctx.serviceContext);
      return await service.findById(input.id);
    }),

  create: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('create_prospect', 'Create a new sales prospect', {
      scopes: ['crm', 'prospects'],
      permissions: ['write:prospects'],
      riskLevel: 'LOW',
    }) })
    .input(prospectSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProspectService(ctx.serviceContext);
      return await service.createProspect({
        ...input,
        status: 'active' as const,
        entityTypes: ['Prospect'] as const,
      });
    }),

  update: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('update_prospect', 'Update an existing prospect', {
      scopes: ['crm', 'prospects'],
      permissions: ['write:prospects'],
      riskLevel: 'LOW',
    }) })
    .input(z.object({
      id: z.string(),
      data: updateProspectSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProspectService(ctx.serviceContext);
      return await service.updateProspect(input.id, input.data);
    }),

  delete: authenticatedProcedure
    .meta({ ai: createDeleteAIMeta('delete_prospect', 'Delete a prospect', {
      scopes: ['crm', 'prospects'],
      permissions: ['delete:prospects'],
      riskLevel: 'MEDIUM',
    }) })
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProspectService(ctx.serviceContext);
      return await service.delete(input.id);
    }),

  convertToLead: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('convert_prospect_to_lead', 'Convert a prospect to a lead', {
      scopes: ['crm', 'prospects', 'leads'],
      permissions: ['write:prospects', 'write:leads'],
      riskLevel: 'LOW',
    }) })
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProspectService(ctx.serviceContext);
      return await service.convertToLead(input.id);
    }),

  convertToCustomer: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('convert_prospect_to_customer', 'Convert a prospect to a customer', {
      scopes: ['crm', 'prospects', 'customers'],
      permissions: ['write:prospects', 'write:customers'],
      riskLevel: 'MEDIUM',
    }) })
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProspectService(ctx.serviceContext);
      return await service.convertToCustomer(input.id);
    }),
});