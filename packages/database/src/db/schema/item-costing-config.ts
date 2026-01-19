/**
 * Item Costing Configuration Schema
 *
 * Supports configurable costing methods per item/subsidiary:
 * - FIFO (First In, First Out)
 * - LIFO (Last In, First Out)
 * - AVERAGE (Moving Average)
 * - WEIGHTED_AVERAGE (Weighted Average)
 * - STANDARD (Standard Cost with variance tracking)
 */

import { pgTable, uuid, text, timestamp, boolean, decimal, date, index, unique, pgEnum } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { organizations } from './organizations';
import { subsidiaries } from './subsidiaries';
import { items } from './items';
import { accounts } from './accounts';

// ============================================================================
// Enums
// ============================================================================

export const CostingMethodEnum = pgEnum('costing_method_enum', [
  'FIFO',           // First In, First Out
  'LIFO',           // Last In, First Out
  'AVERAGE',        // Moving Average
  'WEIGHTED_AVERAGE', // Weighted Average (same as average for most purposes)
  'STANDARD',       // Standard Cost with variance tracking
]);

export type CostingMethodValue = 'FIFO' | 'LIFO' | 'AVERAGE' | 'WEIGHTED_AVERAGE' | 'STANDARD';

// ============================================================================
// Organization Costing Defaults
// ============================================================================

/**
 * Default costing configuration at the organization level.
 * Applied to all items/subsidiaries unless overridden.
 */
export const organizationCostingDefaults = pgTable('organization_costing_defaults', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  // Default costing method for the organization
  defaultCostingMethod: CostingMethodEnum('default_costing_method').notNull().default('AVERAGE'),

  // Standard cost defaults
  allowStandardCostRevaluation: boolean('allow_standard_cost_revaluation').default(false),
  defaultRevaluationAccountId: uuid('default_revaluation_account_id').references(() => accounts.id),

  // Variance thresholds
  priceVarianceThresholdPercent: decimal('price_variance_threshold_percent', { precision: 5, scale: 2 }).default('5.00'),
  quantityVarianceThresholdPercent: decimal('quantity_variance_threshold_percent', { precision: 5, scale: 2 }).default('5.00'),

  // Settings
  trackCostLayers: boolean('track_cost_layers').default(true),
  autoRecalculateOnReceipt: boolean('auto_recalculate_on_receipt').default(true),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
}, (table) => ({
  orgIdxUnique: unique('org_costing_defaults_org_unique').on(table.organizationId),
}));

export type OrganizationCostingDefaultsRecord = typeof organizationCostingDefaults.$inferSelect;
export type InsertOrganizationCostingDefaults = typeof organizationCostingDefaults.$inferInsert;

// ============================================================================
// Subsidiary Costing Configuration
// ============================================================================

/**
 * Costing configuration at the subsidiary level.
 * Overrides organization defaults for specific subsidiaries.
 */
export const subsidiaryCostingConfig = pgTable('subsidiary_costing_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  subsidiaryId: uuid('subsidiary_id').notNull().references(() => subsidiaries.id, { onDelete: 'cascade' }),

  // Override costing method for this subsidiary
  costingMethod: CostingMethodEnum('costing_method').notNull(),

  // Override standard cost settings
  allowStandardCostRevaluation: boolean('allow_standard_cost_revaluation'),
  revaluationAccountId: uuid('revaluation_account_id').references(() => accounts.id),

  // Override variance thresholds
  priceVarianceThresholdPercent: decimal('price_variance_threshold_percent', { precision: 5, scale: 2 }),
  quantityVarianceThresholdPercent: decimal('quantity_variance_threshold_percent', { precision: 5, scale: 2 }),

  // Status
  isActive: boolean('is_active').default(true).notNull(),
  effectiveDate: date('effective_date').notNull(),
  expirationDate: date('expiration_date'),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
}, (table) => ({
  subsidiaryUniqueIdx: unique('subsidiary_costing_config_unique').on(table.organizationId, table.subsidiaryId),
  activeIdx: index('subsidiary_costing_config_active_idx').on(table.subsidiaryId, table.isActive),
}));

export type SubsidiaryCostingConfigRecord = typeof subsidiaryCostingConfig.$inferSelect;
export type InsertSubsidiaryCostingConfig = typeof subsidiaryCostingConfig.$inferInsert;

