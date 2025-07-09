import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { AccountService } from '@glapi/api-service';

const accountSchema = z.object({
  accountNumber: z.string().min(1).max(20),
  accountName: z.string().min(1).max(255),
  accountCategory: z.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'COGS', 'Expense']),
  accountSubcategory: z.string().optional(),
  normalBalance: z.string().optional(),
  financialStatementLine: z.string().optional(),
  isControlAccount: z.boolean().default(false),
  rollupAccountId: z.string().optional(),
  gaapClassification: z.string().optional(),
  cashFlowCategory: z.string().optional(),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().default(true),
  parentAccountNumber: z.string().optional(),
});

export const accountsRouter = router({
  list: authenticatedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
        orderBy: z.enum(['accountNumber', 'accountName', 'createdAt']).default('accountNumber'),
        orderDirection: z.enum(['asc', 'desc']).default('asc'),
        accountCategory: z.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'COGS', 'Expense']).optional(),
        isActive: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input = {} }) => {
      const service = new AccountService(ctx.serviceContext);
      
      const result = await service.listAccounts(
        { page: input.page || 1, limit: input.limit || 50 },
        input.orderBy || 'accountNumber',
        input.orderDirection || 'asc',
        {
          accountCategory: input.accountCategory,
          isActive: input.isActive
        }
      );
      
      return result;
    }),

  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new AccountService(ctx.serviceContext);
      return service.getAccountById(input.id);
    }),

  create: authenticatedProcedure
    .input(accountSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new AccountService(ctx.serviceContext);
      return service.createAccount({
        ...input,
        organizationId: ctx.serviceContext.organizationId
      });
    }),

  update: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: accountSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new AccountService(ctx.serviceContext);
      return service.updateAccount(input.id, input.data);
    }),

  delete: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new AccountService(ctx.serviceContext);
      await service.deleteAccount(input.id);
      return { success: true };
    }),

  seed: authenticatedProcedure
    .input(
      z.array(z.object({
        accountNumber: z.string().min(1),
        accountName: z.string().min(1),
        accountCategory: z.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'COGS', 'Expense']),
        description: z.string().optional(),
        isControlAccount: z.boolean().default(false),
        isActive: z.boolean().default(true),
      }))
    )
    .mutation(async ({ ctx, input }) => {
      const service = new AccountService(ctx.serviceContext);
      return service.seedDefaultAccounts(input.map(account => ({
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        accountCategory: account.accountCategory,
        description: account.description,
        isControlAccount: account.isControlAccount,
        isActive: account.isActive,
      })));
    }),
});