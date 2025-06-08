import { pgTable, uuid, varchar, timestamp, decimal, pgEnum, date } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { organizations } from "./organizations";

export const contractStatusEnum = pgEnum("contract_status", [
  "draft",
  "signed",
  "active",
  "completed",
  "terminated"
]);

export const sspAllocationMethodEnum = pgEnum("ssp_allocation_method", [
  "observable_evidence",
  "residual",
  "proportional"
]);

export const contracts = pgTable("contracts", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  contractNumber: varchar("contract_number", { length: 100 }).notNull(),
  entityId: uuid("entity_id").references(() => entities.id).notNull(),
  contractDate: date("contract_date").notNull(),
  effectiveDate: date("effective_date").notNull(),
  contractValue: decimal("contract_value", { precision: 12, scale: 2 }).notNull(),
  contractStatus: contractStatusEnum("contract_status").notNull(),
  sspAllocationMethod: sspAllocationMethodEnum("ssp_allocation_method").default("proportional"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});