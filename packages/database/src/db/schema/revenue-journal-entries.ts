import { pgTable, uuid, timestamp, decimal, date, varchar } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { revenueSchedules } from "./revenue-schedules";
import { accountingPeriods } from "./accounting-periods";
import { journalStatusEnum } from "./revenue-enums";
import { relations } from "drizzle-orm";

// Revenue journal entries table - tracks actual journal entries for revenue recognition
export const revenueJournalEntries = pgTable("revenue_journal_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  revenueScheduleId: uuid("revenue_schedule_id").references(() => revenueSchedules.id).notNull(),
  accountingPeriodId: uuid("accounting_period_id").references(() => accountingPeriods.id),
  entryDate: date("entry_date").notNull(),
  deferredRevenueAmount: decimal("deferred_revenue_amount", { precision: 12, scale: 2 }),
  recognizedRevenueAmount: decimal("recognized_revenue_amount", { precision: 12, scale: 2 }),
  journalEntryReference: varchar("journal_entry_reference", { length: 255 }),
  status: journalStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

// Relations
export const revenueJournalEntriesRelations = relations(revenueJournalEntries, ({ one }) => ({
  organization: one(organizations, {
    fields: [revenueJournalEntries.organizationId],
    references: [organizations.id]
  }),
  revenueSchedule: one(revenueSchedules, {
    fields: [revenueJournalEntries.revenueScheduleId],
    references: [revenueSchedules.id]
  }),
  accountingPeriod: one(accountingPeriods, {
    fields: [revenueJournalEntries.accountingPeriodId],
    references: [accountingPeriods.id]
  })
}));

// Type exports
export type RevenueJournalEntry = typeof revenueJournalEntries.$inferSelect;
export type NewRevenueJournalEntry = typeof revenueJournalEntries.$inferInsert;
export type UpdateRevenueJournalEntry = Partial<NewRevenueJournalEntry>;