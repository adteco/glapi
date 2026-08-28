import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { entities } from './entities';
import { items } from './items';
import { organizations } from './organizations';
import { projectMilestones, projectTasks } from './project-tasks';
import { projectBillingModelEnum, projectCostCodes, projects } from './projects';
import { subsidiaries } from './subsidiaries';

export const projectContractStatusEnum = pgEnum('project_contract_status', [
  'draft',
  'approved',
  'active',
  'suspended',
  'completed',
  'terminated',
  'cancelled',
]);

export const projectContractVersionStatusEnum = pgEnum('project_contract_version_status', [
  'draft',
  'approved',
  'superseded',
  'cancelled',
]);

export const projectBillingGroupingEnum = pgEnum('project_billing_grouping', [
  'customer',
  'project',
  'customer_project',
]);

export const projectBillingRuleTypeEnum = pgEnum('project_billing_rule_type', [
  'time_and_materials',
  'fixed_fee_milestone',
  'fixed_fee_progress',
]);

export const projectBillingRateScopeEnum = pgEnum('project_billing_rate_scope', [
  'default',
  'person',
  'role',
  'task',
  'item',
  'cost_code',
]);

export const projectProgressMeasureEnum = pgEnum('project_progress_measure', [
  'cost_to_cost',
  'labor_hours',
  'units_delivered',
  'elapsed_time',
  'manual_output',
]);

export const projectBillingMilestoneStatusEnum = pgEnum('project_billing_milestone_status', [
  'pending',
  'achieved',
  'approved',
  'invoiced',
  'cancelled',
]);

export const projectProgressCertificationStatusEnum = pgEnum(
  'project_progress_certification_status',
  ['draft', 'submitted', 'approved', 'rejected', 'invoiced', 'cancelled'],
);

export const projectRevenueTimingEnum = pgEnum('project_revenue_timing', [
  'point_in_time',
  'over_time',
]);

export const projectRevenueRecognitionMethodEnum = pgEnum(
  'project_revenue_recognition_method',
  [
    'right_to_invoice',
    'cost_to_cost',
    'labor_hours',
    'units_delivered',
    'elapsed_time',
    'manual_output',
  ],
);

export const projectContracts = pgTable(
  'project_contracts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    subsidiaryId: uuid('subsidiary_id')
      .notNull()
      .references(() => subsidiaries.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => entities.id),
    contractNumber: text('contract_number').notNull(),
    name: text('name').notNull(),
    status: projectContractStatusEnum('status').default('draft').notNull(),
    transactionCurrencyCode: char('transaction_currency_code', { length: 3 }).default('USD').notNull(),
    functionalCurrencyCode: char('functional_currency_code', { length: 3 }).default('USD').notNull(),
    exchangeRate: numeric('exchange_rate', { precision: 18, scale: 8 }).default('1').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    signedDate: date('signed_date'),
    currentVersionId: uuid('current_version_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdBy: uuid('created_by').references(() => entities.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => entities.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationNumberUnique: uniqueIndex('ux_project_contracts_org_number').on(
      table.organizationId,
      table.contractNumber,
    ),
    projectIdx: index('idx_project_contracts_project').on(table.organizationId, table.projectId),
    customerIdx: index('idx_project_contracts_customer').on(table.organizationId, table.customerId),
    statusIdx: index('idx_project_contracts_status').on(table.organizationId, table.status),
    validDateRange: check(
      'chk_project_contracts_date_range',
      sql`${table.endDate} IS NULL OR ${table.endDate} >= ${table.startDate}`,
    ),
    positiveExchangeRate: check('chk_project_contracts_exchange_rate', sql`${table.exchangeRate} > 0`),
  }),
);

