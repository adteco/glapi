import { pgTable, uuid, timestamp, decimal, date } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { performanceObligations } from "./performance-obligations";
import { recognitionPatternEnum, scheduleStatusEnum } from "./revenue-enums";
import { relations } from "drizzle-orm";

// Revenue schedules table - tracks revenue recognition over time
export const revenueSchedules = pgTable("revenue_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  performanceObligationId: uuid("performance_obligation_id").references(() => performanceObligations.id).notNull(),
  periodStartDate: date("period_start_date").notNull(),
  periodEndDate: date("period_end_date").notNull(),
  scheduledAmount: decimal("scheduled_amount", { precision: 12, scale: 2 }).notNull(),
  recognizedAmount: decimal("recognized_amount", { precision: 12, scale: 2 }).default("0"),
  recognitionDate: date("recognition_date"),
  recognitionPattern: recognitionPatternEnum("recognition_pattern").notNull(),
  status: scheduleStatusEnum("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

// Relations
export const revenueSchedulesRelations = relations(revenueSchedules, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [revenueSchedules.organizationId],
    references: [organizations.id]
  }),
  performanceObligation: one(performanceObligations, {
    fields: [revenueSchedules.performanceObligationId],
    references: [performanceObligations.id]
  }),
  journalEntries: many(revenueJournalEntries)
}));

// Import after defining revenueSchedules to avoid circular dependency
import { revenueJournalEntries } from "./revenue-journal-entries";

// Type exports
export type RevenueSchedule = typeof revenueSchedules.$inferSelect;
export type NewRevenueSchedule = typeof revenueSchedules.$inferInsert;
export type UpdateRevenueSchedule = Partial<NewRevenueSchedule>;