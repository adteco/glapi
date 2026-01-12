import {
  pgTable,
  uuid,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { projects, projectCostCodes } from './projects';
import { organizations } from './organizations';
import { users } from './users';
import { accounts } from './accounts';

/**
 * Schedule of Values (SOV) Status
 * - DRAFT: SOV is being created/edited
 * - ACTIVE: SOV is approved and in use
 * - REVISED: SOV has been revised (superseded by new version)
 * - CLOSED: Project complete, SOV closed out
 */
export const SOV_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  REVISED: 'REVISED',
  CLOSED: 'CLOSED',
} as const;

export type SovStatus = (typeof SOV_STATUS)[keyof typeof SOV_STATUS];

/**
 * SOV Line Type - categorization of work
 */
export const SOV_LINE_TYPE = {
  LABOR: 'LABOR',
  MATERIAL: 'MATERIAL',
  EQUIPMENT: 'EQUIPMENT',
  SUBCONTRACT: 'SUBCONTRACT',
  OTHER_DIRECT: 'OTHER_DIRECT',
  OVERHEAD: 'OVERHEAD',
  FEE: 'FEE',
} as const;

export type SovLineType = (typeof SOV_LINE_TYPE)[keyof typeof SOV_LINE_TYPE];

/**
 * Project Schedule of Values Header
 * Master SOV document for a project - tracks the overall contract value
 * and billing structure. One active SOV per project at a time.
 */
