"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountsRelations = exports.accounts = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const enums_1 = require("./enums"); // Import the enum
const organizations_1 = require("./organizations");
exports.accounts = (0, pg_core_1.pgTable)('accounts', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    organizationId: (0, pg_core_1.text)('organization_id').notNull().references(() => organizations_1.organizations.id),
    accountNumber: (0, pg_core_1.text)('account_number').notNull(),
    accountName: (0, pg_core_1.text)('account_name').notNull(),
    accountCategory: (0, enums_1.accountCategoryEnum)('account_category').notNull(),
    accountSubcategory: (0, pg_core_1.text)('account_subcategory'), // 'CURRENT_ASSETS', 'FIXED_ASSETS', etc.
    normalBalance: (0, pg_core_1.text)('normal_balance'), // 'DEBIT' or 'CREDIT'
    financialStatementLine: (0, pg_core_1.text)('financial_statement_line'), // Maps to specific FS line items
    isControlAccount: (0, pg_core_1.boolean)('is_control_account').default(false).notNull(),
    rollupAccountId: (0, pg_core_1.uuid)('rollup_account_id').references(() => exports.accounts.id), // For account hierarchies
    gaapClassification: (0, pg_core_1.text)('gaap_classification'), // Specific GAAP classifications
    cashFlowCategory: (0, pg_core_1.text)('cash_flow_category'), // 'OPERATING', 'INVESTING', 'FINANCING'
    description: (0, pg_core_1.text)('description'),
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
    return {
        orgAccountNumIdx: (0, pg_core_1.uniqueIndex)('accounts_organization_id_account_number_idx').on(table.organizationId, table.accountNumber),
        // Temporarily disabled to troubleshoot Drizzle issues
        // categoryIdx: uniqueIndex('accounts_category_idx').on(table.accountCategory, table.isActive),
        // rollupIdx: uniqueIndex('accounts_rollup_idx').on(table.rollupAccountId),
    };
});
exports.accountsRelations = (0, drizzle_orm_1.relations)(exports.accounts, ({ one, many }) => ({
    organization: one(organizations_1.organizations, {
        fields: [exports.accounts.organizationId],
        references: [organizations_1.organizations.id],
    }),
    rollupAccount: one(exports.accounts, {
        fields: [exports.accounts.rollupAccountId],
        references: [exports.accounts.id],
    }),
    childAccounts: many(exports.accounts),
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
//# sourceMappingURL=accounts.js.map