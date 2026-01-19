import { pgTable, pgEnum, uuid, text, date, numeric, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { subsidiaries } from './subsidiaries';
import { users } from './users';
import { projects, projectTasks, projectCostCodes } from './projects';

export const projectExpenseStatusEnum = pgEnum('project_expense_status', [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'POSTED',
  'CANCELLED',
]);

export const projectExpenseTypeEnum = pgEnum('project_expense_type', [
  'TRAVEL',
  'MATERIALS',
  'SUBCONTRACT',
  'EQUIPMENT',
  'OTHER',
]);

export const projectExpenseEntries = pgTable('project_expense_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  subsidiaryId: uuid('subsidiary_id').references(() => subsidiaries.id),

  employeeId: uuid('employee_id').notNull().references(() => users.id),
  projectId: uuid('project_id').references(() => projects.id),
  projectTaskId: uuid('project_task_id').references(() => projectTasks.id),
  costCodeId: uuid('cost_code_id').references(() => projectCostCodes.id),

  expenseType: projectExpenseTypeEnum('expense_type').default('OTHER').notNull(),
  vendorName: text('vendor_name'),
  vendorInvoiceNumber: text('vendor_invoice_number'),
  expenseDate: date('expense_date').notNull(),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  currencyCode: text('currency_code').default('USD').notNull(),
  description: text('description'),
  isBillable: boolean('is_billable').default(true).notNull(),

  status: projectExpenseStatusEnum('status').default('DRAFT').notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  submittedBy: uuid('submitted_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: uuid('approved_by').references(() => users.id),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  rejectedBy: uuid('rejected_by').references(() => users.id),
  rejectionReason: text('rejection_reason'),
  postedAt: timestamp('posted_at', { withTimezone: true }),

  metadata: jsonb('metadata'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgDateIdx: index('idx_project_expenses_org_date').on(table.organizationId, table.expenseDate),
  projectIdx: index('idx_project_expenses_project').on(table.projectId),
  statusIdx: index('idx_project_expenses_status').on(table.organizationId, table.status),
  costCodeIdx: index('idx_project_expenses_cost_code').on(table.costCodeId),
}));

export const projectExpenseApprovals = pgTable('project_expense_approvals', {
  id: uuid('id').defaultRandom().primaryKey(),
  expenseId: uuid('expense_id').notNull().references(() => projectExpenseEntries.id, { onDelete: 'cascade' }),
  action: projectExpenseStatusEnum('action').notNull(),
  previousStatus: projectExpenseStatusEnum('previous_status'),
  newStatus: projectExpenseStatusEnum('new_status').notNull(),
  performedBy: uuid('performed_by').notNull().references(() => users.id),
  performedAt: timestamp('performed_at', { withTimezone: true }).defaultNow().notNull(),
  comments: text('comments'),
  metadata: jsonb('metadata'),
}, (table) => ({
  expenseIdx: index('idx_project_expense_approvals_expense').on(table.expenseId),
}));

export const projectExpenseAttachments = pgTable('project_expense_attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  expenseId: uuid('expense_id').notNull().references(() => projectExpenseEntries.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  contentType: text('content_type'),
  fileSize: numeric('file_size'),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb('metadata'),
}, (table) => ({
  expenseIdx: index('idx_project_expense_attachments_expense').on(table.organizationId, table.expenseId),
}));

export const projectExpenseEntriesRelations = relations(projectExpenseEntries, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projectExpenseEntries.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [projectExpenseEntries.projectId],
    references: [projects.id],
  }),
  projectTask: one(projectTasks, {
    fields: [projectExpenseEntries.projectTaskId],
    references: [projectTasks.id],
  }),
  costCode: one(projectCostCodes, {
    fields: [projectExpenseEntries.costCodeId],
    references: [projectCostCodes.id],
  }),
  employee: one(users, {
    fields: [projectExpenseEntries.employeeId],
    references: [users.id],
  }),
  approvals: many(projectExpenseApprovals),
  attachments: many(projectExpenseAttachments),
}));

export const projectExpenseApprovalsRelations = relations(projectExpenseApprovals, ({ one }) => ({
  expense: one(projectExpenseEntries, {
    fields: [projectExpenseApprovals.expenseId],
    references: [projectExpenseEntries.id],
  }),
  performer: one(users, {
    fields: [projectExpenseApprovals.performedBy],
    references: [users.id],
  }),
}));

export const projectExpenseAttachmentsRelations = relations(projectExpenseAttachments, ({ one }) => ({
  organization: one(organizations, {
    fields: [projectExpenseAttachments.organizationId],
    references: [organizations.id],
  }),
  expense: one(projectExpenseEntries, {
    fields: [projectExpenseAttachments.expenseId],
    references: [projectExpenseEntries.id],
  }),
  uploader: one(users, {
    fields: [projectExpenseAttachments.uploadedBy],
    references: [users.id],
  }),
}));

export type ProjectExpenseEntry = typeof projectExpenseEntries.$inferSelect;
export type NewProjectExpenseEntry = typeof projectExpenseEntries.$inferInsert;
export type ProjectExpenseApproval = typeof projectExpenseApprovals.$inferSelect;
export type NewProjectExpenseApproval = typeof projectExpenseApprovals.$inferInsert;
export type ProjectExpenseAttachment = typeof projectExpenseAttachments.$inferSelect;
export type NewProjectExpenseAttachment = typeof projectExpenseAttachments.$inferInsert;
