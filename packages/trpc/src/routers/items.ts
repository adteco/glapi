import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { ItemsService, ItemCategoriesService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

const itemSchema = z.object({
  itemCode: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  itemType: z.enum(['INVENTORY_ITEM', 'NON_INVENTORY_ITEM', 'SERVICE', 'CHARGE', 'DISCOUNT', 'TAX', 'ASSEMBLY', 'KIT']).default('INVENTORY_ITEM'),
  categoryId: z.string().uuid().optional().nullable(),
  unitOfMeasureId: z.string().uuid(),
  defaultPrice: z.number().min(0).optional(),
  defaultCost: z.number().min(0).optional(),
  sku: z.string().optional(),
  upc: z.string().optional(),
  isActive: z.boolean().default(true),
  isTaxable: z.boolean().default(true),
  isPurchasable: z.boolean().default(true),
  isSaleable: z.boolean().default(true),
  trackQuantity: z.boolean().default(false),
  trackLotNumbers: z.boolean().default(false),
  trackSerialNumbers: z.boolean().default(false),
  isParent: z.boolean().default(false),
  parentItemId: z.string().uuid().optional().nullable(),
  variantAttributes: z.record(z.string()).optional(),
  incomeAccountId: z.string().uuid().optional().nullable(),
  expenseAccountId: z.string().uuid().optional().nullable(),
  assetAccountId: z.string().uuid().optional().nullable(),
  cogsAccountId: z.string().uuid().optional().nullable(),
  taxCode: z.string().optional(),
  manufacturerPartNumber: z.string().optional(),
  weight: z.number().positive().optional(),
  weightUnit: z.string().optional(),
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
      return service.createItem({
        ...input,
        categoryId: input.categoryId || undefined,
        parentItemId: input.parentItemId || undefined,
        incomeAccountId: input.incomeAccountId || undefined,
        expenseAccountId: input.expenseAccountId || undefined,
        assetAccountId: input.assetAccountId || undefined,
        cogsAccountId: input.cogsAccountId || undefined,
      });
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
          code: z.string().min(1),
          name: z.string().min(1),
          parentCategoryId: z.string().uuid().optional().nullable(),
          isActive: z.boolean().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const service = new ItemCategoriesService(ctx.serviceContext);
        return service.createCategory({
          ...input,
          parentCategoryId: input.parentCategoryId || undefined,
        });
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