/**
 * Expense Entries Schema
 *
 * Supports expense tracking, reimbursements, and approval workflows for
 * construction accounting and project management.
 *
 * @module expense-entries
 * @task glapi-0ib.2
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  date,
  numeric,
  jsonb,
  timestamp,
  boolean,
  uniqueIndex,
  index,
  integer,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { subsidiaries } from './subsidiaries';
import { users } from './users';
import { entities } from './entities';
import { projects, projectCostCodes } from './projects';
import { approvalActionEnum } from './time-entries';

// ============================================================================
// Enums
// ============================================================================

/**
 * Expense entry status lifecycle:
 * - DRAFT: Entry being created/edited by employee
 * - SUBMITTED: Submitted for approval
 * - APPROVED: Approved by manager
 * - REJECTED: Rejected, requires revision
 * - REIMBURSED: Expense has been reimbursed
 * - POSTED: Expense posted to GL
 * - CANCELLED: Entry cancelled
 */
export const expenseEntryStatusEnum = pgEnum('expense_entry_status', [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'REIMBURSED',
  'POSTED',
  'CANCELLED',
]);

/**
 * Expense category for classification
 */
export const expenseCategoryEnum = pgEnum('expense_category', [
  'TRAVEL',
  'LODGING',
  'MEALS',
  'TRANSPORTATION',
  'SUPPLIES',
  'EQUIPMENT',
  'MATERIALS',
  'SUBCONTRACTOR',
  'COMMUNICATIONS',
  'PROFESSIONAL_SERVICES',
  'INSURANCE',
  'PERMITS_FEES',
  'OTHER',
]);

/**
 * Payment method for expense entries
 */
export const paymentMethodEnum = pgEnum('expense_payment_method', [
  'CORPORATE_CARD',
  'PERSONAL_CARD',
  'CASH',
  'CHECK',
  'DIRECT_PAYMENT',
  'REIMBURSEMENT_PENDING',
  'OTHER',
]);

// ============================================================================
// Expense Entries Table
// ============================================================================

/**
 * Expense entries - tracks expenses incurred against projects/cost codes
 */
export const expenseEntries = pgTable('expense_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  subsidiaryId: uuid('subsidiary_id').references(() => subsidiaries.id),

  // Employee reference (references entities table for business employees)
  employeeId: uuid('employee_id').notNull().references(() => entities.id),

  // Project/Cost code allocation
  projectId: uuid('project_id').references(() => projects.id),
  costCodeId: uuid('cost_code_id').references(() => projectCostCodes.id),

  // Expense details
  expenseDate: date('expense_date').notNull(),
  category: expenseCategoryEnum('category').notNull(),
  merchantName: text('merchant_name'),
  description: text('description').notNull(),

  // Amount details
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  currencyCode: text('currency_code').default('USD').notNull(),
  exchangeRate: numeric('exchange_rate', { precision: 18, scale: 8 }).default('1'),
  amountInBaseCurrency: numeric('amount_in_base_currency', { precision: 18, scale: 4 }),

  // Tax handling
  taxAmount: numeric('tax_amount', { precision: 18, scale: 4 }),
  isTaxDeductible: boolean('is_tax_deductible').default(true).notNull(),

  // Payment info
  paymentMethod: paymentMethodEnum('payment_method').default('PERSONAL_CARD').notNull(),
  requiresReimbursement: boolean('requires_reimbursement').default(true).notNull(),
  reimbursementAmount: numeric('reimbursement_amount', { precision: 18, scale: 4 }),

  // Billing flags
  isBillable: boolean('is_billable').default(false).notNull(),
  billingMarkup: numeric('billing_markup', { precision: 6, scale: 4 }),
  billableAmount: numeric('billable_amount', { precision: 18, scale: 4 }),

  // Notes
  internalNotes: text('internal_notes'),

  // Status and workflow
  status: expenseEntryStatusEnum('status').default('DRAFT').notNull(),

  // Workflow timestamps
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  submittedBy: uuid('submitted_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: uuid('approved_by').references(() => users.id),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  rejectedBy: uuid('rejected_by').references(() => users.id),
  rejectionReason: text('rejection_reason'),
  reimbursedAt: timestamp('reimbursed_at', { withTimezone: true }),
  postedAt: timestamp('posted_at', { withTimezone: true }),

  // GL posting reference
  glTransactionId: uuid('gl_transaction_id'),
  glPostingBatchId: uuid('gl_posting_batch_id'),

  // External system references
  externalId: text('external_id'),
  externalSource: text('external_source'),

  // Metadata
  metadata: jsonb('metadata'),

  // Audit fields
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Indexes for common queries
  orgDateIdx: index('idx_expense_entries_org_date').on(table.organizationId, table.expenseDate),
  employeeDateIdx: index('idx_expense_entries_employee_date').on(table.employeeId, table.expenseDate),
  projectIdx: index('idx_expense_entries_project').on(table.projectId),
  statusIdx: index('idx_expense_entries_status').on(table.organizationId, table.status),
  approvalIdx: index('idx_expense_entries_pending_approval').on(table.organizationId, table.status, table.submittedAt),
  categoryIdx: index('idx_expense_entries_category').on(table.organizationId, table.category),
  // Unique constraint for external ID per organization
  externalIdIdx: uniqueIndex('idx_expense_entries_external').on(table.organizationId, table.externalSource, table.externalId),
}));

