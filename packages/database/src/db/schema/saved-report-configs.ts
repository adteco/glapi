import {
  pgTable,
  text,
  boolean,
  timestamp,
  uniqueIndex,
  uuid,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { entities } from './entities';
import { organizations } from './organizations';

/**
 * Report type enum values
 */
export const REPORT_TYPES = {
  BALANCE_SHEET: 'BALANCE_SHEET',
  INCOME_STATEMENT: 'INCOME_STATEMENT',
  CASH_FLOW_STATEMENT: 'CASH_FLOW_STATEMENT',
} as const;

export type SavedReportType = (typeof REPORT_TYPES)[keyof typeof REPORT_TYPES];

/**
 * Configuration JSON structure type
 */
export interface SavedReportConfigJson {
  // Dimension filters
  subsidiaryId?: string | null;
  departmentIds?: string[];
  classIds?: string[];
  locationIds?: string[];
  // Display options
  includeInactive?: boolean;
  showAccountHierarchy?: boolean;
  showZeroBalances?: boolean;
  includeYTD?: boolean;
  // Comparison settings
  compareWithPriorPeriod?: boolean;
  // Export preferences
  defaultExportFormat?: 'PDF' | 'EXCEL' | 'CSV' | 'JSON';
}

/**
 * Saved Report Configurations Table
 *
 * Stores user-specific report configurations for financial statements.
 * Users can save their preferred filters and settings to quickly
 * regenerate reports with the same parameters.
 *
 * RLS Policy Notes:
 * - organization_id: Used for RLS filtering - users can only see configs
 *   within their organization
 * - user_id: References entities table (not users) for proper RLS integration
 *   with the entity-based access control system
 * - Policies should allow:
 *   - SELECT: WHERE organization_id = current_setting('app.organization_id')
 *     AND user_id = current_setting('app.entity_id')
 *   - INSERT/UPDATE/DELETE: Same as SELECT (users manage their own configs)
 */
export const savedReportConfigs = pgTable(
  'saved_report_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Organization context for RLS
    organizationId: uuid('organization_id').notNull().references(() => organizations.id),

    // Owner - references entities table for RLS compatibility
    // When a user saves a config, we use their entity_id (not clerk user_id)
    userId: uuid('user_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),

    // Configuration name (unique per user per report type)
    name: text('name').notNull(),

    // Report type: BALANCE_SHEET, INCOME_STATEMENT, CASH_FLOW_STATEMENT
    reportType: text('report_type').notNull(),

    // Configuration JSON containing filters and display options
    config: jsonb('config').$type<SavedReportConfigJson>().notNull().default({}),

    // Default flag - only one default per user per report type
    isDefault: boolean('is_default').notNull().default(false),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // Unique constraint: one config name per user per report type
    userReportNameIdx: uniqueIndex('idx_saved_configs_user_report_name').on(
      table.userId,
      table.reportType,
      table.name
    ),
    // Index for listing user's configs
    userReportTypeIdx: index('idx_saved_configs_user_report_type').on(
      table.userId,
      table.reportType
    ),
    // Index for finding default configs
    userDefaultIdx: index('idx_saved_configs_user_default').on(
      table.userId,
      table.reportType,
      table.isDefault
    ),
    // Organization index for RLS performance
    orgIdx: index('idx_saved_configs_org').on(table.organizationId),
  })
);

/**
 * Relations for saved report configs
 */
export const savedReportConfigsRelations = relations(savedReportConfigs, ({ one }) => ({
  // Owner entity (user who saved the config)
  user: one(entities, {
    fields: [savedReportConfigs.userId],
    references: [entities.id],
  }),
}));

/**
 * Type helpers for insert/select operations
 */
export type SavedReportConfig = typeof savedReportConfigs.$inferSelect;
export type NewSavedReportConfig = typeof savedReportConfigs.$inferInsert;
