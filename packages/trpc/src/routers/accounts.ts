import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { AccountService } from '@glapi/api-service';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';

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
    .meta({ ai: createReadOnlyAIMeta('list_accounts', 'Search and list chart of accounts', {
      scopes: ['accounting', 'gl', 'global'],
      permissions: ['read:accounts'],
    }) })
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
      const service = new AccountService(ctx.serviceContext, { db: ctx.db });

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
    .meta({ ai: createReadOnlyAIMeta('get_account', 'Get a single GL account by ID', {
      scopes: ['accounting', 'gl', 'global'],
      permissions: ['read:accounts'],
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new AccountService(ctx.serviceContext, { db: ctx.db });
      return service.getAccountById(input.id);
    }),

  create: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('create_account', 'Create a new GL account in chart of accounts', {
      scopes: ['accounting', 'gl'],
      permissions: ['write:accounts'],
      riskLevel: 'MEDIUM',
      minimumRole: 'accountant',
    }) })
    .input(accountSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new AccountService(ctx.serviceContext, { db: ctx.db });
      return service.createAccount({
        ...input,
        organizationId: ctx.serviceContext.organizationId
      });
    }),

  update: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('update_account', 'Update an existing GL account', {
      scopes: ['accounting', 'gl'],
      permissions: ['write:accounts'],
      riskLevel: 'MEDIUM',
      minimumRole: 'accountant',
    }) })
    .input(
      z.object({
        id: z.string().uuid(),
        data: accountSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new AccountService(ctx.serviceContext, { db: ctx.db });
      return service.updateAccount(input.id, input.data);
    }),

  delete: authenticatedProcedure
    .meta({ ai: createDeleteAIMeta('delete_account', 'Delete a GL account from chart of accounts', {
      scopes: ['accounting'],
      permissions: ['delete:accounts'],
      riskLevel: 'HIGH',
      minimumRole: 'admin',
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new AccountService(ctx.serviceContext, { db: ctx.db });
      await service.deleteAccount(input.id);
      return { success: true };
    }),

  seed: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('seed_accounts', 'Seed default accounts to chart of accounts', {
      scopes: ['accounting', 'setup'],
      permissions: ['write:accounts'],
      riskLevel: 'HIGH',
      minimumRole: 'admin',
    }) })
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
      const service = new AccountService(ctx.serviceContext, { db: ctx.db });
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
