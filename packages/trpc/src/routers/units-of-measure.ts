import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { UnitsOfMeasureService } from '@glapi/api-service';

const unitOfMeasureSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  abbreviation: z.string().min(1, 'Abbreviation is required'),
  baseUnitId: z.string().optional(),
  baseConversionFactor: z.number().default(1),
  decimalPlaces: z.number().default(2),
});

const updateUnitOfMeasureSchema = unitOfMeasureSchema.partial();

const unitOfMeasureQuerySchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  unitType: z.string().optional(),
  activeOnly: z.boolean().optional(),
});

export const unitsOfMeasureRouter = router({
  list: authenticatedProcedure
    .input(unitOfMeasureQuerySchema.optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new UnitsOfMeasureService(ctx.serviceContext);
      return await service.listUnitsOfMeasure(input);
    }),

  getById: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new UnitsOfMeasureService(ctx.serviceContext);
      return await service.getUnitsOfMeasure(input.id);
    }),

  create: authenticatedProcedure
    .input(unitOfMeasureSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new UnitsOfMeasureService(ctx.serviceContext);
      return await service.createUnitsOfMeasure(input);
    }),

  update: authenticatedProcedure
    .input(z.object({
      id: z.string(),
      data: updateUnitOfMeasureSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new UnitsOfMeasureService(ctx.serviceContext);
      return await service.updateUnitsOfMeasure(input.id, input.data);
    }),

  delete: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new UnitsOfMeasureService(ctx.serviceContext);
      return await service.deleteUnitsOfMeasure(input.id);
    }),

  convertQuantity: authenticatedProcedure
    .input(z.object({
      quantity: z.number(),
      fromUnitId: z.string(),
      toUnitId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const service = new UnitsOfMeasureService(ctx.serviceContext);
      return await service.convertQuantity(input.fromUnitId, input.toUnitId, input.quantity);
    }),
});