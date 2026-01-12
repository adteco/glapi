import { pgTable, text, boolean, timestamp, uuid, integer, decimal, index, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { accountingPeriods } from './accounting-periods';
import { subsidiaries } from './subsidiaries';
import { users } from './users';
import { accounts } from './accounts';

/**
 * Close task status lifecycle:
 * - NOT_STARTED: Task not yet begun
 * - IN_PROGRESS: Task is being worked on
 * - PENDING_REVIEW: Task completed, awaiting review
 * - COMPLETED: Task finished and approved
 * - BLOCKED: Task cannot proceed due to dependency
 * - SKIPPED: Task intentionally skipped (with reason)
 */
export const CLOSE_TASK_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_REVIEW: 'PENDING_REVIEW',
  COMPLETED: 'COMPLETED',
  BLOCKED: 'BLOCKED',
  SKIPPED: 'SKIPPED',
} as const;

export type CloseTaskStatus = typeof CLOSE_TASK_STATUS[keyof typeof CLOSE_TASK_STATUS];

/**
 * Close task priority levels
 */
export const CLOSE_TASK_PRIORITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;

export type CloseTaskPriority = typeof CLOSE_TASK_PRIORITY[keyof typeof CLOSE_TASK_PRIORITY];

/**
 * Variance alert severity
 */
export const VARIANCE_ALERT_SEVERITY = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
} as const;

export type VarianceAlertSeverity = typeof VARIANCE_ALERT_SEVERITY[keyof typeof VARIANCE_ALERT_SEVERITY];

/**
 * Tie-out status
 */
export const TIEOUT_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  RECONCILED: 'RECONCILED',
  VARIANCE_IDENTIFIED: 'VARIANCE_IDENTIFIED',
  APPROVED: 'APPROVED',
} as const;

export type TieoutStatus = typeof TIEOUT_STATUS[keyof typeof TIEOUT_STATUS];

/**
 * Close task templates - reusable task definitions
 */
export const closeTaskTemplates = pgTable('close_task_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  subsidiaryId: uuid('subsidiary_id').notNull(),
  taskCode: text('task_code').notNull(),
  taskName: text('task_name').notNull(),
  description: text('description'),
  category: text('category').notNull(), // 'JOURNAL_ENTRY', 'RECONCILIATION', 'REVIEW', 'REPORTING', 'OTHER'
  priority: text('priority').notNull().default('MEDIUM'),
  estimatedMinutes: integer('estimated_minutes'),
  instructions: text('instructions'),
  // Dependencies
  dependsOnTaskCodes: jsonb('depends_on_task_codes').$type<string[]>().default([]),
  // Assignment
  defaultAssigneeId: uuid('default_assignee_id'),
  defaultReviewerId: uuid('default_reviewer_id'),
  // Timing
  dayOfCloseTarget: integer('day_of_close_target'), // Day number in close process (1, 2, 3, etc.)
  isRequired: boolean('is_required').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  // Automation
  automationType: text('automation_type'), // 'MANUAL', 'SEMI_AUTO', 'FULLY_AUTO'
  automationConfig: jsonb('automation_config').$type<Record<string, unknown>>(),
  // Audit
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
}, (table) => ({
  subTaskCodeIdx: uniqueIndex('idx_close_templates_sub_code').on(table.subsidiaryId, table.taskCode),
  categoryIdx: index('idx_close_templates_category').on(table.subsidiaryId, table.category),
  activeIdx: index('idx_close_templates_active').on(table.subsidiaryId, table.isActive),
}));

/**
 * Close checklists - instances for each period close
 */
