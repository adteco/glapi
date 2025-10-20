import { pgTable, uuid, text, date, numeric, jsonb, timestamp, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { subsidiaries } from './subsidiaries';
import { activityCodes } from './activity-codes';
import { users } from './users';
import { entities } from './entities';

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  subsidiaryId: uuid('subsidiary_id').references(() => subsidiaries.id),
  projectCode: text('project_code').notNull(),
  name: text('name').notNull(),
  status: text('status').default('planning').notNull(),
  startDate: date('start_date'),
  endDate: date('end_date'),
  externalSource: text('external_source'),
  jobNumber: text('job_number'),
  projectType: text('project_type'),
  retainagePercent: numeric('retainage_percent', { precision: 5, scale: 2 }).default('0').notNull(),
  currencyCode: text('currency_code'),
  description: text('description'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectCodeIdx: uniqueIndex('idx_projects_org_code').on(table.organizationId, table.projectCode),
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
  activityCodeId: uuid('activity_code_id').references(() => activityCodes.id),
  costCode: text('cost_code'),
  costType: text('cost_type'),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  budgetAmount: numeric('budget_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  committedAmount: numeric('committed_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  costCodeIdx: uniqueIndex('idx_project_cost_codes_project_code').on(table.projectId, table.costCode),
}));

export const projectBudgetVersions = pgTable('project_budget_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  versionName: text('version_name').notNull(),
  status: text('status').default('draft').notNull(),
  isLocked: boolean('is_locked').default(false).notNull(),
  effectiveDate: date('effective_date'),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  approvedBy: uuid('approved_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  versionIdx: uniqueIndex('idx_project_budget_versions_name').on(table.projectId, table.versionName),
}));

export const projectBudgetLines = pgTable('project_budget_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  budgetVersionId: uuid('budget_version_id').notNull().references(() => projectBudgetVersions.id),
  projectCostCodeId: uuid('project_cost_code_id').notNull().references(() => projectCostCodes.id),
  costType: text('cost_type'),
  originalBudgetAmount: numeric('original_budget_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  revisedBudgetAmount: numeric('revised_budget_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  forecastAmount: numeric('forecast_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  committedAmount: numeric('committed_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  actualAmount: numeric('actual_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  budgetLineIdx: uniqueIndex('idx_project_budget_lines_unique').on(table.budgetVersionId, table.projectCostCodeId),
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
  activityCode: one(activityCodes, {
    fields: [projectCostCodes.activityCodeId],
    references: [activityCodes.id],
  }),
  projectBudgetLines: many(projectBudgetLines),
}));

export const projectBudgetVersionsRelations = relations(projectBudgetVersions, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectBudgetVersions.projectId],
    references: [projects.id],
  }),
  createdByUser: one(users, {
    fields: [projectBudgetVersions.createdBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [projectBudgetVersions.approvedBy],
    references: [users.id],
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
