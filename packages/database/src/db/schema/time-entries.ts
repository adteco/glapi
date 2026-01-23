/**
 * Time Entries Schema
 *
 * Supports time tracking, labor costing, and approval workflows for
 * construction accounting and project management.
 *
 * @module time-entries
 * @author OliveWolf
 * @task glapi-zo0
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
import { entities } from './entities';
import { projects, projectCostCodes } from './projects';

// ============================================================================
// Enums
// ============================================================================

/**
 * Time entry status lifecycle:
 * - DRAFT: Entry being created/edited by employee
 * - SUBMITTED: Submitted for approval
 * - APPROVED: Approved by supervisor/manager
 * - REJECTED: Rejected, requires revision
 * - POSTED: Labor costs posted to GL
 * - CANCELLED: Entry cancelled
 */
export const timeEntryStatusEnum = pgEnum('time_entry_status', [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'POSTED',
  'CANCELLED',
]);

/**
 * Time entry type for categorization
 */
export const timeEntryTypeEnum = pgEnum('time_entry_type', [
  'REGULAR',
  'OVERTIME',
  'DOUBLE_TIME',
  'PTO',
  'SICK',
  'HOLIDAY',
  'OTHER',
]);

/**
 * Approval action types for audit trail
 */
export const approvalActionEnum = pgEnum('approval_action', [
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'RETURNED',
  'CANCELLED',
  'REOPENED',
]);

// ============================================================================
// Time Entries Table
// ============================================================================

/**
 * Time entries - tracks hours worked by employees against projects/cost codes
 */
export const timeEntries = pgTable('time_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  subsidiaryId: uuid('subsidiary_id').references(() => subsidiaries.id),

  // Employee reference (references entities table for business employees)
  employeeId: uuid('employee_id').notNull().references(() => entities.id),

  // Project/Cost code allocation
  projectId: uuid('project_id').references(() => projects.id),
  costCodeId: uuid('cost_code_id').references(() => projectCostCodes.id),

  // Time entry details
  entryDate: date('entry_date').notNull(),
  hours: numeric('hours', { precision: 6, scale: 2 }).notNull(),
  entryType: timeEntryTypeEnum('entry_type').default('REGULAR').notNull(),

  // Billing flags
  isBillable: boolean('is_billable').default(true).notNull(),
  billingRate: numeric('billing_rate', { precision: 15, scale: 4 }),

  // Cost calculation
  laborRate: numeric('labor_rate', { precision: 15, scale: 4 }),
  laborCost: numeric('labor_cost', { precision: 18, scale: 4 }),
  burdenRate: numeric('burden_rate', { precision: 15, scale: 4 }),
  burdenCost: numeric('burden_cost', { precision: 18, scale: 4 }),
  totalCost: numeric('total_cost', { precision: 18, scale: 4 }),

  // Description and notes
  description: text('description'),
  internalNotes: text('internal_notes'),

  // Status and workflow
  status: timeEntryStatusEnum('status').default('DRAFT').notNull(),

  // Workflow timestamps - references entities (authenticated users are entities with clerkUserId)
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  submittedBy: uuid('submitted_by').references(() => entities.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: uuid('approved_by').references(() => entities.id),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  rejectedBy: uuid('rejected_by').references(() => entities.id),
  rejectionReason: text('rejection_reason'),
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
  createdBy: uuid('created_by').references(() => entities.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Indexes for common queries
  orgDateIdx: index('idx_time_entries_org_date').on(table.organizationId, table.entryDate),
  employeeDateIdx: index('idx_time_entries_employee_date').on(table.employeeId, table.entryDate),
  projectIdx: index('idx_time_entries_project').on(table.projectId),
  statusIdx: index('idx_time_entries_status').on(table.organizationId, table.status),
  approvalIdx: index('idx_time_entries_pending_approval').on(table.organizationId, table.status, table.submittedAt),
  // Unique constraint for external ID per organization
  externalIdIdx: uniqueIndex('idx_time_entries_external').on(table.organizationId, table.externalSource, table.externalId),
}));

// ============================================================================
// Labor Cost Rates Table
// ============================================================================

/**
 * Labor cost rates - defines hourly rates for employees by project/role/date
 */
