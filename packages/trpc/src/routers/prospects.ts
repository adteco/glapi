import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { ProspectService } from '@glapi/api-service';

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
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new ProspectService(ctx.serviceContext);
      return await service.findById(input.id);
    }),

  create: authenticatedProcedure
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
    .input(z.object({
      id: z.string(),
      data: updateProspectSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProspectService(ctx.serviceContext);
      return await service.updateProspect(input.id, input.data);
    }),

  delete: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProspectService(ctx.serviceContext);
      return await service.delete(input.id);
    }),

  convertToLead: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProspectService(ctx.serviceContext);
      return await service.convertToLead(input.id);
    }),

  convertToCustomer: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProspectService(ctx.serviceContext);
      return await service.convertToCustomer(input.id);
    }),
});