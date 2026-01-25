import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { ContactService } from '@glapi/api-service';

const contactSchema = z.object({
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
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    title: z.string().optional(),
    company: z.string().optional(),
    contact_type: z.string().optional(),
    preferred_communication: z.string().optional(),
  }).optional(),
});

const updateContactSchema = contactSchema.partial();

const contactQuerySchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  search: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const contactsRouter = router({
  list: authenticatedProcedure
    .input(contactQuerySchema.optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new ContactService(ctx.serviceContext);
      const { page = 1, limit = 10, search, isActive } = input;

      return await service.listContacts({
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
      const service = new ContactService(ctx.serviceContext);
      return await service.findById(input.id);
    }),

  create: authenticatedProcedure
    .input(contactSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ContactService(ctx.serviceContext);
      return await service.createContact({
        ...input,
        status: 'active' as const,
        entityTypes: ['Contact'] as const,
      });
    }),

  update: authenticatedProcedure
    .input(z.object({
      id: z.string(),
      data: updateContactSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ContactService(ctx.serviceContext);
      return await service.updateContact(input.id, input.data);
    }),

  delete: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ContactService(ctx.serviceContext);
      return await service.delete(input.id);
    }),
});