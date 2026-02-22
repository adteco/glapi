import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { AccountingListService } from '@glapi/api-service';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';
import {
  createPaymentTermsSchema,
  updatePaymentTermsSchema,
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  createChargeTypeSchema,
  updateChargeTypeSchema,
  assignCustomerAccountingListSchema,
  accountingListQuerySchema,
} from '@glapi/types';

// ============================================================================
// ROUTER
// ============================================================================

export const accountingListsRouter = router({
  // ============================================================================
  // PAYMENT TERMS
  // ============================================================================

  listPaymentTerms: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_payment_terms', 'List payment terms configurations', {
      scopes: ['accounting', 'billing', 'global'],
      permissions: ['read:accounting-lists'],
    }) })
    .input(accountingListQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      // Apply defaults when input is empty/undefined
      const params = input ?? { page: 1, limit: 50 };
      return await service.listPaymentTerms(params);
    }),

  getPaymentTerms: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      return await service.getPaymentTerms(input.id);
    }),

  createPaymentTerms: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('create_payment_terms', 'Create a new payment terms configuration', {
      scopes: ['accounting', 'billing'],
      permissions: ['write:accounting-lists'],
      riskLevel: 'LOW',
    }) })
    .input(createPaymentTermsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      return await service.createPaymentTerms(input);
    }),

  updatePaymentTerms: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: updatePaymentTermsSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      return await service.updatePaymentTerms(input.id, input.data);
    }),

  deletePaymentTerms: authenticatedProcedure
    .meta({ ai: createDeleteAIMeta('delete_payment_terms', 'Delete a payment terms configuration', {
      scopes: ['accounting', 'billing'],
      permissions: ['delete:accounting-lists'],
      riskLevel: 'MEDIUM',
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      return await service.deletePaymentTerms(input.id);
    }),

  // ============================================================================
  // PAYMENT METHODS
  // ============================================================================

  listPaymentMethods: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_payment_methods', 'List payment method configurations', {
      scopes: ['accounting', 'billing', 'global'],
      permissions: ['read:accounting-lists'],
    }) })
    .input(accountingListQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      // Apply defaults when input is empty/undefined
      const params = input ?? { page: 1, limit: 50 };
      return await service.listPaymentMethods(params);
    }),

  getPaymentMethod: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      return await service.getPaymentMethod(input.id);
    }),

  createPaymentMethod: authenticatedProcedure
    .input(createPaymentMethodSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      return await service.createPaymentMethod(input);
    }),

  updatePaymentMethod: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: updatePaymentMethodSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      return await service.updatePaymentMethod(input.id, input.data);
    }),

  deletePaymentMethod: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      return await service.deletePaymentMethod(input.id);
    }),

  // ============================================================================
  // CHARGE TYPES
  // ============================================================================

  listChargeTypes: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_charge_types', 'List charge type configurations', {
      scopes: ['accounting', 'billing', 'global'],
      permissions: ['read:accounting-lists'],
    }) })
    .input(accountingListQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      // Apply defaults when input is empty/undefined
      const params = input ?? { page: 1, limit: 50 };
      return await service.listChargeTypes(params);
    }),

  getChargeType: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      return await service.getChargeType(input.id);
    }),

  createChargeType: authenticatedProcedure
    .input(createChargeTypeSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      return await service.createChargeType(input);
    }),

  updateChargeType: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: updateChargeTypeSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      return await service.updateChargeType(input.id, input.data);
    }),

  deleteChargeType: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      return await service.deleteChargeType(input.id);
    }),

  // ============================================================================
  // CUSTOMER ASSIGNMENTS
  // ============================================================================

  assignToCustomer: authenticatedProcedure
    .input(assignCustomerAccountingListSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      return await service.assignToCustomer(input);
    }),

  removeFromCustomer: authenticatedProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      accountingListId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      return await service.removeFromCustomer(input.customerId, input.accountingListId);
    }),

  getCustomerAccountingLists: authenticatedProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      return await service.getCustomerAccountingLists(input.customerId);
    }),

  getEffectivePaymentTerms: authenticatedProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      asOfDate: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      return await service.getEffectivePaymentTerms(input.customerId, input.asOfDate);
    }),

  getCustomersForAccountingList: authenticatedProcedure
    .input(z.object({
      accountingListId: z.string().uuid(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      return await service.getCustomersForAccountingList(
        input.accountingListId,
        input.page,
        input.limit
      );
    }),

  // ============================================================================
  // CALCULATIONS
  // ============================================================================

  calculateDueDate: authenticatedProcedure
    .input(z.object({
      invoiceDate: z.date(),
      paymentTermsId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      return await service.calculateDueDate(input.invoiceDate, input.paymentTermsId);
    }),

  calculateEarlyPaymentDiscount: authenticatedProcedure
    .input(z.object({
      amount: z.number().positive(),
      paymentTermsId: z.string().uuid(),
      invoiceDate: z.date(),
      paymentDate: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      const service = new AccountingListService(ctx.serviceContext);
      return await service.calculateEarlyPaymentDiscount(
        input.amount,
        input.paymentTermsId,
        input.invoiceDate,
        input.paymentDate
      );
    }),
});
