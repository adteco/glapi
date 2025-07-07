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
      const service = new ProspectService();
      const { page, limit, search, isActive } = input;
      
      return await service.listProspects(ctx.user.organizationId, {
        page,
        limit,
        search,
        isActive,
      });
    }),

  getById: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new ProspectService();
      return await service.findById(input.id, ctx.user.organizationId);
    }),

  create: authenticatedProcedure
    .input(prospectSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProspectService();
      return await service.createProspect(ctx.user.organizationId, input);
    }),

  update: authenticatedProcedure
    .input(z.object({
      id: z.string(),
      data: updateProspectSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProspectService();
      return await service.updateProspect(input.id, ctx.user.organizationId, input.data);
    }),

  delete: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProspectService();
      return await service.delete(input.id, ctx.user.organizationId);
    }),
});