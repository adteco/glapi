import { pgTable, text, timestamp, jsonb, decimal, integer, boolean, index, pgEnum, date } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';

/**
 * Forecast model enum
 */
export const forecastModelEnum = pgEnum('forecast_model', [
  'linear_regression',
  'arima',
  'prophet',
  'ml_ensemble',
  'weighted_average',
  'exponential_smoothing'
]);

/**
 * Revenue Forecast Runs Table
 * Tracks forecasting model runs and their parameters
 */
export const revenueForecastRuns = pgTable('revenue_forecast_runs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Forecast parameters
  forecastName: text('forecast_name').notNull(),
  forecastModel: forecastModelEnum('forecast_model').notNull(),
  forecastStartDate: date('forecast_start_date').notNull(),
  forecastEndDate: date('forecast_end_date').notNull(),
  
  // Historical data used
  historicalStartDate: date('historical_start_date').notNull(),
  historicalEndDate: date('historical_end_date').notNull(),
  dataPointsUsed: integer('data_points_used').notNull(),
  
  // Model parameters
  modelParameters: jsonb('model_parameters'),
  confidenceLevel: decimal('confidence_level', { precision: 3, scale: 2 }).default('0.95'),
  
  // Results summary
  forecastedARR: decimal('forecasted_arr', { precision: 15, scale: 2 }),
  forecastedMRR: decimal('forecasted_mrr', { precision: 15, scale: 2 }),
  expectedChurn: decimal('expected_churn', { precision: 15, scale: 2 }),
  expectedGrowth: decimal('expected_growth', { precision: 8, scale: 4 }),
  
  // Model performance
  mape: decimal('mape', { precision: 8, scale: 4 }), // Mean Absolute Percentage Error
  rmse: decimal('rmse', { precision: 15, scale: 2 }), // Root Mean Square Error
  r2Score: decimal('r2_score', { precision: 5, scale: 4 }),
  
  status: text('status').notNull().default('running'), // running, completed, failed
  errorMessage: text('error_message'),
  
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true })
}, (table) => ({
  orgIdx: index('forecast_runs_org_idx').on(table.organizationId),
  statusIdx: index('forecast_runs_status_idx').on(table.status),
  createdIdx: index('forecast_runs_created_idx').on(table.createdAt)
}));

/**
 * Revenue Forecast Details Table
 * Stores detailed forecast values by period
 */
export const revenueForecastDetails = pgTable('revenue_forecast_details', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  forecastRunId: text('forecast_run_id').notNull().references(() => revenueForecastRuns.id, { onDelete: 'cascade' }),
  
  // Forecast period
  forecastDate: date('forecast_date').notNull(),
  periodType: text('period_type').notNull(), // day, week, month, quarter, year
  
  // Forecasted values
  forecastedRevenue: decimal('forecasted_revenue', { precision: 15, scale: 2 }).notNull(),
  lowerBound: decimal('lower_bound', { precision: 15, scale: 2 }).notNull(),
  upperBound: decimal('upper_bound', { precision: 15, scale: 2 }).notNull(),
  
  // Components breakdown
  baseRevenue: decimal('base_revenue', { precision: 15, scale: 2 }),
  newRevenue: decimal('new_revenue', { precision: 15, scale: 2 }),
  expansionRevenue: decimal('expansion_revenue', { precision: 15, scale: 2 }),
  contractionRevenue: decimal('contraction_revenue', { precision: 15, scale: 2 }),
  churnRevenue: decimal('churn_revenue', { precision: 15, scale: 2 }),
  
  // Seasonality and trend components
  trendComponent: decimal('trend_component', { precision: 15, scale: 2 }),
  seasonalComponent: decimal('seasonal_component', { precision: 15, scale: 2 }),
  
  // Actuals (updated when period completes)
  actualRevenue: decimal('actual_revenue', { precision: 15, scale: 2 }),
  variance: decimal('variance', { precision: 15, scale: 2 }),
  variancePercentage: decimal('variance_percentage', { precision: 8, scale: 4 }),
  accuracyScore: decimal('accuracy_score', { precision: 5, scale: 4 }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  forecastRunIdx: index('forecast_details_run_idx').on(table.forecastRunId),
  dateIdx: index('forecast_details_date_idx').on(table.forecastDate)
}));

/**
 * Cohort Analysis Table
 * Tracks customer cohorts and their performance over time
 */
