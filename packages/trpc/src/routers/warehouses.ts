import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { WarehousePricingService } from '@glapi/api-service';

const warehouseSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  name: z.string().min(1, 'Name is required'),
  locationId: z.string().optional(),
  isActive: z.boolean().default(true),
});

const updateWarehouseSchema = warehouseSchema.partial();

const warehouseQuerySchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  activeOnly: z.boolean().optional(),
});

const assignWarehousePriceListSchema = z.object({
  warehouseId: z.string(),
  priceListId: z.string(),
  priority: z.number().default(1),
  effectiveDate: z.date().optional(),
  expirationDate: z.date().optional(),
});

const assignCustomerWarehouseSchema = z.object({
  customerId: z.string(),
  itemId: z.string(),
  warehouseId: z.string(),
  isDefault: z.boolean().default(false),
  effectiveDate: z.date().optional(),
  expirationDate: z.date().optional(),
});

const getCustomerPriceSchema = z.object({
  customerId: z.string(),
  itemId: z.string(),
  quantity: z.number().optional(),
  date: z.date().optional(),
});

export const warehousesRouter = router({
  list: authenticatedProcedure
    .input(warehouseQuerySchema.optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new WarehousePricingService(ctx.serviceContext);
      return await service.listWarehouses(input);
    }),

  getById: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new WarehousePricingService(ctx.serviceContext);
      return await service.getWarehouse(input.id);
    }),

  create: authenticatedProcedure
    .input(warehouseSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new WarehousePricingService(ctx.serviceContext);
      return await service.createWarehouse({
        warehouseId: input.warehouseId,
        name: input.name,
        locationId: input.locationId,
        isActive: input.isActive,
      });
    }),

  update: authenticatedProcedure
    .input(z.object({
      id: z.string(),
      data: updateWarehouseSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new WarehousePricingService(ctx.serviceContext);
      return await service.updateWarehouse(input.id, input.data);
    }),

  delete: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new WarehousePricingService(ctx.serviceContext);
      return await service.deleteWarehouse(input.id);
    }),

  assignPriceList: authenticatedProcedure
    .input(assignWarehousePriceListSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new WarehousePricingService(ctx.serviceContext);
      return await service.assignWarehousePriceList({
        warehouseId: input.warehouseId,
        priceListId: input.priceListId,
        priority: input.priority,
        effectiveDate: input.effectiveDate,
        expirationDate: input.expirationDate,
      });
    }),

  getPriceLists: authenticatedProcedure
    .input(z.object({ 
      warehouseId: z.string(),
      date: z.date().optional()
    }))
    .query(async ({ ctx, input }) => {
      const service = new WarehousePricingService(ctx.serviceContext);
      return await service.getWarehousePriceLists(input.warehouseId, input.date);
    }),

  removePriceList: authenticatedProcedure
    .input(z.object({
      warehouseId: z.string(),
      priceListId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new WarehousePricingService(ctx.serviceContext);
      return await service.removeWarehousePriceList(input.warehouseId, input.priceListId);
    }),

  assignCustomer: authenticatedProcedure
    .input(assignCustomerWarehouseSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new WarehousePricingService(ctx.serviceContext);
      return await service.assignCustomerWarehouse({
        customerId: input.customerId,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        isDefault: input.isDefault,
        effectiveDate: input.effectiveDate,
        expirationDate: input.expirationDate,
      });
    }),

  getCustomerAssignments: authenticatedProcedure
    .input(z.object({ customerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new WarehousePricingService(ctx.serviceContext);
      return await service.getCustomerWarehouseAssignments(input.customerId);
    }),

  updateCustomerAssignment: authenticatedProcedure
    .input(z.object({
      id: z.string(),
      data: assignCustomerWarehouseSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new WarehousePricingService(ctx.serviceContext);
      return await service.updateCustomerWarehouseAssignment(input.id, input.data);
    }),

  removeCustomerAssignment: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new WarehousePricingService(ctx.serviceContext);
      return await service.removeCustomerWarehouseAssignment(input.id);
    }),

  getCustomerPrice: authenticatedProcedure
    .input(getCustomerPriceSchema)
    .query(async ({ ctx, input }) => {
      const service = new WarehousePricingService(ctx.serviceContext);
      return await service.getCustomerWarehousePrice({
        customerId: input.customerId,
        itemId: input.itemId,
        quantity: input.quantity,
        date: input.date,
      });
    }),

  bulkAssignCustomers: authenticatedProcedure
    .input(z.object({
      assignments: z.array(assignCustomerWarehouseSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new WarehousePricingService(ctx.serviceContext);
      return await service.bulkAssignCustomerWarehouses(
        input.assignments.map(a => ({
          customerId: a.customerId,
          itemId: a.itemId,
          warehouseId: a.warehouseId,
          isDefault: a.isDefault,
          effectiveDate: a.effectiveDate,
          expirationDate: a.expirationDate,
        }))
      );
    }),
});