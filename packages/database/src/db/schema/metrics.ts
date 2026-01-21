import { pgTable, text, uuid, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==========================================
// Custom Metrics Table
// ==========================================

/**
 * Custom metric definitions created by users
 */
export const customMetrics = pgTable('custom_metrics', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull(), // revenue, expenses, profitability, liquidity, efficiency, project, custom
  formula: text('formula').notNull(), // SQL expression or formula definition
  unit: text('unit').notNull(), // USD, %, ratio, days, etc.
  aggregation: text('aggregation').notNull().default('sum'), // sum, avg, min, max, count, latest
  isPercentage: boolean('is_percentage').default(false),
  precision: integer('precision').default(2),
  thresholds: text('thresholds'), // JSON: { good, warning, critical, direction, target }
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==========================================
// Saved Views Table
// ==========================================

/**
 * Saved dashboard/report view configurations
 */
export const savedViews = pgTable('saved_views', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  viewType: text('view_type').notNull(), // dashboard, report, analysis
  configuration: text('configuration').notNull(), // JSON configuration
  isDefault: boolean('is_default').default(false),
  isShared: boolean('is_shared').default(false),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==========================================
// Metric Snapshots Table (for caching/history)
// ==========================================

/**
 * Historical metric value snapshots for trend analysis
 */
export const metricSnapshots = pgTable('metric_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull(),
  metricId: text('metric_id').notNull(), // Built-in metric ID or custom metric UUID
  periodId: uuid('period_id').notNull(),
  subsidiaryId: uuid('subsidiary_id'),
  classId: uuid('class_id'),
  departmentId: uuid('department_id'),
  locationId: uuid('location_id'),
  value: text('value').notNull(), // Stored as decimal string
  previousValue: text('previous_value'),
  changePercent: text('change_percent'),
  calculatedAt: timestamp('calculated_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'), // For cache invalidation
});

// ==========================================
// Dashboard Layouts Table
// ==========================================

/**
 * Dashboard widget layouts
 */
export const dashboardLayouts = pgTable('dashboard_layouts', {
  id: uuid('id').defaultRandom().primaryKey(),
  savedViewId: uuid('saved_view_id')
    .notNull()
    .references(() => savedViews.id, { onDelete: 'cascade' }),
  widgetId: text('widget_id').notNull(),
  widgetType: text('widget_type').notNull(), // kpi, chart, table, breakdown
  position: integer('position').notNull(),
  width: integer('width').notNull().default(4), // Grid units (1-12)
  height: integer('height').notNull().default(2),
  configuration: text('configuration'), // Widget-specific JSON config
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==========================================
// Relations
// ==========================================

export const savedViewsRelations = relations(savedViews, ({ many }) => ({
  layouts: many(dashboardLayouts),
}));

export const dashboardLayoutsRelations = relations(dashboardLayouts, ({ one }) => ({
  savedView: one(savedViews, {
    fields: [dashboardLayouts.savedViewId],
    references: [savedViews.id],
  }),
}));