// ============================================================================
// Expense Attachments Table
// ============================================================================

/**
 * Expense attachments - receipts and supporting documents
 */
export const expenseAttachments = pgTable('expense_attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  expenseEntryId: uuid('expense_entry_id').notNull().references(() => expenseEntries.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  // File info
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type'),

  // Storage info
  storageKey: text('storage_key').notNull(),
  storageProvider: text('storage_provider').default('s3').notNull(),
  publicUrl: text('public_url'),

  // Document type
  documentType: text('document_type').default('RECEIPT').notNull(), // RECEIPT, INVOICE, QUOTE, OTHER

  // OCR/parsing results
  ocrText: text('ocr_text'),
  parsedData: jsonb('parsed_data'),

  // Metadata
  metadata: jsonb('metadata'),

  // Audit fields
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  expenseIdx: index('idx_expense_attachments_expense').on(table.expenseEntryId),
  orgIdx: index('idx_expense_attachments_org').on(table.organizationId),
}));

// ============================================================================
// Expense Entry Approvals Table (Audit Trail)
// ============================================================================

/**
 * Expense entry approval history - audit trail for all approval actions
 */
export const expenseEntryApprovals = pgTable('expense_entry_approvals', {
  id: uuid('id').defaultRandom().primaryKey(),
  expenseEntryId: uuid('expense_entry_id').notNull().references(() => expenseEntries.id, { onDelete: 'cascade' }),

  // Action details
  action: approvalActionEnum('action').notNull(),
  previousStatus: expenseEntryStatusEnum('previous_status'),
  newStatus: expenseEntryStatusEnum('new_status').notNull(),

  // Who performed the action
  performedBy: uuid('performed_by').notNull().references(() => users.id),
  performedAt: timestamp('performed_at', { withTimezone: true }).defaultNow().notNull(),

  // Comments/notes
  comments: text('comments'),

  // Metadata (can include device info, IP, etc.)
  metadata: jsonb('metadata'),
}, (table) => ({
  expenseEntryIdx: index('idx_expense_entry_approvals_entry').on(table.expenseEntryId),
  performedByIdx: index('idx_expense_entry_approvals_performer').on(table.performedBy, table.performedAt),
}));

// ============================================================================
// Expense Reports Table (Batch submissions)
// ============================================================================

/**
 * Expense reports - for bulk submission and approval of expenses
 */
export const expenseReports = pgTable('expense_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  employeeId: uuid('employee_id').notNull().references(() => entities.id),

  // Report details
  reportNumber: text('report_number').notNull(),
  title: text('title').notNull(),
  description: text('description'),

  // Date range covered
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),

  // Purpose
  businessPurpose: text('business_purpose'),
  projectId: uuid('project_id').references(() => projects.id),

  // Totals
  totalEntries: integer('total_entries').default(0).notNull(),
  totalAmount: numeric('total_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  totalReimbursable: numeric('total_reimbursable', { precision: 18, scale: 4 }).default('0').notNull(),
  totalBillable: numeric('total_billable', { precision: 18, scale: 4 }).default('0').notNull(),

  // Status
  status: expenseEntryStatusEnum('status').default('DRAFT').notNull(),

  // Workflow timestamps
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  submittedBy: uuid('submitted_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: uuid('approved_by').references(() => users.id),
  reimbursedAt: timestamp('reimbursed_at', { withTimezone: true }),
  postedAt: timestamp('posted_at', { withTimezone: true }),

  // GL posting reference
  glPostingBatchId: uuid('gl_posting_batch_id'),

  // Metadata
  metadata: jsonb('metadata'),

  // Audit fields
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgReportIdx: uniqueIndex('idx_expense_reports_org_number').on(table.organizationId, table.reportNumber),
  employeeIdx: index('idx_expense_reports_employee').on(table.employeeId),
  periodIdx: index('idx_expense_reports_period').on(table.organizationId, table.periodStart, table.periodEnd),
  statusIdx: index('idx_expense_reports_status').on(table.organizationId, table.status),
}));

