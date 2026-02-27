import { pgTable, uuid, text, date, numeric, jsonb, timestamp, boolean, uniqueIndex, index, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { subsidiaries } from './subsidiaries';
import { activityCodes } from './activity-codes';
import { users } from './users';
import { entities } from './entities';

/**
 * Cost code types for categorization
 */
export const COST_CODE_TYPE = {
  LABOR: 'LABOR',
  MATERIAL: 'MATERIAL',
  EQUIPMENT: 'EQUIPMENT',
  SUBCONTRACT: 'SUBCONTRACT',
  OTHER: 'OTHER',
} as const;

export type CostCodeType = typeof COST_CODE_TYPE[keyof typeof COST_CODE_TYPE];

/**
 * Budget version status lifecycle:
 * - DRAFT: Budget is being created/edited
 * - SUBMITTED: Budget submitted for approval
 * - APPROVED: Budget approved for use
 * - LOCKED: Budget is locked, no changes allowed
 * - SUPERSEDED: Budget replaced by a newer version
 */
export const BUDGET_VERSION_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  LOCKED: 'LOCKED',
  SUPERSEDED: 'SUPERSEDED',
} as const;

export type BudgetVersionStatus = typeof BUDGET_VERSION_STATUS[keyof typeof BUDGET_VERSION_STATUS];

export const projectBillingModelEnum = pgEnum('project_billing_model', [
  'fixed_fee',
  'time_and_materials',
]);

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  subsidiaryId: uuid('subsidiary_id').references(() => subsidiaries.id),
  customerId: uuid('customer_id').references(() => entities.id),
  projectCode: text('project_code').notNull(),
  name: text('name').notNull(),
  status: text('status').default('planning').notNull(),
  startDate: date('start_date'),
  endDate: date('end_date'),
  externalSource: text('external_source'),
  jobNumber: text('job_number'),
  projectType: text('project_type'),
  billingModel: projectBillingModelEnum('billing_model').default('time_and_materials').notNull(),
  budgetRevenue: numeric('budget_revenue', { precision: 18, scale: 4 }),
  budgetCost: numeric('budget_cost', { precision: 18, scale: 4 }),
  percentComplete: numeric('percent_complete', { precision: 5, scale: 2 }).default('0'),
  retainagePercent: numeric('retainage_percent', { precision: 5, scale: 2 }).default('0').notNull(),
  currencyCode: text('currency_code'),
  description: text('description'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectCodeIdx: uniqueIndex('idx_projects_org_code').on(table.organizationId, table.projectCode),
  customerIdx: index('idx_projects_customer').on(table.customerId),
}));

export const projectParticipants = pgTable('project_participants', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  entityId: uuid('entity_id'),
  participantRole: text('participant_role').notNull(),
  isPrimary: boolean('is_primary').default(false).notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  participantIdx: uniqueIndex('idx_project_participants_role').on(table.projectId, table.participantRole, table.entityId),
}));

