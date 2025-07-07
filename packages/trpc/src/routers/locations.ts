import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { LocationService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

const locationSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
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
      const service = new LocationService(ctx.serviceContext);
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
      const service = new LocationService(ctx.serviceContext);
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
      const service = new LocationService(ctx.serviceContext);
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
      const service = new LocationService(ctx.serviceContext);
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
      const service = new LocationService(ctx.serviceContext);
      await service.deleteLocation(input.id);
      return { success: true };
    }),
});