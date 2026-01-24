import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
  pgEnum,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { entities } from './entities';
import { emailTemplates } from './email-templates';

// ============================================================================
// ENUMS
// ============================================================================

export const communicationEventTypeEnum = pgEnum('communication_event_type', [
  'ad_hoc',
  'workflow',
  'transactional',
  'notification',
  'bulk',
]);

export const communicationStatusEnum = pgEnum('communication_status', [
  'pending',
  'queued',
  'sending',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'complained',
  'failed',
  'cancelled',
]);

// ============================================================================
// COMMUNICATION EVENTS TABLE
// ============================================================================

export const communicationEvents = pgTable(
  'communication_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // Polymorphic recipient
    entityType: varchar('entity_type', { length: 50 }),
    entityId: uuid('entity_id'),
    // Email details
    toEmail: varchar('to_email', { length: 255 }).notNull(),
    toName: varchar('to_name', { length: 255 }),
    fromEmail: varchar('from_email', { length: 255 }).notNull(),
    fromName: varchar('from_name', { length: 255 }),
    replyTo: varchar('reply_to', { length: 255 }),
    cc: jsonb('cc').default([]).$type<string[]>(),
    bcc: jsonb('bcc').default([]).$type<string[]>(),
    // Content
    subject: varchar('subject', { length: 500 }).notNull(),
    htmlBody: text('html_body').notNull(),
    textBody: text('text_body'),
    // Template reference
    templateId: uuid('template_id').references(() => emailTemplates.id, {
      onDelete: 'set null',
    }),
    templateVariables: jsonb('template_variables')
      .default({})
      .$type<Record<string, unknown>>(),
    // Workflow reference (foreign keys added in workflow migration)
    workflowExecutionId: uuid('workflow_execution_id'),
    workflowStepId: uuid('workflow_step_id'),
    // Event metadata
    eventType: communicationEventTypeEnum('event_type').default('ad_hoc').notNull(),
    status: communicationStatusEnum('status').default('pending').notNull(),
    // SES tracking
    sesMessageId: varchar('ses_message_id', { length: 255 }),
    sesConfigurationSet: varchar('ses_configuration_set', { length: 100 }),
    // Timestamps
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    queuedAt: timestamp('queued_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    clickedAt: timestamp('clicked_at', { withTimezone: true }),
    bouncedAt: timestamp('bounced_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    // Error handling
    errorCode: varchar('error_code', { length: 100 }),
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').default(0).notNull(),
    maxRetries: integer('max_retries').default(3).notNull(),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    // Audit
    createdBy: uuid('created_by').references(() => entities.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('idx_communication_events_organization').on(table.organizationId),
    orgStatusIdx: index('idx_communication_events_org_status').on(
      table.organizationId,
      table.status
    ),
    orgEventTypeIdx: index('idx_communication_events_org_event_type').on(
      table.organizationId,
      table.eventType
    ),
    entityIdx: index('idx_communication_events_entity').on(
      table.organizationId,
      table.entityType,
      table.entityId
    ),
    templateIdx: index('idx_communication_events_template').on(table.templateId),
    workflowExecutionIdx: index('idx_communication_events_workflow_execution').on(
      table.workflowExecutionId
    ),
    sesMessageIdx: index('idx_communication_events_ses_message').on(table.sesMessageId),
    toEmailIdx: index('idx_communication_events_to_email').on(
      table.organizationId,
      table.toEmail
    ),
    createdAtIdx: index('idx_communication_events_created_at').on(
      table.organizationId,
      table.createdAt
    ),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const communicationEventsRelations = relations(
  communicationEvents,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [communicationEvents.organizationId],
      references: [organizations.id],
    }),
    template: one(emailTemplates, {
      fields: [communicationEvents.templateId],
      references: [emailTemplates.id],
    }),
    createdByEntity: one(entities, {
      fields: [communicationEvents.createdBy],
      references: [entities.id],
    }),
  })
);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Communication event type
export type CommunicationEventType =
  | 'ad_hoc'
  | 'workflow'
  | 'transactional'
  | 'notification'
  | 'bulk';

// Communication status type
export type CommunicationStatus =
  | 'pending'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'complained'
  | 'failed'
  | 'cancelled';

// Inferred types
export type CommunicationEvent = typeof communicationEvents.$inferSelect;
export type NewCommunicationEvent = typeof communicationEvents.$inferInsert;
export type UpdateCommunicationEvent = Partial<
  Omit<NewCommunicationEvent, 'id' | 'organizationId' | 'createdAt' | 'createdBy'>
>;

// Status constants
export const COMMUNICATION_STATUS = {
  PENDING: 'pending',
  QUEUED: 'queued',
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  OPENED: 'opened',
  CLICKED: 'clicked',
  BOUNCED: 'bounced',
  COMPLAINED: 'complained',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export const COMMUNICATION_EVENT_TYPE = {
  AD_HOC: 'ad_hoc',
  WORKFLOW: 'workflow',
  TRANSACTIONAL: 'transactional',
  NOTIFICATION: 'notification',
  BULK: 'bulk',
} as const;

// Entity types that can receive communications
export const COMMUNICATION_ENTITY_TYPES = [
  'customer',
  'employee',
  'contact',
  'lead',
  'prospect',
  'vendor',
] as const;

export type CommunicationEntityType = (typeof COMMUNICATION_ENTITY_TYPES)[number];
