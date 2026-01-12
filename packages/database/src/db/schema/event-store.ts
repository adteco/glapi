import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  integer,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { organizations } from './organizations';

// ============================================================================
// Enums
// ============================================================================

/**
 * Event categories for organizing events by business domain
 */
export const eventCategoryEnum = pgEnum('event_category_enum', [
  'TRANSACTION',
  'APPROVAL',
  'PAYMENT',
  'ACCOUNTING',
  'SUBSCRIPTION',
  'PROJECT',
  'CONTRACT',
  'INVENTORY',
  'SYSTEM',
]);

/**
 * Status enum for outbox event processing
 */
export const outboxStatusEnum = pgEnum('outbox_status_enum', [
  'PENDING',
  'PUBLISHED',
  'FAILED',
]);

// ============================================================================
// Event Store Table
// ============================================================================

/**
 * Core Event Store - Immutable log of all business events
 *
 * This table implements event sourcing patterns for complete auditability.
 * All state changes are captured as immutable events with:
 * - Global ordering via global_sequence
 * - Aggregate versioning for optimistic concurrency
 * - Correlation/causation tracking for distributed tracing
 * - Multi-tenant support via organization_id
 */
export const eventStore = pgTable('event_store', {
  // Primary key
  id: uuid('id').defaultRandom().primaryKey(),

  // Event classification
  eventType: text('event_type').notNull(),
  eventCategory: eventCategoryEnum('event_category').notNull(),

  // Aggregate identification (the entity being changed)
  aggregateId: text('aggregate_id').notNull(),
  aggregateType: text('aggregate_type').notNull(),

  // Versioning
  eventVersion: bigint('event_version', { mode: 'number' }).notNull(),
  globalSequence: bigint('global_sequence', { mode: 'number' }).notNull().unique(),

  // Event payload
  eventData: jsonb('event_data').notNull(),
  metadata: jsonb('metadata'),

  // Timing
  eventTimestamp: timestamp('event_timestamp', { withTimezone: true, precision: 6 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),

  // User context
  userId: text('user_id'),
  sessionId: text('session_id'),

  // Distributed tracing
  correlationId: uuid('correlation_id').notNull(),
  causationId: uuid('causation_id'),

  // Multi-tenancy
  organizationId: text('organization_id').notNull().references(() => organizations.id),
}, (table) => ({
  // Index for querying events by aggregate (most common query pattern)
  aggregateIdx: index('event_store_aggregate_idx')
    .on(table.aggregateType, table.aggregateId, table.eventVersion),

  // Index for correlation tracing
  correlationIdx: index('event_store_correlation_idx')
    .on(table.correlationId),

  // Index for time-based queries
  timestampIdx: index('event_store_timestamp_idx')
    .on(table.eventTimestamp),

  // Index for global ordering (projections use this)
  globalSeqIdx: index('event_store_global_sequence_idx')
    .on(table.globalSequence),

  // Index for event type queries
  eventTypeIdx: index('event_store_event_type_idx')
    .on(table.eventType, table.eventTimestamp),

  // Index for organization-scoped queries
  orgIdx: index('event_store_organization_idx')
    .on(table.organizationId, table.eventTimestamp),
}));

// ============================================================================
// Event Outbox Table
// ============================================================================

/**
 * Event Outbox - Ensures reliable event publishing via transactional outbox pattern
 *
 * This implements the outbox pattern for reliable event publishing:
 * - Events are written to outbox in same transaction as business data
 * - Background processor publishes events and marks them as published
 * - Failed events are retried with exponential backoff
 */
export const eventOutbox = pgTable('event_outbox', {
  // Primary key
  id: uuid('id').defaultRandom().primaryKey(),

  // Reference to the source event
  eventId: uuid('event_id').notNull().references(() => eventStore.id),

  // Publishing destination
  topic: text('topic').notNull(),
  partitionKey: text('partition_key'),

  // Message payload (may differ from event_data for transformation)
  payload: jsonb('payload').notNull(),

  // Processing status
  status: outboxStatusEnum('status').default('PENDING').notNull(),

  // Timing
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true, precision: 6 }),

  // Retry handling
  retryCount: integer('retry_count').default(0).notNull(),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  errorMessage: text('error_message'),

  // Multi-tenancy
  organizationId: text('organization_id').notNull().references(() => organizations.id),
}, (table) => ({
  // Index for outbox processor queries (find pending events)
  statusCreatedIdx: index('event_outbox_status_created_idx')
    .on(table.status, table.createdAt),

  // Index for retry processing
  retryIdx: index('event_outbox_retry_idx')
    .on(table.status, table.nextRetryAt),

  // Index for topic-based queries
  topicIdx: index('event_outbox_topic_idx')
    .on(table.topic, table.status),

  // Index for organization-scoped queries
  orgIdx: index('event_outbox_organization_idx')
    .on(table.organizationId, table.status),
}));

