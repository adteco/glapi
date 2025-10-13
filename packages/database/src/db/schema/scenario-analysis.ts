import { pgTable, text, timestamp, decimal, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';

// Scenario type enum
export const scenarioTypeEnum = pgEnum('scenario_type', [
  'base',
  'optimistic',
  'pessimistic',
  'custom'
]);

// Scenario status enum
export const scenarioStatusEnum = pgEnum('scenario_status', [
  'draft',
  'active',
  'archived'
]);

// Scenario analysis table
export const scenarioAnalysis = pgTable('scenario_analysis', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Scenario details
  scenarioName: text('scenario_name').notNull(),
  scenarioType: scenarioTypeEnum('scenario_type').notNull(),
  description: text('description'),
  
  // Parameters
  assumptions: jsonb('assumptions').notNull(),
  variables: jsonb('variables').notNull(),
  
  // Results
  projectedRevenue: decimal('projected_revenue', { precision: 15, scale: 2 }),
  projectedCosts: decimal('projected_costs', { precision: 15, scale: 2 }),
  projectedProfit: decimal('projected_profit', { precision: 15, scale: 2 }),
  
  // Impact analysis
  revenueImpact: jsonb('revenue_impact'),
  cashFlowImpact: jsonb('cash_flow_impact'),
  profitabilityImpact: jsonb('profitability_impact'),
  
  // Comparison
  baselineComparison: jsonb('baseline_comparison'),
  sensitivityAnalysis: jsonb('sensitivity_analysis'),
  
  // Status
  status: scenarioStatusEnum('status').notNull().default('draft'),
  
  // Metadata
  metadata: jsonb('metadata'),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
});

// Type exports
export type ScenarioAnalysis = typeof scenarioAnalysis.$inferSelect;
export type NewScenarioAnalysis = typeof scenarioAnalysis.$inferInsert;