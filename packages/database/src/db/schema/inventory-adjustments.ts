/**
 * Inventory Adjustments and Transfers Schema
 *
 * Supports:
 * - Quantity adjustments (count variances, damage, shrinkage)
 * - Value adjustments (revaluation, write-downs)
 * - Location/warehouse transfers
 * - Inter-subsidiary transfers
 * - Approval workflows with audit trail
 */

import { pgTable, uuid, text, timestamp, boolean, decimal, date, index, unique, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { subsidiaries } from './subsidiaries';
import { items } from './items';
import { accounts } from './accounts';

// ============================================================================
// Enums
// ============================================================================

export const adjustmentTypeEnum = pgEnum('adjustment_type_enum', [
  'QUANTITY_INCREASE',    // Add quantity (found items, corrections)
  'QUANTITY_DECREASE',    // Remove quantity (damage, shrinkage, loss)
  'VALUE_REVALUATION',    // Change cost value without quantity change
  'WRITE_DOWN',           // Reduce value (obsolescence, damage)
  'WRITE_OFF',            // Complete removal from inventory
]);

export const adjustmentStatusEnum = pgEnum('adjustment_status_enum', [
  'DRAFT',                // Initial creation
  'PENDING_APPROVAL',     // Submitted for approval
  'APPROVED',             // Approved, ready to post
  'POSTED',               // Posted to GL
  'REJECTED',             // Rejected by approver
  'CANCELLED',            // Cancelled by creator
]);

export const transferTypeEnum = pgEnum('transfer_type_enum', [
  'LOCATION_TRANSFER',    // Transfer between warehouses/locations
  'SUBSIDIARY_TRANSFER',  // Transfer between subsidiaries (intercompany)
  'BIN_TRANSFER',         // Transfer between bins within same location
]);

export const transferStatusEnum = pgEnum('transfer_status_enum', [
  'DRAFT',                // Initial creation
  'PENDING_APPROVAL',     // Submitted for approval
  'APPROVED',             // Approved, ready to process
  'IN_TRANSIT',           // Items shipped, pending receipt
  'RECEIVED',             // Received at destination
  'POSTED',               // Posted to GL
  'REJECTED',             // Rejected by approver
  'CANCELLED',            // Cancelled
]);

export type AdjustmentTypeValue = 'QUANTITY_INCREASE' | 'QUANTITY_DECREASE' | 'VALUE_REVALUATION' | 'WRITE_DOWN' | 'WRITE_OFF';
export type AdjustmentStatusValue = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED' | 'REJECTED' | 'CANCELLED';
export type TransferTypeValue = 'LOCATION_TRANSFER' | 'SUBSIDIARY_TRANSFER' | 'BIN_TRANSFER';
export type TransferStatusValue = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'POSTED' | 'REJECTED' | 'CANCELLED';

// ============================================================================
// Inventory Adjustments
// ============================================================================

/**
 * Header for inventory adjustments
 */
export const inventoryAdjustments = pgTable('inventory_adjustments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  subsidiaryId: uuid('subsidiary_id').notNull().references(() => subsidiaries.id, { onDelete: 'cascade' }),

  // Adjustment identification
  adjustmentNumber: text('adjustment_number').notNull(),
  adjustmentDate: date('adjustment_date').notNull(),
  adjustmentType: adjustmentTypeEnum('adjustment_type').notNull(),
  status: adjustmentStatusEnum('status').notNull().default('DRAFT'),

  // Reason and documentation
  reasonCode: text('reason_code'),
  reason: text('reason'),
  reference: text('reference'),
  notes: text('notes'),

  // GL posting reference
  glTransactionId: uuid('gl_transaction_id'),
  postedAt: timestamp('posted_at', { withTimezone: true }),

  // Approval tracking
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  submittedBy: uuid('submitted_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: uuid('approved_by'),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  rejectedBy: uuid('rejected_by'),
  rejectionReason: text('rejection_reason'),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
}, (table) => ({
  adjustmentNumberUnique: unique('inventory_adjustments_number_unique').on(table.organizationId, table.adjustmentNumber),
  statusIdx: index('inventory_adjustments_status_idx').on(table.status),
  dateIdx: index('inventory_adjustments_date_idx').on(table.adjustmentDate),
}));

export type InventoryAdjustmentRecord = typeof inventoryAdjustments.$inferSelect;
export type InsertInventoryAdjustment = typeof inventoryAdjustments.$inferInsert;

/**
 * Line items for inventory adjustments
 */
export const inventoryAdjustmentLines = pgTable('inventory_adjustment_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  adjustmentId: uuid('adjustment_id').notNull().references(() => inventoryAdjustments.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'restrict' }),

  // Location
  warehouseId: uuid('warehouse_id'),
  locationId: uuid('location_id'),
  binId: uuid('bin_id'),

  // Lot/Serial tracking
  lotNumberId: uuid('lot_number_id'),
  serialNumber: text('serial_number'),

  // Quantity adjustment
  quantityBefore: decimal('quantity_before', { precision: 18, scale: 4 }),
  quantityAdjustment: decimal('quantity_adjustment', { precision: 18, scale: 4 }),
  quantityAfter: decimal('quantity_after', { precision: 18, scale: 4 }),
  unitOfMeasure: text('unit_of_measure'),

  // Value adjustment
  unitCostBefore: decimal('unit_cost_before', { precision: 18, scale: 4 }),
  unitCostAfter: decimal('unit_cost_after', { precision: 18, scale: 4 }),
  totalValueBefore: decimal('total_value_before', { precision: 18, scale: 4 }),
  totalValueAfter: decimal('total_value_after', { precision: 18, scale: 4 }),
  adjustmentValue: decimal('adjustment_value', { precision: 18, scale: 4 }),

  // GL accounts for posting
  inventoryAccountId: uuid('inventory_account_id').references(() => accounts.id),
  adjustmentAccountId: uuid('adjustment_account_id').references(() => accounts.id),

  // Costing method used
  costingMethod: text('costing_method'),
  costLayerId: uuid('cost_layer_id'),

  // Line-level notes
  notes: text('notes'),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  adjustmentIdx: index('inventory_adjustment_lines_adjustment_idx').on(table.adjustmentId),
  itemIdx: index('inventory_adjustment_lines_item_idx').on(table.itemId),
}));