// ============================================================================
// Event Projections Table
// ============================================================================

/**
 * Event Projections - Tracks read model state built from events
 *
 * Projections are read-optimized views built by processing event streams.
 * This table tracks:
 * - Current projection state (JSON data)
 * - Last processed event for checkpoint/resume
 * - Enables projection rebuilds and recovery
 */
export const eventProjections = pgTable('event_projections', {
  // Primary key
  id: uuid('id').defaultRandom().primaryKey(),

  // Projection identification
  projectionName: text('projection_name').notNull(),
  aggregateId: text('aggregate_id').notNull(),
  aggregateType: text('aggregate_type').notNull(),

  // Processing state
  lastEventVersion: bigint('last_event_version', { mode: 'number' }).notNull(),
  lastGlobalSequence: bigint('last_global_sequence', { mode: 'number' }).notNull(),

  // Current projection state
  projectionData: jsonb('projection_data').notNull(),

  // Timing
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),

  // Multi-tenancy
  organizationId: text('organization_id').notNull().references(() => organizations.id),
}, (table) => ({
  // Unique constraint for projection identity
  projectionUniqueIdx: uniqueIndex('event_projections_unique_idx')
    .on(table.projectionName, table.aggregateId, table.organizationId),

  // Index for finding projections by sequence (for catch-up processing)
  lastSeqIdx: index('event_projections_last_sequence_idx')
    .on(table.lastGlobalSequence),

  // Index for projection name queries
  projectionNameIdx: index('event_projections_name_idx')
    .on(table.projectionName, table.organizationId),

  // Index for aggregate queries
  aggregateIdx: index('event_projections_aggregate_idx')
    .on(table.aggregateType, table.aggregateId),
}));

// ============================================================================
// Relations
// ============================================================================

export const eventStoreRelations = relations(eventStore, ({ one }) => ({
  organization: one(organizations, {
    fields: [eventStore.organizationId],
    references: [organizations.id],
  }),
}));

export const eventOutboxRelations = relations(eventOutbox, ({ one }) => ({
  event: one(eventStore, {
    fields: [eventOutbox.eventId],
    references: [eventStore.id],
  }),
  organization: one(organizations, {
    fields: [eventOutbox.organizationId],
    references: [organizations.id],
  }),
}));

export const eventProjectionsRelations = relations(eventProjections, ({ one }) => ({
  organization: one(organizations, {
    fields: [eventProjections.organizationId],
    references: [organizations.id],
  }),
}));

// ============================================================================
// Types
// ============================================================================

// Event Store types
export type EventStoreRecord = InferSelectModel<typeof eventStore>;
export type NewEventStoreRecord = InferInsertModel<typeof eventStore>;

// Event Outbox types
export type EventOutboxRecord = InferSelectModel<typeof eventOutbox>;
export type NewEventOutboxRecord = InferInsertModel<typeof eventOutbox>;

// Event Projections types
export type EventProjectionRecord = InferSelectModel<typeof eventProjections>;
export type NewEventProjectionRecord = InferInsertModel<typeof eventProjections>;

// ============================================================================
// Base Event Interface (for TypeScript consumers)
// ============================================================================

/**
 * Base event interface that all domain events should extend
 */
export interface BaseEvent<TData = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  eventCategory: typeof eventCategoryEnum.enumValues[number];
  aggregateId: string;
  aggregateType: string;
  version: number;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  correlationId: string;
  causationId?: string;
  metadata?: Record<string, unknown>;
  data: TData;
}

/**
 * Event categories for organizing events by business domain
 */
export const EventCategory = {
  TRANSACTION: 'TRANSACTION',
  APPROVAL: 'APPROVAL',
  PAYMENT: 'PAYMENT',
  ACCOUNTING: 'ACCOUNTING',
  SUBSCRIPTION: 'SUBSCRIPTION',
  PROJECT: 'PROJECT',
  CONTRACT: 'CONTRACT',
  INVENTORY: 'INVENTORY',
  SYSTEM: 'SYSTEM',
} as const;

export type EventCategoryType = typeof EventCategory[keyof typeof EventCategory];

/**
 * Outbox status values
 */
export const OutboxStatus = {
  PENDING: 'PENDING',
  PUBLISHED: 'PUBLISHED',
  FAILED: 'FAILED',
} as const;

export type OutboxStatusType = typeof OutboxStatus[keyof typeof OutboxStatus];
