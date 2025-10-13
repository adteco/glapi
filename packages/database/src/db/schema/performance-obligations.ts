import { pgTable, uuid, timestamp, decimal, date, integer } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { subscriptions } from "./subscriptions";
import { items } from "./items";
import { obligationTypeEnum, satisfactionMethodEnum, poStatusEnum } from "./revenue-enums";
import { relations } from "drizzle-orm";

// Performance obligations table - represents ASC 606 performance obligations
export const performanceObligations = pgTable("performance_obligations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id).notNull(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  obligationType: obligationTypeEnum("obligation_type").notNull(),
  allocatedAmount: decimal("allocated_amount", { precision: 12, scale: 2 }).notNull(),
  satisfactionMethod: satisfactionMethodEnum("satisfaction_method").notNull(),
  satisfactionPeriodMonths: integer("satisfaction_period_months"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  status: poStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

// Relations
export const performanceObligationsRelations = relations(performanceObligations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [performanceObligations.organizationId],
    references: [organizations.id]
  }),
  subscription: one(subscriptions, {
    fields: [performanceObligations.subscriptionId],
    references: [subscriptions.id]
  }),
  item: one(items, {
    fields: [performanceObligations.itemId],
    references: [items.id]
  }),
  revenueSchedules: many(revenueSchedules),
  contractSspAllocations: many(contractSspAllocations)
}));

// Import after defining performanceObligations to avoid circular dependency
import { revenueSchedules } from "./revenue-schedules";
import { contractSspAllocations } from "./contract-ssp-allocations";

// Type exports
export type PerformanceObligation = typeof performanceObligations.$inferSelect;
export type NewPerformanceObligation = typeof performanceObligations.$inferInsert;
export type UpdatePerformanceObligation = Partial<NewPerformanceObligation>;