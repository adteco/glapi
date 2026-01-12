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
import { projects } from './projects';
import { organizations } from './organizations';
import { users } from './users';
import { entities } from './entities';
import { glTransactions } from './gl-transactions';
import {
  projectScheduleOfValues,
  scheduleOfValueLines,
} from './schedule-of-values';

/**
 * Pay Application Status Workflow:
 * DRAFT -> SUBMITTED -> APPROVED -> BILLED -> PAID
 *
 * Can also be: REJECTED (back to DRAFT), VOIDED (cancelled)
 */
export const PAY_APP_STATUS = {
  DRAFT: 'DRAFT', // Being prepared
  SUBMITTED: 'SUBMITTED', // Submitted for review
  APPROVED: 'APPROVED', // Approved by owner/GC
  CERTIFIED: 'CERTIFIED', // Architect/engineer certified
  BILLED: 'BILLED', // Invoice generated
  PAID: 'PAID', // Payment received
  REJECTED: 'REJECTED', // Rejected - needs revision
  VOIDED: 'VOIDED', // Cancelled/voided
} as const;

export type PayAppStatus = (typeof PAY_APP_STATUS)[keyof typeof PAY_APP_STATUS];

/**
 * Pay Application Type
 */
export const PAY_APP_TYPE = {
  PROGRESS: 'PROGRESS', // Regular progress billing
  FINAL: 'FINAL', // Final payment request
  RETAINAGE_RELEASE: 'RETAINAGE_RELEASE', // Retainage release only
} as const;

export type PayAppType = (typeof PAY_APP_TYPE)[keyof typeof PAY_APP_TYPE];

/**
 * Pay Applications (AIA G702 equivalent)
 * Header record for a payment application/invoice to owner
 */