export const laborCostRates = pgTable('labor_cost_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  subsidiaryId: uuid('subsidiary_id').references(() => subsidiaries.id),

  // Rate can be employee-specific, role-based, or project-specific
  employeeId: uuid('employee_id').references(() => entities.id),
  projectId: uuid('project_id').references(() => projects.id),
  costCodeId: uuid('cost_code_id').references(() => projectCostCodes.id),

  // Role-based rates (when employeeId is null)
  laborRole: text('labor_role'),

  // Rate details
  laborRate: numeric('labor_rate', { precision: 15, scale: 4 }).notNull(),
  burdenRate: numeric('burden_rate', { precision: 15, scale: 4 }).default('0').notNull(),
  billingRate: numeric('billing_rate', { precision: 15, scale: 4 }),

  // Overtime multipliers
  overtimeMultiplier: numeric('overtime_multiplier', { precision: 4, scale: 2 }).default('1.5').notNull(),
  doubleTimeMultiplier: numeric('double_time_multiplier', { precision: 4, scale: 2 }).default('2.0').notNull(),

  // Effective date range
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),

  // Priority for rate selection (higher = more specific)
  priority: integer('priority').default(0).notNull(),

  // Status
  isActive: boolean('is_active').default(true).notNull(),

  // Currency
  currencyCode: text('currency_code').default('USD').notNull(),

  // Metadata
  description: text('description'),
  metadata: jsonb('metadata'),

  // Audit fields
  createdBy: uuid('created_by').references(() => entities.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgEffectiveIdx: index('idx_labor_rates_org_effective').on(table.organizationId, table.effectiveFrom),
  employeeIdx: index('idx_labor_rates_employee').on(table.employeeId, table.effectiveFrom),
  projectIdx: index('idx_labor_rates_project').on(table.projectId, table.effectiveFrom),
  roleIdx: index('idx_labor_rates_role').on(table.organizationId, table.laborRole, table.effectiveFrom),
}));

// ============================================================================
// Employee Project Assignments Table
// ============================================================================

/**
 * Employee project assignments - controls which employees can log time to which projects
 */
export const employeeProjectAssignments = pgTable('employee_project_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  employeeId: uuid('employee_id').notNull().references(() => entities.id),
  projectId: uuid('project_id').notNull().references(() => projects.id),

  // Assignment details
  role: text('role'),
  defaultCostCodeId: uuid('default_cost_code_id').references(() => projectCostCodes.id),

  // Budget allocation
  budgetedHours: numeric('budgeted_hours', { precision: 10, scale: 2 }),
  actualHours: numeric('actual_hours', { precision: 10, scale: 2 }).default('0').notNull(),

  // Date range
  startDate: date('start_date'),
  endDate: date('end_date'),

  // Status
  isActive: boolean('is_active').default(true).notNull(),
  canApproveTime: boolean('can_approve_time').default(false).notNull(),

  // Metadata
  metadata: jsonb('metadata'),

  // Audit fields
  createdBy: uuid('created_by').references(() => entities.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueAssignmentIdx: uniqueIndex('idx_employee_project_unique').on(table.employeeId, table.projectId),
  orgEmployeeIdx: index('idx_employee_project_org_employee').on(table.organizationId, table.employeeId),
  projectIdx: index('idx_employee_project_project').on(table.projectId),
}));

// ============================================================================
// Time Entry Approvals Table (Audit Trail)
// ============================================================================

/**
 * Time entry approval history - audit trail for all approval actions
 */
export const timeEntryApprovals = pgTable('time_entry_approvals', {
  id: uuid('id').defaultRandom().primaryKey(),
  timeEntryId: uuid('time_entry_id').notNull().references(() => timeEntries.id, { onDelete: 'cascade' }),

  // Action details
  action: approvalActionEnum('action').notNull(),
  previousStatus: timeEntryStatusEnum('previous_status'),
  newStatus: timeEntryStatusEnum('new_status').notNull(),

  // Who performed the action
  performedBy: uuid('performed_by').notNull().references(() => entities.id),
  performedAt: timestamp('performed_at', { withTimezone: true }).defaultNow().notNull(),

  // Comments/notes
  comments: text('comments'),

  // Metadata (can include device info, IP, etc.)
  metadata: jsonb('metadata'),
}, (table) => ({
  timeEntryIdx: index('idx_time_entry_approvals_entry').on(table.timeEntryId),
  performedByIdx: index('idx_time_entry_approvals_performer').on(table.performedBy, table.performedAt),
}));

// ============================================================================
// Time Entry Batch Table
// ============================================================================

/**
 * Time entry batches - for bulk submission and approval
 */
export const timeEntryBatches = pgTable('time_entry_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  // Batch details
  batchNumber: text('batch_number').notNull(),
  description: text('description'),

  // Date range covered
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),

  // Totals
  totalEntries: integer('total_entries').default(0).notNull(),
  totalHours: numeric('total_hours', { precision: 10, scale: 2 }).default('0').notNull(),
  totalCost: numeric('total_cost', { precision: 18, scale: 4 }).default('0').notNull(),

  // Status
  status: timeEntryStatusEnum('status').default('DRAFT').notNull(),

  // Workflow timestamps - references entities (authenticated users are entities with clerkUserId)
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  submittedBy: uuid('submitted_by').references(() => entities.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: uuid('approved_by').references(() => entities.id),
  postedAt: timestamp('posted_at', { withTimezone: true }),

  // GL posting reference
  glPostingBatchId: uuid('gl_posting_batch_id'),

  // Metadata
  metadata: jsonb('metadata'),

  // Audit fields
  createdBy: uuid('created_by').references(() => entities.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgBatchIdx: uniqueIndex('idx_time_entry_batches_org_number').on(table.organizationId, table.batchNumber),
  periodIdx: index('idx_time_entry_batches_period').on(table.organizationId, table.periodStart, table.periodEnd),
  statusIdx: index('idx_time_entry_batches_status').on(table.organizationId, table.status),
}));

