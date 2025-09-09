import { pgTable, text, timestamp, jsonb, decimal, boolean } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { contractModifications } from './contract-modifications';
import { performanceObligations } from './performance-obligations';
import { revenueJournalEntries } from './revenue-journal-entries';

/**
 * Catch-up Adjustments Table
 * Tracks cumulative catch-up adjustments for contract modifications
 */
export const catchUpAdjustments = pgTable('catch_up_adjustments', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  modificationId: text('modification_id').notNull().references(() => contractModifications.id, { onDelete: 'cascade' }),
  performanceObligationId: text('performance_obligation_id').references(() => performanceObligations.id, { onDelete: 'restrict' }),
  
  // Adjustment details
  adjustmentType: text('adjustment_type').notNull(), // 'revenue_increase', 'revenue_decrease', 'cost_adjustment'
  adjustmentDate: timestamp('adjustment_date', { withTimezone: true }).notNull(),
  
  // Financial values
  priorPeriodRevenue: decimal('prior_period_revenue', { precision: 15, scale: 2 }).notNull(),
  currentPeriodRevenue: decimal('current_period_revenue', { precision: 15, scale: 2 }).notNull(),
  adjustmentAmount: decimal('adjustment_amount', { precision: 15, scale: 2 }).notNull(),
  
  // GL posting
  journalEntryId: text('journal_entry_id').references(() => revenueJournalEntries.id, { onDelete: 'restrict' }),
  posted: boolean('posted').default(false),
  postingDate: timestamp('posting_date', { withTimezone: true }),
  
  // Calculation details
  calculationDetails: jsonb('calculation_details'),
  
  // Metadata
  metadata: jsonb('metadata'),
  
  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
});

export type CatchUpAdjustment = typeof catchUpAdjustments.$inferSelect;
export type NewCatchUpAdjustment = typeof catchUpAdjustments.$inferInsert;