export const closeChecklists = pgTable('close_checklists', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountingPeriodId: uuid('accounting_period_id').notNull(),
  subsidiaryId: uuid('subsidiary_id').notNull(),
  checklistName: text('checklist_name').notNull(),
  status: text('status').notNull().default('NOT_STARTED'),
  // Progress tracking
  totalTasks: integer('total_tasks').default(0).notNull(),
  completedTasks: integer('completed_tasks').default(0).notNull(),
  blockedTasks: integer('blocked_tasks').default(0).notNull(),
  // Dates
  targetCloseDate: timestamp('target_close_date', { withTimezone: true }),
  actualCloseDate: timestamp('actual_close_date', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  // Owner
  ownerId: uuid('owner_id'),
  // Notes
  notes: text('notes'),
  // Audit
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
}, (table) => ({
  periodIdx: uniqueIndex('idx_close_checklists_period').on(table.accountingPeriodId),
  subsidiaryStatusIdx: index('idx_close_checklists_sub_status').on(table.subsidiaryId, table.status),
  targetDateIdx: index('idx_close_checklists_target_date').on(table.targetCloseDate),
}));

/**
 * Close tasks - individual tasks within a checklist
 */
export const closeTasks = pgTable('close_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  checklistId: uuid('checklist_id').notNull(),
  templateId: uuid('template_id'),
  // Task details
  taskCode: text('task_code').notNull(),
  taskName: text('task_name').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  priority: text('priority').notNull().default('MEDIUM'),
  status: text('status').notNull().default('NOT_STARTED'),
  // Assignment
  assigneeId: uuid('assignee_id'),
  reviewerId: uuid('reviewer_id'),
  // Timing
  dueDate: timestamp('due_date', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  estimatedMinutes: integer('estimated_minutes'),
  actualMinutes: integer('actual_minutes'),
  // Dependencies
  dependsOnTaskIds: jsonb('depends_on_task_ids').$type<string[]>().default([]),
  blockedReason: text('blocked_reason'),
  // Work details
  workNotes: text('work_notes'),
  reviewNotes: text('review_notes'),
  skipReason: text('skip_reason'),
  // Supporting data
  attachmentUrls: jsonb('attachment_urls').$type<string[]>().default([]),
  relatedTransactionIds: jsonb('related_transaction_ids').$type<string[]>().default([]),
  sortOrder: integer('sort_order').default(0).notNull(),
  // Audit
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
}, (table) => ({
  checklistIdx: index('idx_close_tasks_checklist').on(table.checklistId),
  statusIdx: index('idx_close_tasks_status').on(table.checklistId, table.status),
  assigneeIdx: index('idx_close_tasks_assignee').on(table.assigneeId, table.status),
  dueDateIdx: index('idx_close_tasks_due_date').on(table.dueDate, table.status),
}));

/**
 * Variance thresholds - define when alerts should be triggered
 */
