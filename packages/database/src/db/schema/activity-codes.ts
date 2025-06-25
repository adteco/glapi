import { pgTable, uuid, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { subsidiaries } from './subsidiaries';
import { accounts } from './accounts';

export const activityCodes = pgTable('activity_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id)
    .notNull(),
  subsidiaryId: uuid('subsidiary_id').references(() => subsidiaries.id),
  code: text('code').notNull(),
  description: text('description'),
  revenueAccountId: uuid('revenue_account_id').references(() => accounts.id),
  costAccountId: uuid('cost_account_id').references(() => accounts.id),
  isActive: boolean('is_active').default(true),
  isSystemCode: boolean('is_system_code').default(false),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type ActivityCode = typeof activityCodes.$inferSelect;
export type NewActivityCode = typeof activityCodes.$inferInsert;