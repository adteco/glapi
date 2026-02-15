import {
  pgTable,
  uuid,
  date,
  timestamp,
  decimal,
  text,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { performanceObligations } from "./performance-obligations";
import { recognitionSourceEnum } from "./revenue-enums";

/**
 * revenue_schedules (canonical)
 *
 * Legacy contract-based schema uses:
 * - schedule_date + scheduled_amount + recognized_amount + recognition_source
 *
 * Subscription ASC-606 engine uses:
 * - organization_id + period_start_date + period_end_date + recognition_pattern + status
 *
 * The migration `0073_unify_606_ledger_obligations.sql` evolves the live table to support both.
 */
export const revenueSchedules = pgTable("revenue_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Canonical org field for RLS
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),

  performanceObligationId: uuid("performance_obligation_id")
    .references(() => performanceObligations.id)
    .notNull(),

  // Legacy schedule date (kept non-null in the live schema)
  scheduleDate: date("schedule_date").notNull(),
  scheduledAmount: decimal("scheduled_amount", { precision: 14, scale: 2 }).notNull(),
  recognizedAmount: decimal("recognized_amount", { precision: 14, scale: 2 }).default("0"),
  recognitionSource: recognitionSourceEnum("recognition_source"),
  recognitionDate: date("recognition_date"),

  // Newer period-based fields (nullable for legacy rows)
  periodStartDate: date("period_start_date"),
  periodEndDate: date("period_end_date"),
  recognitionPattern: text("recognition_pattern"),
  status: text("status"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const revenueSchedulesRelations = relations(revenueSchedules, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [revenueSchedules.organizationId],
    references: [organizations.id],
  }),
  performanceObligation: one(performanceObligations, {
    fields: [revenueSchedules.performanceObligationId],
    references: [performanceObligations.id],
  }),
  journalEntries: many(revenueJournalEntries),
}));

// Import after defining to avoid circular dependencies
import { revenueJournalEntries } from "./revenue-journal-entries";

export type RevenueSchedule = typeof revenueSchedules.$inferSelect;
export type NewRevenueSchedule = typeof revenueSchedules.$inferInsert;
export type UpdateRevenueSchedule = Partial<NewRevenueSchedule>;