export const payApplications = pgTable(
  'pay_applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    scheduleOfValuesId: uuid('schedule_of_values_id')
      .notNull()
      .references(() => projectScheduleOfValues.id),

    // Application identification
    applicationNumber: integer('application_number').notNull(), // Sequential per project
    applicationDate: date('application_date').notNull(),
    payAppType: text('pay_app_type').default('PROGRESS').notNull(), // PROGRESS, FINAL, RETAINAGE_RELEASE

    // Period covered
    periodFrom: date('period_from').notNull(),
    periodTo: date('period_to').notNull(),

    // Parties
    contractorId: uuid('contractor_id').references(() => entities.id), // Contractor submitting
    ownerId: uuid('owner_id').references(() => entities.id), // Owner receiving
    architectId: uuid('architect_id').references(() => entities.id), // Architect certifying

    // Contract amounts (from SOV at time of pay app)
    originalContractSum: decimal('original_contract_sum', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(),
    netChangeByChangeOrders: decimal('net_change_by_change_orders', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(),
    contractSumToDate: decimal('contract_sum_to_date', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // Line 3 on G702

    // Work completed summary
    totalCompletedAndStoredToDate: decimal(
      'total_completed_and_stored_to_date',
      { precision: 18, scale: 4 }
    )
      .default('0')
      .notNull(), // Line 4
    retainagePercent: decimal('retainage_percent', { precision: 5, scale: 2 })
      .default('10')
      .notNull(),

    // Retainage breakdown
    retainageFromWorkCompleted: decimal('retainage_from_work_completed', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // Line 5a
    retainageFromStoredMaterial: decimal('retainage_from_stored_material', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // Line 5b
    totalRetainage: decimal('total_retainage', { precision: 18, scale: 4 })
      .default('0')
      .notNull(), // Line 5c = 5a + 5b

    // Net amounts
    totalEarnedLessRetainage: decimal('total_earned_less_retainage', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // Line 6 = Line 4 - Line 5c
    lessPreviousCertificates: decimal('less_previous_certificates', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // Line 7
    currentPaymentDue: decimal('current_payment_due', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // Line 8 = Line 6 - Line 7
    balanceToFinish: decimal('balance_to_finish', { precision: 18, scale: 4 })
      .default('0')
      .notNull(), // Line 9 = Line 3 - Line 6

    // Retainage release (for partial/final releases)
    retainageReleaseAmount: decimal('retainage_release_amount', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(),
    retainageReleasePercent: decimal('retainage_release_percent', {
      precision: 5,
      scale: 2,
    }),

    // Status and workflow
    status: text('status').default('DRAFT').notNull(),

    // Submission tracking
    submittedBy: uuid('submitted_by').references(() => users.id),
    submittedDate: timestamp('submitted_date', { withTimezone: true }),

    // Owner/GC review
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewedDate: timestamp('reviewed_date', { withTimezone: true }),
    reviewNotes: text('review_notes'),

    // Approval
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedDate: timestamp('approved_date', { withTimezone: true }),
    approvedAmount: decimal('approved_amount', { precision: 18, scale: 4 }), // May differ from requested

    // Architect certification (AIA G702)
    certifiedBy: uuid('certified_by').references(() => users.id),
    certifiedDate: timestamp('certified_date', { withTimezone: true }),
    certificationNumber: text('certification_number'),

    // Rejection
    rejectedBy: uuid('rejected_by').references(() => users.id),
    rejectedDate: timestamp('rejected_date', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),

    // Billing/Invoice
    billedDate: timestamp('billed_date', { withTimezone: true }),
    invoiceNumber: text('invoice_number'),
    invoiceDate: date('invoice_date'),

    // Payment tracking
    paidDate: timestamp('paid_date', { withTimezone: true }),
    paidAmount: decimal('paid_amount', { precision: 18, scale: 4 }),
    checkNumber: text('check_number'),
    paymentReference: text('payment_reference'),

    // GL Integration
    glTransactionId: uuid('gl_transaction_id').references(
      () => glTransactions.id
    ),

    // External references
    externalReference: text('external_reference'), // Owner's pay app number
    documentUrl: text('document_url'), // Link to signed document

    // Currency
    currencyCode: text('currency_code').default('USD').notNull(),

    // Void tracking
    voidedBy: uuid('voided_by').references(() => users.id),
    voidedDate: timestamp('voided_date', { withTimezone: true }),
    voidReason: text('void_reason'),

    // Audit fields
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedBy: uuid('updated_by').references(() => users.id),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    notes: text('notes'),
    metadata: jsonb('metadata'),
  },
  (table) => ({
    projectAppNumIdx: uniqueIndex('idx_pay_app_project_num').on(
      table.projectId,
      table.applicationNumber
    ),
    orgProjectIdx: index('idx_pay_app_org_project').on(
      table.organizationId,
      table.projectId
    ),
    statusIdx: index('idx_pay_app_status').on(table.status),
    periodIdx: index('idx_pay_app_period').on(table.periodFrom, table.periodTo),
    invoiceIdx: index('idx_pay_app_invoice').on(table.invoiceNumber),
  })
);

/**
 * Pay Application Lines (AIA G703 equivalent)
 * Detail lines showing progress on each SOV item
 */
export const payApplicationLines = pgTable(
  'pay_application_lines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    payApplicationId: uuid('pay_application_id')
      .notNull()
      .references(() => payApplications.id, { onDelete: 'cascade' }),
    sovLineId: uuid('sov_line_id')
      .notNull()
      .references(() => scheduleOfValueLines.id),

    lineNumber: integer('line_number').notNull(),

    // SOV reference data (snapshot at time of pay app)
    itemNumber: text('item_number'), // From SOV line
    description: text('description').notNull(),
    scheduledValue: decimal('scheduled_value', { precision: 18, scale: 4 })
      .default('0')
      .notNull(), // Col C - contract value

    // Previous billing (from prior pay apps)
    previousWorkCompleted: decimal('previous_work_completed', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // Col D
    previousMaterialsStored: decimal('previous_materials_stored', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // Col E

    // This period billing
    thisWorkCompleted: decimal('this_work_completed', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // Col F
    thisMaterialsStored: decimal('this_materials_stored', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // Col G

    // Calculated totals
    totalCompletedAndStored: decimal('total_completed_and_stored', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // D+E+F+G
    percentComplete: decimal('percent_complete', { precision: 8, scale: 4 })
      .default('0')
      .notNull(), // % of scheduled value
    balanceToFinish: decimal('balance_to_finish', { precision: 18, scale: 4 })
      .default('0')
      .notNull(), // C - total completed

    // Retainage for this line
    retainagePercent: decimal('retainage_percent', { precision: 5, scale: 2 })
      .default('10')
      .notNull(),
    retainageAmount: decimal('retainage_amount', { precision: 18, scale: 4 })
      .default('0')
      .notNull(),

    // Adjustments (if approved amount differs from requested)
    adjustedThisWorkCompleted: decimal('adjusted_this_work_completed', {
      precision: 18,
      scale: 4,
    }),
    adjustedThisMaterialsStored: decimal('adjusted_this_materials_stored', {
      precision: 18,
      scale: 4,
    }),
    adjustmentReason: text('adjustment_reason'),

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
    payAppLineIdx: uniqueIndex('idx_pay_app_line_number').on(
      table.payApplicationId,
      table.lineNumber
    ),
    sovLineIdx: index('idx_pay_app_line_sov').on(table.sovLineId),
    payAppSovIdx: uniqueIndex('idx_pay_app_sov_line').on(
      table.payApplicationId,
      table.sovLineId
    ),
  })
);

/**
 * Retainage Releases
 * Tracks partial and final retainage releases
 */
export const retainageReleases = pgTable(
  'retainage_releases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    payApplicationId: uuid('pay_application_id').references(
      () => payApplications.id
    ), // Optional: may be standalone

    releaseNumber: integer('release_number').notNull(), // Sequential per project
    releaseDate: date('release_date').notNull(),
    releaseType: text('release_type').default('PARTIAL').notNull(), // PARTIAL, FINAL, PUNCHLIST

    // Amounts
    totalRetainageHeld: decimal('total_retainage_held', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // Before this release
    releaseAmount: decimal('release_amount', { precision: 18, scale: 4 })
      .default('0')
      .notNull(),
    retainageRemaining: decimal('retainage_remaining', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // After this release
    releasePercent: decimal('release_percent', { precision: 5, scale: 2 }), // % of held being released

    // Status workflow
    status: text('status').default('DRAFT').notNull(), // DRAFT, SUBMITTED, APPROVED, PAID, VOIDED

    // Approval workflow
    requestedBy: uuid('requested_by').references(() => users.id),
    requestedDate: timestamp('requested_date', { withTimezone: true }),
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedDate: timestamp('approved_date', { withTimezone: true }),
    approvedAmount: decimal('approved_amount', { precision: 18, scale: 4 }),

    // Payment tracking
    paidDate: timestamp('paid_date', { withTimezone: true }),
    paidAmount: decimal('paid_amount', { precision: 18, scale: 4 }),
    checkNumber: text('check_number'),
    paymentReference: text('payment_reference'),

    // GL Integration
    glTransactionId: uuid('gl_transaction_id').references(
      () => glTransactions.id
    ),

    // Conditions/requirements
    requiresPunchlistComplete: boolean('requires_punchlist_complete').default(
      false
    ),
    punchlistCompleteDate: date('punchlist_complete_date'),
    requiresLienWaivers: boolean('requires_lien_waivers').default(false),
    lienWaiversReceivedDate: date('lien_waivers_received_date'),
    requiresWarrantyDocuments: boolean('requires_warranty_documents').default(
      false
    ),
    warrantyDocumentsReceivedDate: date('warranty_documents_received_date'),

    // External references
    externalReference: text('external_reference'),
    documentUrl: text('document_url'),

    // Currency
    currencyCode: text('currency_code').default('USD').notNull(),

    notes: text('notes'),
    metadata: jsonb('metadata'),

    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedBy: uuid('updated_by').references(() => users.id),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    projectReleaseIdx: uniqueIndex('idx_retainage_release_project').on(
      table.projectId,
      table.releaseNumber
    ),
    payAppIdx: index('idx_retainage_release_pay_app').on(table.payApplicationId),
    statusIdx: index('idx_retainage_release_status').on(table.status),
  })
);

/**
 * Retainage Release Lines
 * Distributes retainage release amount across SOV lines
 */
export const retainageReleaseLines = pgTable(
  'retainage_release_lines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    retainageReleaseId: uuid('retainage_release_id')
      .notNull()
      .references(() => retainageReleases.id, { onDelete: 'cascade' }),
    sovLineId: uuid('sov_line_id')
      .notNull()
      .references(() => scheduleOfValueLines.id),

    lineNumber: integer('line_number').notNull(),
    description: text('description'),

    retainageHeld: decimal('retainage_held', { precision: 18, scale: 4 })
      .default('0')
      .notNull(), // Before release
    releaseAmount: decimal('release_amount', { precision: 18, scale: 4 })
      .default('0')
      .notNull(),
    retainageRemaining: decimal('retainage_remaining', {
      precision: 18,
      scale: 4,
    })
      .default('0')
      .notNull(), // After release

    notes: text('notes'),
    metadata: jsonb('metadata'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    releaseLineIdx: uniqueIndex('idx_retainage_release_line').on(
      table.retainageReleaseId,
      table.lineNumber
    ),
    sovLineIdx: index('idx_retainage_release_sov_line').on(table.sovLineId),
  })
);

/**
 * Pay Application Approval History
 * Tracks all approval/rejection actions for audit trail
 */
export const payAppApprovalHistory = pgTable(
  'pay_app_approval_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    payApplicationId: uuid('pay_application_id')
      .notNull()
      .references(() => payApplications.id),

    action: text('action').notNull(), // SUBMIT, APPROVE, REJECT, CERTIFY, VOID, etc.
    fromStatus: text('from_status').notNull(),
    toStatus: text('to_status').notNull(),

    performedBy: uuid('performed_by')
      .notNull()
      .references(() => users.id),
    performedAt: timestamp('performed_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    comments: text('comments'),
    amount: decimal('amount', { precision: 18, scale: 4 }), // If approval adjusted amount
    metadata: jsonb('metadata'),
  },
  (table) => ({
    payAppHistoryIdx: index('idx_pay_app_approval_history').on(
      table.payApplicationId,
      table.performedAt
    ),
    actionIdx: index('idx_pay_app_approval_action').on(table.action),
  })
);

// Relations
export const payApplicationsRelations = relations(
  payApplications,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [payApplications.organizationId],
      references: [organizations.id],
    }),
    project: one(projects, {
      fields: [payApplications.projectId],
      references: [projects.id],
    }),
    scheduleOfValues: one(projectScheduleOfValues, {
      fields: [payApplications.scheduleOfValuesId],
      references: [projectScheduleOfValues.id],
    }),
    contractor: one(entities, {
      fields: [payApplications.contractorId],
      references: [entities.id],
      relationName: 'payAppContractor',
    }),
    owner: one(entities, {
      fields: [payApplications.ownerId],
      references: [entities.id],
      relationName: 'payAppOwner',
    }),
    architect: one(entities, {
      fields: [payApplications.architectId],
      references: [entities.id],
      relationName: 'payAppArchitect',
    }),
    glTransaction: one(glTransactions, {
      fields: [payApplications.glTransactionId],
      references: [glTransactions.id],
    }),
    submittedByUser: one(users, {
      fields: [payApplications.submittedBy],
      references: [users.id],
      relationName: 'payAppSubmitter',
    }),
    reviewedByUser: one(users, {
      fields: [payApplications.reviewedBy],
      references: [users.id],
      relationName: 'payAppReviewer',
    }),
    approvedByUser: one(users, {
      fields: [payApplications.approvedBy],
      references: [users.id],
      relationName: 'payAppApprover',
    }),
    certifiedByUser: one(users, {
      fields: [payApplications.certifiedBy],
      references: [users.id],
      relationName: 'payAppCertifier',
    }),
    rejectedByUser: one(users, {
      fields: [payApplications.rejectedBy],
      references: [users.id],
      relationName: 'payAppRejecter',
    }),
    voidedByUser: one(users, {
      fields: [payApplications.voidedBy],
      references: [users.id],
      relationName: 'payAppVoider',
    }),
    createdByUser: one(users, {
      fields: [payApplications.createdBy],
      references: [users.id],
      relationName: 'payAppCreator',
    }),
    updatedByUser: one(users, {
      fields: [payApplications.updatedBy],
      references: [users.id],
      relationName: 'payAppUpdater',
    }),
    lines: many(payApplicationLines),
    retainageReleases: many(retainageReleases),
    approvalHistory: many(payAppApprovalHistory),
  })
);

export const payApplicationLinesRelations = relations(
  payApplicationLines,
  ({ one }) => ({
    payApplication: one(payApplications, {
      fields: [payApplicationLines.payApplicationId],
      references: [payApplications.id],
    }),
    sovLine: one(scheduleOfValueLines, {
      fields: [payApplicationLines.sovLineId],
      references: [scheduleOfValueLines.id],
    }),
  })
);

export const retainageReleasesRelations = relations(
  retainageReleases,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [retainageReleases.organizationId],
      references: [organizations.id],
    }),
    project: one(projects, {
      fields: [retainageReleases.projectId],
      references: [projects.id],
    }),
    payApplication: one(payApplications, {
      fields: [retainageReleases.payApplicationId],
      references: [payApplications.id],
    }),
    glTransaction: one(glTransactions, {
      fields: [retainageReleases.glTransactionId],
      references: [glTransactions.id],
    }),
    requestedByUser: one(users, {
      fields: [retainageReleases.requestedBy],
      references: [users.id],
      relationName: 'releaseRequester',
    }),
    approvedByUser: one(users, {
      fields: [retainageReleases.approvedBy],
      references: [users.id],
      relationName: 'releaseApprover',
    }),
    createdByUser: one(users, {
      fields: [retainageReleases.createdBy],
      references: [users.id],
      relationName: 'releaseCreator',
    }),
    updatedByUser: one(users, {
      fields: [retainageReleases.updatedBy],
      references: [users.id],
      relationName: 'releaseUpdater',
    }),
    lines: many(retainageReleaseLines),
  })
);

export const retainageReleaseLinesRelations = relations(
  retainageReleaseLines,
  ({ one }) => ({
    retainageRelease: one(retainageReleases, {
      fields: [retainageReleaseLines.retainageReleaseId],
      references: [retainageReleases.id],
    }),
    sovLine: one(scheduleOfValueLines, {
      fields: [retainageReleaseLines.sovLineId],
      references: [scheduleOfValueLines.id],
    }),
  })
);

export const payAppApprovalHistoryRelations = relations(
  payAppApprovalHistory,
  ({ one }) => ({
    payApplication: one(payApplications, {
      fields: [payAppApprovalHistory.payApplicationId],
      references: [payApplications.id],
    }),
    performedByUser: one(users, {
      fields: [payAppApprovalHistory.performedBy],
      references: [users.id],
    }),
  })
);

// Type exports
export type PayApplication = typeof payApplications.$inferSelect;
export type NewPayApplication = typeof payApplications.$inferInsert;
export type PayApplicationLine = typeof payApplicationLines.$inferSelect;
export type NewPayApplicationLine = typeof payApplicationLines.$inferInsert;
export type RetainageRelease = typeof retainageReleases.$inferSelect;
export type NewRetainageRelease = typeof retainageReleases.$inferInsert;
export type RetainageReleaseLine = typeof retainageReleaseLines.$inferSelect;
export type NewRetainageReleaseLine = typeof retainageReleaseLines.$inferInsert;
export type PayAppApprovalHistory = typeof payAppApprovalHistory.$inferSelect;
export type NewPayAppApprovalHistory = typeof payAppApprovalHistory.$inferInsert;