// ============================================================================
// Item Costing Methods
// ============================================================================

/**
 * Costing configuration at the item/subsidiary level.
 * Most granular override - applies to specific items in specific subsidiaries.
 */
export const itemCostingMethods = pgTable('item_costing_methods', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  subsidiaryId: uuid('subsidiary_id').notNull().references(() => subsidiaries.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),

  // Costing method for this item in this subsidiary
  costingMethod: CostingMethodEnum('costing_method').notNull(),

  // Standard cost (if using STANDARD method)
  standardCost: decimal('standard_cost', { precision: 18, scale: 4 }),
  standardCostEffectiveDate: timestamp('standard_cost_effective_date', { withTimezone: true }),
  previousStandardCost: decimal('previous_standard_cost', { precision: 18, scale: 4 }),

  // Revaluation settings
  allowStandardCostRevaluation: boolean('allow_standard_cost_revaluation').default(false),
  revaluationAccountId: uuid('revaluation_account_id').references(() => accounts.id),

  // Override default item cost with subsidiary-specific default
  overrideDefaultCost: decimal('override_default_cost', { precision: 18, scale: 4 }),

  // Variance thresholds (override subsidiary/org defaults)
  priceVarianceThresholdPercent: decimal('price_variance_threshold_percent', { precision: 5, scale: 2 }),
  quantityVarianceThresholdPercent: decimal('quantity_variance_threshold_percent', { precision: 5, scale: 2 }),

  // Status and dates
  isActive: boolean('is_active').default(true).notNull(),
  effectiveDate: date('effective_date').notNull(),
  expirationDate: date('expiration_date'),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
}, (table) => ({
  itemSubsidiaryUniqueIdx: unique('item_costing_methods_unique').on(table.organizationId, table.subsidiaryId, table.itemId),
  itemIdx: index('item_costing_methods_item_idx').on(table.itemId),
  subsidiaryIdx: index('item_costing_methods_subsidiary_idx').on(table.subsidiaryId),
  activeIdx: index('item_costing_methods_active_idx').on(table.itemId, table.subsidiaryId, table.isActive),
}));

export type ItemCostingMethodRecord = typeof itemCostingMethods.$inferSelect;
export type InsertItemCostingMethod = typeof itemCostingMethods.$inferInsert;

// ============================================================================
// Item Cost Layers (for FIFO/LIFO tracking)
// ============================================================================

/**
 * Tracks individual cost layers for FIFO/LIFO inventory valuation.
 * Each receipt creates a new layer with its specific cost.
 */
export const itemCostLayers = pgTable('item_cost_layers', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  subsidiaryId: uuid('subsidiary_id').notNull().references(() => subsidiaries.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),

  // Layer identification
  layerNumber: text('layer_number').notNull(), // Auto-generated sequence
  receiptDate: timestamp('receipt_date', { withTimezone: true }).notNull(),

  // Source transaction
  sourceTransactionId: uuid('source_transaction_id'),
  sourceTransactionType: text('source_transaction_type'), // PO_RECEIPT, ADJUSTMENT, TRANSFER_IN, etc.
  sourceDocumentNumber: text('source_document_number'),

  // Quantities
  quantityReceived: decimal('quantity_received', { precision: 18, scale: 4 }).notNull(),
  quantityRemaining: decimal('quantity_remaining', { precision: 18, scale: 4 }).notNull(),
  quantityReserved: decimal('quantity_reserved', { precision: 18, scale: 4 }).default('0'),

  // Costs
  unitCost: decimal('unit_cost', { precision: 18, scale: 4 }).notNull(),
  totalCost: decimal('total_cost', { precision: 18, scale: 4 }).notNull(),
  currencyCode: text('currency_code').default('USD'),

  // Lot/Serial reference (if tracked)
  lotNumberId: uuid('lot_number_id'),

  // Status
  isFullyDepleted: boolean('is_fully_depleted').default(false).notNull(),
  depletedAt: timestamp('depleted_at', { withTimezone: true }),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
}, (table) => ({
  itemSubsidiaryIdx: index('item_cost_layers_item_subsidiary_idx').on(table.itemId, table.subsidiaryId),
  activeLayersIdx: index('item_cost_layers_active_idx').on(table.itemId, table.subsidiaryId, table.isFullyDepleted),
  receiptDateIdx: index('item_cost_layers_receipt_date_idx').on(table.itemId, table.subsidiaryId, table.receiptDate),
  layerNumberUnique: unique('item_cost_layers_number_unique').on(table.organizationId, table.itemId, table.subsidiaryId, table.layerNumber),
}));

