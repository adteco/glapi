import {
  pgTable,
  uuid,
  varchar,
  text,
  decimal,
  integer,
  timestamp,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { subscriptions } from "./subscriptions";
import { items } from "./items";
import { performanceObligationStatusEnum } from "./revenue-enums";

/**
 * performance_obligations (canonical)
 *
 * This table is intentionally a superset schema:
 * - Legacy contract-based obligations use: contract_line_item_id + name/ssp/etc
 * - Subscription-based ASC-606 obligations use: organization_id + subscription_id + item_id + timing fields
 *
 * The database migration `0073_unify_606_ledger_obligations.sql` evolves the live table accordingly.
 */
export const performanceObligations = pgTable("performance_obligations", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Multi-tenancy (canonical)
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),

  // Subscription-based ASC-606 fields
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
  itemId: uuid("item_id").references(() => items.id),
  obligationType: text("obligation_type"),
  satisfactionMethod: text("satisfaction_method"),
  satisfactionPeriodMonths: integer("satisfaction_period_months"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  allocatedAmount: decimal("allocated_amount", { precision: 14, scale: 2 }),

  // Legacy contract-based fields
  contractLineItemId: uuid("contract_line_item_id"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ssp: decimal("ssp", { precision: 14, scale: 2 }).notNull(),
  allocatedTransactionPrice: decimal("allocated_transaction_price", { precision: 14, scale: 2 }),
  revenueRecognized: decimal("revenue_recognized", { precision: 14, scale: 2 }).default("0"),

  status: performanceObligationStatusEnum("status").default("Pending"),
  fulfillmentDate: timestamp("fulfillment_date", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const performanceObligationsRelations = relations(performanceObligations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [performanceObligations.organizationId],
    references: [organizations.id],
  }),
  subscription: one(subscriptions, {
    fields: [performanceObligations.subscriptionId],
    references: [subscriptions.id],
  }),
  item: one(items, {
    fields: [performanceObligations.itemId],
    references: [items.id],
  }),
  revenueSchedules: many(revenueSchedules),
  contractSspAllocations: many(contractSspAllocations),
}));

// Import after defining to avoid circular dependencies
import { revenueSchedules } from "./revenue-schedules";
import { contractSspAllocations } from "./contract-ssp-allocations";

export type PerformanceObligation = typeof performanceObligations.$inferSelect;
export type NewPerformanceObligation = typeof performanceObligations.$inferInsert;
export type UpdatePerformanceObligation = Partial<NewPerformanceObligation>;