export type InventoryAdjustmentLineRecord = typeof inventoryAdjustmentLines.$inferSelect;
export type InsertInventoryAdjustmentLine = typeof inventoryAdjustmentLines.$inferInsert;

// ============================================================================
// Inventory Transfers
// ============================================================================

/**
 * Header for inventory transfers
 */
export const inventoryTransfers = pgTable('inventory_transfers', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  // Transfer identification
  transferNumber: text('transfer_number').notNull(),
  transferDate: date('transfer_date').notNull(),
  transferType: transferTypeEnum('transfer_type').notNull(),
  status: transferStatusEnum('status').notNull().default('DRAFT'),

  // Source
  fromSubsidiaryId: uuid('from_subsidiary_id').notNull().references(() => subsidiaries.id, { onDelete: 'restrict' }),
  fromWarehouseId: uuid('from_warehouse_id'),
  fromLocationId: uuid('from_location_id'),

  // Destination
  toSubsidiaryId: uuid('to_subsidiary_id').notNull().references(() => subsidiaries.id, { onDelete: 'restrict' }),
  toWarehouseId: uuid('to_warehouse_id'),
  toLocationId: uuid('to_location_id'),

  // For intercompany transfers
  isIntercompany: boolean('is_intercompany').default(false),
  transferPrice: decimal('transfer_price', { precision: 18, scale: 4 }),
  currencyCode: text('currency_code').default('USD'),

  // Transit information
  expectedShipDate: date('expected_ship_date'),
  actualShipDate: date('actual_ship_date'),
  expectedReceiveDate: date('expected_receive_date'),
  actualReceiveDate: date('actual_receive_date'),
  trackingNumber: text('tracking_number'),
  carrier: text('carrier'),

  // Reason and documentation
  reason: text('reason'),
  reference: text('reference'),
  notes: text('notes'),

  // GL posting references
  shipGlTransactionId: uuid('ship_gl_transaction_id'),
  receiveGlTransactionId: uuid('receive_gl_transaction_id'),
  shippedAt: timestamp('shipped_at', { withTimezone: true }),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  postedAt: timestamp('posted_at', { withTimezone: true }),

  // Approval tracking
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  submittedBy: uuid('submitted_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: uuid('approved_by'),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  rejectedBy: uuid('rejected_by'),
  rejectionReason: text('rejection_reason'),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
}, (table) => ({
  transferNumberUnique: unique('inventory_transfers_number_unique').on(table.organizationId, table.transferNumber),
  statusIdx: index('inventory_transfers_status_idx').on(table.status),
  dateIdx: index('inventory_transfers_date_idx').on(table.transferDate),
  fromSubsidiaryIdx: index('inventory_transfers_from_subsidiary_idx').on(table.fromSubsidiaryId),
  toSubsidiaryIdx: index('inventory_transfers_to_subsidiary_idx').on(table.toSubsidiaryId),
}));

