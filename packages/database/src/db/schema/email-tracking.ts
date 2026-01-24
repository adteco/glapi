import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
  pgEnum,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { communicationEvents } from './communication-events';

// ============================================================================
// ENUMS
// ============================================================================

export const emailTrackingEventTypeEnum = pgEnum('email_tracking_event_type', [
  'send',
  'delivery',
  'bounce',
  'complaint',
  'reject',
  'open',
  'click',
  'rendering_failure',
  'delivery_delay',
]);

export const emailBounceTypeEnum = pgEnum('email_bounce_type', [
  'permanent',
  'transient',
  'undetermined',
]);

export const emailUnsubscribeReasonEnum = pgEnum('email_unsubscribe_reason', [
  'user_request',
  'hard_bounce',
  'complaint',
  'admin_action',
  'list_unsubscribe',
]);

// ============================================================================
// EMAIL TRACKING EVENTS TABLE
// ============================================================================

export const emailTrackingEvents = pgTable(
  'email_tracking_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    communicationEventId: uuid('communication_event_id').references(
      () => communicationEvents.id,
      { onDelete: 'set null' }
    ),
    // Event identification
    eventType: emailTrackingEventTypeEnum('event_type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    // SES identifiers
    sesMessageId: varchar('ses_message_id', { length: 255 }).notNull(),
    sesNotificationId: varchar('ses_notification_id', { length: 255 }),
    sesFeedbackId: varchar('ses_feedback_id', { length: 255 }),
    // Bounce details
    bounceType: emailBounceTypeEnum('bounce_type'),
    bounceSubType: varchar('bounce_sub_type', { length: 100 }),
    bouncedRecipients: jsonb('bounced_recipients').$type<BouncedRecipient[]>(),
    diagnosticCode: text('diagnostic_code'),
    // Complaint details
    complaintFeedbackType: varchar('complaint_feedback_type', { length: 100 }),
    complainedRecipients: jsonb('complained_recipients').$type<string[]>(),
    // Click details
    clickedUrl: text('clicked_url'),
    linkTags: jsonb('link_tags').$type<Record<string, string>>(),
    // Device/user details
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 45 }),
    // Raw payload for debugging
    rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>(),
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('idx_email_tracking_events_org').on(table.organizationId),
    communicationIdx: index('idx_email_tracking_events_communication').on(
      table.communicationEventId
    ),
    sesMessageIdx: index('idx_email_tracking_events_ses_message').on(table.sesMessageId),
    eventTypeIdx: index('idx_email_tracking_events_event_type').on(
      table.organizationId,
      table.eventType
    ),
    occurredAtIdx: index('idx_email_tracking_events_occurred_at').on(
      table.organizationId,
      table.occurredAt
    ),
  })
);

// ============================================================================
// EMAIL UNSUBSCRIBES TABLE
// ============================================================================

export const emailUnsubscribes = pgTable(
  'email_unsubscribes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // Email identification
    email: varchar('email', { length: 255 }).notNull(),
    emailHash: varchar('email_hash', { length: 64 }).notNull(),
    // Entity reference
    entityType: varchar('entity_type', { length: 50 }),
    entityId: uuid('entity_id'),
    // Unsubscribe details
    reason: emailUnsubscribeReasonEnum('reason').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    resubscribedAt: timestamp('resubscribed_at', { withTimezone: true }),
    // Source tracking
    sourceCommunicationEventId: uuid('source_communication_event_id').references(
      () => communicationEvents.id,
      { onDelete: 'set null' }
    ),
    sourceTrackingEventId: uuid('source_tracking_event_id').references(
      () => emailTrackingEvents.id,
      { onDelete: 'set null' }
    ),
    // Additional data
    feedback: text('feedback'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgEmailHashUnique: uniqueIndex('idx_email_unsubscribes_org_email_hash').on(
      table.organizationId,
      table.emailHash
    ),
    orgIdx: index('idx_email_unsubscribes_org').on(table.organizationId),
    orgActiveIdx: index('idx_email_unsubscribes_org_active').on(
      table.organizationId,
      table.isActive
    ),
    entityIdx: index('idx_email_unsubscribes_entity').on(
      table.organizationId,
      table.entityType,
      table.entityId
    ),
    emailHashIdx: index('idx_email_unsubscribes_email_hash').on(table.emailHash),
  })
);

