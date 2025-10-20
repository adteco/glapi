import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { LeadService } from '@glapi/api-service';

const leadSchema = z.object({
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
    lead_source: z.string().optional(),
    lead_status: z.string().optional(),
    estimated_value: z.number().optional(),
    probability: z.number().min(0).max(100).optional(),
    expected_close_date: z.string().optional(),
  }).optional(),
});

const updateLeadSchema = leadSchema.partial();

const leadQuerySchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  search: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const leadsRouter = router({
  list: authenticatedProcedure
    .input(leadQuerySchema.optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new LeadService();
      const { page = 1, limit = 10, search, isActive } = input;

      return await service.listLeads(ctx.user.organizationId, {
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
      const service = new LeadService();
      return await service.findById(input.id, ctx.user.organizationId);
    }),

  create: authenticatedProcedure
    .input(leadSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new LeadService();
      return await service.createLead(ctx.user.organizationId, {
        ...input,
        status: 'active' as const,
        entityTypes: ['Lead'] as const,
      });
    }),

  update: authenticatedProcedure
    .input(z.object({
      id: z.string(),
      data: updateLeadSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new LeadService();
      return await service.updateLead(input.id, ctx.user.organizationId, input.data);
    }),

  delete: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new LeadService();
      return await service.delete(input.id, ctx.user.organizationId);
    }),

  convertToCustomer: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new LeadService();
      return await service.convertToCustomer(input.id, ctx.user.organizationId);
    }),
});