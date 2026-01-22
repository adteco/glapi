/**
 * Import Staging Schema
 *
 * Staging tables for data import/migration operations.
 * Supports validation, error tracking, and batch processing.
 */

import { relations } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

// ============================================================================
// Enums
// ============================================================================

/**
 * Import batch status
 */
export const importBatchStatusEnum = pgEnum('import_batch_status', [
  'pending',      // Batch created, not yet processed
  'validating',   // Running validation
  'validated',    // Validation complete (may have errors)
  'processing',   // Importing data
  'completed',    // Import complete
  'failed',       // Import failed
  'rolled_back',  // Import was rolled back
  'cancelled',    // Import cancelled by user
]);

/**
 * Import record status
 */
export const importRecordStatusEnum = pgEnum('import_record_status', [
  'pending',      // Not yet validated
  'valid',        // Passed validation
  'invalid',      // Failed validation
  'imported',     // Successfully imported
  'skipped',      // Skipped (duplicate, etc.)
  'failed',       // Import failed
]);

/**
 * Import data type
 */
export const importDataTypeEnum = pgEnum('import_data_type', [
  // Master data
  'account',            // Chart of accounts
  'customer',           // Customer entities
  'vendor',             // Vendor entities
  'employee',           // Employee entities
  'item',               // Items/Products
  'department',         // Departments
  'class',              // Classes
  'location',           // Locations
  'project',            // Projects/Jobs
  'cost_code',          // Project cost codes
  'subsidiary',         // Subsidiaries
  // Transactional data
  'journal_entry',      // GL Journal entries
  'invoice',            // Sales invoices
  'bill',               // Vendor bills
  'payment',            // Customer payments
  'bill_payment',       // Vendor bill payments
  'opening_balance',    // Opening balances
  'budget',             // Budget data
  'time_entry',         // Time entries
  'expense_entry',      // Expense entries
]);

/**
 * Import source system
 */
export const importSourceSystemEnum = pgEnum('import_source_system', [
  'quickbooks_online',
  'quickbooks_desktop',
  'xero',
  'sage',
  'netsuite',
  'dynamics',
  'freshbooks',
  'wave',
  'csv',
  'excel',
  'json',
  'other',
]);

// ============================================================================
// Import Batch Table
// ============================================================================

/**
 * Import batch - tracks a single import operation
 */
export const importBatches = pgTable('import_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),

  // Batch identification
  batchNumber: text('batch_number').notNull(),
  name: text('name').notNull(),
  description: text('description'),

  // Source information
  sourceSystem: importSourceSystemEnum('source_system').notNull(),
  sourceFile: text('source_file'),
  sourceFileHash: text('source_file_hash'),

  // Data type(s) being imported
  dataTypes: importDataTypeEnum('data_types').array().notNull(),

  // Status tracking
  status: importBatchStatusEnum('status').default('pending').notNull(),

  // Statistics
  totalRecords: integer('total_records').default(0).notNull(),
  validRecords: integer('valid_records').default(0).notNull(),
  invalidRecords: integer('invalid_records').default(0).notNull(),
  importedRecords: integer('imported_records').default(0).notNull(),
  skippedRecords: integer('skipped_records').default(0).notNull(),
  failedRecords: integer('failed_records').default(0).notNull(),

  // Timing
  validationStartedAt: timestamp('validation_started_at', { withTimezone: true }),
  validationCompletedAt: timestamp('validation_completed_at', { withTimezone: true }),
  importStartedAt: timestamp('import_started_at', { withTimezone: true }),
  importCompletedAt: timestamp('import_completed_at', { withTimezone: true }),

  // Rollback support
  canRollback: boolean('can_rollback').default(true).notNull(),
  rolledBackAt: timestamp('rolled_back_at', { withTimezone: true }),
  rolledBackBy: text('rolled_back_by'),

  // Configuration
  options: jsonb('options').$type<ImportBatchOptions>(),

  // Error summary
  errorSummary: jsonb('error_summary').$type<ImportErrorSummary>(),

  // Audit
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgBatchIdx: unique('import_batches_org_batch_unique').on(table.organizationId, table.batchNumber),
  statusIdx: index('import_batches_status_idx').on(table.status),
  createdAtIdx: index('import_batches_created_at_idx').on(table.createdAt),
}));

