import { pgTable, text, integer, boolean, decimal, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const activityCodes = pgTable('activity_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  subsidiaryId: uuid('subsidiary_id').notNull(),
  activityCode: text('activity_code').notNull(),
  activityName: text('activity_name').notNull(),
  activityCategory: text('activity_category'), // 'BILLABLE', 'NON_BILLABLE', 'ADMIN', 'INTERNAL'
  defaultBillingRate: decimal('default_billing_rate', { precision: 18, scale: 4 }),
  defaultCostRate: decimal('default_cost_rate', { precision: 18, scale: 4 }),
  unitOfMeasure: text('unit_of_measure').default('HOUR'), // 'HOUR', 'DAY', 'FIXED'
  revenueAccountId: uuid('revenue_account_id'),
  costAccountId: uuid('cost_account_id'),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  requiresApproval: boolean('requires_approval').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  subCodeIdx: uniqueIndex('idx_activity_codes_sub_code').on(table.subsidiaryId, table.activityCode),
  categoryIdx: uniqueIndex('idx_activity_codes_category').on(table.activityCategory, table.isActive),
}));

export const activityCodesRelations = relations(activityCodes, ({ one, many }) => ({
  subsidiary: one(subsidiaries, {
    fields: [activityCodes.subsidiaryId],
    references: [subsidiaries.id],
  }),
  revenueAccount: one(accounts, {
    fields: [activityCodes.revenueAccountId],
    references: [accounts.id],
  }),
  costAccount: one(accounts, {
    fields: [activityCodes.costAccountId],
    references: [accounts.id],
  }),
  // transactionLines relation defined in transaction-types.ts to avoid circular dependency
}));

// Import references
import { subsidiaries } from './subsidiaries';
import { accounts } from './accounts';
// import { businessTransactionLines } from './transaction-types'; // Avoid circular dependency