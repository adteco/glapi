import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  jsonb,
  integer,
  pgEnum,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';

// Report schedule status enum
export const reportScheduleStatusEnum = pgEnum('report_schedule_status', [
  'draft',
  'active',
  'paused',
  'completed',
  'error',
]);

// Report schedule frequency enum
export const reportScheduleFrequencyEnum = pgEnum('report_schedule_frequency', [
  'once',      // One-time execution
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'cron',      // Custom cron expression
]);

// Report type enum - the types of reports that can be scheduled
export const reportTypeEnum = pgEnum('report_type', [
  // Financial reports
  'income_statement',
  'balance_sheet',
  'cash_flow_statement',
  'trial_balance',
  'general_ledger',
  'account_activity',
  // Construction reports
  'job_cost_summary',
  'wip_summary',
  'project_budget_variance',
  'retainage_aging',
  // Revenue reports
  'revenue_forecast',
  'deferred_revenue',
  'subscription_metrics',
  // Custom
  'custom',
]);

// Job execution status enum
export const jobExecutionStatusEnum = pgEnum('job_execution_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

// Output format enum
export const reportOutputFormatEnum = pgEnum('report_output_format', [
  'json',
  'csv',
  'pdf',
  'xlsx',
]);

// Report schedules table - defines recurring report jobs
export const reportSchedules = pgTable('report_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id)
    .notNull(),

  // Schedule identification
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Report configuration
  reportType: reportTypeEnum('report_type').notNull(),
  outputFormat: reportOutputFormatEnum('output_format').default('json').notNull(),

  // Report filters stored as JSON (date ranges, dimensions, etc.)
  filters: jsonb('filters').$type<ReportFilters>().default({}),

  // Schedule configuration
  frequency: reportScheduleFrequencyEnum('frequency').notNull(),
  cronExpression: varchar('cron_expression', { length: 100 }), // For cron frequency

  // Timezone for scheduling (IANA timezone name)
  timezone: varchar('timezone', { length: 100 }).default('UTC').notNull(),

  // Interval-based scheduling options
  dayOfWeek: integer('day_of_week'), // 0-6 for weekly (0 = Sunday)
  dayOfMonth: integer('day_of_month'), // 1-31 for monthly
  monthOfYear: integer('month_of_year'), // 1-12 for yearly
  timeOfDay: varchar('time_of_day', { length: 8 }).default('06:00:00'), // HH:MM:SS format

  // Status
  status: reportScheduleStatusEnum('status').default('draft').notNull(),
  isEnabled: boolean('is_enabled').default(true).notNull(),

  // Execution tracking
  nextRunAt: timestamp('next_run_at', { withTimezone: true }),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
  lastErrorMessage: text('last_error_message'),

  // Run statistics
  totalRuns: integer('total_runs').default(0).notNull(),
  successfulRuns: integer('successful_runs').default(0).notNull(),
  failedRuns: integer('failed_runs').default(0).notNull(),

  // Execution limits
  maxRetries: integer('max_retries').default(3).notNull(),
  retryDelaySeconds: integer('retry_delay_seconds').default(300).notNull(),

  // End conditions
  runUntil: timestamp('run_until', { withTimezone: true }), // Stop after this date
  maxRuns: integer('max_runs'), // Stop after this many runs

  // Notification configuration
  notifyOnSuccess: boolean('notify_on_success').default(false).notNull(),
  notifyOnFailure: boolean('notify_on_failure').default(true).notNull(),
  notificationEmails: jsonb('notification_emails').$type<string[]>().default([]),

  // Delivery configuration (will be used by future delivery connectors)
  deliveryConfig: jsonb('delivery_config').$type<DeliveryConfig>(),

  // Metadata
  tags: jsonb('tags').$type<string[]>().default([]),
  metadata: jsonb('metadata'),

  // Audit fields
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdIdx: index('report_schedules_org_id_idx').on(table.organizationId),
  statusIdx: index('report_schedules_status_idx').on(table.status),
  nextRunAtIdx: index('report_schedules_next_run_at_idx').on(table.nextRunAt),
  reportTypeIdx: index('report_schedules_report_type_idx').on(table.reportType),
}));