export const projectContractVersions = pgTable(
  'project_contract_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectContractId: uuid('project_contract_id')
      .notNull()
      .references(() => projectContracts.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    status: projectContractVersionStatusEnum('status').default('draft').notNull(),
    billingModel: projectBillingModelEnum('billing_model').notNull(),
    billingGrouping: projectBillingGroupingEnum('billing_grouping').default('customer_project').notNull(),
    transactionPrice: numeric('transaction_price', { precision: 18, scale: 4 }).default('0').notNull(),
    variableConsideration: numeric('variable_consideration', { precision: 18, scale: 4 })
      .default('0')
      .notNull(),
    paymentTermsDays: integer('payment_terms_days').default(30).notNull(),
    effectiveStartDate: date('effective_start_date').notNull(),
    effectiveEndDate: date('effective_end_date'),
    supersedesVersionId: uuid('supersedes_version_id'),
    changeReason: text('change_reason'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    approvedBy: uuid('approved_by').references(() => entities.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => entities.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    versionUnique: uniqueIndex('ux_project_contract_versions_number').on(
      table.projectContractId,
      table.versionNumber,
    ),
    approvedVersionUnique: uniqueIndex('ux_project_contract_versions_approved')
      .on(table.projectContractId)
      .where(sql`${table.status} = 'approved'`),
    statusIdx: index('idx_project_contract_versions_status').on(
      table.organizationId,
      table.status,
    ),
    effectiveIdx: index('idx_project_contract_versions_effective').on(
      table.projectContractId,
      table.effectiveStartDate,
    ),
    positiveVersion: check('chk_project_contract_versions_version', sql`${table.versionNumber} > 0`),
    nonnegativePrice: check(
      'chk_project_contract_versions_transaction_price',
      sql`${table.transactionPrice} >= 0`,
    ),
    validEffectiveRange: check(
      'chk_project_contract_versions_effective_range',
      sql`${table.effectiveEndDate} IS NULL OR ${table.effectiveEndDate} >= ${table.effectiveStartDate}`,
    ),
    validApproval: check(
      'chk_project_contract_versions_approval',
      sql`${table.status} = 'draft' OR ${table.status} = 'cancelled' OR (${table.approvedAt} IS NOT NULL AND ${table.approvedBy} IS NOT NULL)`,
    ),
  }),
);

export const projectContractLines = pgTable(
  'project_contract_lines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectContractVersionId: uuid('project_contract_version_id')
      .notNull()
      .references(() => projectContractVersions.id, { onDelete: 'cascade' }),
    lineNumber: integer('line_number').notNull(),
    itemId: uuid('item_id').references(() => items.id),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 18, scale: 4 }).default('1').notNull(),
    unitPrice: numeric('unit_price', { precision: 18, scale: 4 }).default('0').notNull(),
    discountAmount: numeric('discount_amount', { precision: 18, scale: 4 }).default('0').notNull(),
    transactionPrice: numeric('transaction_price', { precision: 18, scale: 4 }).default('0').notNull(),
    sspAmount: numeric('ssp_amount', { precision: 18, scale: 4 }),
    serviceStartDate: date('service_start_date'),
    serviceEndDate: date('service_end_date'),
    revenueTiming: projectRevenueTimingEnum('revenue_timing').notNull(),
    recognitionMethod: projectRevenueRecognitionMethodEnum('recognition_method').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    lineUnique: uniqueIndex('ux_project_contract_lines_number').on(
      table.projectContractVersionId,
      table.lineNumber,
    ),
    versionIdx: index('idx_project_contract_lines_version').on(table.projectContractVersionId),
    positiveLineNumber: check('chk_project_contract_lines_number', sql`${table.lineNumber} > 0`),
    nonnegativeAmounts: check(
      'chk_project_contract_lines_amounts',
      sql`${table.quantity} >= 0 AND ${table.unitPrice} >= 0 AND ${table.discountAmount} >= 0 AND ${table.transactionPrice} >= 0`,
    ),
    validServiceRange: check(
      'chk_project_contract_lines_service_range',
      sql`${table.serviceEndDate} IS NULL OR ${table.serviceStartDate} IS NULL OR ${table.serviceEndDate} >= ${table.serviceStartDate}`,
    ),
  }),
);

