import { pgTable, text, timestamp, jsonb, integer, decimal, boolean, index, unique } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { items } from './items';

/**
 * SSP Calculation Runs Table
 * Tracks automated SSP calculation runs with ML model metrics
 */
export const sspCalculationRuns = pgTable('ssp_calculation_runs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Run Information
  runNumber: text('run_number').notNull(),
  runType: text('run_type').notNull(), // 'scheduled', 'manual', 'triggered'
  runDate: timestamp('run_date', { withTimezone: true }).notNull(),
  
  // Calculation Parameters
  calculationMethod: text('calculation_method').notNull(), // 'vsoe', 'statistical', 'ml', 'hybrid'
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  minTransactions: integer('min_transactions').default(5).notNull(),
  confidenceThreshold: decimal('confidence_threshold', { precision: 5, scale: 4 }).default('0.8000').notNull(),
  
  // ML Model Information
  modelVersion: text('model_version'),
  modelAccuracy: decimal('model_accuracy', { precision: 5, scale: 4 }),
  modelTrainingDate: timestamp('model_training_date', { withTimezone: true }),
  featureImportance: jsonb('feature_importance'), // { feature: importance_score }
  
  // Run Statistics
  itemsProcessed: integer('items_processed').default(0).notNull(),
  itemsWithVSOE: integer('items_with_vsoe').default(0).notNull(),
  itemsWithStatistical: integer('items_with_statistical').default(0).notNull(),
  itemsWithML: integer('items_with_ml').default(0).notNull(),
  itemsWithExceptions: integer('items_with_exceptions').default(0).notNull(),
  
  // Performance Metrics
  processingDuration: integer('processing_duration'), // milliseconds
  dataPointsAnalyzed: integer('data_points_analyzed').default(0).notNull(),
  outlierDetected: integer('outliers_detected').default(0).notNull(),
  
  // Status
  status: text('status').notNull().default('pending'), // 'pending', 'running', 'completed', 'failed'
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  
  // Results Summary
  resultsSummary: jsonb('results_summary'),
  
  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true })
}, (table) => ({
  orgIdx: index('ssp_runs_org_idx').on(table.organizationId),
  runDateIdx: index('ssp_runs_date_idx').on(table.runDate),
  statusIdx: index('ssp_runs_status_idx').on(table.status),
  runNumberUnique: unique('ssp_runs_number_unique').on(table.organizationId, table.runNumber)
}));

/**
 * VSOE Evidence Table
 * Stores Vendor-Specific Objective Evidence analysis results
 */
export const vsoeEvidence = pgTable('vsoe_evidence', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  calculationRunId: text('calculation_run_id').references(() => sspCalculationRuns.id, { onDelete: 'set null' }),
  
  // VSOE Analysis Period
  analysisStartDate: text('analysis_start_date').notNull(),
  analysisEndDate: text('analysis_end_date').notNull(),
  
  // VSOE Criteria
  standaloneTransactions: integer('standalone_transactions').default(0).notNull(),
  totalTransactions: integer('total_transactions').default(0).notNull(),
  standalonePercentage: decimal('standalone_percentage', { precision: 5, scale: 2 }).default('0.00').notNull(),
  
  // Price Analysis
  minPrice: decimal('min_price', { precision: 12, scale: 2 }).notNull(),
  maxPrice: decimal('max_price', { precision: 12, scale: 2 }).notNull(),
  meanPrice: decimal('mean_price', { precision: 12, scale: 2 }).notNull(),
  medianPrice: decimal('median_price', { precision: 12, scale: 2 }).notNull(),
  standardDeviation: decimal('standard_deviation', { precision: 12, scale: 2 }).notNull(),
  coefficientOfVariation: decimal('coefficient_of_variation', { precision: 5, scale: 4 }).notNull(),
  
  // VSOE Compliance
  meetsVSOECriteria: boolean('meets_vsoe_criteria').default(false).notNull(),
  vsoePrice: decimal('vsoe_price', { precision: 12, scale: 2 }),
  vsoeConfidence: decimal('vsoe_confidence', { precision: 5, scale: 4 }).default('0.0000').notNull(),
  
  // Failure Reasons
  failureReason: text('failure_reason'), // 'insufficient_standalone', 'high_variability', 'insufficient_data'
  failureDetails: jsonb('failure_details'),
  
  // Statistical Tests
  normalityTest: jsonb('normality_test'), // { test_name, p_value, is_normal }
  outlierAnalysis: jsonb('outlier_analysis'), // { method, outlier_count, outlier_ids }
  
  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validTo: timestamp('valid_to', { withTimezone: true })
}, (table) => ({
  orgItemIdx: index('vsoe_org_item_idx').on(table.organizationId, table.itemId),
  runIdx: index('vsoe_run_idx').on(table.calculationRunId),
  validityIdx: index('vsoe_validity_idx').on(table.validFrom, table.validTo),
  criteriaIdx: index('vsoe_criteria_idx').on(table.meetsVSOECriteria)
}));

/**
 * SSP Pricing Bands Table
 * Statistical pricing analysis with outlier detection
 */