export const varianceThresholds = pgTable('variance_thresholds', {
  id: uuid('id').defaultRandom().primaryKey(),
  subsidiaryId: uuid('subsidiary_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  // Scope
  accountId: uuid('account_id'), // Specific account, or null for all
  accountPattern: text('account_pattern'), // Regex pattern for account codes
  // Thresholds
  absoluteThreshold: decimal('absolute_threshold', { precision: 19, scale: 4 }),
  percentageThreshold: decimal('percentage_threshold', { precision: 5, scale: 2 }),
  // Comparison
  compareAgainst: text('compare_against').notNull(), // 'PRIOR_PERIOD', 'PRIOR_YEAR', 'BUDGET', 'FORECAST'
  // Alert configuration
  severity: text('severity').notNull().default('WARNING'),
  isActive: boolean('is_active').default(true).notNull(),
  notifyUserIds: jsonb('notify_user_ids').$type<string[]>().default([]),
  // Audit
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
}, (table) => ({
  subsidiaryIdx: index('idx_variance_thresholds_sub').on(table.subsidiaryId, table.isActive),
  accountIdx: index('idx_variance_thresholds_account').on(table.accountId),
}));

/**
 * Variance alerts - triggered when thresholds are exceeded
 */
export const varianceAlerts = pgTable('variance_alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  thresholdId: uuid('threshold_id'),
  accountingPeriodId: uuid('accounting_period_id').notNull(),
  checklistId: uuid('checklist_id'),
  // Alert details
  accountId: uuid('account_id').notNull(),
  severity: text('severity').notNull(),
  alertType: text('alert_type').notNull(), // 'VARIANCE', 'UNUSUAL_BALANCE', 'MISSING_ENTRY', 'DUPLICATE'
  // Values
  currentValue: decimal('current_value', { precision: 19, scale: 4 }).notNull(),
  comparisonValue: decimal('comparison_value', { precision: 19, scale: 4 }),
  varianceAmount: decimal('variance_amount', { precision: 19, scale: 4 }),
  variancePercent: decimal('variance_percent', { precision: 10, scale: 4 }),
  // Status
  status: text('status').notNull().default('OPEN'), // 'OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'
  acknowledgedBy: uuid('acknowledged_by'),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  resolvedBy: uuid('resolved_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  // Notes
  alertMessage: text('alert_message').notNull(),
  resolutionNotes: text('resolution_notes'),
  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
}, (table) => ({
  periodIdx: index('idx_variance_alerts_period').on(table.accountingPeriodId, table.status),
  checklistIdx: index('idx_variance_alerts_checklist').on(table.checklistId),
  severityIdx: index('idx_variance_alerts_severity').on(table.severity, table.status),
  accountIdx: index('idx_variance_alerts_account').on(table.accountId),
}));

/**
 * Tie-out templates - reconciliation templates
 */
export const tieoutTemplates = pgTable('tieout_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  subsidiaryId: uuid('subsidiary_id').notNull(),
  templateCode: text('template_code').notNull(),
  templateName: text('template_name').notNull(),
  description: text('description'),
  // Configuration
  sourceType: text('source_type').notNull(), // 'GL_BALANCE', 'SUBLEDGER', 'EXTERNAL', 'CALCULATED'
  targetType: text('target_type').notNull(), // 'GL_BALANCE', 'SUBLEDGER', 'EXTERNAL', 'CALCULATED'
  sourceAccountId: uuid('source_account_id'),
  targetAccountId: uuid('target_account_id'),
  sourceConfig: jsonb('source_config').$type<Record<string, unknown>>(),
  targetConfig: jsonb('target_config').$type<Record<string, unknown>>(),
  // Tolerance
  toleranceAmount: decimal('tolerance_amount', { precision: 19, scale: 4 }).default('0'),
  tolerancePercent: decimal('tolerance_percent', { precision: 5, scale: 2 }).default('0'),
  // Assignment
  defaultAssigneeId: uuid('default_assignee_id'),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  // Audit
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
}, (table) => ({
  subCodeIdx: uniqueIndex('idx_tieout_templates_sub_code').on(table.subsidiaryId, table.templateCode),
  activeIdx: index('idx_tieout_templates_active').on(table.subsidiaryId, table.isActive),
}));

/**
 * Tie-out instances - actual reconciliations for each period
 */
export const tieoutInstances = pgTable('tieout_instances', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: uuid('template_id'),
  checklistId: uuid('checklist_id'),
  accountingPeriodId: uuid('accounting_period_id').notNull(),
  closeTaskId: uuid('close_task_id'),
  // Tie-out details
  tieoutName: text('tieout_name').notNull(),
  status: text('status').notNull().default('NOT_STARTED'),
  // Values
  sourceValue: decimal('source_value', { precision: 19, scale: 4 }),
  targetValue: decimal('target_value', { precision: 19, scale: 4 }),
  varianceAmount: decimal('variance_amount', { precision: 19, scale: 4 }),
  // Status tracking
  assigneeId: uuid('assignee_id'),
  reviewerId: uuid('reviewer_id'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: uuid('approved_by'),
  // Notes
  workNotes: text('work_notes'),
  varianceExplanation: text('variance_explanation'),
  // Supporting docs
  attachmentUrls: jsonb('attachment_urls').$type<string[]>().default([]),
  // Audit
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
}, (table) => ({
  periodIdx: index('idx_tieout_instances_period').on(table.accountingPeriodId),
  checklistIdx: index('idx_tieout_instances_checklist').on(table.checklistId),
  statusIdx: index('idx_tieout_instances_status').on(table.status),
  assigneeIdx: index('idx_tieout_instances_assignee').on(table.assigneeId),
}));