// Job execution history table - tracks each execution of a scheduled job
export const reportJobExecutions = pgTable('report_job_executions', {
  id: uuid('id').defaultRandom().primaryKey(),
  reportScheduleId: uuid('report_schedule_id')
    .references(() => reportSchedules.id, { onDelete: 'cascade' })
    .notNull(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id)
    .notNull(),

  // Execution identification
  executionNumber: integer('execution_number').notNull(),

  // Status
  status: jobExecutionStatusEnum('status').default('pending').notNull(),

  // Timing
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  durationMs: integer('duration_ms'),

  // Retry tracking
  attemptNumber: integer('attempt_number').default(1).notNull(),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),

  // Results
  outputLocation: text('output_location'), // S3 URL, file path, etc.
  outputSizeBytes: integer('output_size_bytes'),
  rowCount: integer('row_count'),

  // Error tracking
  errorCode: varchar('error_code', { length: 50 }),
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),

  // The filters used for this execution (snapshot)
  filtersSnapshot: jsonb('filters_snapshot').$type<ReportFilters>(),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  scheduleIdIdx: index('report_job_executions_schedule_id_idx').on(table.reportScheduleId),
  orgIdIdx: index('report_job_executions_org_id_idx').on(table.organizationId),
  statusIdx: index('report_job_executions_status_idx').on(table.status),
  scheduledAtIdx: index('report_job_executions_scheduled_at_idx').on(table.scheduledAt),
}));

// Relations
export const reportSchedulesRelations = relations(reportSchedules, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [reportSchedules.organizationId],
    references: [organizations.id],
  }),
  executions: many(reportJobExecutions),
}));

export const reportJobExecutionsRelations = relations(reportJobExecutions, ({ one }) => ({
  reportSchedule: one(reportSchedules, {
    fields: [reportJobExecutions.reportScheduleId],
    references: [reportSchedules.id],
  }),
  organization: one(organizations, {
    fields: [reportJobExecutions.organizationId],
    references: [organizations.id],
  }),
}));

// Types for JSON columns
export interface ReportFilters {
  // Date range
  dateFrom?: string;
  dateTo?: string;
  relativeDateRange?: 'last_7_days' | 'last_30_days' | 'last_month' | 'last_quarter' | 'last_year' | 'ytd' | 'custom';

  // Accounting dimensions
  subsidiaryIds?: string[];
  departmentIds?: string[];
  locationIds?: string[];
  classIds?: string[];
  projectIds?: string[];

  // Entity filters
  entityIds?: string[];
  accountIds?: string[];

  // Additional filters
  includeInactive?: boolean;
  compareWithPriorPeriod?: boolean;
  consolidate?: boolean;

  // Custom filters as key-value pairs
  custom?: Record<string, unknown>;
}

export interface DeliveryConfig {
  type: 'email' | 'sftp' | 'webhook' | 's3' | 'none';

  // Email delivery
  emailRecipients?: string[];
  emailSubject?: string;
  emailBody?: string;

  // SFTP delivery
  sftpHost?: string;
  sftpPort?: number;
  sftpPath?: string;
  sftpCredentialsId?: string; // Reference to stored credentials

  // Webhook delivery
  webhookUrl?: string;
  webhookHeaders?: Record<string, string>;

  // S3 delivery
  s3Bucket?: string;
  s3Prefix?: string;
  s3Region?: string;
}

// Inferred types
export type ReportSchedule = typeof reportSchedules.$inferSelect;
export type NewReportSchedule = typeof reportSchedules.$inferInsert;
export type UpdateReportSchedule = Partial<Omit<NewReportSchedule, 'id' | 'organizationId' | 'createdAt'>>;

export type ReportJobExecution = typeof reportJobExecutions.$inferSelect;
export type NewReportJobExecution = typeof reportJobExecutions.$inferInsert;
export type UpdateReportJobExecution = Partial<Omit<NewReportJobExecution, 'id' | 'organizationId' | 'reportScheduleId' | 'createdAt'>>;

export type ReportScheduleStatus = 'draft' | 'active' | 'paused' | 'completed' | 'error';
export type ReportScheduleFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'cron';
export type ReportType =
  | 'income_statement' | 'balance_sheet' | 'cash_flow_statement' | 'trial_balance' | 'general_ledger' | 'account_activity'
  | 'job_cost_summary' | 'wip_summary' | 'project_budget_variance' | 'retainage_aging'
  | 'revenue_forecast' | 'deferred_revenue' | 'subscription_metrics'
  | 'custom';
export type JobExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ReportOutputFormat = 'json' | 'csv' | 'pdf' | 'xlsx';

// Helper type for schedule with executions
export type ReportScheduleWithExecutions = ReportSchedule & {
  executions: ReportJobExecution[];
};