// ============================================================================
// Expense Report Items (Link entries to reports)
// ============================================================================

/**
 * Links expense entries to expense reports
 */
export const expenseReportItems = pgTable('expense_report_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  expenseReportId: uuid('expense_report_id').notNull().references(() => expenseReports.id, { onDelete: 'cascade' }),
  expenseEntryId: uuid('expense_entry_id').notNull().references(() => expenseEntries.id, { onDelete: 'cascade' }),

  // Item order within report
  lineNumber: integer('line_number').notNull(),

  // Metadata
  metadata: jsonb('metadata'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  reportIdx: index('idx_expense_report_items_report').on(table.expenseReportId),
  entryIdx: index('idx_expense_report_items_entry').on(table.expenseEntryId),
  uniqueEntryIdx: uniqueIndex('idx_expense_report_items_unique').on(table.expenseReportId, table.expenseEntryId),
}));

// ============================================================================
// Expense Policies Table
// ============================================================================

/**
 * Expense policies - defines limits and rules for expense approvals
 */
export const expensePolicies = pgTable('expense_policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  subsidiaryId: uuid('subsidiary_id').references(() => subsidiaries.id),

  // Policy name
  name: text('name').notNull(),
  description: text('description'),

  // Category-specific limits
  category: expenseCategoryEnum('category'),
  dailyLimit: numeric('daily_limit', { precision: 18, scale: 4 }),
  singleTransactionLimit: numeric('single_transaction_limit', { precision: 18, scale: 4 }),
  monthlyLimit: numeric('monthly_limit', { precision: 18, scale: 4 }),

  // Approval thresholds
  autoApproveLimit: numeric('auto_approve_limit', { precision: 18, scale: 4 }),
  requiresReceiptThreshold: numeric('requires_receipt_threshold', { precision: 18, scale: 4 }).default('25'),

  // Rules
  requiresProjectAllocation: boolean('requires_project_allocation').default(false).notNull(),
  requiresDescription: boolean('requires_description').default(true).notNull(),
  allowPartialBillable: boolean('allow_partial_billable').default(true).notNull(),

  // Priority
  priority: integer('priority').default(0).notNull(),

  // Status
  isActive: boolean('is_active').default(true).notNull(),

  // Effective dates
  effectiveFrom: date('effective_from'),
  effectiveTo: date('effective_to'),

  // Metadata
  metadata: jsonb('metadata'),

  // Audit fields
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('idx_expense_policies_org').on(table.organizationId),
  categoryIdx: index('idx_expense_policies_category').on(table.organizationId, table.category),
}));

// ============================================================================
// Relations
// ============================================================================

export const expenseEntriesRelations = relations(expenseEntries, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [expenseEntries.organizationId],
    references: [organizations.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [expenseEntries.subsidiaryId],
    references: [subsidiaries.id],
  }),
  employee: one(entities, {
    fields: [expenseEntries.employeeId],
    references: [entities.id],
    relationName: 'expenseEntryEmployee',
  }),
  project: one(projects, {
    fields: [expenseEntries.projectId],
    references: [projects.id],
  }),
  costCode: one(projectCostCodes, {
    fields: [expenseEntries.costCodeId],
    references: [projectCostCodes.id],
  }),
  approver: one(users, {
    fields: [expenseEntries.approvedBy],
    references: [users.id],
    relationName: 'expenseEntryApprover',
  }),
  attachments: many(expenseAttachments),
  approvalHistory: many(expenseEntryApprovals),
}));

