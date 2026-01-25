import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { VendorService } from '@glapi/api-service';

const vendorSchema = z.object({
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
    ein: z.string().optional(),
    vendor_type: z.string().optional(),
    terms: z.string().optional(),
    creditLimit: z.number().optional(),
  }).optional(),
});

const updateVendorSchema = vendorSchema.partial();

const vendorQuerySchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  search: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const vendorsRouter = router({
  list: authenticatedProcedure
    .input(vendorQuerySchema.optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new VendorService(ctx.serviceContext);
      const { page = 1, limit = 10, search, isActive } = input;

      return await service.listVendors({
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
      const service = new VendorService(ctx.serviceContext);
      return await service.findById(input.id);
    }),

  create: authenticatedProcedure
    .input(vendorSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new VendorService(ctx.serviceContext);
      return await service.createVendor({
        ...input,
        status: 'active' as const,
        entityTypes: ['Vendor'] as const,
      });
    }),

  update: authenticatedProcedure
    .input(z.object({
      id: z.string(),
      data: updateVendorSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new VendorService(ctx.serviceContext);
      return await service.updateVendor(input.id, input.data);
    }),

  delete: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new VendorService(ctx.serviceContext);
      return await service.delete(input.id);
    }),

  findByEIN: authenticatedProcedure
    .input(z.object({ ein: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new VendorService(ctx.serviceContext);
      return await service.findByEIN(input.ein);
    }),
});