import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { LocationService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';

const locationSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  description: z.string().optional(),
  subsidiaryId: z.string(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  stateProvince: z.string().optional(),
  postalCode: z.string().optional(),
  countryCode: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const locationsRouter = router({
  list: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_locations', 'Search and list locations', {
      scopes: ['accounting', 'dimensions', 'global'],
      permissions: ['read:locations'],
    }) })
    .input(
      z.object({
        includeInactive: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new LocationService(ctx.serviceContext, { db: ctx.db });
      const result = await service.listLocations(
        { page: 1, limit: 100 },
        'name',
        'asc'
      );
      return result.data;
    }),

  get: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_location', 'Get a single location by ID', {
      scopes: ['accounting', 'dimensions', 'global'],
      permissions: ['read:locations'],
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new LocationService(ctx.serviceContext, { db: ctx.db });
      const location = await service.getLocationById(input.id);
      
      if (!location) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Location not found',
        });
      }
      
      return location;
    }),

  create: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('create_location', 'Create a new location', {
      scopes: ['accounting', 'dimensions'],
      permissions: ['write:locations'],
      riskLevel: 'MEDIUM',
    }) })
    .input(locationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new LocationService(ctx.serviceContext, { db: ctx.db });
      return service.createLocation({
        ...input,
        organizationId: ctx.serviceContext!.organizationId,
      });
    }),

  update: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('update_location', 'Update an existing location', {
      scopes: ['accounting', 'dimensions'],
      permissions: ['write:locations'],
      riskLevel: 'MEDIUM',
    }) })
    .input(
      z.object({
        id: z.string().uuid(),
        data: locationSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new LocationService(ctx.serviceContext, { db: ctx.db });
      const updated = await service.updateLocation(input.id, input.data);
      
      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Location not found',
        });
      }
      
      return updated;
    }),

  delete: authenticatedProcedure
    .meta({ ai: createDeleteAIMeta('delete_location', 'Delete a location', {
      scopes: ['accounting'],
      permissions: ['delete:locations'],
      riskLevel: 'HIGH',
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new LocationService(ctx.serviceContext, { db: ctx.db });
      await service.deleteLocation(input.id);
      return { success: true };
    }),
});