export const projectScheduleOfValues = pgTable(
  'project_schedule_of_values',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    sovNumber: text('sov_number').notNull(), // e.g., "SOV-001", auto-generated per project
    versionNumber: integer('version_number').default(1).notNull(),
    status: text('status').default('DRAFT').notNull(), // DRAFT, ACTIVE, REVISED, CLOSED
    description: text('description'),

    // Contract amounts
    originalContractAmount: decimal('original_contract_amount', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(),
    approvedChangeOrders: decimal('approved_change_orders', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(),
    pendingChangeOrders: decimal('pending_change_orders', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(),
    revisedContractAmount: decimal('revised_contract_amount', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // original + approved COs

    // Billing summary (denormalized for quick access)
    totalScheduledValue: decimal('total_scheduled_value', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(),
    totalPreviouslyBilled: decimal('total_previously_billed', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(),
    totalCurrentBilling: decimal('total_current_billing', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(),
    totalBilledToDate: decimal('total_billed_to_date', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(),
    totalRetainageHeld: decimal('total_retainage_held', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(),
    totalRetainageReleased: decimal('total_retainage_released', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(),
    balanceToFinish: decimal('balance_to_finish', { precision: 18, scale: 4 })
      .default('0')
      .notNull(),
    percentComplete: decimal('percent_complete', { precision: 8, scale: 4 })
      .default('0')
      .notNull(),

    // Default retainage settings
    defaultRetainagePercent: decimal('default_retainage_percent', {
      precision: 5,
      scale: 2,
    })
      .default('10')
      .notNull(),
    retainageCapAmount: decimal('retainage_cap_amount', {
      precision: 18,
      scale: 4,
    }), // Optional cap on retainage
    retainageCapPercent: decimal('retainage_cap_percent', {
      precision: 5,
      scale: 2,
    }), // e.g., 50% complete = reduced retainage

    // Dates
    effectiveDate: date('effective_date'),
    expirationDate: date('expiration_date'),

    // Currency
    currencyCode: text('currency_code').default('USD').notNull(),

    // Workflow
    previousVersionId: uuid('previous_version_id'), // Reference to superseded SOV
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedDate: timestamp('approved_date', { withTimezone: true }),

    // Audit fields
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedBy: uuid('updated_by').references(() => users.id),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    metadata: jsonb('metadata'),
  },
  (table) => ({
    projectSovIdx: uniqueIndex('idx_sov_project_version').on(
      table.projectId,
      table.versionNumber
    ),
    orgProjectIdx: index('idx_sov_org_project').on(
      table.organizationId,
      table.projectId
    ),
    statusIdx: index('idx_sov_status').on(table.status),
    sovNumberIdx: uniqueIndex('idx_sov_number').on(
      table.organizationId,
      table.sovNumber
    ),
  })
);

/**
 * Schedule of Values Lines
 * Individual line items on the SOV - typically one per cost code or work category
 */
export const scheduleOfValueLines = pgTable(
  'schedule_of_value_lines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    scheduleOfValuesId: uuid('schedule_of_values_id')
      .notNull()
      .references(() => projectScheduleOfValues.id, { onDelete: 'cascade' }),
    projectCostCodeId: uuid('project_cost_code_id').references(
      () => projectCostCodes.id
    ),

    // Line identification
    lineNumber: integer('line_number').notNull(),
    itemNumber: text('item_number'), // e.g., "1.1", "1.2", "2.0" - hierarchical numbering
    lineType: text('line_type').default('OTHER_DIRECT').notNull(), // LABOR, MATERIAL, etc.
    description: text('description').notNull(),

    // Contract amounts
    originalScheduledValue: decimal('original_scheduled_value', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(),
    changeOrderAmount: decimal('change_order_amount', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(),
    revisedScheduledValue: decimal('revised_scheduled_value', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // original + COs

    // Billing progress - AIA G702/G703 columns
    previousWorkCompleted: decimal('previous_work_completed', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // Col D - previously billed work
    previousMaterialsStored: decimal('previous_materials_stored', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // Col E - previously billed materials
    currentWorkCompleted: decimal('current_work_completed', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // Col F - current period work
    currentMaterialsStored: decimal('current_materials_stored', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // Col G - current period materials

    // Calculated totals (denormalized)
    totalCompletedAndStored: decimal('total_completed_and_stored', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // D+E+F+G
    percentComplete: decimal('percent_complete', { precision: 8, scale: 4 })
      .default('0')
      .notNull(), // (D+E+F+G) / C
    balanceToFinish: decimal('balance_to_finish', { precision: 18, scale: 4 })
      .default('0')
      .notNull(), // C - (D+E+F+G)

    // Retainage
    retainagePercent: decimal('retainage_percent', { precision: 5, scale: 2 })
      .default('10')
      .notNull(),
    retainageHeld: decimal('retainage_held', { precision: 18, scale: 4 })
      .default('0')
      .notNull(),
    retainageReleased: decimal('retainage_released', { precision: 18, scale: 4 })
      .default('0')
      .notNull(),
    netRetainage: decimal('net_retainage', { precision: 18, scale: 4 })
      .default('0')
      .notNull(), // held - released

    // GL Account mapping
    revenueAccountId: uuid('revenue_account_id').references(() => accounts.id),
    contractAssetAccountId: uuid('contract_asset_account_id').references(
      () => accounts.id
    ), // Unbilled receivables
    retainageAccountId: uuid('retainage_account_id').references(
      () => accounts.id
    ),

    // Sorting and hierarchy
    sortOrder: integer('sort_order').default(0).notNull(),
    parentLineId: uuid('parent_line_id'), // Self-reference for hierarchical SOV
    isSubtotal: boolean('is_subtotal').default(false).notNull(),
    isSummaryLine: boolean('is_summary_line').default(false).notNull(),

    // Status
    isActive: boolean('is_active').default(true).notNull(),

    // Notes and metadata
    notes: text('notes'),
    metadata: jsonb('metadata'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    sovLineIdx: uniqueIndex('idx_sov_line_number').on(
      table.scheduleOfValuesId,
      table.lineNumber
    ),
    sovItemIdx: index('idx_sov_line_item').on(
      table.scheduleOfValuesId,
      table.itemNumber
    ),
    costCodeIdx: index('idx_sov_line_cost_code').on(table.projectCostCodeId),
    parentIdx: index('idx_sov_line_parent').on(table.parentLineId),
  })
);

/**
 * Change Order tracking for SOV adjustments
 */
export const sovChangeOrders = pgTable(
  'sov_change_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    scheduleOfValuesId: uuid('schedule_of_values_id')
      .notNull()
      .references(() => projectScheduleOfValues.id),
    changeOrderNumber: text('change_order_number').notNull(), // e.g., "CO-001"
    description: text('description').notNull(),
    status: text('status').default('PENDING').notNull(), // PENDING, APPROVED, REJECTED, VOIDED
    amount: decimal('amount', { precision: 18, scale: 4 }).notNull(),
    effectiveDate: date('effective_date'),

    // Approval workflow
    requestedBy: uuid('requested_by').references(() => users.id),
    requestedDate: timestamp('requested_date', { withTimezone: true }),
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedDate: timestamp('approved_date', { withTimezone: true }),
    rejectedBy: uuid('rejected_by').references(() => users.id),
    rejectedDate: timestamp('rejected_date', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),

    // External reference
    externalReference: text('external_reference'), // Customer CO number
    documentUrl: text('document_url'),

    notes: text('notes'),
    metadata: jsonb('metadata'),

    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    sovCoIdx: uniqueIndex('idx_sov_co_number').on(
      table.scheduleOfValuesId,
      table.changeOrderNumber
    ),
    statusIdx: index('idx_sov_co_status').on(table.status),
  })
);

/**
 * Change order line items - distributes CO amount to SOV lines
 */
export const sovChangeOrderLines = pgTable(
  'sov_change_order_lines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    changeOrderId: uuid('change_order_id')
      .notNull()
      .references(() => sovChangeOrders.id, { onDelete: 'cascade' }),
    sovLineId: uuid('sov_line_id')
      .notNull()
      .references(() => scheduleOfValueLines.id),
    lineNumber: integer('line_number').notNull(),
    description: text('description'),
    amount: decimal('amount', { precision: 18, scale: 4 }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    coLineIdx: uniqueIndex('idx_co_line_number').on(
      table.changeOrderId,
      table.lineNumber
    ),
    sovLineIdx: index('idx_co_sov_line').on(table.sovLineId),
  })
);

// Relations
export const projectScheduleOfValuesRelations = relations(
  projectScheduleOfValues,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [projectScheduleOfValues.organizationId],
      references: [organizations.id],
    }),
    project: one(projects, {
      fields: [projectScheduleOfValues.projectId],
      references: [projects.id],
    }),
    previousVersion: one(projectScheduleOfValues, {
      fields: [projectScheduleOfValues.previousVersionId],
      references: [projectScheduleOfValues.id],
      relationName: 'sovVersions',
    }),
    approvedByUser: one(users, {
      fields: [projectScheduleOfValues.approvedBy],
      references: [users.id],
      relationName: 'sovApprover',
    }),
    createdByUser: one(users, {
      fields: [projectScheduleOfValues.createdBy],
      references: [users.id],
      relationName: 'sovCreator',
    }),
    updatedByUser: one(users, {
      fields: [projectScheduleOfValues.updatedBy],
      references: [users.id],
      relationName: 'sovUpdater',
    }),
    lines: many(scheduleOfValueLines),
    changeOrders: many(sovChangeOrders),
  })
);

export const scheduleOfValueLinesRelations = relations(
  scheduleOfValueLines,
  ({ one, many }) => ({
    scheduleOfValues: one(projectScheduleOfValues, {
      fields: [scheduleOfValueLines.scheduleOfValuesId],
      references: [projectScheduleOfValues.id],
    }),
    projectCostCode: one(projectCostCodes, {
      fields: [scheduleOfValueLines.projectCostCodeId],
      references: [projectCostCodes.id],
    }),
    revenueAccount: one(accounts, {
      fields: [scheduleOfValueLines.revenueAccountId],
      references: [accounts.id],
      relationName: 'sovRevenueAccount',
    }),
    contractAssetAccount: one(accounts, {
      fields: [scheduleOfValueLines.contractAssetAccountId],
      references: [accounts.id],
      relationName: 'sovContractAssetAccount',
    }),
    retainageAccount: one(accounts, {
      fields: [scheduleOfValueLines.retainageAccountId],
      references: [accounts.id],
      relationName: 'sovRetainageAccount',
    }),
    parentLine: one(scheduleOfValueLines, {
      fields: [scheduleOfValueLines.parentLineId],
      references: [scheduleOfValueLines.id],
      relationName: 'sovLineHierarchy',
    }),
    childLines: many(scheduleOfValueLines, {
      relationName: 'sovLineHierarchy',
    }),
    changeOrderLines: many(sovChangeOrderLines),
  })
);

export const sovChangeOrdersRelations = relations(
  sovChangeOrders,
  ({ one, many }) => ({
    scheduleOfValues: one(projectScheduleOfValues, {
      fields: [sovChangeOrders.scheduleOfValuesId],
      references: [projectScheduleOfValues.id],
    }),
    requestedByUser: one(users, {
      fields: [sovChangeOrders.requestedBy],
      references: [users.id],
      relationName: 'coRequester',
    }),
    approvedByUser: one(users, {
      fields: [sovChangeOrders.approvedBy],
      references: [users.id],
      relationName: 'coApprover',
    }),
    rejectedByUser: one(users, {
      fields: [sovChangeOrders.rejectedBy],
      references: [users.id],
      relationName: 'coRejecter',
    }),
    createdByUser: one(users, {
      fields: [sovChangeOrders.createdBy],
      references: [users.id],
      relationName: 'coCreator',
    }),
    lines: many(sovChangeOrderLines),
  })
);

export const sovChangeOrderLinesRelations = relations(
  sovChangeOrderLines,
  ({ one }) => ({
    changeOrder: one(sovChangeOrders, {
      fields: [sovChangeOrderLines.changeOrderId],
      references: [sovChangeOrders.id],
    }),
    sovLine: one(scheduleOfValueLines, {
      fields: [sovChangeOrderLines.sovLineId],
      references: [scheduleOfValueLines.id],
    }),
  })
);

// Type exports
export type ProjectScheduleOfValues = typeof projectScheduleOfValues.$inferSelect;
export type NewProjectScheduleOfValues = typeof projectScheduleOfValues.$inferInsert;
export type ScheduleOfValueLine = typeof scheduleOfValueLines.$inferSelect;
export type NewScheduleOfValueLine = typeof scheduleOfValueLines.$inferInsert;
export type SovChangeOrder = typeof sovChangeOrders.$inferSelect;
export type NewSovChangeOrder = typeof sovChangeOrders.$inferInsert;
export type SovChangeOrderLine = typeof sovChangeOrderLines.$inferSelect;
export type NewSovChangeOrderLine = typeof sovChangeOrderLines.$inferInsert;