export const cohortAnalysis = pgTable('cohort_analysis', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Cohort definition
  cohortName: text('cohort_name').notNull(),
  cohortMonth: date('cohort_month').notNull(),
  cohortSize: integer('cohort_size').notNull(),
  
  // Cohort characteristics
  acquisitionChannel: text('acquisition_channel'),
  customerSegment: text('customer_segment'),
  productType: text('product_type'),
  
  // Revenue metrics by period
  periodOffset: integer('period_offset').notNull(), // Months since cohort start
  activeCustomers: integer('active_customers').notNull(),
  retentionRate: decimal('retention_rate', { precision: 5, scale: 4 }).notNull(),
  
  // Revenue values
  periodRevenue: decimal('period_revenue', { precision: 15, scale: 2 }).notNull(),
  cumulativeRevenue: decimal('cumulative_revenue', { precision: 15, scale: 2 }).notNull(),
  averageRevenue: decimal('average_revenue', { precision: 12, scale: 2 }).notNull(),
  
  // LTV metrics
  predictedLTV: decimal('predicted_ltv', { precision: 15, scale: 2 }),
  actualLTV: decimal('actual_ltv', { precision: 15, scale: 2 }),
  paybackPeriod: integer('payback_period'), // Months to recover CAC
  cac: decimal('cac', { precision: 12, scale: 2 }), // Customer Acquisition Cost
  ltvCacRatio: decimal('ltv_cac_ratio', { precision: 8, scale: 2 }),
  
  analysisDate: date('analysis_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  orgIdx: index('cohort_analysis_org_idx').on(table.organizationId),
  cohortMonthIdx: index('cohort_analysis_month_idx').on(table.cohortMonth),
  periodIdx: index('cohort_analysis_period_idx').on(table.periodOffset)
}));

/**
 * Scenario Analysis Table
 * Stores what-if scenario analyses
 */
export const scenarioAnalysis = pgTable('scenario_analysis', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  scenarioName: text('scenario_name').notNull(),
  scenarioType: text('scenario_type').notNull(), // growth, recession, best_case, worst_case, custom
  scenarioDescription: text('scenario_description'),
  
  // Scenario parameters
  assumptions: jsonb('assumptions').notNull(),
  /*
    Example assumptions:
    {
      newCustomerGrowth: 0.15, // 15% growth
      churnRateChange: -0.02,  // 2% reduction in churn
      priceIncreasePercent: 0.05, // 5% price increase
      marketExpansion: true,
      competitorImpact: "low",
      economicFactors: {
        inflation: 0.03,
        marketGrowth: 0.08
      }
    }
  */
  
  // Impact analysis
  baselineARR: decimal('baseline_arr', { precision: 15, scale: 2 }).notNull(),
  scenarioARR: decimal('scenario_arr', { precision: 15, scale: 2 }).notNull(),
  arrImpact: decimal('arr_impact', { precision: 15, scale: 2 }).notNull(),
  impactPercentage: decimal('impact_percentage', { precision: 8, scale: 4 }).notNull(),
  
  // Revenue breakdown
  baselineByMonth: jsonb('baseline_by_month'),
  scenarioByMonth: jsonb('scenario_by_month'),
  
  // Time horizon
  analysisStartDate: date('analysis_start_date').notNull(),
  analysisEndDate: date('analysis_end_date').notNull(),
  
  // Probability and confidence
  probability: decimal('probability', { precision: 3, scale: 2 }), // 0-1 scale
  confidenceInterval: jsonb('confidence_interval'),
  riskLevel: text('risk_level'), // low, medium, high
  
  // Recommendations
  recommendations: jsonb('recommendations'),
  actionItems: jsonb('action_items'),
  
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  orgIdx: index('scenario_analysis_org_idx').on(table.organizationId),
  typeIdx: index('scenario_analysis_type_idx').on(table.scenarioType),
  createdIdx: index('scenario_analysis_created_idx').on(table.createdAt)
}));

/**
 * Churn Predictions Table
 * Stores customer churn predictions
 */
