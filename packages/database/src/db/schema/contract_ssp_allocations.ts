import { pgTable, uuid, timestamp, decimal, pgEnum } from "drizzle-orm/pg-core";
import { contracts } from "./contracts";
import { contractLineItems } from "./contract_line_items";

export const allocationMethodEnum = pgEnum("allocation_method", [
  "proportional",
  "residual",
  "specific_evidence"
]);

export const contractSspAllocations = pgTable("contract_ssp_allocations", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractId: uuid("contract_id").references(() => contracts.id).notNull(),
  lineItemId: uuid("line_item_id").references(() => contractLineItems.id).notNull(),
  allocatedAmount: decimal("allocated_amount", { precision: 12, scale: 2 }).notNull(),
  allocationMethod: allocationMethodEnum("allocation_method").notNull(),
  allocationPercentage: decimal("allocation_percentage", { precision: 5, scale: 2 }),
  allocationDate: timestamp("allocation_date", { withTimezone: true }).defaultNow(),
  createdBy: uuid("created_by")
});