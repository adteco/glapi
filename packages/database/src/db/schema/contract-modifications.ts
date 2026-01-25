import { pgTable, text, timestamp, jsonb, decimal, integer, boolean, index, unique, pgEnum, uuid } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { subscriptions } from './subscriptions';
import { subscriptionItems } from './subscription-items';
import { items } from './items';
import { performanceObligations } from './performance-obligations';
import { revenueJournalEntries } from './revenue-journal-entries';

/**
 * Modification method enum - Based on ASC 606-10-25-12
 */
export const modificationMethodEnum = pgEnum('modification_method', [
  'prospective',          // Account for remaining obligations only
  'cumulative_catch_up',  // Adjust revenue from contract inception
  'separate_contract',    // Treat as new distinct contract
  'blend_extend'         // Blend and extend remaining terms
]);

/**
 * Modification type enum
 */
export const modificationTypeEnum = pgEnum('modification_type', [
  'add_items',
  'remove_items',
  'quantity_change',
  'price_change',
  'term_extension',
  'early_termination',
  'partial_termination',
  'upgrade',
  'downgrade',
  'blend_extend',
  'cancellation'
]);

/**
 * Modification status enum
 */
export const modificationStatusEnum = pgEnum('modification_status', [
  'draft',
  'pending_approval',
  'approved',
  'applied',
  'rejected',
  'cancelled'
]);

/**
 * Contract Modifications Table
 * Tracks all contract modifications with full ASC 606 compliance
 */
export const contractModifications = pgTable('contract_modifications', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  subscriptionId: text('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'restrict' }),
  
  // Modification details
  modificationNumber: text('modification_number').notNull(),
  modificationType: modificationTypeEnum('modification_type').notNull(),
  modificationMethod: modificationMethodEnum('modification_method').notNull(),
  
  // Dates
  requestDate: timestamp('request_date', { withTimezone: true }).notNull(),
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  approvalDate: timestamp('approval_date', { withTimezone: true }),
  appliedDate: timestamp('applied_date', { withTimezone: true }),
  
  // Financial values
  originalContractValue: decimal('original_contract_value', { precision: 15, scale: 2 }).notNull(),
  modifiedContractValue: decimal('modified_contract_value', { precision: 15, scale: 2 }).notNull(),
  adjustmentAmount: decimal('adjustment_amount', { precision: 15, scale: 2 }).notNull(),
  refundAmount: decimal('refund_amount', { precision: 15, scale: 2 }),
  creditAmount: decimal('credit_amount', { precision: 15, scale: 2 }),
  
  // Modification details
  modificationDetails: jsonb('modification_details').notNull(),
  
  // Impact analysis
  revenueImpact: jsonb('revenue_impact'),
  obligationChanges: jsonb('obligation_changes'),
  scheduleChanges: jsonb('schedule_changes'),
  
  // Accounting treatment
  cumulativeCatchUpAmount: decimal('cumulative_catch_up_amount', { precision: 15, scale: 2 }),
  prospectiveAdjustmentAmount: decimal('prospective_adjustment_amount', { precision: 15, scale: 2 }),
  
  // Workflow
  status: modificationStatusEnum('status').notNull().default('draft'),
  requestedBy: text('requested_by'),
  approvedBy: text('approved_by'),
  rejectedBy: text('rejected_by'),
  rejectionReason: text('rejection_reason'),
  
  // Approval requirements
  requiresFinanceApproval: boolean('requires_finance_approval').default(false),
  requiresLegalApproval: boolean('requires_legal_approval').default(false),
  financeApprovedBy: text('finance_approved_by'),
  legalApprovedBy: text('legal_approved_by'),
  financeApprovedAt: timestamp('finance_approved_at', { withTimezone: true }),
  legalApprovedAt: timestamp('legal_approved_at', { withTimezone: true }),
  
  // Documentation
  reason: text('reason'),
  notes: text('notes'),
  customerNotificationSent: boolean('customer_notification_sent').default(false),
  customerNotificationDate: timestamp('customer_notification_date', { withTimezone: true }),
  
  // Parent modification for multi-step modifications
  // Note: Self-reference constraint defined separately to avoid TypeScript circular inference
  parentModificationId: text('parent_modification_id'),
  
  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  orgIdx: index('contract_mods_org_idx').on(table.organizationId),
  subscriptionIdx: index('contract_mods_subscription_idx').on(table.subscriptionId),
  statusIdx: index('contract_mods_status_idx').on(table.status),
  effectiveDateIdx: index('contract_mods_effective_date_idx').on(table.effectiveDate),
  modNumberUnique: unique('contract_mods_number_unique').on(table.organizationId, table.modificationNumber)
}));

