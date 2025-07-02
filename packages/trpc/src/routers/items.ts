import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { ItemsService, ItemCategoriesService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

const itemSchema = z.object({
  itemCode: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  unitOfMeasureId: z.string().uuid().optional().nullable(),
  defaultPrice: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  isActive: z.boolean().default(true),
  isSerialized: z.boolean().default(false),
  isLotTracked: z.boolean().default(false),
  reorderPoint: z.number().min(0).optional(),
  reorderQuantity: z.number().min(0).optional(),
  leadTimeDays: z.number().min(0).optional(),
});

const variantSchema = z.object({
  variantCode: z.string().min(1),
  variantName: z.string().min(1),
  attributes: z.record(z.string()).optional(),
  additionalPrice: z.number().default(0),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const itemsRouter = router({
  list: authenticatedProcedure
    .input(
      z.object({
        categoryId: z.string().uuid().optional(),
        includeInactive: z.boolean().optional(),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new ItemsService(ctx.serviceContext);
      
      const result = await service.listItems({
        page: 1, 
        limit: 100
      });
      
      return result.data;
    }),

  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ItemsService(ctx.serviceContext);
      return service.getItem(input.id);
    }),

  create: authenticatedProcedure
    .input(itemSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ItemsService(ctx.serviceContext);
      return service.createItem(input);
    }),

  update: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: itemSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ItemsService(ctx.serviceContext);
      return service.updateItem(input.id, input.data);
    }),

  delete: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ItemsService(ctx.serviceContext);
      await service.deleteItem(input.id);
      return { success: true };
    }),

  // Variants sub-router - simplified for now
  variants: router({
    list: authenticatedProcedure
      .input(z.object({ itemId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        // TODO: Implement when ItemVariantService is available
        return [];
      }),
  }),

  // Categories sub-router
  categories: router({
    list: authenticatedProcedure.query(async ({ ctx }) => {
      const service = new ItemCategoriesService(ctx.serviceContext);
      const result = await service.listCategories({
        page: 1, 
        limit: 100
      });
      return result.data;
    }),

    tree: authenticatedProcedure.query(async ({ ctx }) => {
      const service = new ItemCategoriesService(ctx.serviceContext);
      return service.getCategoryTree();
    }),

    create: authenticatedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          parentId: z.string().uuid().optional().nullable(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const service = new ItemCategoriesService(ctx.serviceContext);
        return service.createCategory(input);
      }),
  }),

  // Pricing sub-router - simplified for now
  pricing: router({
    getForItem: authenticatedProcedure
      .input(z.object({ itemId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        // TODO: Implement pricing logic
        return [];
      }),
  }),
});