// ============================================================================
// Import Records Table (Staging)
// ============================================================================

/**
 * Import records - individual records being imported
 */
export const importRecords = pgTable('import_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').notNull().references(() => importBatches.id, { onDelete: 'cascade' }),

  // Record identification
  rowNumber: integer('row_number').notNull(),
  externalId: text('external_id'),

  // Data type
  dataType: importDataTypeEnum('data_type').notNull(),

  // Raw data from source
  rawData: jsonb('raw_data').notNull(),

  // Transformed/mapped data ready for import
  mappedData: jsonb('mapped_data'),

  // Status
  status: importRecordStatusEnum('status').default('pending').notNull(),

  // Validation results
  validationErrors: jsonb('validation_errors').$type<ValidationError[]>(),
  validationWarnings: jsonb('validation_warnings').$type<ValidationWarning[]>(),

  // Import results
  importedEntityId: uuid('imported_entity_id'),
  importedEntityType: text('imported_entity_type'),
  importError: text('import_error'),

  // Duplicate detection
  isDuplicate: boolean('is_duplicate').default(false).notNull(),
  duplicateOfId: uuid('duplicate_of_id'),

  // Timestamps
  validatedAt: timestamp('validated_at', { withTimezone: true }),
  importedAt: timestamp('imported_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  batchRowIdx: unique('import_records_batch_row_unique').on(table.batchId, table.rowNumber),
  batchStatusIdx: index('import_records_batch_status_idx').on(table.batchId, table.status),
  externalIdIdx: index('import_records_external_id_idx').on(table.batchId, table.externalId),
  dataTypeIdx: index('import_records_data_type_idx').on(table.dataType),
}));

// ============================================================================
// Import Field Mappings Table
// ============================================================================

/**
 * Import field mappings - defines how source fields map to target fields
 */
export const importFieldMappings = pgTable('import_field_mappings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),

  // Mapping identification
  name: text('name').notNull(),
  description: text('description'),

  // Source/target
  sourceSystem: importSourceSystemEnum('source_system').notNull(),
  dataType: importDataTypeEnum('data_type').notNull(),

  // Field mappings
  mappings: jsonb('mappings').notNull().$type<FieldMapping[]>(),

  // Value transformations
  transformations: jsonb('transformations').$type<FieldTransformation[]>(),

  // Default values
  defaults: jsonb('defaults').$type<Record<string, unknown>>(),

  // Status
  isDefault: boolean('is_default').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgSourceTypeIdx: index('import_field_mappings_org_source_type_idx')
    .on(table.organizationId, table.sourceSystem, table.dataType),
}));

// ============================================================================
// Import Templates Table
// ============================================================================

/**
 * Import templates - predefined import configurations
 */
export const importTemplates = pgTable('import_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id'),

  // Template identification
  name: text('name').notNull(),
  description: text('description'),

  // Configuration
  sourceSystem: importSourceSystemEnum('source_system').notNull(),
  dataTypes: importDataTypeEnum('data_types').array().notNull(),

  // Template options
  options: jsonb('options').$type<ImportTemplateOptions>(),

  // Validation rules
  validationRules: jsonb('validation_rules').$type<ValidationRule[]>(),

  // Status
  isSystemTemplate: boolean('is_system_template').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgNameIdx: unique('import_templates_org_name_unique').on(table.organizationId, table.name),
}));

// ============================================================================
// Import Audit Log Table
// ============================================================================

/**
 * Import audit log - tracks all import-related actions
 */
export const importAuditLogs = pgTable('import_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').references(() => importBatches.id, { onDelete: 'cascade' }),
  recordId: uuid('record_id').references(() => importRecords.id, { onDelete: 'cascade' }),

  // Action
  action: text('action').notNull(),

  // Details
  details: jsonb('details'),

  // Before/after state (for rollback)
  beforeState: jsonb('before_state'),
  afterState: jsonb('after_state'),

  // Error info
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),

  // Audit fields
  performedBy: text('performed_by').notNull(),
  performedAt: timestamp('performed_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  batchIdx: index('import_audit_logs_batch_idx').on(table.batchId),
  recordIdx: index('import_audit_logs_record_idx').on(table.recordId),
  actionIdx: index('import_audit_logs_action_idx').on(table.action),
  performedAtIdx: index('import_audit_logs_performed_at_idx').on(table.performedAt),
}));