export type ItemCostLayerRecord = typeof itemCostLayers.$inferSelect;
export type InsertItemCostLayer = typeof itemCostLayers.$inferInsert;

// ============================================================================
// Item Cost History (Audit Trail)
// ============================================================================

/**
 * Tracks all changes to item costs for audit purposes.
 */
export const itemCostHistory = pgTable('item_cost_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  subsidiaryId: uuid('subsidiary_id').notNull().references(() => subsidiaries.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),

  // What changed
  changeType: text('change_type').notNull(), // STANDARD_COST_UPDATE, METHOD_CHANGE, REVALUATION, RECEIPT_COST, etc.
  costingMethod: CostingMethodEnum('costing_method'),
  previousCost: decimal('previous_cost', { precision: 18, scale: 4 }),
  newCost: decimal('new_cost', { precision: 18, scale: 4 }),
  varianceAmount: decimal('variance_amount', { precision: 18, scale: 4 }),

  // Context
  affectedTransactionId: uuid('affected_transaction_id'),
  affectedTransactionType: text('affected_transaction_type'),
  costLayerId: uuid('cost_layer_id'),
  changeReason: text('change_reason'),
  notes: text('notes'),

  // Quantities affected (for revaluations)
  quantityAffected: decimal('quantity_affected', { precision: 18, scale: 4 }),
  totalValueChange: decimal('total_value_change', { precision: 18, scale: 4 }),

  // GL posting reference
  glTransactionId: uuid('gl_transaction_id'),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
}, (table) => ({
  itemIdx: index('item_cost_history_item_idx').on(table.itemId),
  dateIdx: index('item_cost_history_date_idx').on(table.createdAt),
  changeTypeIdx: index('item_cost_history_change_type_idx').on(table.changeType),
}));

export type ItemCostHistoryRecord = typeof itemCostHistory.$inferSelect;
export type InsertItemCostHistory = typeof itemCostHistory.$inferInsert;

// ============================================================================
// Relations
// ============================================================================

export const organizationCostingDefaultsRelations = relations(organizationCostingDefaults, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationCostingDefaults.organizationId],
    references: [organizations.id],
  }),
  revaluationAccount: one(accounts, {
    fields: [organizationCostingDefaults.defaultRevaluationAccountId],
    references: [accounts.id],
  }),
}));

export const subsidiaryCostingConfigRelations = relations(subsidiaryCostingConfig, ({ one }) => ({
  organization: one(organizations, {
    fields: [subsidiaryCostingConfig.organizationId],
    references: [organizations.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [subsidiaryCostingConfig.subsidiaryId],
    references: [subsidiaries.id],
  }),
  revaluationAccount: one(accounts, {
    fields: [subsidiaryCostingConfig.revaluationAccountId],
    references: [accounts.id],
  }),
}));

export const itemCostingMethodsRelations = relations(itemCostingMethods, ({ one }) => ({
  organization: one(organizations, {
    fields: [itemCostingMethods.organizationId],
    references: [organizations.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [itemCostingMethods.subsidiaryId],
    references: [subsidiaries.id],
  }),
  item: one(items, {
    fields: [itemCostingMethods.itemId],
    references: [items.id],
  }),
  revaluationAccount: one(accounts, {
    fields: [itemCostingMethods.revaluationAccountId],
    references: [accounts.id],
  }),
}));

export const itemCostLayersRelations = relations(itemCostLayers, ({ one }) => ({
  organization: one(organizations, {
    fields: [itemCostLayers.organizationId],
    references: [organizations.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [itemCostLayers.subsidiaryId],
    references: [subsidiaries.id],
  }),
  item: one(items, {
    fields: [itemCostLayers.itemId],
    references: [items.id],
  }),
}));

export const itemCostHistoryRelations = relations(itemCostHistory, ({ one }) => ({
  organization: one(organizations, {
    fields: [itemCostHistory.organizationId],
    references: [organizations.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [itemCostHistory.subsidiaryId],
    references: [subsidiaries.id],
  }),
  item: one(items, {
    fields: [itemCostHistory.itemId],
    references: [items.id],
  }),
}));