/**
 * Modification Line Items Table
 * Tracks individual line item changes within a modification
 */
export const modificationLineItems = pgTable('modification_line_items', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  modificationId: text('modification_id').notNull().references(() => contractModifications.id, { onDelete: 'cascade' }),
  
  // Change type
  changeType: text('change_type').notNull(), // 'add', 'remove', 'modify'
  
  // Item references
  originalSubscriptionItemId: text('original_subscription_item_id').references(() => subscriptionItems.id, { onDelete: 'set null' }),
  newItemId: text('new_item_id').references(() => items.id, { onDelete: 'set null' }),
  
  // Original values (for modifications)
  originalQuantity: decimal('original_quantity', { precision: 10, scale: 2 }),
  originalUnitPrice: decimal('original_unit_price', { precision: 15, scale: 2 }),
  originalStartDate: timestamp('original_start_date', { withTimezone: true }),
  originalEndDate: timestamp('original_end_date', { withTimezone: true }),
  originalDiscountPercent: decimal('original_discount_percent', { precision: 5, scale: 2 }),
  
  // New values
  newQuantity: decimal('new_quantity', { precision: 10, scale: 2 }),
  newUnitPrice: decimal('new_unit_price', { precision: 15, scale: 2 }),
  newStartDate: timestamp('new_start_date', { withTimezone: true }),
  newEndDate: timestamp('new_end_date', { withTimezone: true }),
  newDiscountPercent: decimal('new_discount_percent', { precision: 5, scale: 2 }),
  
  // Financial impact
  revenueAdjustment: decimal('revenue_adjustment', { precision: 15, scale: 2 }),
  ssp: decimal('ssp', { precision: 15, scale: 2 }),
  allocatedAmount: decimal('allocated_amount', { precision: 15, scale: 2 }),
  
  // Metadata
  itemName: text('item_name'),
  itemType: text('item_type'),
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  modificationIdx: index('mod_line_items_mod_idx').on(table.modificationId),
  changeTypeIdx: index('mod_line_items_change_type_idx').on(table.changeType)
}));

/**
 * Cumulative Catch-up Adjustments Table
 * Tracks ASC 606 cumulative catch-up adjustments
 */
export const catchUpAdjustments = pgTable('catch_up_adjustments', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  modificationId: text('modification_id').notNull().references(() => contractModifications.id, { onDelete: 'cascade' }),
  performanceObligationId: text('performance_obligation_id').references(() => performanceObligations.id, { onDelete: 'set null' }),
  
  // Adjustment calculation
  priorRecognizedAmount: decimal('prior_recognized_amount', { precision: 15, scale: 2 }).notNull(),
  revisedCumulativeAmount: decimal('revised_cumulative_amount', { precision: 15, scale: 2 }).notNull(),
  catchUpAdjustment: decimal('catch_up_adjustment', { precision: 15, scale: 2 }).notNull(),
  
  // Revenue components
  priorRecognizedRevenue: decimal('prior_recognized_revenue', { precision: 15, scale: 2 }).notNull(),
  priorDeferredRevenue: decimal('prior_deferred_revenue', { precision: 15, scale: 2 }).notNull(),
  revisedRecognizedRevenue: decimal('revised_recognized_revenue', { precision: 15, scale: 2 }).notNull(),
  revisedDeferredRevenue: decimal('revised_deferred_revenue', { precision: 15, scale: 2 }).notNull(),
  
  // Journal entry reference
  journalEntryId: text('journal_entry_id').references(() => revenueJournalEntries.id, { onDelete: 'set null' }),
  
  // Period information
  adjustmentDate: timestamp('adjustment_date', { withTimezone: true }).notNull(),
  fiscalYear: integer('fiscal_year').notNull(),
  fiscalPeriod: integer('fiscal_period').notNull(),
  
  // Status
  status: text('status').notNull().default('calculated'), // 'calculated', 'posted', 'reversed'
  postedDate: timestamp('posted_date', { withTimezone: true }),
  reversedDate: timestamp('reversed_date', { withTimezone: true }),
  reversalReason: text('reversal_reason'),
  
  // Metadata
  calculationMethod: text('calculation_method'),
  calculationDetails: jsonb('calculation_details'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by')
}, (table) => ({
  orgIdx: index('catch_up_org_idx').on(table.organizationId),
  modificationIdx: index('catch_up_mod_idx').on(table.modificationId),
  obligationIdx: index('catch_up_obligation_idx').on(table.performanceObligationId),
  statusIdx: index('catch_up_status_idx').on(table.status),
  periodIdx: index('catch_up_period_idx').on(table.fiscalYear, table.fiscalPeriod)
}));