// ============================================================================
// EMAIL SUPPRESSION LIST TABLE
// ============================================================================

export const emailSuppressionList = pgTable(
  'email_suppression_list',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    emailHash: varchar('email_hash', { length: 64 }).notNull(),
    reason: varchar('reason', { length: 100 }).notNull(),
    source: varchar('source', { length: 100 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    isPermanent: boolean('is_permanent').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgEmailHashUnique: uniqueIndex('idx_email_suppression_list_org_email_hash').on(
      table.organizationId,
      table.emailHash
    ),
    orgIdx: index('idx_email_suppression_list_org').on(table.organizationId),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const emailTrackingEventsRelations = relations(
  emailTrackingEvents,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [emailTrackingEvents.organizationId],
      references: [organizations.id],
    }),
    communicationEvent: one(communicationEvents, {
      fields: [emailTrackingEvents.communicationEventId],
      references: [communicationEvents.id],
    }),
  })
);

export const emailUnsubscribesRelations = relations(emailUnsubscribes, ({ one }) => ({
  organization: one(organizations, {
    fields: [emailUnsubscribes.organizationId],
    references: [organizations.id],
  }),
  sourceCommunicationEvent: one(communicationEvents, {
    fields: [emailUnsubscribes.sourceCommunicationEventId],
    references: [communicationEvents.id],
    relationName: 'unsubscribeSourceEvent',
  }),
  sourceTrackingEvent: one(emailTrackingEvents, {
    fields: [emailUnsubscribes.sourceTrackingEventId],
    references: [emailTrackingEvents.id],
  }),
}));

export const emailSuppressionListRelations = relations(
  emailSuppressionList,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [emailSuppressionList.organizationId],
      references: [organizations.id],
    }),
  })
);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Tracking event types
export type EmailTrackingEventType =
  | 'send'
  | 'delivery'
  | 'bounce'
  | 'complaint'
  | 'reject'
  | 'open'
  | 'click'
  | 'rendering_failure'
  | 'delivery_delay';

// Bounce types
export type EmailBounceType = 'permanent' | 'transient' | 'undetermined';

// Unsubscribe reasons
export type EmailUnsubscribeReason =
  | 'user_request'
  | 'hard_bounce'
  | 'complaint'
  | 'admin_action'
  | 'list_unsubscribe';

// Bounced recipient structure
export interface BouncedRecipient {
  emailAddress: string;
  action?: string;
  status?: string;
  diagnosticCode?: string;
}

// Inferred types
export type EmailTrackingEvent = typeof emailTrackingEvents.$inferSelect;
export type NewEmailTrackingEvent = typeof emailTrackingEvents.$inferInsert;

export type EmailUnsubscribe = typeof emailUnsubscribes.$inferSelect;
export type NewEmailUnsubscribe = typeof emailUnsubscribes.$inferInsert;
export type UpdateEmailUnsubscribe = Partial<
  Omit<NewEmailUnsubscribe, 'id' | 'organizationId' | 'email' | 'emailHash' | 'createdAt'>
>;

export type EmailSuppressionRecord = typeof emailSuppressionList.$inferSelect;
export type NewEmailSuppressionRecord = typeof emailSuppressionList.$inferInsert;

// Constants
export const EMAIL_TRACKING_EVENT_TYPE = {
  SEND: 'send',
  DELIVERY: 'delivery',
  BOUNCE: 'bounce',
  COMPLAINT: 'complaint',
  REJECT: 'reject',
  OPEN: 'open',
  CLICK: 'click',
  RENDERING_FAILURE: 'rendering_failure',
  DELIVERY_DELAY: 'delivery_delay',
} as const;

export const EMAIL_BOUNCE_TYPE = {
  PERMANENT: 'permanent',
  TRANSIENT: 'transient',
  UNDETERMINED: 'undetermined',
} as const;

export const EMAIL_UNSUBSCRIBE_REASON = {
  USER_REQUEST: 'user_request',
  HARD_BOUNCE: 'hard_bounce',
  COMPLAINT: 'complaint',
  ADMIN_ACTION: 'admin_action',
  LIST_UNSUBSCRIBE: 'list_unsubscribe',
} as const;

// Helper function to generate email hash
export function generateEmailHash(email: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}