export const projectBillingRules = pgTable(
  'project_billing_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectContractVersionId: uuid('project_contract_version_id')
      .notNull()
      .references(() => projectContractVersions.id, { onDelete: 'cascade' }),
    projectContractLineId: uuid('project_contract_line_id').references(() => projectContractLines.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    ruleType: projectBillingRuleTypeEnum('rule_type').notNull(),
    priority: integer('priority').default(100).notNull(),
    effectiveStartDate: date('effective_start_date').notNull(),
    effectiveEndDate: date('effective_end_date'),
    currencyCode: char('currency_code', { length: 3 }).default('USD').notNull(),
    grouping: projectBillingGroupingEnum('grouping').default('customer_project').notNull(),
    defaultRate: numeric('default_rate', { precision: 18, scale: 6 }),
    fixedFeeAmount: numeric('fixed_fee_amount', { precision: 18, scale: 4 }),
    progressMeasure: projectProgressMeasureEnum('progress_measure'),
    requiresApproval: boolean('requires_approval').default(true).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdBy: uuid('created_by').references(() => entities.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => entities.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    versionIdx: index('idx_project_billing_rules_version').on(
      table.organizationId,
      table.projectContractVersionId,
    ),
    effectiveIdx: index('idx_project_billing_rules_effective').on(
      table.projectContractVersionId,
      table.ruleType,
      table.effectiveStartDate,
    ),
    validEffectiveRange: check(
      'chk_project_billing_rules_effective_range',
      sql`${table.effectiveEndDate} IS NULL OR ${table.effectiveEndDate} >= ${table.effectiveStartDate}`,
    ),
    validAmounts: check(
      'chk_project_billing_rules_amounts',
      sql`(${table.defaultRate} IS NULL OR ${table.defaultRate} >= 0) AND (${table.fixedFeeAmount} IS NULL OR ${table.fixedFeeAmount} >= 0)`,
    ),
    requiredPolicyFields: check(
      'chk_project_billing_rules_policy_fields',
      sql`(${table.ruleType} = 'time_and_materials' AND ${table.fixedFeeAmount} IS NULL AND ${table.progressMeasure} IS NULL) OR (${table.ruleType} = 'fixed_fee_milestone' AND ${table.fixedFeeAmount} IS NOT NULL AND ${table.progressMeasure} IS NULL) OR (${table.ruleType} = 'fixed_fee_progress' AND ${table.fixedFeeAmount} IS NOT NULL AND ${table.progressMeasure} IS NOT NULL)`,
    ),
  }),
);

export const projectBillingRates = pgTable(
  'project_billing_rates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    billingRuleId: uuid('billing_rule_id')
      .notNull()
      .references(() => projectBillingRules.id, { onDelete: 'cascade' }),
    rateScope: projectBillingRateScopeEnum('rate_scope').notNull(),
    entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'cascade' }),
    roleKey: text('role_key'),
    projectTaskId: uuid('project_task_id').references(() => projectTasks.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').references(() => items.id, { onDelete: 'cascade' }),
    projectCostCodeId: uuid('project_cost_code_id').references(() => projectCostCodes.id, {
      onDelete: 'cascade',
    }),
    unitRate: numeric('unit_rate', { precision: 18, scale: 6 }).notNull(),
    effectiveStartDate: date('effective_start_date').notNull(),
    effectiveEndDate: date('effective_end_date'),
    priority: integer('priority').default(100).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdBy: uuid('created_by').references(() => entities.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    resolutionIdx: index('idx_project_billing_rates_resolution').on(
      table.organizationId,
      table.billingRuleId,
      table.rateScope,
      table.effectiveStartDate,
    ),
    validEffectiveRange: check(
      'chk_project_billing_rates_effective_range',
      sql`${table.effectiveEndDate} IS NULL OR ${table.effectiveEndDate} >= ${table.effectiveStartDate}`,
    ),
    positiveRate: check('chk_project_billing_rates_unit_rate', sql`${table.unitRate} >= 0`),
    validScopeTarget: check(
      'chk_project_billing_rates_scope_target',
      sql`(${table.rateScope} = 'default' AND ${table.entityId} IS NULL AND ${table.roleKey} IS NULL AND ${table.projectTaskId} IS NULL AND ${table.itemId} IS NULL AND ${table.projectCostCodeId} IS NULL) OR (${table.rateScope} = 'person' AND ${table.entityId} IS NOT NULL) OR (${table.rateScope} = 'role' AND ${table.roleKey} IS NOT NULL) OR (${table.rateScope} = 'task' AND ${table.projectTaskId} IS NOT NULL) OR (${table.rateScope} = 'item' AND ${table.itemId} IS NOT NULL) OR (${table.rateScope} = 'cost_code' AND ${table.projectCostCodeId} IS NOT NULL)`,
    ),
  }),
);