/**
 * Close notifications - alerts and reminders
 */
export const closeNotifications = pgTable('close_notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Target
  userId: uuid('user_id').notNull(),
  checklistId: uuid('checklist_id'),
  taskId: uuid('task_id'),
  alertId: uuid('alert_id'),
  // Notification details
  notificationType: text('notification_type').notNull(), // 'TASK_ASSIGNED', 'TASK_DUE', 'TASK_OVERDUE', 'VARIANCE_ALERT', 'REVIEW_NEEDED', 'CLOSE_REMINDER'
  title: text('title').notNull(),
  message: text('message').notNull(),
  severity: text('severity').notNull().default('INFO'),
  // Status
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  isDismissed: boolean('is_dismissed').default(false).notNull(),
  dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
  // Action link
  actionUrl: text('action_url'),
  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
}, (table) => ({
  userIdx: index('idx_close_notifications_user').on(table.userId, table.isRead),
  checklistIdx: index('idx_close_notifications_checklist').on(table.checklistId),
  typeIdx: index('idx_close_notifications_type').on(table.notificationType, table.createdAt),
}));

// Relations
export const closeTaskTemplatesRelations = relations(closeTaskTemplates, ({ one }) => ({
  subsidiary: one(subsidiaries, {
    fields: [closeTaskTemplates.subsidiaryId],
    references: [subsidiaries.id],
  }),
  defaultAssignee: one(users, {
    fields: [closeTaskTemplates.defaultAssigneeId],
    references: [users.id],
    relationName: 'templateDefaultAssignee',
  }),
  defaultReviewer: one(users, {
    fields: [closeTaskTemplates.defaultReviewerId],
    references: [users.id],
    relationName: 'templateDefaultReviewer',
  }),
  createdByUser: one(users, {
    fields: [closeTaskTemplates.createdBy],
    references: [users.id],
    relationName: 'templateCreatedByUser',
  }),
}));

