import { pgTable, uuid, timestamp, decimal, date, jsonb } from "drizzle-orm/pg-core";
import { subscriptions } from "./subscriptions";
import { items } from "./items";
import { organizations } from "./organizations";
import { relations } from "drizzle-orm";

// Subscription items table
export const subscriptionItems = pgTable("subscription_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "cascade" }).notNull(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 4 }).notNull().default("1"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 4 }).default("0"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

// Relations
export const subscriptionItemsRelations = relations(subscriptionItems, ({ one }) => ({
  organization: one(organizations, {
    fields: [subscriptionItems.organizationId],
    references: [organizations.id]
  }),
  subscription: one(subscriptions, {
    fields: [subscriptionItems.subscriptionId],
    references: [subscriptions.id]
  }),
  item: one(items, {
    fields: [subscriptionItems.itemId],
    references: [items.id]
  })
}));

// Type exports
export type SubscriptionItem = typeof subscriptionItems.$inferSelect;
export type NewSubscriptionItem = typeof subscriptionItems.$inferInsert;
export type UpdateSubscriptionItem = Partial<NewSubscriptionItem>;