// ============================================================================
// Relations
// ============================================================================

export const timeEntriesRelations = relations(timeEntries, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [timeEntries.organizationId],
    references: [organizations.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [timeEntries.subsidiaryId],
    references: [subsidiaries.id],
  }),
  employee: one(entities, {
    fields: [timeEntries.employeeId],
    references: [entities.id],
    relationName: 'timeEntryEmployee',
  }),
  project: one(projects, {
    fields: [timeEntries.projectId],
    references: [projects.id],
  }),
  costCode: one(projectCostCodes, {
    fields: [timeEntries.costCodeId],
    references: [projectCostCodes.id],
  }),
  approver: one(entities, {
    fields: [timeEntries.approvedBy],
    references: [entities.id],
    relationName: 'timeEntryApprover',
  }),
  approvalHistory: many(timeEntryApprovals),
}));

export const laborCostRatesRelations = relations(laborCostRates, ({ one }) => ({
  organization: one(organizations, {
    fields: [laborCostRates.organizationId],
    references: [organizations.id],
  }),
  employee: one(entities, {
    fields: [laborCostRates.employeeId],
    references: [entities.id],
  }),
  project: one(projects, {
    fields: [laborCostRates.projectId],
    references: [projects.id],
  }),
  costCode: one(projectCostCodes, {
    fields: [laborCostRates.costCodeId],
    references: [projectCostCodes.id],
  }),
}));

export const employeeProjectAssignmentsRelations = relations(employeeProjectAssignments, ({ one }) => ({
  organization: one(organizations, {
    fields: [employeeProjectAssignments.organizationId],
    references: [organizations.id],
  }),
  employee: one(entities, {
    fields: [employeeProjectAssignments.employeeId],
    references: [entities.id],
  }),
  project: one(projects, {
    fields: [employeeProjectAssignments.projectId],
    references: [projects.id],
  }),
  defaultCostCode: one(projectCostCodes, {
    fields: [employeeProjectAssignments.defaultCostCodeId],
    references: [projectCostCodes.id],
  }),
}));

export const timeEntryApprovalsRelations = relations(timeEntryApprovals, ({ one }) => ({
  timeEntry: one(timeEntries, {
    fields: [timeEntryApprovals.timeEntryId],
    references: [timeEntries.id],
  }),
  performer: one(entities, {
    fields: [timeEntryApprovals.performedBy],
    references: [entities.id],
  }),
}));

export const timeEntryBatchesRelations = relations(timeEntryBatches, ({ one }) => ({
  organization: one(organizations, {
    fields: [timeEntryBatches.organizationId],
    references: [organizations.id],
  }),
  submitter: one(entities, {
    fields: [timeEntryBatches.submittedBy],
    references: [entities.id],
    relationName: 'batchSubmitter',
  }),
  approver: one(entities, {
    fields: [timeEntryBatches.approvedBy],
    references: [entities.id],
    relationName: 'batchApprover',
  }),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;
export type UpdateTimeEntry = Partial<Omit<NewTimeEntry, 'id' | 'organizationId' | 'createdAt'>>;

export type LaborCostRate = typeof laborCostRates.$inferSelect;
export type NewLaborCostRate = typeof laborCostRates.$inferInsert;
export type UpdateLaborCostRate = Partial<Omit<NewLaborCostRate, 'id' | 'organizationId' | 'createdAt'>>;

export type EmployeeProjectAssignment = typeof employeeProjectAssignments.$inferSelect;
export type NewEmployeeProjectAssignment = typeof employeeProjectAssignments.$inferInsert;
export type UpdateEmployeeProjectAssignment = Partial<Omit<NewEmployeeProjectAssignment, 'id' | 'organizationId' | 'createdAt'>>;

export type TimeEntryApproval = typeof timeEntryApprovals.$inferSelect;
export type NewTimeEntryApproval = typeof timeEntryApprovals.$inferInsert;

export type TimeEntryBatch = typeof timeEntryBatches.$inferSelect;
export type NewTimeEntryBatch = typeof timeEntryBatches.$inferInsert;
export type UpdateTimeEntryBatch = Partial<Omit<NewTimeEntryBatch, 'id' | 'organizationId' | 'createdAt'>>;

// Status type exports
export type TimeEntryStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'POSTED' | 'CANCELLED';
export type TimeEntryType = 'REGULAR' | 'OVERTIME' | 'DOUBLE_TIME' | 'PTO' | 'SICK' | 'HOLIDAY' | 'OTHER';
export type ApprovalAction = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RETURNED' | 'CANCELLED' | 'REOPENED';