export const projectContractBillingMilestones = pgTable(
  'project_contract_billing_milestones',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    billingRuleId: uuid('billing_rule_id')
      .notNull()
      .references(() => projectBillingRules.id, { onDelete: 'cascade' }),
    projectContractLineId: uuid('project_contract_line_id').references(() => projectContractLines.id, {
      onDelete: 'set null',
    }),
    projectMilestoneId: uuid('project_milestone_id').references(() => projectMilestones.id, {
      onDelete: 'set null',
    }),
    sequenceNumber: integer('sequence_number').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    amount: numeric('amount', { precision: 18, scale: 4 }),
    percentage: numeric('percentage', { precision: 8, scale: 4 }),
    targetDate: date('target_date'),
    acceptanceCondition: text('acceptance_condition').notNull(),
    status: projectBillingMilestoneStatusEnum('status').default('pending').notNull(),
    achievedAt: timestamp('achieved_at', { withTimezone: true }),
    achievedBy: uuid('achieved_by').references(() => entities.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: uuid('approved_by').references(() => entities.id, { onDelete: 'set null' }),
    invoicedAt: timestamp('invoiced_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdBy: uuid('created_by').references(() => entities.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sequenceUnique: uniqueIndex('ux_project_contract_billing_milestones_sequence').on(
      table.billingRuleId,
      table.sequenceNumber,
    ),
    statusIdx: index('idx_project_contract_billing_milestones_status').on(
      table.organizationId,
      table.status,
      table.targetDate,
    ),
    validValue: check(
      'chk_project_contract_billing_milestones_value',
      sql`(${table.amount} IS NOT NULL AND ${table.percentage} IS NULL AND ${table.amount} >= 0) OR (${table.amount} IS NULL AND ${table.percentage} IS NOT NULL AND ${table.percentage} > 0 AND ${table.percentage} <= 100)`,
    ),
    validApproval: check(
      'chk_project_contract_billing_milestones_approval',
      sql`${table.status} IN ('pending', 'achieved', 'cancelled') OR (${table.approvedAt} IS NOT NULL AND ${table.approvedBy} IS NOT NULL)`,
    ),
  }),
);

export const projectProgressCertifications = pgTable(
  'project_progress_certifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    billingRuleId: uuid('billing_rule_id')
      .notNull()
      .references(() => projectBillingRules.id, { onDelete: 'cascade' }),
    certificationDate: date('certification_date').notNull(),
    versionNumber: integer('version_number').default(1).notNull(),
    cumulativeProgressPercent: numeric('cumulative_progress_percent', {
      precision: 8,
      scale: 4,
    }).notNull(),
    cumulativeBillableAmount: numeric('cumulative_billable_amount', {
      precision: 18,
      scale: 4,
    }).notNull(),
    status: projectProgressCertificationStatusEnum('status').default('draft').notNull(),
    evidence: jsonb('evidence').$type<Record<string, unknown>>(),
    notes: text('notes'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    submittedBy: uuid('submitted_by').references(() => entities.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: uuid('approved_by').references(() => entities.id, { onDelete: 'set null' }),
    invoicedAt: timestamp('invoiced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    versionUnique: uniqueIndex('ux_project_progress_certifications_version').on(
      table.billingRuleId,
      table.certificationDate,
      table.versionNumber,
    ),
    statusIdx: index('idx_project_progress_certifications_status').on(
      table.organizationId,
      table.status,
      table.certificationDate,
    ),
    validProgress: check(
      'chk_project_progress_certifications_progress',
      sql`${table.cumulativeProgressPercent} >= 0 AND ${table.cumulativeProgressPercent} <= 100 AND ${table.cumulativeBillableAmount} >= 0`,
    ),
    validApproval: check(
      'chk_project_progress_certifications_approval',
      sql`${table.status} IN ('draft', 'submitted', 'rejected', 'cancelled') OR (${table.approvedAt} IS NOT NULL AND ${table.approvedBy} IS NOT NULL)`,
    ),
  }),
);

