import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  jsonb,
  integer,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { reportSchedules, reportJobExecutions } from './report-schedules';

// Delivery status enum
export const deliveryStatusEnum = pgEnum('delivery_status', [
  'pending',
  'processing',
  'delivered',
  'failed',
  'dead_letter',
]);

// Delivery type enum
export const deliveryTypeEnum = pgEnum('delivery_type', [
  'email',
  'webhook',
  'sftp',
  's3',
]);

// Delivery queue table - tracks delivery attempts for report outputs
export const deliveryQueue = pgTable('delivery_queue', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id)
    .notNull(),
  reportScheduleId: uuid('report_schedule_id')
    .references(() => reportSchedules.id, { onDelete: 'cascade' }),
  jobExecutionId: uuid('job_execution_id')
    .references(() => reportJobExecutions.id, { onDelete: 'cascade' }),

  // Delivery configuration
  deliveryType: deliveryTypeEnum('delivery_type').notNull(),
  deliveryConfig: jsonb('delivery_config').$type<DeliveryQueueConfig>().notNull(),

  // Payload information
  reportType: varchar('report_type', { length: 100 }).notNull(),
  outputFormat: varchar('output_format', { length: 20 }).notNull(), // json, csv, pdf, xlsx
  outputLocation: text('output_location'), // S3 URL or file path
  outputSizeBytes: integer('output_size_bytes'),

  // Status tracking
  status: deliveryStatusEnum('status').default('pending').notNull(),

  // Retry handling
  attemptCount: integer('attempt_count').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(5).notNull(),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),

  // Timing
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  // Result tracking
  lastErrorCode: varchar('last_error_code', { length: 50 }),
  lastErrorMessage: text('last_error_message'),
  lastErrorStack: text('last_error_stack'),
  deliveryResponse: jsonb('delivery_response').$type<DeliveryResponse>(),

  // Dead letter metadata
  movedToDeadLetterAt: timestamp('moved_to_dead_letter_at', { withTimezone: true }),
  deadLetterReason: text('dead_letter_reason'),

  // Audit fields
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdIdx: index('delivery_queue_org_id_idx').on(table.organizationId),
  statusIdx: index('delivery_queue_status_idx').on(table.status),
  nextAttemptIdx: index('delivery_queue_next_attempt_idx').on(table.nextAttemptAt),
  scheduleIdIdx: index('delivery_queue_schedule_id_idx').on(table.reportScheduleId),
  executionIdIdx: index('delivery_queue_execution_id_idx').on(table.jobExecutionId),
}));

// Delivery audit log - detailed log of all delivery attempts
export const deliveryAttempts = pgTable('delivery_attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  deliveryQueueId: uuid('delivery_queue_id')
    .references(() => deliveryQueue.id, { onDelete: 'cascade' })
    .notNull(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id)
    .notNull(),

  // Attempt info
  attemptNumber: integer('attempt_number').notNull(),

  // Status
  success: varchar('success', { length: 10 }).notNull(), // 'true' | 'false'

  // Timing
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  durationMs: integer('duration_ms'),

  // Request details
  requestPayload: jsonb('request_payload'), // Sanitized - no sensitive data

  // Response details
  responseStatus: integer('response_status'),
  responseHeaders: jsonb('response_headers').$type<Record<string, string>>(),
  responseBody: text('response_body'),

  // Error details
  errorCode: varchar('error_code', { length: 50 }),
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  queueIdIdx: index('delivery_attempts_queue_id_idx').on(table.deliveryQueueId),
  orgIdIdx: index('delivery_attempts_org_id_idx').on(table.organizationId),
}));

// Relations
export const deliveryQueueRelations = relations(deliveryQueue, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [deliveryQueue.organizationId],
    references: [organizations.id],
  }),
  reportSchedule: one(reportSchedules, {
    fields: [deliveryQueue.reportScheduleId],
    references: [reportSchedules.id],
  }),
  jobExecution: one(reportJobExecutions, {
    fields: [deliveryQueue.jobExecutionId],
    references: [reportJobExecutions.id],
  }),
  attempts: many(deliveryAttempts),
}));

export const deliveryAttemptsRelations = relations(deliveryAttempts, ({ one }) => ({
  deliveryQueueItem: one(deliveryQueue, {
    fields: [deliveryAttempts.deliveryQueueId],
    references: [deliveryQueue.id],
  }),
  organization: one(organizations, {
    fields: [deliveryAttempts.organizationId],
    references: [organizations.id],
  }),
}));

// Types for JSON columns
export interface DeliveryQueueConfig {
  // Common
  type: 'email' | 'webhook' | 'sftp' | 's3';

  // Email specific
  emailRecipients?: string[];
  emailSubject?: string;
  emailBodyTemplate?: string;
  emailBodyHtml?: string;
  attachmentFilename?: string;

  // Webhook specific
  webhookUrl?: string;
  webhookMethod?: 'POST' | 'PUT';
  webhookHeaders?: Record<string, string>;
  webhookTimeout?: number; // milliseconds

  // SFTP specific
  sftpHost?: string;
  sftpPort?: number;
  sftpPath?: string;
  sftpCredentialsId?: string;
  sftpFilename?: string;

  // S3 specific
  s3Bucket?: string;
  s3Key?: string;
  s3Region?: string;
  s3ContentType?: string;
}

export interface DeliveryResponse {
  // Common
  deliveredAt: string;

  // Email specific
  messageId?: string;
  acceptedRecipients?: string[];
  rejectedRecipients?: string[];

  // Webhook specific
  httpStatus?: number;
  responseBody?: string;

  // S3/SFTP specific
  location?: string;
  etag?: string;
}

// Inferred types
export type DeliveryQueueItem = typeof deliveryQueue.$inferSelect;
export type NewDeliveryQueueItem = typeof deliveryQueue.$inferInsert;
export type UpdateDeliveryQueueItem = Partial<Omit<NewDeliveryQueueItem, 'id' | 'organizationId' | 'createdAt'>>;

export type DeliveryAttempt = typeof deliveryAttempts.$inferSelect;
export type NewDeliveryAttempt = typeof deliveryAttempts.$inferInsert;

export type DeliveryStatus = 'pending' | 'processing' | 'delivered' | 'failed' | 'dead_letter';
export type DeliveryType = 'email' | 'webhook' | 'sftp' | 's3';