export const projectCostCodes = pgTable('project_cost_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  parentCostCodeId: uuid('parent_cost_code_id'), // Self-referential for hierarchy (added later via migration)
  activityCodeId: uuid('activity_code_id').references(() => activityCodes.id),
  costCode: text('cost_code').notNull(),
  costType: text('cost_type').notNull().default('OTHER'), // LABOR, MATERIAL, EQUIPMENT, SUBCONTRACT, OTHER
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  isBillable: boolean('is_billable').default(true).notNull(),
  // Denormalized amounts for quick access (updated by triggers/service)
  budgetAmount: numeric('budget_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  committedAmount: numeric('committed_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  actualAmount: numeric('actual_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  // GL Account references
  revenueAccountId: uuid('revenue_account_id'),
  costAccountId: uuid('cost_account_id'),
  wipAccountId: uuid('wip_account_id'),
  metadata: jsonb('metadata'),
  createdBy: uuid('created_by').references(() => entities.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  costCodeIdx: uniqueIndex('idx_project_cost_codes_project_code').on(table.projectId, table.costCode),
  parentIdx: index('idx_project_cost_codes_parent').on(table.parentCostCodeId),
  projectActiveIdx: index('idx_project_cost_codes_project_active').on(table.projectId, table.isActive),
}));

export const projectBudgetVersions = pgTable('project_budget_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  versionNumber: integer('version_number').notNull(),
  versionName: text('version_name').notNull(),
  status: text('status').default('DRAFT').notNull(), // DRAFT, SUBMITTED, APPROVED, LOCKED, SUPERSEDED
  isCurrent: boolean('is_current').default(false).notNull(), // True for the active budget version
  effectiveDate: date('effective_date'),
  expirationDate: date('expiration_date'),
  description: text('description'),
  notes: text('notes'),
  // Totals (denormalized for quick access)
  totalBudgetAmount: numeric('total_budget_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  totalLaborAmount: numeric('total_labor_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  totalMaterialAmount: numeric('total_material_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  totalEquipmentAmount: numeric('total_equipment_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  totalSubcontractAmount: numeric('total_subcontract_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  totalOtherAmount: numeric('total_other_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  // Workflow tracking
  createdBy: uuid('created_by').references(() => entities.id, { onDelete: 'set null' }),
  submittedBy: uuid('submitted_by').references(() => users.id),
  submittedDate: timestamp('submitted_date', { withTimezone: true }),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedDate: timestamp('approved_date', { withTimezone: true }),
  lockedBy: uuid('locked_by').references(() => users.id),
  lockedDate: timestamp('locked_date', { withTimezone: true }),
  // Import tracking
  importSource: text('import_source'), // 'CSV', 'API', 'MANUAL'
  importFileName: text('import_file_name'),
  importDate: timestamp('import_date', { withTimezone: true }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  versionIdx: uniqueIndex('idx_project_budget_versions_name').on(table.projectId, table.versionName),
  versionNumIdx: uniqueIndex('idx_project_budget_versions_num').on(table.projectId, table.versionNumber),
  currentIdx: index('idx_project_budget_versions_current').on(table.projectId, table.isCurrent),
  statusIdx: index('idx_project_budget_versions_status').on(table.status),
}));

export const projectBudgetLines = pgTable('project_budget_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  budgetVersionId: uuid('budget_version_id').notNull().references(() => projectBudgetVersions.id),
  projectCostCodeId: uuid('project_cost_code_id').notNull().references(() => projectCostCodes.id),
  lineNumber: integer('line_number').notNull(),
  description: text('description'),
  // Budget amounts
  originalBudgetAmount: numeric('original_budget_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  revisedBudgetAmount: numeric('revised_budget_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  approvedChanges: numeric('approved_changes', { precision: 18, scale: 4 }).default('0').notNull(),
  pendingChanges: numeric('pending_changes', { precision: 18, scale: 4 }).default('0').notNull(),
  // Tracking amounts (updated by transaction posting)
  committedAmount: numeric('committed_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  actualAmount: numeric('actual_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  encumberedAmount: numeric('encumbered_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  // Forecasting
  forecastAmount: numeric('forecast_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  estimateToComplete: numeric('estimate_to_complete', { precision: 18, scale: 4 }).default('0').notNull(),
  estimateAtCompletion: numeric('estimate_at_completion', { precision: 18, scale: 4 }).default('0').notNull(),
  // Variance calculations (can be computed but stored for performance)
  varianceAmount: numeric('variance_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  variancePercent: numeric('variance_percent', { precision: 8, scale: 4 }),
  // Units (for unit-based budgets like labor hours)
  budgetUnits: numeric('budget_units', { precision: 18, scale: 4 }),
  actualUnits: numeric('actual_units', { precision: 18, scale: 4 }),
  unitOfMeasure: text('unit_of_measure'),
  unitRate: numeric('unit_rate', { precision: 18, scale: 6 }),
  // Notes and metadata
  notes: text('notes'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  budgetLineIdx: uniqueIndex('idx_project_budget_lines_unique').on(table.budgetVersionId, table.projectCostCodeId),
  lineNumberIdx: index('idx_project_budget_lines_line_number').on(table.budgetVersionId, table.lineNumber),
}));

export const externalReferences = pgTable('external_references', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  objectType: text('object_type').notNull(),
  objectId: uuid('object_id').notNull(),
  provider: text('provider').notNull(),
  externalId: text('external_id').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  providerExternalIdx: uniqueIndex('idx_external_refs_provider_external').on(table.provider, table.externalId),
  objectIdx: index('idx_external_refs_object').on(table.objectType, table.objectId),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [projects.subsidiaryId],
    references: [subsidiaries.id],
  }),
  customer: one(entities, {
    fields: [projects.customerId],
    references: [entities.id],
  }),
  projectParticipants: many(projectParticipants),
  projectCostCodes: many(projectCostCodes),
  projectBudgetVersions: many(projectBudgetVersions),
}));

export const projectParticipantsRelations = relations(projectParticipants, ({ one }) => ({
  project: one(projects, {
    fields: [projectParticipants.projectId],
    references: [projects.id],
  }),
  entity: one(entities, {
    fields: [projectParticipants.entityId],
    references: [entities.id],
  }),
}));

export const projectCostCodesRelations = relations(projectCostCodes, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectCostCodes.projectId],
    references: [projects.id],
  }),
  parentCostCode: one(projectCostCodes, {
    fields: [projectCostCodes.parentCostCodeId],
    references: [projectCostCodes.id],
    relationName: 'parentChild',
  }),
  childCostCodes: many(projectCostCodes, {
    relationName: 'parentChild',
  }),
  activityCode: one(activityCodes, {
    fields: [projectCostCodes.activityCodeId],
    references: [activityCodes.id],
  }),
  createdByEntity: one(entities, {
    fields: [projectCostCodes.createdBy],
    references: [entities.id],
  }),
  projectBudgetLines: many(projectBudgetLines),
}));

