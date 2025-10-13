import { pgTable, uuid, timestamp, decimal } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { subscriptions } from "./subscriptions";
import { performanceObligations } from "./performance-obligations";
import { allocationMethodEnum } from "./revenue-enums";
import { relations } from "drizzle-orm";

// Contract SSP allocations table - tracks how contract value is allocated to performance obligations
export const contractSspAllocations = pgTable("contract_ssp_allocations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id).notNull(),
  performanceObligationId: uuid("performance_obligation_id").references(() => performanceObligations.id).notNull(),
  sspAmount: decimal("ssp_amount", { precision: 10, scale: 2 }).notNull(),
  allocatedAmount: decimal("allocated_amount", { precision: 12, scale: 2 }).notNull(),
  allocationPercentage: decimal("allocation_percentage", { precision: 7, scale: 4 }).notNull(),
  allocationMethod: allocationMethodEnum("allocation_method").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

// Relations
export const contractSspAllocationsRelations = relations(contractSspAllocations, ({ one }) => ({
  organization: one(organizations, {
    fields: [contractSspAllocations.organizationId],
    references: [organizations.id]
  }),
  subscription: one(subscriptions, {
    fields: [contractSspAllocations.subscriptionId],
    references: [subscriptions.id]
  }),
  performanceObligation: one(performanceObligations, {
    fields: [contractSspAllocations.performanceObligationId],
    references: [performanceObligations.id]
  })
}));

// Type exports
export type ContractSspAllocation = typeof contractSspAllocations.$inferSelect;
export type NewContractSspAllocation = typeof contractSspAllocations.$inferInsert;
export type UpdateContractSspAllocation = Partial<NewContractSspAllocation>;