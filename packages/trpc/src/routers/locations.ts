import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { LocationService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

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
    .input(locationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new LocationService(ctx.serviceContext, { db: ctx.db });
      return service.createLocation({
        ...input,
        organizationId: ctx.serviceContext!.organizationId,
      });
    }),

  update: authenticatedProcedure
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
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new LocationService(ctx.serviceContext, { db: ctx.db });
      await service.deleteLocation(input.id);
      return { success: true };
    }),
});