export const projectBudgetVersionsRelations = relations(projectBudgetVersions, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectBudgetVersions.projectId],
    references: [projects.id],
  }),
  createdByEntity: one(entities, {
    fields: [projectBudgetVersions.createdBy],
    references: [entities.id],
    relationName: 'budgetVersionCreatedBy',
  }),
  submittedByEntity: one(entities, {
    fields: [projectBudgetVersions.submittedBy],
    references: [entities.id],
    relationName: 'budgetVersionSubmittedBy',
  }),
  approvedByEntity: one(entities, {
    fields: [projectBudgetVersions.approvedBy],
    references: [entities.id],
    relationName: 'budgetVersionApprovedBy',
  }),
  lockedByEntity: one(entities, {
    fields: [projectBudgetVersions.lockedBy],
    references: [entities.id],
    relationName: 'budgetVersionLockedBy',
  }),
  projectBudgetLines: many(projectBudgetLines),
}));

export const projectBudgetLinesRelations = relations(projectBudgetLines, ({ one }) => ({
  budgetVersion: one(projectBudgetVersions, {
    fields: [projectBudgetLines.budgetVersionId],
    references: [projectBudgetVersions.id],
  }),
  projectCostCode: one(projectCostCodes, {
    fields: [projectBudgetLines.projectCostCodeId],
    references: [projectCostCodes.id],
  }),
}));

export const externalReferencesRelations = relations(externalReferences, ({ one }) => ({
  organization: one(organizations, {
    fields: [externalReferences.organizationId],
    references: [organizations.id],
  }),
}));

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectParticipant = typeof projectParticipants.$inferSelect;
export type NewProjectParticipant = typeof projectParticipants.$inferInsert;
export type ProjectCostCode = typeof projectCostCodes.$inferSelect;
export type NewProjectCostCode = typeof projectCostCodes.$inferInsert;
export type ProjectBudgetVersion = typeof projectBudgetVersions.$inferSelect;
export type NewProjectBudgetVersion = typeof projectBudgetVersions.$inferInsert;
export type ProjectBudgetLine = typeof projectBudgetLines.$inferSelect;
export type NewProjectBudgetLine = typeof projectBudgetLines.$inferInsert;
export type ExternalReference = typeof externalReferences.$inferSelect;
export type NewExternalReference = typeof externalReferences.$inferInsert;
