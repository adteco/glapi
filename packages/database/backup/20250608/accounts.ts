import { pgTable, uuid, text, boolean, timestamp, uniqueIndex, integer, AnyPgColumn } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { accountCategoryEnum } from './enums'; // Import the enum
import { organizations } from './organizations';

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  accountNumber: text('account_number').notNull(),
  accountName: text('account_name').notNull(),
  accountCategory: accountCategoryEnum('account_category').notNull(),
  accountSubcategory: text('account_subcategory'), // 'CURRENT_ASSETS', 'FIXED_ASSETS', etc.
  normalBalance: text('normal_balance'), // 'DEBIT' or 'CREDIT'
  financialStatementLine: text('financial_statement_line'), // Maps to specific FS line items
  isControlAccount: boolean('is_control_account').default(false).notNull(),
  rollupAccountId: uuid('rollup_account_id').references((): AnyPgColumn => accounts.id), // For account hierarchies
  gaapClassification: text('gaap_classification'), // Specific GAAP classifications
  cashFlowCategory: text('cash_flow_category'), // 'OPERATING', 'INVESTING', 'FINANCING'
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    orgAccountNumIdx: uniqueIndex('accounts_organization_id_account_number_idx').on(table.organizationId, table.accountNumber),
    // Temporarily disabled to troubleshoot Drizzle issues
    // categoryIdx: uniqueIndex('accounts_category_idx').on(table.accountCategory, table.isActive),
    // rollupIdx: uniqueIndex('accounts_rollup_idx').on(table.rollupAccountId),
  };
});

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [accounts.organizationId],
    references: [organizations.id],
  }),
  rollupAccount: one(accounts, {
    fields: [accounts.rollupAccountId],
    references: [accounts.id],
  }),
  childAccounts: many(accounts),
  // Relations to avoid circular dependencies - these are defined in the respective files
  // transactionLines: many(businessTransactionLines),
  // glTransactionLines: many(glTransactionLines),
  // postingRulesDebit: many(glPostingRules, { relationName: 'debitAccount' }),
  // postingRulesCredit: many(glPostingRules, { relationName: 'creditAccount' }),
  // accountBalances: many(glAccountBalances),
  // budgetLines: many(glBudgetLines),
  // userRestrictions: many(userAccountRestrictions),
  // taxCodes: many(taxCodes),
  // activityCodesRevenue: many(activityCodes, { relationName: 'revenueAccount' }),
  // activityCodesCost: many(activityCodes, { relationName: 'costAccount' }),
}));

// Import additional references for relations - commented out to avoid circular dependencies
// These relations will be defined in the respective files
// import { businessTransactionLines } from './transaction-types';
// import { glTransactionLines } from './gl-transactions';
// import { glPostingRules } from './gl-transactions';
// import { glAccountBalances } from './accounting-periods';
// import { glBudgetLines } from './accounting-periods';
// import { userAccountRestrictions } from './rls-access-control';
// import { taxCodes } from './tax-codes';
// import { activityCodes } from './activity-codes'; 