export const churnPredictions = pgTable('churn_predictions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').notNull(),
  
  // Prediction details
  predictionDate: date('prediction_date').notNull(),
  churnProbability: decimal('churn_probability', { precision: 5, scale: 4 }).notNull(),
  riskLevel: text('risk_level').notNull(), // low, medium, high
  predictedChurnDate: date('predicted_churn_date'),
  
  // Revenue impact
  monthlyRevenue: decimal('monthly_revenue', { precision: 15, scale: 2 }).notNull(),
  revenueAtRisk: decimal('revenue_at_risk', { precision: 15, scale: 2 }).notNull(),
  lifetimeValue: decimal('lifetime_value', { precision: 15, scale: 2 }),
  
  // Risk factors
  riskFactors: jsonb('risk_factors'),
  /*
    Example:
    [
      { factor: "usage_decline", impact: 0.35, trend: "decreasing" },
      { factor: "support_tickets", impact: 0.25, trend: "increasing" },
      { factor: "payment_failures", impact: 0.20, trend: "stable" }
    ]
  */
  
  // Model metadata
  modelVersion: text('model_version'),
  modelConfidence: decimal('model_confidence', { precision: 5, scale: 4 }),
  
  // Outcome tracking
  actualChurned: boolean('actual_churned'),
  actualChurnDate: date('actual_churn_date'),
  predictionAccuracy: decimal('prediction_accuracy', { precision: 5, scale: 4 }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  orgIdx: index('churn_predictions_org_idx').on(table.organizationId),
  customerIdx: index('churn_predictions_customer_idx').on(table.customerId),
  dateIdx: index('churn_predictions_date_idx').on(table.predictionDate),
  riskIdx: index('churn_predictions_risk_idx').on(table.riskLevel)
}));

/**
 * Deferred Revenue Rollforward Table
 * Tracks deferred revenue movements
 */
export const deferredRevenueRollforward = pgTable('deferred_revenue_rollforward', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Period information
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  periodType: text('period_type').notNull(), // month, quarter, year
  
  // Balance movements
  beginningBalance: decimal('beginning_balance', { precision: 15, scale: 2 }).notNull(),
  additions: decimal('additions', { precision: 15, scale: 2 }).notNull(),
  recognitions: decimal('recognitions', { precision: 15, scale: 2 }).notNull(),
  adjustments: decimal('adjustments', { precision: 15, scale: 2 }).notNull(),
  endingBalance: decimal('ending_balance', { precision: 15, scale: 2 }).notNull(),
  
  // Components breakdown
  shortTermDeferred: decimal('short_term_deferred', { precision: 15, scale: 2 }).notNull(),
  longTermDeferred: decimal('long_term_deferred', { precision: 15, scale: 2 }).notNull(),
  
  // By product/service
  byProductBreakdown: jsonb('by_product_breakdown'),
  byCustomerSegment: jsonb('by_customer_segment'),
  
  // Recognition schedule
  expectedRecognitionNext30Days: decimal('expected_recognition_30d', { precision: 15, scale: 2 }),
  expectedRecognitionNext90Days: decimal('expected_recognition_90d', { precision: 15, scale: 2 }),
  expectedRecognitionNext365Days: decimal('expected_recognition_365d', { precision: 15, scale: 2 }),
  
  // Metrics
  averageRecognitionPeriod: decimal('avg_recognition_period', { precision: 8, scale: 2 }), // in days
  recognitionVelocity: decimal('recognition_velocity', { precision: 8, scale: 4 }), // % recognized per period
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  orgIdx: index('deferred_rollforward_org_idx').on(table.organizationId),
  periodIdx: index('deferred_rollforward_period_idx').on(table.periodStart, table.periodEnd)
}));

// Type exports
export type RevenueForecastRun = typeof revenueForecastRuns.$inferSelect;
export type NewRevenueForecastRun = typeof revenueForecastRuns.$inferInsert;
export type RevenueForecastDetail = typeof revenueForecastDetails.$inferSelect;
export type NewRevenueForecastDetail = typeof revenueForecastDetails.$inferInsert;
export type CohortAnalysis = typeof cohortAnalysis.$inferSelect;
export type NewCohortAnalysis = typeof cohortAnalysis.$inferInsert;
export type ScenarioAnalysis = typeof scenarioAnalysis.$inferSelect;
export type NewScenarioAnalysis = typeof scenarioAnalysis.$inferInsert;
export type ChurnPrediction = typeof churnPredictions.$inferSelect;
export type NewChurnPrediction = typeof churnPredictions.$inferInsert;
export type DeferredRevenueRollforward = typeof deferredRevenueRollforward.$inferSelect;
export type NewDeferredRevenueRollforward = typeof deferredRevenueRollforward.$inferInsert;

// Enum exports
export const ForecastModel = {
  LINEAR_REGRESSION: 'linear_regression',
  ARIMA: 'arima',
  PROPHET: 'prophet',
  ML_ENSEMBLE: 'ml_ensemble',
  WEIGHTED_AVERAGE: 'weighted_average',
  EXPONENTIAL_SMOOTHING: 'exponential_smoothing'
} as const;