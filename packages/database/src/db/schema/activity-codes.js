"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityCodesRelations = exports.activityCodes = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
exports.activityCodes = (0, pg_core_1.pgTable)('activity_codes', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    subsidiaryId: (0, pg_core_1.uuid)('subsidiary_id').notNull(),
    activityCode: (0, pg_core_1.text)('activity_code').notNull(),
    activityName: (0, pg_core_1.text)('activity_name').notNull(),
    activityCategory: (0, pg_core_1.text)('activity_category'), // 'BILLABLE', 'NON_BILLABLE', 'ADMIN', 'INTERNAL'
    defaultBillingRate: (0, pg_core_1.decimal)('default_billing_rate', { precision: 18, scale: 4 }),
    defaultCostRate: (0, pg_core_1.decimal)('default_cost_rate', { precision: 18, scale: 4 }),
    unitOfMeasure: (0, pg_core_1.text)('unit_of_measure').default('HOUR'), // 'HOUR', 'DAY', 'FIXED'
    revenueAccountId: (0, pg_core_1.uuid)('revenue_account_id'),
    costAccountId: (0, pg_core_1.uuid)('cost_account_id'),
    description: (0, pg_core_1.text)('description'),
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    requiresApproval: (0, pg_core_1.boolean)('requires_approval').default(false).notNull(),
    sortOrder: (0, pg_core_1.integer)('sort_order').default(0).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    subCodeIdx: (0, pg_core_1.uniqueIndex)('idx_activity_codes_sub_code').on(table.subsidiaryId, table.activityCode),
    categoryIdx: (0, pg_core_1.uniqueIndex)('idx_activity_codes_category').on(table.activityCategory, table.isActive),
}));
exports.activityCodesRelations = (0, drizzle_orm_1.relations)(exports.activityCodes, ({ one, many }) => ({
    subsidiary: one(subsidiaries_1.subsidiaries, {
        fields: [exports.activityCodes.subsidiaryId],
        references: [subsidiaries_1.subsidiaries.id],
    }),
    revenueAccount: one(accounts_1.accounts, {
        fields: [exports.activityCodes.revenueAccountId],
        references: [accounts_1.accounts.id],
    }),
    costAccount: one(accounts_1.accounts, {
        fields: [exports.activityCodes.costAccountId],
        references: [accounts_1.accounts.id],
    }),
    // transactionLines relation defined in transaction-types.ts to avoid circular dependency
}));
// Import references
const subsidiaries_1 = require("./subsidiaries");
const accounts_1 = require("./accounts");
// import { businessTransactionLines } from './transaction-types'; // Avoid circular dependency
//# sourceMappingURL=activity-codes.js.map