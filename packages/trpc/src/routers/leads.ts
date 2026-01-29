import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { createServiceFactory } from '@glapi/api-service';
import { leadProspectMetadataSchema } from '@glapi/types';

const leadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  displayName: z.string().optional(),
  entityId: z.string().optional(),
  isActive: z.boolean().default(true),
  legalName: z.string().optional(),
  taxIdNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
  metadata: leadProspectMetadataSchema.optional(),
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
      const services = createServiceFactory(ctx);
      const { page = 1, limit = 10, search, isActive } = input;

      return await services.lead.listLeads({
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
      const services = createServiceFactory(ctx);
      return await services.lead.findById(input.id);
    }),

  // Alias for getById (some components use get)
  get: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const services = createServiceFactory(ctx);
      return await services.lead.findById(input.id);
    }),

  create: authenticatedProcedure
    .input(leadSchema)
    .mutation(async ({ ctx, input }) => {
      const services = createServiceFactory(ctx);
      return await services.lead.createLead({
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
      const services = createServiceFactory(ctx);
      return await services.lead.updateLead(input.id, input.data);
    }),

  delete: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const services = createServiceFactory(ctx);
      return await services.lead.delete(input.id);
    }),

  convertToCustomer: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const services = createServiceFactory(ctx);
      return await services.lead.convertToCustomer(input.id);
    }),
});