import { pgTable, text, timestamp, decimal, jsonb, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { subscriptions } from './subscriptions';

// Churn risk level enum
export const churnRiskLevelEnum = pgEnum('churn_risk_level', [
  'low',
  'medium',
  'high',
  'critical'
]);

// Churn predictions table
export const churnPredictions = pgTable('churn_predictions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  subscriptionId: text('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
  
  // Prediction details
  predictionDate: timestamp('prediction_date', { withTimezone: true }).notNull(),
  churnProbability: decimal('churn_probability', { precision: 5, scale: 4 }).notNull(), // 0.0000 to 1.0000
  riskLevel: churnRiskLevelEnum('risk_level').notNull(),
  predictedChurnDate: timestamp('predicted_churn_date', { withTimezone: true }),
  
  // Factors
  riskFactors: jsonb('risk_factors'),
  recommendations: jsonb('recommendations'),
  
  // Model info
  modelVersion: text('model_version').notNull(),
  modelConfidence: decimal('model_confidence', { precision: 5, scale: 4 }),
  
  // Financial impact
  estimatedRevenueLoss: decimal('estimated_revenue_loss', { precision: 15, scale: 2 }),
  remainingContractValue: decimal('remaining_contract_value', { precision: 15, scale: 2 }),
  
  // Status
  isActive: boolean('is_active').default(true),
  alertSent: boolean('alert_sent').default(false),
  alertSentAt: timestamp('alert_sent_at', { withTimezone: true }),
  
  // Metadata
  metadata: jsonb('metadata'),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
});

// Type exports
export type ChurnPrediction = typeof churnPredictions.$inferSelect;
export type NewChurnPrediction = typeof churnPredictions.$inferInsert;