export const sspPricingBands = pgTable('ssp_pricing_bands', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  calculationRunId: text('calculation_run_id').references(() => sspCalculationRuns.id, { onDelete: 'set null' }),
  
  // Analysis Period
  periodStartDate: text('period_start_date').notNull(),
  periodEndDate: text('period_end_date').notNull(),
  
  // Pricing Bands (Percentiles)
  p5Price: decimal('p5_price', { precision: 12, scale: 2 }), // 5th percentile
  p25Price: decimal('p25_price', { precision: 12, scale: 2 }), // 25th percentile (Q1)
  p50Price: decimal('p50_price', { precision: 12, scale: 2 }), // 50th percentile (Median)
  p75Price: decimal('p75_price', { precision: 12, scale: 2 }), // 75th percentile (Q3)
  p95Price: decimal('p95_price', { precision: 12, scale: 2 }), // 95th percentile
  
  // IQR Analysis
  iqr: decimal('iqr', { precision: 12, scale: 2 }), // Interquartile Range
  lowerFence: decimal('lower_fence', { precision: 12, scale: 2 }), // Q1 - 1.5*IQR
  upperFence: decimal('upper_fence', { precision: 12, scale: 2 }), // Q3 + 1.5*IQR
  
  // Distribution Metrics
  skewness: decimal('skewness', { precision: 8, scale: 4 }),
  kurtosis: decimal('kurtosis', { precision: 8, scale: 4 }),
  isNormalDistribution: boolean('is_normal_distribution').default(false),
  
  // Outlier Detection
  outlierCount: integer('outlier_count').default(0).notNull(),
  outlierPercentage: decimal('outlier_percentage', { precision: 5, scale: 2 }).default('0.00').notNull(),
  outlierTransactionIds: jsonb('outlier_transaction_ids'), // Array of transaction IDs
  
  // Seasonality Analysis
  hasSeasonality: boolean('has_seasonality').default(false),
  seasonalityPattern: jsonb('seasonality_pattern'), // { month: avg_price }
  trendDirection: text('trend_direction'), // 'increasing', 'decreasing', 'stable'
  trendStrength: decimal('trend_strength', { precision: 5, scale: 4 }),
  
  // Recommended SSP
  recommendedSSP: decimal('recommended_ssp', { precision: 12, scale: 2 }).notNull(),
  recommendationMethod: text('recommendation_method').notNull(), // 'median', 'trimmed_mean', 'ml_predicted'
  recommendationConfidence: decimal('recommendation_confidence', { precision: 5, scale: 4 }).notNull(),
  
  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  orgItemIdx: index('pricing_bands_org_item_idx').on(table.organizationId, table.itemId),
  periodIdx: index('pricing_bands_period_idx').on(table.periodStartDate, table.periodEndDate),
  runIdx: index('pricing_bands_run_idx').on(table.calculationRunId)
}));

/**
 * SSP Exceptions Table
 * Exception tracking and alerting
 */
export const sspExceptions = pgTable('ssp_exceptions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  calculationRunId: text('calculation_run_id').references(() => sspCalculationRuns.id, { onDelete: 'set null' }),
  
  // Exception Information
  exceptionType: text('exception_type').notNull(), // 'no_data', 'insufficient_data', 'high_variability', 'outlier', 'stale_data', 'price_volatility'
  severity: text('severity').notNull(), // 'critical', 'warning', 'info'
  
  // Exception Details
  message: text('message').notNull(),
  details: jsonb('details'),
  
  // Metrics
  dataPoints: integer('data_points').default(0),
  lastTransactionDate: timestamp('last_transaction_date', { withTimezone: true }),
  daysSinceLastTransaction: integer('days_since_last_transaction'),
  priceVariability: decimal('price_variability', { precision: 5, scale: 4 }),
  
  // Impact
  impactedRevenue: decimal('impacted_revenue', { precision: 15, scale: 2 }),
  impactedContracts: integer('impacted_contracts').default(0),
  
  // Resolution
  status: text('status').notNull().default('open'), // 'open', 'acknowledged', 'resolved', 'ignored'
  acknowledgedBy: text('acknowledged_by'),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  resolvedBy: text('resolved_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolutionNotes: text('resolution_notes'),
  
  // Alerting
  alertSent: boolean('alert_sent').default(false).notNull(),
  alertSentAt: timestamp('alert_sent_at', { withTimezone: true }),
  alertRecipients: jsonb('alert_recipients'), // Array of email addresses or user IDs
  
  // Recommended Actions
  recommendedActions: jsonb('recommended_actions'), // Array of action objects
  
  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  orgIdx: index('ssp_exceptions_org_idx').on(table.organizationId),
  itemIdx: index('ssp_exceptions_item_idx').on(table.itemId),
  typeIdx: index('ssp_exceptions_type_idx').on(table.exceptionType),
  severityIdx: index('ssp_exceptions_severity_idx').on(table.severity),
  statusIdx: index('ssp_exceptions_status_idx').on(table.status),
  runIdx: index('ssp_exceptions_run_idx').on(table.calculationRunId)
}));

// Type exports
export type SSPCalculationRun = typeof sspCalculationRuns.$inferSelect;
export type NewSSPCalculationRun = typeof sspCalculationRuns.$inferInsert;
export type VSOEEvidence = typeof vsoeEvidence.$inferSelect;
export type NewVSOEEvidence = typeof vsoeEvidence.$inferInsert;
export type SSPPricingBand = typeof sspPricingBands.$inferSelect;
export type NewSSPPricingBand = typeof sspPricingBands.$inferInsert;
export type SSPException = typeof sspExceptions.$inferSelect;
export type NewSSPException = typeof sspExceptions.$inferInsert;

// Enum exports
export const CalculationMethods = {
  VSOE: 'vsoe',
  STATISTICAL: 'statistical',
  ML: 'ml',
  HYBRID: 'hybrid',
  MANUAL: 'manual'
} as const;

export const ExceptionTypes = {
  NO_DATA: 'no_data',
  INSUFFICIENT_DATA: 'insufficient_data',
  HIGH_VARIABILITY: 'high_variability',
  OUTLIER: 'outlier',
  STALE_DATA: 'stale_data',
  PRICE_VOLATILITY: 'price_volatility',
  VSOE_FAILURE: 'vsoe_failure'
} as const;

export const ExceptionSeverity = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info'
} as const;

export const RunStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  APPROVED: 'approved'
} as const;