/**
 * Modification Approval History Table
 * Tracks approval workflow for modifications
 */
export const modificationApprovalHistory = pgTable('modification_approval_history', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  modificationId: text('modification_id').notNull().references(() => contractModifications.id, { onDelete: 'cascade' }),
  
  // Approval details
  approvalLevel: text('approval_level').notNull(), // 'manager', 'finance', 'legal', 'executive'
  approvalAction: text('approval_action').notNull(), // 'approved', 'rejected', 'requested_info'
  approvedBy: text('approved_by').notNull(),
  approvalDate: timestamp('approval_date', { withTimezone: true }).notNull(),
  
  // Comments and conditions
  comments: text('comments'),
  conditions: jsonb('conditions'),
  
  // Delegation
  delegatedFrom: text('delegated_from'),
  delegationReason: text('delegation_reason'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  modificationIdx: index('approval_history_mod_idx').on(table.modificationId),
  approverIdx: index('approval_history_approver_idx').on(table.approvedBy),
  dateIdx: index('approval_history_date_idx').on(table.approvalDate)
}));

// Type exports
export type ModificationLineItem = typeof modificationLineItems.$inferSelect;
export type NewModificationLineItem = typeof modificationLineItems.$inferInsert;
export type CatchUpAdjustment = typeof catchUpAdjustments.$inferSelect;
export type NewCatchUpAdjustment = typeof catchUpAdjustments.$inferInsert;
export type ModificationApprovalHistory = typeof modificationApprovalHistory.$inferSelect;
export type NewModificationApprovalHistory = typeof modificationApprovalHistory.$inferInsert;

// Enum exports
export const ModificationMethod = {
  PROSPECTIVE: 'prospective',
  CUMULATIVE_CATCH_UP: 'cumulative_catch_up',
  SEPARATE_CONTRACT: 'separate_contract',
  BLEND_EXTEND: 'blend_extend'
} as const;

export const ModificationType = {
  ADD_ITEMS: 'add_items',
  REMOVE_ITEMS: 'remove_items',
  QUANTITY_CHANGE: 'quantity_change',
  PRICE_CHANGE: 'price_change',
  TERM_EXTENSION: 'term_extension',
  EARLY_TERMINATION: 'early_termination',
  PARTIAL_TERMINATION: 'partial_termination',
  UPGRADE: 'upgrade',
  DOWNGRADE: 'downgrade',
  BLEND_EXTEND: 'blend_extend',
  CANCELLATION: 'cancellation'
} as const;

export const ModificationStatus = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  APPLIED: 'applied',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
} as const;

// Type exports
export type ContractModification = typeof contractModifications.$inferSelect;
export type NewContractModification = typeof contractModifications.$inferInsert;
export type UpdateContractModification = Partial<NewContractModification>;

// Enum value type exports
export type ModificationMethodValue = typeof ModificationMethod[keyof typeof ModificationMethod];
export type ModificationTypeValue = typeof ModificationType[keyof typeof ModificationType];
export type ModificationStatusValue = typeof ModificationStatus[keyof typeof ModificationStatus];