import { pgTable, uuid, varchar, timestamp, decimal, pgEnum, date, boolean, jsonb } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { organizations } from "./organizations";
import { relations } from "drizzle-orm";

// Enum for subscription status
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "draft",
  "active",
  "suspended",
  "cancelled",
  "expired"
]);

// Enum for billing frequency
export const billingFrequencyEnum = pgEnum("billing_frequency", [
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "custom"
]);

// Subscriptions table
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  entityId: uuid("entity_id").references(() => entities.id).notNull(),
  subscriptionNumber: varchar("subscription_number", { length: 100 }).notNull(),
  status: subscriptionStatusEnum("status").notNull().default("draft"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  contractValue: decimal("contract_value", { precision: 12, scale: 2 }),
  billingFrequency: billingFrequencyEnum("billing_frequency"),
  autoRenew: boolean("auto_renew").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

// Relations
export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [subscriptions.organizationId],
    references: [organizations.id]
  }),
  entity: one(entities, {
    fields: [subscriptions.entityId],
    references: [entities.id]
  }),
  items: many(subscriptionItems)
}));

// Import subscription items after defining subscriptions to avoid circular dependency
import { subscriptionItems } from "./subscription-items";

// Type exports
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type UpdateSubscription = Partial<NewSubscription>;