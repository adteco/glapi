import { pgTable, uuid, varchar, timestamp, decimal, date, pgEnum, text, boolean } from "drizzle-orm/pg-core";
import { contracts } from "./contracts";
import { performanceObligations } from "./performance_obligations";

export const entryTypeEnum = pgEnum("entry_type", [
  "revenue_recognition",
  "contract_asset",
  "deferred_revenue",
  "refund_liability"
]);

export const revenueJournalEntries = pgTable("revenue_journal_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  entryDate: date("entry_date").notNull(),
  contractId: uuid("contract_id").references(() => contracts.id).notNull(),
  performanceObligationId: uuid("performance_obligation_id").references(() => performanceObligations.id),
  debitAccount: varchar("debit_account", { length: 100 }).notNull(),
  creditAccount: varchar("credit_account", { length: 100 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  entryType: entryTypeEnum("entry_type").notNull(),
  description: text("description"),
  isPosted: boolean("is_posted").default(false),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});