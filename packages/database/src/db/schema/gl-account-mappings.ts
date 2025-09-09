import { pgTable, text, timestamp, jsonb, integer, boolean, index, unique, primaryKey } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { subsidiaries } from './subsidiaries';
import { departments } from './departments';
import { locations } from './locations';
import { classes } from './classes';
import { items } from './items';

/**
 * GL Account Mappings Table
 * Configures how revenue transactions map to GL accounts
 */
export const glAccountMappings = pgTable('gl_account_mappings', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Mapping Name and Description
  mappingName: text('mapping_name').notNull(),
  description: text('description'),
  
  // Account Types
  accountType: text('account_type').notNull(), // 'revenue', 'deferred_revenue', 'ar', 'cash', 'tax', 'discount'
  transactionType: text('transaction_type').notNull(), // 'recognition', 'billing', 'payment', 'adjustment'
  
  // GL Account Information
  glAccountCode: text('gl_account_code').notNull(),
  glAccountName: text('gl_account_name').notNull(),
  glAccountType: text('gl_account_type'), // 'asset', 'liability', 'revenue', 'expense', 'equity'
  
  // Mapping Dimensions (null means applies to all)
  subsidiaryId: text('subsidiary_id').references(() => subsidiaries.id, { onDelete: 'set null' }),
  departmentId: text('department_id').references(() => departments.id, { onDelete: 'set null' }),
  locationId: text('location_id').references(() => locations.id, { onDelete: 'set null' }),
  classId: text('class_id').references(() => classes.id, { onDelete: 'set null' }),
  itemId: text('item_id').references(() => items.id, { onDelete: 'set null' }),
  itemCategory: text('item_category'), // 'license', 'maintenance', 'service', 'hardware'
  
  // Priority for rule matching (higher = higher priority)
  priority: integer('priority').default(0).notNull(),
  
  // Complex mapping rules (JSON)
  mappingRules: jsonb('mapping_rules'), // Complex conditions in JSON format
  
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  isDefault: boolean('is_default').default(false).notNull(), // Default mapping for account type
  
  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedBy: text('updated_by')
}, (table) => ({
  // Indexes for fast lookups
  orgIdx: index('gl_mappings_org_idx').on(table.organizationId),
  accountTypeIdx: index('gl_mappings_account_type_idx').on(table.accountType),
  transactionTypeIdx: index('gl_mappings_transaction_type_idx').on(table.transactionType),
  priorityIdx: index('gl_mappings_priority_idx').on(table.priority),
  activeIdx: index('gl_mappings_active_idx').on(table.isActive),
  
  // Composite indexes for dimension lookups
  dimensionIdx: index('gl_mappings_dimension_idx').on(
    table.organizationId,
    table.accountType,
    table.subsidiaryId,
    table.departmentId,
    table.locationId,
    table.classId,
    table.itemId
  ),
  
  // Unique constraint for default mappings per account type
  defaultUnique: unique('gl_mappings_default_unique').on(
    table.organizationId,
    table.accountType,
    table.transactionType,
    table.isDefault
  )
}));

/**
 * Journal Entry Batches Table
 * Manages batch processing of journal entries for period-end
 */
