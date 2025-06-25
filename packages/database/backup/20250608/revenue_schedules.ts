import { pgTable, uuid, timestamp, decimal, date, pgEnum } from "drizzle-orm/pg-core";
import { performanceObligations } from "./performance_obligations";

export const recognitionSourceEnum = pgEnum("recognition_source", [
  "automatic",
  "manual_adjustment",
  "milestone_achievement"
]);

export const revenueSchedules = pgTable("revenue_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  performanceObligationId: uuid("performance_obligation_id").references(() => performanceObligations.id).notNull(),
  scheduleDate: date("schedule_date").notNull(),
  scheduledAmount: decimal("scheduled_amount", { precision: 12, scale: 2 }).notNull(),
  recognizedAmount: decimal("recognized_amount", { precision: 12, scale: 2 }).default("0"),
  recognitionSource: recognitionSourceEnum("recognition_source"),
  recognitionDate: date("recognition_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});