export const projectContractsRelations = relations(projectContracts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projectContracts.organizationId],
    references: [organizations.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [projectContracts.subsidiaryId],
    references: [subsidiaries.id],
  }),
  project: one(projects, {
    fields: [projectContracts.projectId],
    references: [projects.id],
  }),
  customer: one(entities, {
    fields: [projectContracts.customerId],
    references: [entities.id],
  }),
  versions: many(projectContractVersions),
}));

export const projectContractVersionsRelations = relations(
  projectContractVersions,
  ({ one, many }) => ({
    contract: one(projectContracts, {
      fields: [projectContractVersions.projectContractId],
      references: [projectContracts.id],
    }),
    lines: many(projectContractLines),
    billingRules: many(projectBillingRules),
  }),
);

export const projectContractLinesRelations = relations(projectContractLines, ({ one, many }) => ({
  version: one(projectContractVersions, {
    fields: [projectContractLines.projectContractVersionId],
    references: [projectContractVersions.id],
  }),
  billingRules: many(projectBillingRules),
  milestones: many(projectContractBillingMilestones),
}));

export const projectBillingRulesRelations = relations(projectBillingRules, ({ one, many }) => ({
  version: one(projectContractVersions, {
    fields: [projectBillingRules.projectContractVersionId],
    references: [projectContractVersions.id],
  }),
  line: one(projectContractLines, {
    fields: [projectBillingRules.projectContractLineId],
    references: [projectContractLines.id],
  }),
  rates: many(projectBillingRates),
  milestones: many(projectContractBillingMilestones),
  progressCertifications: many(projectProgressCertifications),
}));

export const projectBillingRatesRelations = relations(projectBillingRates, ({ one }) => ({
  billingRule: one(projectBillingRules, {
    fields: [projectBillingRates.billingRuleId],
    references: [projectBillingRules.id],
  }),
}));

export const projectContractBillingMilestonesRelations = relations(
  projectContractBillingMilestones,
  ({ one }) => ({
    billingRule: one(projectBillingRules, {
      fields: [projectContractBillingMilestones.billingRuleId],
      references: [projectBillingRules.id],
    }),
    contractLine: one(projectContractLines, {
      fields: [projectContractBillingMilestones.projectContractLineId],
      references: [projectContractLines.id],
    }),
    deliveryMilestone: one(projectMilestones, {
      fields: [projectContractBillingMilestones.projectMilestoneId],
      references: [projectMilestones.id],
    }),
  }),
);

export const projectProgressCertificationsRelations = relations(
  projectProgressCertifications,
  ({ one }) => ({
    billingRule: one(projectBillingRules, {
      fields: [projectProgressCertifications.billingRuleId],
      references: [projectBillingRules.id],
    }),
  }),
);

export type ProjectContract = typeof projectContracts.$inferSelect;
export type NewProjectContract = typeof projectContracts.$inferInsert;
export type ProjectContractVersion = typeof projectContractVersions.$inferSelect;
export type NewProjectContractVersion = typeof projectContractVersions.$inferInsert;
export type ProjectContractLine = typeof projectContractLines.$inferSelect;
export type NewProjectContractLine = typeof projectContractLines.$inferInsert;
export type ProjectBillingRule = typeof projectBillingRules.$inferSelect;
export type NewProjectBillingRule = typeof projectBillingRules.$inferInsert;
export type ProjectBillingRate = typeof projectBillingRates.$inferSelect;
export type NewProjectBillingRate = typeof projectBillingRates.$inferInsert;
export type ProjectContractBillingMilestone = typeof projectContractBillingMilestones.$inferSelect;
export type NewProjectContractBillingMilestone = typeof projectContractBillingMilestones.$inferInsert;
export type ProjectProgressCertification = typeof projectProgressCertifications.$inferSelect;
export type NewProjectProgressCertification = typeof projectProgressCertifications.$inferInsert;