export const expenseAttachmentsRelations = relations(expenseAttachments, ({ one }) => ({
  expenseEntry: one(expenseEntries, {
    fields: [expenseAttachments.expenseEntryId],
    references: [expenseEntries.id],
  }),
  organization: one(organizations, {
    fields: [expenseAttachments.organizationId],
    references: [organizations.id],
  }),
  uploader: one(users, {
    fields: [expenseAttachments.uploadedBy],
    references: [users.id],
  }),
}));

export const expenseEntryApprovalsRelations = relations(expenseEntryApprovals, ({ one }) => ({
  expenseEntry: one(expenseEntries, {
    fields: [expenseEntryApprovals.expenseEntryId],
    references: [expenseEntries.id],
  }),
  performer: one(users, {
    fields: [expenseEntryApprovals.performedBy],
    references: [users.id],
  }),
}));

export const expenseReportsRelations = relations(expenseReports, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [expenseReports.organizationId],
    references: [organizations.id],
  }),
  employee: one(entities, {
    fields: [expenseReports.employeeId],
    references: [entities.id],
    relationName: 'reportEmployee',
  }),
  project: one(projects, {
    fields: [expenseReports.projectId],
    references: [projects.id],
  }),
  submitter: one(users, {
    fields: [expenseReports.submittedBy],
    references: [users.id],
    relationName: 'reportSubmitter',
  }),
  approver: one(users, {
    fields: [expenseReports.approvedBy],
    references: [users.id],
    relationName: 'reportApprover',
  }),
  items: many(expenseReportItems),
}));

export const expenseReportItemsRelations = relations(expenseReportItems, ({ one }) => ({
  report: one(expenseReports, {
    fields: [expenseReportItems.expenseReportId],
    references: [expenseReports.id],
  }),
  entry: one(expenseEntries, {
    fields: [expenseReportItems.expenseEntryId],
    references: [expenseEntries.id],
  }),
}));

export const expensePoliciesRelations = relations(expensePolicies, ({ one }) => ({
  organization: one(organizations, {
    fields: [expensePolicies.organizationId],
    references: [organizations.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [expensePolicies.subsidiaryId],
    references: [subsidiaries.id],
  }),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type ExpenseEntry = typeof expenseEntries.$inferSelect;
export type NewExpenseEntry = typeof expenseEntries.$inferInsert;
export type UpdateExpenseEntry = Partial<Omit<NewExpenseEntry, 'id' | 'organizationId' | 'createdAt'>>;

export type ExpenseAttachment = typeof expenseAttachments.$inferSelect;
export type NewExpenseAttachment = typeof expenseAttachments.$inferInsert;

export type ExpenseEntryApproval = typeof expenseEntryApprovals.$inferSelect;
export type NewExpenseEntryApproval = typeof expenseEntryApprovals.$inferInsert;

export type ExpenseReport = typeof expenseReports.$inferSelect;
export type NewExpenseReport = typeof expenseReports.$inferInsert;
export type UpdateExpenseReport = Partial<Omit<NewExpenseReport, 'id' | 'organizationId' | 'createdAt'>>;

export type ExpenseReportItem = typeof expenseReportItems.$inferSelect;
export type NewExpenseReportItem = typeof expenseReportItems.$inferInsert;

export type ExpensePolicy = typeof expensePolicies.$inferSelect;
export type NewExpensePolicy = typeof expensePolicies.$inferInsert;
export type UpdateExpensePolicy = Partial<Omit<NewExpensePolicy, 'id' | 'organizationId' | 'createdAt'>>;

// Status type exports
export type ExpenseEntryStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REIMBURSED' | 'POSTED' | 'CANCELLED';
export type ExpenseCategory = 'TRAVEL' | 'LODGING' | 'MEALS' | 'TRANSPORTATION' | 'SUPPLIES' | 'EQUIPMENT' | 'MATERIALS' | 'SUBCONTRACTOR' | 'COMMUNICATIONS' | 'PROFESSIONAL_SERVICES' | 'INSURANCE' | 'PERMITS_FEES' | 'OTHER';
export type PaymentMethod = 'CORPORATE_CARD' | 'PERSONAL_CARD' | 'CASH' | 'CHECK' | 'DIRECT_PAYMENT' | 'REIMBURSEMENT_PENDING' | 'OTHER';