export type InventoryTransferRecord = typeof inventoryTransfers.$inferSelect;
export type InsertInventoryTransfer = typeof inventoryTransfers.$inferInsert;

/**
 * Line items for inventory transfers
 */
export const inventoryTransferLines = pgTable('inventory_transfer_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  transferId: uuid('transfer_id').notNull().references(() => inventoryTransfers.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'restrict' }),

  // Source bin/location
  fromBinId: uuid('from_bin_id'),

  // Destination bin/location
  toBinId: uuid('to_bin_id'),

  // Lot/Serial tracking
  lotNumberId: uuid('lot_number_id'),
  serialNumber: text('serial_number'),

  // Quantities
  quantityRequested: decimal('quantity_requested', { precision: 18, scale: 4 }).notNull(),
  quantityShipped: decimal('quantity_shipped', { precision: 18, scale: 4 }),
  quantityReceived: decimal('quantity_received', { precision: 18, scale: 4 }),
  unitOfMeasure: text('unit_of_measure'),

  // Costs
  unitCost: decimal('unit_cost', { precision: 18, scale: 4 }),
  totalCost: decimal('total_cost', { precision: 18, scale: 4 }),

  // For intercompany transfers
  transferUnitPrice: decimal('transfer_unit_price', { precision: 18, scale: 4 }),
  transferTotalPrice: decimal('transfer_total_price', { precision: 18, scale: 4 }),

  // GL accounts
  fromInventoryAccountId: uuid('from_inventory_account_id').references(() => accounts.id),
  toInventoryAccountId: uuid('to_inventory_account_id').references(() => accounts.id),
  transitAccountId: uuid('transit_account_id').references(() => accounts.id),

  // Cost layer tracking
  costLayerId: uuid('cost_layer_id'),
  newCostLayerId: uuid('new_cost_layer_id'),

  // Line-level notes
  notes: text('notes'),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  transferIdx: index('inventory_transfer_lines_transfer_idx').on(table.transferId),
  itemIdx: index('inventory_transfer_lines_item_idx').on(table.itemId),
}));

export type InventoryTransferLineRecord = typeof inventoryTransferLines.$inferSelect;
export type InsertInventoryTransferLine = typeof inventoryTransferLines.$inferInsert;

// ============================================================================
// Approval History (shared for adjustments and transfers)
// ============================================================================

export const inventoryApprovalHistory = pgTable('inventory_approval_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  // Reference to source document
  documentType: text('document_type').notNull(), // ADJUSTMENT, TRANSFER
  documentId: uuid('document_id').notNull(),

  // Action taken
  action: text('action').notNull(), // SUBMITTED, APPROVED, REJECTED, CANCELLED
  previousStatus: text('previous_status'),
  newStatus: text('new_status'),

  // Actor
  actorId: uuid('actor_id').notNull(),
  actorName: text('actor_name'),

  // Details
  comments: text('comments'),
  approvalLevel: text('approval_level'),

  // Timestamp
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  documentIdx: index('inventory_approval_history_document_idx').on(table.documentType, table.documentId),
  createdAtIdx: index('inventory_approval_history_created_at_idx').on(table.createdAt),
}));

