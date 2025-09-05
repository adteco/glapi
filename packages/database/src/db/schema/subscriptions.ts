import { pgTable, uuid, varchar, timestamp, decimal, pgEnum, date, boolean, jsonb } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { organizations } from "./organizations";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

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

// Zod schemas for validation
export const insertSubscriptionSchema = createInsertSchema(subscriptions, {
  subscriptionNumber: z.string().min(1).max(100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  contractValue: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid decimal format"),
  metadata: z.record(z.any()).optional()
}).refine(
  (data) => {
    if (data.endDate && data.startDate) {
      return new Date(data.endDate) > new Date(data.startDate);
    }
    return true;
  },
  {
    message: "End date must be after start date",
    path: ["endDate"]
  }
);

export const selectSubscriptionSchema = createSelectSchema(subscriptions);

export const updateSubscriptionSchema = insertSubscriptionSchema.partial().omit({ 
  id: true, 
  organizationId: true,
  createdAt: true,
  updatedAt: true 
});

export type Subscription = z.infer<typeof selectSubscriptionSchema>;
export type NewSubscription = z.infer<typeof insertSubscriptionSchema>;
export type UpdateSubscription = z.infer<typeof updateSubscriptionSchema>;