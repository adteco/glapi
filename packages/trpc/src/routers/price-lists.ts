import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { PricingService } from '@glapi/api-service';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';

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
    .meta({ ai: createReadOnlyAIMeta('list_price_lists', 'List price lists with optional filters', {
      scopes: ['pricing', 'sales', 'items'],
      permissions: ['read:price-lists'],
    }) })
    .input(priceListQuerySchema.optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.listPriceLists(input);
    }),

  getById: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_price_list', 'Get a price list by ID', {
      scopes: ['pricing', 'sales', 'items'],
      permissions: ['read:price-lists'],
    }) })
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.getPriceList(input.id);
    }),

  create: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('create_price_list', 'Create a new price list', {
      scopes: ['pricing', 'sales', 'items'],
      permissions: ['write:price-lists'],
      riskLevel: 'LOW',
    }) })
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
    .meta({ ai: createDeleteAIMeta('delete_price_list', 'Delete a price list', {
      scopes: ['pricing', 'sales', 'items'],
      permissions: ['delete:price-lists'],
      riskLevel: 'MEDIUM',
    }) })
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
    .meta({ ai: createReadOnlyAIMeta('calculate_price', 'Calculate price for an item based on customer and quantity', {
      scopes: ['pricing', 'sales', 'items'],
      permissions: ['read:price-lists'],
    }) })
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
    .meta({ ai: createWriteAIMeta('bulk_update_prices', 'Bulk update prices in a price list', {
      scopes: ['pricing', 'sales', 'items'],
      permissions: ['write:price-lists'],
      riskLevel: 'MEDIUM',
    }) })
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

  // ============================================================================
  // Labor Rates (Rate Cards)
  // ============================================================================

  getLaborRates: authenticatedProcedure
    .input(z.object({
      priceListId: z.string(),
      employeeId: z.string().optional(),
      laborRole: z.string().optional(),
      projectId: z.string().optional(),
      costCodeId: z.string().optional(),
      activeOnly: z.boolean().default(false),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.listPriceListLaborRates(
        input.priceListId,
        {
          employeeId: input.employeeId,
          laborRole: input.laborRole,
          projectId: input.projectId,
          costCodeId: input.costCodeId,
          activeOnly: input.activeOnly,
        },
        { page: input.page, limit: input.limit }
      );
    }),

  getLaborRateById: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.getLaborRate(input.id);
    }),

  createLaborRate: authenticatedProcedure
    .input(z.object({
      priceListId: z.string(),
      employeeId: z.string().optional().nullable(),
      laborRole: z.string().optional().nullable(),
      projectId: z.string().optional().nullable(),
      costCodeId: z.string().optional().nullable(),
      laborRate: z.number().nonnegative(),
      burdenRate: z.number().nonnegative().default(0),
      billingRate: z.number().nonnegative(),
      overtimeMultiplier: z.number().positive().default(1.5),
      doubleTimeMultiplier: z.number().positive().default(2.0),
      priority: z.number().int().nonnegative().default(0),
      effectiveDate: z.date(),
      expirationDate: z.date().optional().nullable(),
      description: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.createLaborRate({
        priceListId: input.priceListId,
        employeeId: input.employeeId,
        laborRole: input.laborRole,
        projectId: input.projectId,
        costCodeId: input.costCodeId,
        laborRate: input.laborRate,
        burdenRate: input.burdenRate,
        billingRate: input.billingRate,
        overtimeMultiplier: input.overtimeMultiplier,
        doubleTimeMultiplier: input.doubleTimeMultiplier,
        priority: input.priority,
        effectiveDate: input.effectiveDate,
        expirationDate: input.expirationDate || null,
        description: input.description,
      });
    }),

  updateLaborRate: authenticatedProcedure
    .input(z.object({
      id: z.string(),
      data: z.object({
        employeeId: z.string().optional().nullable(),
        laborRole: z.string().optional().nullable(),
        projectId: z.string().optional().nullable(),
        costCodeId: z.string().optional().nullable(),
        laborRate: z.number().nonnegative().optional(),
        burdenRate: z.number().nonnegative().optional(),
        billingRate: z.number().nonnegative().optional(),
        overtimeMultiplier: z.number().positive().optional(),
        doubleTimeMultiplier: z.number().positive().optional(),
        priority: z.number().int().nonnegative().optional(),
        effectiveDate: z.date().optional(),
        expirationDate: z.date().optional().nullable(),
        description: z.string().optional().nullable(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      const updateData: Record<string, any> = {};

      if (input.data.employeeId !== undefined) updateData.employeeId = input.data.employeeId;
      if (input.data.laborRole !== undefined) updateData.laborRole = input.data.laborRole;
      if (input.data.projectId !== undefined) updateData.projectId = input.data.projectId;
      if (input.data.costCodeId !== undefined) updateData.costCodeId = input.data.costCodeId;
      if (input.data.laborRate !== undefined) updateData.laborRate = input.data.laborRate;
      if (input.data.burdenRate !== undefined) updateData.burdenRate = input.data.burdenRate;
      if (input.data.billingRate !== undefined) updateData.billingRate = input.data.billingRate;
      if (input.data.overtimeMultiplier !== undefined) updateData.overtimeMultiplier = input.data.overtimeMultiplier;
      if (input.data.doubleTimeMultiplier !== undefined) updateData.doubleTimeMultiplier = input.data.doubleTimeMultiplier;
      if (input.data.priority !== undefined) updateData.priority = input.data.priority;
      if (input.data.effectiveDate !== undefined) updateData.effectiveDate = input.data.effectiveDate;
      if (input.data.expirationDate !== undefined) updateData.expirationDate = input.data.expirationDate || null;
      if (input.data.description !== undefined) updateData.description = input.data.description;

      return await service.updateLaborRate(input.id, updateData);
    }),

  deleteLaborRate: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      await service.deleteLaborRate(input.id);
      return { success: true };
    }),

  calculateBillingRate: authenticatedProcedure
    .input(z.object({
      customerId: z.string().optional(),
      employeeId: z.string().optional(),
      laborRole: z.string().optional(),
      projectId: z.string().optional(),
      costCodeId: z.string().optional(),
      date: z.date().default(() => new Date()),
    }))
    .query(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.calculateBillingRate({
        customerId: input.customerId,
        employeeId: input.employeeId,
        laborRole: input.laborRole,
        projectId: input.projectId,
        costCodeId: input.costCodeId,
        date: input.date,
      });
    }),

  getFullRateCard: authenticatedProcedure
    .input(z.object({
      priceListId: z.string(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      return await service.getFullRateCard(input.priceListId, {
        page: input.page,
        limit: input.limit,
      });
    }),

  copyLaborRates: authenticatedProcedure
    .input(z.object({
      sourcePriceListId: z.string(),
      targetPriceListId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PricingService(ctx.serviceContext);
      await service.copyLaborRates(input.sourcePriceListId, input.targetPriceListId);
      return { success: true };
    }),
});