export type InventoryApprovalHistoryRecord = typeof inventoryApprovalHistory.$inferSelect;
export type InsertInventoryApprovalHistory = typeof inventoryApprovalHistory.$inferInsert;

// ============================================================================
// Adjustment Reason Codes (configurable per organization)
// ============================================================================

export const adjustmentReasonCodes = pgTable('adjustment_reason_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  code: text('code').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  adjustmentType: adjustmentTypeEnum('adjustment_type'),

  // Default GL accounts for this reason
  defaultInventoryAccountId: uuid('default_inventory_account_id').references(() => accounts.id),
  defaultAdjustmentAccountId: uuid('default_adjustment_account_id').references(() => accounts.id),

  // Approval requirements
  requiresApproval: boolean('requires_approval').default(true),
  approvalThreshold: decimal('approval_threshold', { precision: 18, scale: 4 }),

  // Status
  isActive: boolean('is_active').default(true).notNull(),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
}, (table) => ({
  codeUnique: unique('adjustment_reason_codes_unique').on(table.organizationId, table.code),
  activeIdx: index('adjustment_reason_codes_active_idx').on(table.organizationId, table.isActive),
}));

export type AdjustmentReasonCodeRecord = typeof adjustmentReasonCodes.$inferSelect;
export type InsertAdjustmentReasonCode = typeof adjustmentReasonCodes.$inferInsert;

// ============================================================================
// Relations
// ============================================================================

export const inventoryAdjustmentsRelations = relations(inventoryAdjustments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [inventoryAdjustments.organizationId],
    references: [organizations.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [inventoryAdjustments.subsidiaryId],
    references: [subsidiaries.id],
  }),
  lines: many(inventoryAdjustmentLines),
}));

export const inventoryAdjustmentLinesRelations = relations(inventoryAdjustmentLines, ({ one }) => ({
  adjustment: one(inventoryAdjustments, {
    fields: [inventoryAdjustmentLines.adjustmentId],
    references: [inventoryAdjustments.id],
  }),
  item: one(items, {
    fields: [inventoryAdjustmentLines.itemId],
    references: [items.id],
  }),
  inventoryAccount: one(accounts, {
    fields: [inventoryAdjustmentLines.inventoryAccountId],
    references: [accounts.id],
  }),
  adjustmentAccount: one(accounts, {
    fields: [inventoryAdjustmentLines.adjustmentAccountId],
    references: [accounts.id],
  }),
}));

export const inventoryTransfersRelations = relations(inventoryTransfers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [inventoryTransfers.organizationId],
    references: [organizations.id],
  }),
  fromSubsidiary: one(subsidiaries, {
    fields: [inventoryTransfers.fromSubsidiaryId],
    references: [subsidiaries.id],
  }),
  toSubsidiary: one(subsidiaries, {
    fields: [inventoryTransfers.toSubsidiaryId],
    references: [subsidiaries.id],
  }),
  lines: many(inventoryTransferLines),
}));

export const inventoryTransferLinesRelations = relations(inventoryTransferLines, ({ one }) => ({
  transfer: one(inventoryTransfers, {
    fields: [inventoryTransferLines.transferId],
    references: [inventoryTransfers.id],
  }),
  item: one(items, {
    fields: [inventoryTransferLines.itemId],
    references: [items.id],
  }),
}));

export const adjustmentReasonCodesRelations = relations(adjustmentReasonCodes, ({ one }) => ({
  organization: one(organizations, {
    fields: [adjustmentReasonCodes.organizationId],
    references: [organizations.id],
  }),
  defaultInventoryAccount: one(accounts, {
    fields: [adjustmentReasonCodes.defaultInventoryAccountId],
    references: [accounts.id],
  }),
  defaultAdjustmentAccount: one(accounts, {
    fields: [adjustmentReasonCodes.defaultAdjustmentAccountId],
    references: [accounts.id],
  }),
}));