export const closeChecklistsRelations = relations(closeChecklists, ({ one, many }) => ({
  accountingPeriod: one(accountingPeriods, {
    fields: [closeChecklists.accountingPeriodId],
    references: [accountingPeriods.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [closeChecklists.subsidiaryId],
    references: [subsidiaries.id],
  }),
  owner: one(users, {
    fields: [closeChecklists.ownerId],
    references: [users.id],
    relationName: 'checklistOwner',
  }),
  createdByUser: one(users, {
    fields: [closeChecklists.createdBy],
    references: [users.id],
    relationName: 'checklistCreatedByUser',
  }),
  tasks: many(closeTasks),
  tieouts: many(tieoutInstances),
  alerts: many(varianceAlerts),
  notifications: many(closeNotifications),
}));

export const closeTasksRelations = relations(closeTasks, ({ one }) => ({
  checklist: one(closeChecklists, {
    fields: [closeTasks.checklistId],
    references: [closeChecklists.id],
  }),
  template: one(closeTaskTemplates, {
    fields: [closeTasks.templateId],
    references: [closeTaskTemplates.id],
  }),
  assignee: one(users, {
    fields: [closeTasks.assigneeId],
    references: [users.id],
    relationName: 'taskAssignee',
  }),
  reviewer: one(users, {
    fields: [closeTasks.reviewerId],
    references: [users.id],
    relationName: 'taskReviewer',
  }),
  createdByUser: one(users, {
    fields: [closeTasks.createdBy],
    references: [users.id],
    relationName: 'taskCreatedByUser',
  }),
}));

export const varianceThresholdsRelations = relations(varianceThresholds, ({ one, many }) => ({
  subsidiary: one(subsidiaries, {
    fields: [varianceThresholds.subsidiaryId],
    references: [subsidiaries.id],
  }),
  account: one(accounts, {
    fields: [varianceThresholds.accountId],
    references: [accounts.id],
  }),
  createdByUser: one(users, {
    fields: [varianceThresholds.createdBy],
    references: [users.id],
    relationName: 'thresholdCreatedByUser',
  }),
  alerts: many(varianceAlerts),
}));

export const varianceAlertsRelations = relations(varianceAlerts, ({ one }) => ({
  threshold: one(varianceThresholds, {
    fields: [varianceAlerts.thresholdId],
    references: [varianceThresholds.id],
  }),
  accountingPeriod: one(accountingPeriods, {
    fields: [varianceAlerts.accountingPeriodId],
    references: [accountingPeriods.id],
  }),
  checklist: one(closeChecklists, {
    fields: [varianceAlerts.checklistId],
    references: [closeChecklists.id],
  }),
  account: one(accounts, {
    fields: [varianceAlerts.accountId],
    references: [accounts.id],
  }),
  acknowledgedByUser: one(users, {
    fields: [varianceAlerts.acknowledgedBy],
    references: [users.id],
    relationName: 'alertAcknowledgedByUser',
  }),
  resolvedByUser: one(users, {
    fields: [varianceAlerts.resolvedBy],
    references: [users.id],
    relationName: 'alertResolvedByUser',
  }),
}));

export const tieoutTemplatesRelations = relations(tieoutTemplates, ({ one, many }) => ({
  subsidiary: one(subsidiaries, {
    fields: [tieoutTemplates.subsidiaryId],
    references: [subsidiaries.id],
  }),
  sourceAccount: one(accounts, {
    fields: [tieoutTemplates.sourceAccountId],
    references: [accounts.id],
    relationName: 'tieoutSourceAccount',
  }),
  targetAccount: one(accounts, {
    fields: [tieoutTemplates.targetAccountId],
    references: [accounts.id],
    relationName: 'tieoutTargetAccount',
  }),
  defaultAssignee: one(users, {
    fields: [tieoutTemplates.defaultAssigneeId],
    references: [users.id],
    relationName: 'tieoutTemplateAssignee',
  }),
  createdByUser: one(users, {
    fields: [tieoutTemplates.createdBy],
    references: [users.id],
    relationName: 'tieoutTemplateCreatedByUser',
  }),
  instances: many(tieoutInstances),
}));

export const tieoutInstancesRelations = relations(tieoutInstances, ({ one }) => ({
  template: one(tieoutTemplates, {
    fields: [tieoutInstances.templateId],
    references: [tieoutTemplates.id],
  }),
  checklist: one(closeChecklists, {
    fields: [tieoutInstances.checklistId],
    references: [closeChecklists.id],
  }),
  accountingPeriod: one(accountingPeriods, {
    fields: [tieoutInstances.accountingPeriodId],
    references: [accountingPeriods.id],
  }),
  closeTask: one(closeTasks, {
    fields: [tieoutInstances.closeTaskId],
    references: [closeTasks.id],
  }),
  assignee: one(users, {
    fields: [tieoutInstances.assigneeId],
    references: [users.id],
    relationName: 'tieoutAssignee',
  }),
  reviewer: one(users, {
    fields: [tieoutInstances.reviewerId],
    references: [users.id],
    relationName: 'tieoutReviewer',
  }),
  approvedByUser: one(users, {
    fields: [tieoutInstances.approvedBy],
    references: [users.id],
    relationName: 'tieoutApprovedByUser',
  }),
  createdByUser: one(users, {
    fields: [tieoutInstances.createdBy],
    references: [users.id],
    relationName: 'tieoutCreatedByUser',
  }),
}));

export const closeNotificationsRelations = relations(closeNotifications, ({ one }) => ({
  user: one(users, {
    fields: [closeNotifications.userId],
    references: [users.id],
  }),
  checklist: one(closeChecklists, {
    fields: [closeNotifications.checklistId],
    references: [closeChecklists.id],
  }),
  task: one(closeTasks, {
    fields: [closeNotifications.taskId],
    references: [closeTasks.id],
  }),
  alert: one(varianceAlerts, {
    fields: [closeNotifications.alertId],
    references: [varianceAlerts.id],
  }),
}));