// ============================================================================
// Relations
// ============================================================================

export const importBatchesRelations = relations(importBatches, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [importBatches.organizationId],
    references: [organizations.id],
  }),
  records: many(importRecords),
  auditLogs: many(importAuditLogs),
}));

export const importRecordsRelations = relations(importRecords, ({ one, many }) => ({
  batch: one(importBatches, {
    fields: [importRecords.batchId],
    references: [importBatches.id],
  }),
  auditLogs: many(importAuditLogs),
}));

export const importFieldMappingsRelations = relations(importFieldMappings, ({ one }) => ({
  organization: one(organizations, {
    fields: [importFieldMappings.organizationId],
    references: [organizations.id],
  }),
}));

export const importTemplatesRelations = relations(importTemplates, ({ one }) => ({
  organization: one(organizations, {
    fields: [importTemplates.organizationId],
    references: [organizations.id],
  }),
}));

export const importAuditLogsRelations = relations(importAuditLogs, ({ one }) => ({
  batch: one(importBatches, {
    fields: [importAuditLogs.batchId],
    references: [importBatches.id],
  }),
  record: one(importRecords, {
    fields: [importAuditLogs.recordId],
    references: [importRecords.id],
  }),
}));

// ============================================================================
// TypeScript Types
// ============================================================================

/**
 * Import batch options
 */
export interface ImportBatchOptions {
  /** Skip duplicate records instead of failing */
  skipDuplicates?: boolean;
  /** Update existing records instead of skipping */
  updateExisting?: boolean;
  /** Continue on validation errors */
  continueOnErrors?: boolean;
  /** Maximum number of errors before stopping */
  maxErrors?: number;
  /** Dry run mode (validate only) */
  dryRun?: boolean;
  /** Enable rollback tracking */
  enableRollback?: boolean;
  /** Field mapping ID to use */
  fieldMappingId?: string;
  /** Custom validation rules */
  validationRules?: ValidationRule[];
  /** Date format for parsing */
  dateFormat?: string;
  /** Decimal separator */
  decimalSeparator?: string;
  /** Thousands separator */
  thousandsSeparator?: string;
}

/**
 * Import template options
 */
export interface ImportTemplateOptions extends ImportBatchOptions {
  /** Column mappings for CSV/Excel */
  columnMappings?: Record<string, string>;
  /** Required columns */
  requiredColumns?: string[];
  /** Columns to skip */
  skipColumns?: string[];
  /** Header row number (1-based) */
  headerRow?: number;
  /** Data start row (1-based) */
  dataStartRow?: number;
}

/**
 * Field mapping definition
 */
export interface FieldMapping {
  /** Source field name */
  sourceField: string;
  /** Target field name */
  targetField: string;
  /** Is this mapping required */
  required?: boolean;
  /** Default value if source is empty */
  defaultValue?: unknown;
  /** Transformation to apply */
  transformation?: string;
}

/**
 * Field transformation
 */
export interface FieldTransformation {
  /** Field to transform */
  field: string;
  /** Transformation type */
  type: 'uppercase' | 'lowercase' | 'trim' | 'date' | 'number' | 'boolean' | 'lookup' | 'custom';
  /** Transformation parameters */
  params?: Record<string, unknown>;
}

/**
 * Validation rule
 */
export interface ValidationRule {
  /** Field to validate */
  field: string;
  /** Rule type */
  type: 'required' | 'format' | 'range' | 'lookup' | 'unique' | 'custom' | 'dependency' | 'crossfield';
  /** Rule parameters */
  params?: Record<string, unknown>;
  /** Error message */
  message?: string;
  /** Severity */
  severity?: 'error' | 'warning';
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Field with error */
  field: string;
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Expected value/format */
  expected?: string;
  /** Actual value */
  actual?: unknown;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Field with warning */
  field: string;
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Suggestion */
  suggestion?: string;
}

/**
 * Import error summary
 */
export interface ImportErrorSummary {
  /** Total errors */
  totalErrors: number;
  /** Errors by code */
  errorsByCode: Record<string, number>;
  /** Errors by field */
  errorsByField: Record<string, number>;
  /** Sample errors */
  sampleErrors: ValidationError[];
}
