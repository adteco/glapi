import { pgTable, text, timestamp, decimal, jsonb, integer, date, pgEnum, boolean, uuid } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';

// Cohort type enum
export const cohortTypeEnum = pgEnum('cohort_type', [
  'acquisition',
  'behavioral',
  'revenue',
  'product',
  'custom'
]);

// Cohort analysis table
export const cohortAnalysis = pgTable('cohort_analysis', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Cohort details
  cohortName: text('cohort_name').notNull(),
  cohortType: cohortTypeEnum('cohort_type').notNull(),
  cohortMonth: date('cohort_month').notNull(),
  
  // Metrics
  initialCustomers: integer('initial_customers').notNull(),
  activeCustomers: integer('active_customers').notNull(),
  churnedCustomers: integer('churned_customers').notNull(),
  retentionRate: decimal('retention_rate', { precision: 5, scale: 4 }),
  
  // Revenue metrics
  initialMrr: decimal('initial_mrr', { precision: 15, scale: 2 }),
  currentMrr: decimal('current_mrr', { precision: 15, scale: 2 }),
  expansionMrr: decimal('expansion_mrr', { precision: 15, scale: 2 }),
  contractionMrr: decimal('contraction_mrr', { precision: 15, scale: 2 }),
  churnedMrr: decimal('churned_mrr', { precision: 15, scale: 2 }),
  
  // Cohort details
  cohortCriteria: jsonb('cohort_criteria'),
  analysisData: jsonb('analysis_data'),
  
  // Metadata
  metadata: jsonb('metadata'),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
});

// Deferred revenue rollforward table
export const deferredRevenueRollforward = pgTable('deferred_revenue_rollforward', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Period
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  
  // Opening balance
  openingBalance: decimal('opening_balance', { precision: 15, scale: 2 }).notNull(),
  
  // Additions
  newContracts: decimal('new_contracts', { precision: 15, scale: 2 }).notNull(),
  modifications: decimal('modifications', { precision: 15, scale: 2 }).notNull(),
  
  // Reductions
  revenueRecognized: decimal('revenue_recognized', { precision: 15, scale: 2 }).notNull(),
  refunds: decimal('refunds', { precision: 15, scale: 2 }).notNull(),
  writeOffs: decimal('write_offs', { precision: 15, scale: 2 }).notNull(),
  
  // Closing balance
  closingBalance: decimal('closing_balance', { precision: 15, scale: 2 }).notNull(),
  
  // Breakdown by obligation
  obligationBreakdown: jsonb('obligation_breakdown'),
  
  // Reconciliation
  reconciliationAdjustments: decimal('reconciliation_adjustments', { precision: 15, scale: 2 }),
  reconciliationNotes: text('reconciliation_notes'),
  
  // Status
  isFinalized: boolean('is_finalized').default(false),
  finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  finalizedBy: text('finalized_by'),
  
  // Metadata
  metadata: jsonb('metadata'),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
});

// Type exports
export type CohortAnalysis = typeof cohortAnalysis.$inferSelect;
export type NewCohortAnalysis = typeof cohortAnalysis.$inferInsert;
export type DeferredRevenueRollforward = typeof deferredRevenueRollforward.$inferSelect;
export type NewDeferredRevenueRollforward = typeof deferredRevenueRollforward.$inferInsert;