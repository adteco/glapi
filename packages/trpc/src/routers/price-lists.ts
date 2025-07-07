import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { PricingService } from '@glapi/api-service';

const priceListSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  description: z.string().optional(),
  currencyCode: z.string().min(3).max(3).default('USD'),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

const updatePriceListSchema = priceListSchema.partial();

const priceListQuerySchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  activeOnly: z.boolean().optional(),
});

const itemPricingSchema = z.object({
  itemId: z.string(),
  priceListId: z.string(),
  unitPrice: z.number().min(0),
  minQuantity: z.number().min(0).default(1),
  effectiveDate: z.date(),
  expirationDate: z.date().optional(),
});

const updateItemPricingSchema = itemPricingSchema.partial();

const assignCustomerPriceListSchema = z.object({
  customerId: z.string(),
  priceListId: z.string(),
  priority: z.number().min(1).default(1),
  effectiveDate: z.date().optional(),
  expirationDate: z.date().optional(),
});

const priceCalculationSchema = z.object({
  itemId: z.string(),
  customerId: z.string().optional(),
  quantity: z.number().min(1).default(1),
  date: z.date().default(() => new Date()),
});

export const priceListsRouter = router({
  list: authenticatedProcedure
    .input(priceListQuerySchema.optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.listPriceLists(input);
    }),

  getById: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.getPriceList(input.id);
    }),

  create: authenticatedProcedure
    .input(priceListSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.createPriceList(input);
    }),

  update: authenticatedProcedure
    .input(z.object({
      id: z.string(),
      data: updatePriceListSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.updatePriceList(input.id, input.data);
    }),

  delete: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.deletePriceList(input.id);
    }),

  getItems: authenticatedProcedure
    .input(z.object({
      priceListId: z.string(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(10),
    }))
    .query(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.getPriceListItems(input.priceListId, {
        page: input.page,
        limit: input.limit,
      });
    }),

  getItemPrices: authenticatedProcedure
    .input(z.object({
      itemId: z.string(),
      priceListId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.getItemPrices(input.itemId, input.priceListId);
    }),

  createItemPricing: authenticatedProcedure
    .input(itemPricingSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.createItemPricing(input);
    }),

  updateItemPricing: authenticatedProcedure
    .input(z.object({
      id: z.string(),
      data: updateItemPricingSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.updateItemPricing(input.id, input.data);
    }),

  deleteItemPricing: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.deleteItemPricing(input.id);
    }),

  assignToCustomer: authenticatedProcedure
    .input(assignCustomerPriceListSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.assignCustomerPriceList(input);
    }),

  removeFromCustomer: authenticatedProcedure
    .input(z.object({
      customerId: z.string(),
      priceListId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.removeCustomerPriceList(input.customerId, input.priceListId);
    }),

  calculatePrice: authenticatedProcedure
    .input(priceCalculationSchema)
    .query(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.calculatePrice(input);
    }),

  copyPrices: authenticatedProcedure
    .input(z.object({
      sourcePriceListId: z.string(),
      targetPriceListId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.copyPrices(input.sourcePriceListId, input.targetPriceListId);
    }),

  bulkUpdatePrices: authenticatedProcedure
    .input(z.object({
      priceListId: z.string(),
      updates: z.array(z.object({
        itemId: z.string(),
        unitPrice: z.number().min(0),
        minQuantity: z.number().min(0).optional(),
        effectiveDate: z.date().optional(),
        expirationDate: z.date().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.bulkUpdatePrices(
        input.priceListId, 
        input.updates.map(u => ({
          itemId: u.itemId,
          unitPrice: u.unitPrice,
          minQuantity: u.minQuantity,
          effectiveDate: u.effectiveDate,
          expirationDate: u.expirationDate,
        }))
      );
    }),
});