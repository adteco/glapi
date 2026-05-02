import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { VendorService } from '@glapi/api-service';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';

const vendorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  entityId: z.string().optional(),
  isActive: z.boolean().default(true),
  displayName: z.string().optional(),
  code: z.string().optional(),
  legalName: z.string().optional(),
  taxId: z.string().optional(),
  taxIdNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  description: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  address: z.object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    stateProvince: z.string().optional(),
    postalCode: z.string().optional(),
    countryCode: z.string().length(2).optional(),
  }).optional(),
  metadata: z.object({
    ein: z.string().optional(),
    vendor_type: z.string().optional(),
    terms: z.string().optional(),
    w9OnFile: z.boolean().optional(),
    defaultExpenseAccount: z.string().optional(),
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

const getVendorByIdProcedure = authenticatedProcedure
  .meta({ ai: createReadOnlyAIMeta('get_vendor', 'Get a single vendor by ID', {
    scopes: ['vendors', 'purchasing', 'global'],
    permissions: ['read:vendors'],
  }) })
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const service = new VendorService(ctx.serviceContext, { db: ctx.db });
    return await service.findById(input.id);
  });

export const vendorsRouter = router({
  list: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_vendors', 'Search and list vendor records', {
      scopes: ['vendors', 'purchasing', 'global'],
      permissions: ['read:vendors'],
    }) })
    .input(vendorQuerySchema.optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new VendorService(ctx.serviceContext, { db: ctx.db });
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

  get: getVendorByIdProcedure,

  getById: getVendorByIdProcedure,

  create: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('create_vendor', 'Create a new vendor record', {
      scopes: ['vendors', 'purchasing'],
      permissions: ['write:vendors'],
      riskLevel: 'MEDIUM',
    }) })
    .input(vendorSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new VendorService(ctx.serviceContext, { db: ctx.db });
      return await service.createVendor({
        ...input,
        status: 'active' as const,
        entityTypes: ['Vendor'] as const,
      });
    }),

  update: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('update_vendor', 'Update an existing vendor record', {
      scopes: ['vendors', 'purchasing'],
      permissions: ['write:vendors'],
      riskLevel: 'MEDIUM',
    }) })
    .input(z.object({
      id: z.string(),
      data: updateVendorSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new VendorService(ctx.serviceContext, { db: ctx.db });
      return await service.updateVendor(input.id, input.data);
    }),

  delete: authenticatedProcedure
    .meta({ ai: createDeleteAIMeta('delete_vendor', 'Delete a vendor record', {
      scopes: ['vendors'],
      permissions: ['delete:vendors'],
      riskLevel: 'HIGH',
    }) })
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new VendorService(ctx.serviceContext, { db: ctx.db });
      return await service.delete(input.id);
    }),

  findByEIN: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('find_vendor_by_ein', 'Find a vendor by EIN/tax ID number', {
      scopes: ['vendors', 'purchasing'],
      permissions: ['read:vendors'],
    }) })
    .input(z.object({ ein: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new VendorService(ctx.serviceContext, { db: ctx.db });
      return await service.findByEIN(input.ein);
    }),
});