export const journalEntryBatches = pgTable('journal_entry_batches', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Batch Information
  batchNumber: text('batch_number').notNull(),
  batchName: text('batch_name').notNull(),
  description: text('description'),
  
  // Period Information
  periodStartDate: text('period_start_date').notNull(),
  periodEndDate: text('period_end_date').notNull(),
  fiscalYear: integer('fiscal_year').notNull(),
  fiscalPeriod: integer('fiscal_period').notNull(),
  
  // Batch Type
  batchType: text('batch_type').notNull(), // 'revenue_recognition', 'billing', 'payment', 'adjustment', 'reversal'
  processingType: text('processing_type').notNull(), // 'automatic', 'manual', 'scheduled'
  
  // Status and Workflow
  status: text('status').notNull().default('draft'), // 'draft', 'pending_approval', 'approved', 'posted', 'reversed', 'failed'
  approvalStatus: text('approval_status'), // 'pending', 'approved', 'rejected'
  
  // Batch Totals
  totalEntries: integer('total_entries').default(0).notNull(),
  totalDebits: text('total_debits').default('0').notNull(),
  totalCredits: text('total_credits').default('0').notNull(),
  
  // Processing Information
  scheduledPostDate: timestamp('scheduled_post_date', { withTimezone: true }),
  actualPostDate: timestamp('actual_post_date', { withTimezone: true }),
  reversalDate: timestamp('reversal_date', { withTimezone: true }),
  
  // External GL Integration
  externalBatchId: text('external_batch_id'), // ID in external GL system
  externalSystemName: text('external_system_name'), // 'quickbooks', 'netsuite', 'sage', 'sap'
  externalPostStatus: text('external_post_status'), // 'pending', 'posted', 'failed'
  externalPostDate: timestamp('external_post_date', { withTimezone: true }),
  externalErrorMessage: text('external_error_message'),
  
  // Approval Workflow
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  rejectedBy: text('rejected_by'),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  
  // Metadata
  metadata: jsonb('metadata'),
  
  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedBy: text('updated_by')
}, (table) => ({
  // Indexes
  orgIdx: index('je_batches_org_idx').on(table.organizationId),
  batchNumberIdx: unique('je_batches_number_unique').on(table.organizationId, table.batchNumber),
  periodIdx: index('je_batches_period_idx').on(table.periodStartDate, table.periodEndDate),
  statusIdx: index('je_batches_status_idx').on(table.status),
  typeIdx: index('je_batches_type_idx').on(table.batchType),
  externalIdx: index('je_batches_external_idx').on(table.externalBatchId),
  fiscalPeriodIdx: index('je_batches_fiscal_idx').on(table.fiscalYear, table.fiscalPeriod)
}));

/**
 * GL Account Mapping Rules Interface
 */
export interface GLMappingRule {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with' | 'in' | 'not_in';
  value: any;
  and?: GLMappingRule[];
  or?: GLMappingRule[];
}

/**
 * Journal Entry Batch Metadata Interface
 */
export interface JournalBatchMetadata {
  source: string;
  processedBy?: string;
  processingDuration?: number;
  entryIds?: string[];
  reconciliationStatus?: 'pending' | 'reconciled' | 'discrepancy';
  reconciliationDate?: string;
  reconciliationNotes?: string;
  warnings?: string[];
  additionalInfo?: Record<string, any>;
}

// Type exports for better type safety
export type GLAccountMapping = typeof glAccountMappings.$inferSelect;
export type NewGLAccountMapping = typeof glAccountMappings.$inferInsert;
export type JournalEntryBatch = typeof journalEntryBatches.$inferSelect;
export type NewJournalEntryBatch = typeof journalEntryBatches.$inferInsert;

// Enum exports for consistency
export const AccountTypes = {
  REVENUE: 'revenue',
  DEFERRED_REVENUE: 'deferred_revenue',
  ACCOUNTS_RECEIVABLE: 'ar',
  CASH: 'cash',
  TAX: 'tax',
  DISCOUNT: 'discount',
  UNBILLED_RECEIVABLE: 'unbilled_ar',
  CONTRACT_ASSET: 'contract_asset',
  CONTRACT_LIABILITY: 'contract_liability'
} as const;

export const TransactionTypes = {
  RECOGNITION: 'recognition',
  BILLING: 'billing',
  PAYMENT: 'payment',
  ADJUSTMENT: 'adjustment',
  REVERSAL: 'reversal',
  RECLASSIFICATION: 'reclassification'
} as const;

export const BatchStatuses = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  POSTED: 'posted',
  REVERSED: 'reversed',
  FAILED: 'failed'
} as const;

export const ExternalSystems = {
  QUICKBOOKS: 'quickbooks',
  NETSUITE: 'netsuite',
  SAGE: 'sage',
  SAP: 'sap',
  ORACLE: 'oracle',
  DYNAMICS: 'dynamics',
  XERO: 'xero',
  CUSTOM: 'custom'
} as const;