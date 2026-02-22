import {
  pgTable,
  uuid,
  timestamp,
  decimal,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { subscriptions } from "./subscriptions";
import { performanceObligations } from "./performance-obligations";
import { allocationMethodEnum } from "./revenue-enums";

/**
 * contract_ssp_allocations (canonical)
 *
 * Superset schema:
 * - Legacy contract-based allocations use: contract_id + line_item_id + allocated_amount + allocation_method
 * - Subscription-based allocations use: organization_id + subscription_id + performance_obligation_id + ssp_amount
 *
 * The migration `0073_unify_606_ledger_obligations.sql` evolves the live table accordingly.
 */
export const contractSspAllocations = pgTable("contract_ssp_allocations", {
  id: uuid("id").defaultRandom().primaryKey(),

  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),

  // Legacy contract workflow fields (nullable for subscription-based allocations)
  contractId: uuid("contract_id"),
  lineItemId: uuid("line_item_id"),

  // Subscription-based workflow fields (nullable for legacy allocations)
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
  performanceObligationId: uuid("performance_obligation_id").references(() => performanceObligations.id),

  // Allocation numbers
  sspAmount: decimal("ssp_amount", { precision: 14, scale: 2 }),
  allocatedAmount: decimal("allocated_amount", { precision: 14, scale: 2 }).notNull(),
  allocationPercentage: decimal("allocation_percentage", { precision: 14, scale: 6 }),
  allocationMethod: allocationMethodEnum("allocation_method").notNull(),

  // Legacy timestamp/audit fields
  allocationDate: timestamp("allocation_date", { withTimezone: true }),
  createdBy: uuid("created_by"),

  // Canonical created time used by newer flows
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contractSspAllocationsRelations = relations(contractSspAllocations, ({ one }) => ({
  organization: one(organizations, {
    fields: [contractSspAllocations.organizationId],
    references: [organizations.id],
  }),
  subscription: one(subscriptions, {
    fields: [contractSspAllocations.subscriptionId],
    references: [subscriptions.id],
  }),
  performanceObligation: one(performanceObligations, {
    fields: [contractSspAllocations.performanceObligationId],
    references: [performanceObligations.id],
  }),
}));

export type ContractSspAllocation = typeof contractSspAllocations.$inferSelect;
export type NewContractSspAllocation = typeof contractSspAllocations.$inferInsert;
export type UpdateContractSspAllocation = Partial<NewContractSspAllocation>;

