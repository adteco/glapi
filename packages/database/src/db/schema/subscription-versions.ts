import {
  pgTable,
  uuid,
  integer,
  text,
  jsonb,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { subscriptions } from './subscriptions';
import { contractModifications } from './contract-modifications';
import { users } from './users';

export const subscriptionVersionTypeEnum = pgEnum('subscription_version_type', [
  'creation',
  'activation',
  'amendment',
  'modification',
  'suspension',
  'resumption',
  'cancellation',
  'renewal',
]);

export const subscriptionVersionSourceEnum = pgEnum(
  'subscription_version_source',
  ['system', 'user', 'integration', 'import'],
);

export const subscriptionVersions = pgTable('subscription_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id)
    .notNull(),
  subscriptionId: uuid('subscription_id')
    .references(() => subscriptions.id, { onDelete: 'cascade' })
    .notNull(),
  versionNumber: integer('version_number').notNull(),
  versionType: subscriptionVersionTypeEnum('version_type').notNull(),
  versionSource: subscriptionVersionSourceEnum('version_source')
    .notNull()
    .default('system'),
  changeSummary: text('change_summary'),
  changeReason: text('change_reason'),
  effectiveDate: timestamp('effective_date', { withTimezone: true })
    .defaultNow()
    .notNull(),
  modificationId: text('modification_id').references(
    () => contractModifications.id,
  ),
  metadata: jsonb('metadata'),
  subscriptionSnapshot: jsonb('subscription_snapshot').notNull(),
  itemsSnapshot: jsonb('items_snapshot').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  previousVersionId: uuid('previous_version_id').references(
    () => subscriptionVersions.id,
  ),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const subscriptionVersionsRelations = relations(
  subscriptionVersions,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [subscriptionVersions.organizationId],
      references: [organizations.id],
    }),
    subscription: one(subscriptions, {
      fields: [subscriptionVersions.subscriptionId],
      references: [subscriptions.id],
    }),
    modification: one(contractModifications, {
      fields: [subscriptionVersions.modificationId],
      references: [contractModifications.id],
    }),
    createdByUser: one(users, {
      fields: [subscriptionVersions.createdBy],
      references: [users.id],
    }),
    previousVersion: one(subscriptionVersions, {
      fields: [subscriptionVersions.previousVersionId],
      references: [subscriptionVersions.id],
    }),
  }),
);

export type SubscriptionVersion = typeof subscriptionVersions.$inferSelect;
export type NewSubscriptionVersion = typeof subscriptionVersions.$inferInsert;
export type SubscriptionVersionTypeValue =
  (typeof subscriptionVersionTypeEnum.enumValues)[number];
export type SubscriptionVersionSourceValue =
  (typeof subscriptionVersionSourceEnum.enumValues)[number];
