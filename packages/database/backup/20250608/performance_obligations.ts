import { pgTable, uuid, varchar, timestamp, decimal, pgEnum, date } from "drizzle-orm/pg-core";
import { contracts } from "./contracts";

export const obligationTypeEnum = pgEnum("obligation_type", [
  "single_point",
  "over_time",
  "series"
]);

export const satisfactionMethodEnum = pgEnum("satisfaction_method", [
  "input_method",
  "output_method",
  "time_based"
]);

export const performanceObligations = pgTable("performance_obligations", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractId: uuid("contract_id").references(() => contracts.id).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  obligationType: obligationTypeEnum("obligation_type").notNull(),
  allocatedPrice: decimal("allocated_price", { precision: 12, scale: 2 }).notNull(),
  satisfactionMethod: satisfactionMethodEnum("satisfaction_method").default("time_based"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  totalUnits: decimal("total_units", { precision: 10, scale: 2 }),
  completedUnits: decimal("completed_units", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});