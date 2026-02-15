import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gt, gte, lt, lte, desc, asc, sql, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  eventStore,
  eventOutbox,
  eventProjections,
  EventStoreRecord,
  NewEventStoreRecord,
  EventOutboxRecord,
  NewEventOutboxRecord,
  EventProjectionRecord,
  NewEventProjectionRecord,
} from '../db/schema/event-store';
import { BaseRepository } from './base-repository';

// ============================================================================
// Types
// ============================================================================

export interface EventQueryOptions {
  aggregateType?: string;
  aggregateId?: string;
  eventType?: string;
  eventTypes?: string[];
  correlationId?: string;
  fromVersion?: number;
  toVersion?: number;
  fromSequence?: number;
  toSequence?: number;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  limit?: number;
  offset?: number;
  orderBy?: 'asc' | 'desc';
}

export interface OutboxQueryOptions {
  status?: 'PENDING' | 'PUBLISHED' | 'FAILED';
  topic?: string;
  maxRetryCount?: number;
  beforeRetryAt?: Date;
  limit?: number;
  offset?: number;
}

export interface ProjectionQueryOptions {
  projectionName?: string;
  aggregateType?: string;
  aggregateId?: string;
  fromSequence?: number;
  limit?: number;
  offset?: number;
}

export interface AppendEventResult {
  event: EventStoreRecord;
  outboxEntry?: EventOutboxRecord;
}

// ============================================================================
// Event Store Repository
// ============================================================================

export class EventStoreRepository extends BaseRepository {
  // Drizzle `.returning()` with no args has proven brittle in some Next.js
  // RSC bundling contexts; use explicit selections.
  private eventReturning = {
    id: eventStore.id,
    eventType: eventStore.eventType,
    eventCategory: eventStore.eventCategory,
    aggregateId: eventStore.aggregateId,
    aggregateType: eventStore.aggregateType,
    eventVersion: eventStore.eventVersion,
    globalSequence: eventStore.globalSequence,
    eventData: eventStore.eventData,
    metadata: eventStore.metadata,
    eventTimestamp: eventStore.eventTimestamp,
    createdAt: eventStore.createdAt,
    userId: eventStore.userId,
    sessionId: eventStore.sessionId,
    correlationId: eventStore.correlationId,
    causationId: eventStore.causationId,
    organizationId: eventStore.organizationId,
  } as const;

  private outboxReturning = {
    id: eventOutbox.id,
    eventId: eventOutbox.eventId,
    topic: eventOutbox.topic,
    partitionKey: eventOutbox.partitionKey,
    payload: eventOutbox.payload,
    status: eventOutbox.status,
    createdAt: eventOutbox.createdAt,
    publishedAt: eventOutbox.publishedAt,
    retryCount: eventOutbox.retryCount,
    nextRetryAt: eventOutbox.nextRetryAt,
    errorMessage: eventOutbox.errorMessage,
    organizationId: eventOutbox.organizationId,
  } as const;

  // --------------------------------------------------------------------------
  // Event Store Operations
  // --------------------------------------------------------------------------

  /**
   * Append a new event to the event store
   * Optionally creates an outbox entry for publishing
   */
  async appendEvent(
    event: Omit<NewEventStoreRecord, 'globalSequence'>,
    outboxConfig?: {
      topic: string;
      partitionKey?: string;
      payload?: Record<string, unknown>;
    }
  ): Promise<AppendEventResult> {
    return await this.db.transaction(async (tx) => {
      // Get next global sequence
      const seqResult = await tx.execute(
        sql`SELECT nextval('event_store_global_sequence_seq') as seq`
      );
      const globalSequence = Number((seqResult.rows[0] as any).seq);

      // Insert the event
      const [insertedEvent] = await tx
        .insert(eventStore)
        .values({
          ...event,
          globalSequence,
        })
        .returning(this.eventReturning);

      let outboxEntry: EventOutboxRecord | undefined;

      // Create outbox entry if config provided
      if (outboxConfig) {
        const [insertedOutbox] = await tx
          .insert(eventOutbox)
          .values({
            eventId: insertedEvent.id,
            topic: outboxConfig.topic,
            partitionKey: outboxConfig.partitionKey,
            payload: outboxConfig.payload || insertedEvent.eventData,
            status: 'PENDING',
            organizationId: event.organizationId,
          })
          .returning(this.outboxReturning);

        outboxEntry = insertedOutbox;
      }

      return {
        event: insertedEvent,
        outboxEntry,
      };
    });
  }

  /**
   * Append multiple events in a single transaction
   */
  async appendEvents(
    events: Array<{
      event: Omit<NewEventStoreRecord, 'globalSequence'>;
      outboxConfig?: {
        topic: string;
        partitionKey?: string;
        payload?: Record<string, unknown>;
      };
    }>
  ): Promise<AppendEventResult[]> {
    return await this.db.transaction(async (tx) => {
      const results: AppendEventResult[] = [];

      for (const { event, outboxConfig } of events) {
        // Get next global sequence
        const seqResult = await tx.execute(
          sql`SELECT nextval('event_store_global_sequence_seq') as seq`
        );
        const globalSequence = Number((seqResult.rows[0] as any).seq);

        // Insert the event
        const [insertedEvent] = await tx
          .insert(eventStore)
          .values({
            ...event,
            globalSequence,
          })
          .returning(this.eventReturning);

        let outboxEntry: EventOutboxRecord | undefined;

        if (outboxConfig) {
          const [insertedOutbox] = await tx
            .insert(eventOutbox)
            .values({
              eventId: insertedEvent.id,
              topic: outboxConfig.topic,
              partitionKey: outboxConfig.partitionKey,
              payload: outboxConfig.payload || insertedEvent.eventData,
              status: 'PENDING',
              organizationId: event.organizationId,
            })
            .returning(this.outboxReturning);

          outboxEntry = insertedOutbox;
        }

        results.push({ event: insertedEvent, outboxEntry });
      }

      return results;
    });
  }

  /**
   * Get event by ID
   */
  async getEventById(
    eventId: string,
    organizationId: string
  ): Promise<EventStoreRecord | null> {
    const result = await this.db
      .select()
      .from(eventStore)
      .where(
        and(
          eq(eventStore.id, eventId),
          eq(eventStore.organizationId, organizationId)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  /**
   * Query events with flexible filtering
   */
  async queryEvents(
    organizationId: string,
    options: EventQueryOptions = {}
  ): Promise<EventStoreRecord[]> {
    const conditions = [eq(eventStore.organizationId, organizationId)];

    if (options.aggregateType) {
      conditions.push(eq(eventStore.aggregateType, options.aggregateType));
    }
    if (options.aggregateId) {
      conditions.push(eq(eventStore.aggregateId, options.aggregateId));
    }
    if (options.eventType) {
      conditions.push(eq(eventStore.eventType, options.eventType));
    }
    if (options.eventTypes && options.eventTypes.length > 0) {
      conditions.push(inArray(eventStore.eventType, options.eventTypes));
    }
    if (options.correlationId) {
      conditions.push(eq(eventStore.correlationId, options.correlationId));
    }
    if (options.fromVersion !== undefined) {
      conditions.push(gte(eventStore.eventVersion, options.fromVersion));
    }
    if (options.toVersion !== undefined) {
      conditions.push(lte(eventStore.eventVersion, options.toVersion));
    }
    if (options.fromSequence !== undefined) {
      conditions.push(gt(eventStore.globalSequence, options.fromSequence));
    }
    if (options.toSequence !== undefined) {
      conditions.push(lte(eventStore.globalSequence, options.toSequence));
    }
    if (options.fromTimestamp) {
      conditions.push(gte(eventStore.eventTimestamp, options.fromTimestamp));
    }
    if (options.toTimestamp) {
      conditions.push(lte(eventStore.eventTimestamp, options.toTimestamp));
    }

    let query = this.db
      .select()
      .from(eventStore)
      .where(and(...conditions));

    // Order by global sequence
    if (options.orderBy === 'desc') {
      query = query.orderBy(desc(eventStore.globalSequence)) as typeof query;
    } else {
      query = query.orderBy(asc(eventStore.globalSequence)) as typeof query;
    }

    // Apply pagination
    if (options.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    return await query;
  }

  /**
   * Get events for an aggregate (for rebuilding state)
   */
  async getAggregateEvents(
    organizationId: string,
    aggregateType: string,
    aggregateId: string,
    fromVersion?: number
  ): Promise<EventStoreRecord[]> {
    return this.queryEvents(organizationId, {
      aggregateType,
      aggregateId,
      fromVersion,
      orderBy: 'asc',
    });
  }

  /**
   * Get the latest event version for an aggregate
   */
  async getLatestVersion(
    organizationId: string,
    aggregateType: string,
    aggregateId: string
  ): Promise<number> {
    const result = await this.db
      .select({ maxVersion: sql<number>`MAX(${eventStore.eventVersion})` })
      .from(eventStore)
      .where(
        and(
          eq(eventStore.organizationId, organizationId),
          eq(eventStore.aggregateType, aggregateType),
          eq(eventStore.aggregateId, aggregateId)
        )
      );

    return result[0]?.maxVersion || 0;
  }

  /**
   * Get current global sequence (for checkpointing)
   */
  async getCurrentGlobalSequence(): Promise<number> {
    const result = await this.db
      .select({ maxSeq: sql<number>`MAX(${eventStore.globalSequence})` })
      .from(eventStore);

    return result[0]?.maxSeq || 0;
  }

  // --------------------------------------------------------------------------
  // Outbox Operations
  // --------------------------------------------------------------------------

  /**
   * Get pending outbox entries for processing
   */
  async getPendingOutboxEntries(
    options: OutboxQueryOptions = {}
  ): Promise<EventOutboxRecord[]> {
    const conditions = [eq(eventOutbox.status, 'PENDING')];

    if (options.topic) {
      conditions.push(eq(eventOutbox.topic, options.topic));
    }
    if (options.maxRetryCount !== undefined) {
      conditions.push(lte(eventOutbox.retryCount, options.maxRetryCount));
    }

    let query = this.db
      .select()
      .from(eventOutbox)
      .where(and(...conditions))
      .orderBy(asc(eventOutbox.createdAt));

    if (options.limit) {
      query = query.limit(options.limit) as typeof query;
    }

    return await query;
  }

  /**
   * Get failed outbox entries ready for retry
   */
  async getRetryableOutboxEntries(
    maxRetries: number = 5,
    limit: number = 100
  ): Promise<EventOutboxRecord[]> {
    return await this.db
      .select()
      .from(eventOutbox)
      .where(
        and(
          eq(eventOutbox.status, 'FAILED'),
          lt(eventOutbox.retryCount, maxRetries),
          lte(eventOutbox.nextRetryAt, new Date())
        )
      )
      .orderBy(asc(eventOutbox.nextRetryAt))
      .limit(limit);
  }

  /**
   * Mark outbox entry as published
   */
  async markOutboxPublished(outboxId: string): Promise<EventOutboxRecord | null> {
    const result = await this.db
      .update(eventOutbox)
      .set({
        status: 'PUBLISHED',
        publishedAt: new Date(),
      })
      .where(eq(eventOutbox.id, outboxId))
      .returning();

    return result[0] || null;
  }

  /**
   * Mark outbox entry as failed with retry scheduling
   */
  async markOutboxFailed(
    outboxId: string,
    errorMessage: string,
    nextRetryAt?: Date
  ): Promise<EventOutboxRecord | null> {
    const result = await this.db
      .update(eventOutbox)
      .set({
        status: 'FAILED',
        errorMessage,
        retryCount: sql`${eventOutbox.retryCount} + 1`,
        nextRetryAt: nextRetryAt || null,
      })
      .where(eq(eventOutbox.id, outboxId))
      .returning();

    return result[0] || null;
  }

  /**
   * Reset failed outbox entry for retry
   */
  async resetOutboxForRetry(outboxId: string): Promise<EventOutboxRecord | null> {
    const result = await this.db
      .update(eventOutbox)
      .set({
        status: 'PENDING',
        errorMessage: null,
        nextRetryAt: null,
      })
      .where(eq(eventOutbox.id, outboxId))
      .returning();

    return result[0] || null;
  }

  // --------------------------------------------------------------------------
  // Projection Operations
  // --------------------------------------------------------------------------

  /**
   * Get or create a projection
   */
  async getOrCreateProjection(
    organizationId: string,
    projectionName: string,
    aggregateType: string,
    aggregateId: string,
    initialData: Record<string, unknown> = {}
  ): Promise<EventProjectionRecord> {
    // Try to get existing
    const existing = await this.db
      .select()
      .from(eventProjections)
      .where(
        and(
          eq(eventProjections.organizationId, organizationId),
          eq(eventProjections.projectionName, projectionName),
          eq(eventProjections.aggregateId, aggregateId)
        )
      )
      .limit(1);

    if (existing[0]) {
      return existing[0];
    }

    // Create new projection
    const [created] = await this.db
      .insert(eventProjections)
      .values({
        organizationId,
        projectionName,
        aggregateType,
        aggregateId,
        lastEventVersion: 0,
        lastGlobalSequence: 0,
        projectionData: initialData,
      })
      .returning();

    return created;
  }

  /**
   * Update projection state
   */
  async updateProjection(
    projectionId: string,
    data: Record<string, unknown>,
    lastEventVersion: number,
    lastGlobalSequence: number
  ): Promise<EventProjectionRecord | null> {
    const result = await this.db
      .update(eventProjections)
      .set({
        projectionData: data,
        lastEventVersion,
        lastGlobalSequence,
        updatedAt: new Date(),
      })
      .where(eq(eventProjections.id, projectionId))
      .returning();

    return result[0] || null;
  }

  /**
   * Get projection by ID
   */
  async getProjectionById(
    projectionId: string,
    organizationId: string
  ): Promise<EventProjectionRecord | null> {
    const result = await this.db
      .select()
      .from(eventProjections)
      .where(
        and(
          eq(eventProjections.id, projectionId),
          eq(eventProjections.organizationId, organizationId)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get projection by name and aggregate
   */
  async getProjection(
    organizationId: string,
    projectionName: string,
    aggregateId: string
  ): Promise<EventProjectionRecord | null> {
    const result = await this.db
      .select()
      .from(eventProjections)
      .where(
        and(
          eq(eventProjections.organizationId, organizationId),
          eq(eventProjections.projectionName, projectionName),
          eq(eventProjections.aggregateId, aggregateId)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  /**
   * Query projections
   */
  async queryProjections(
    organizationId: string,
    options: ProjectionQueryOptions = {}
  ): Promise<EventProjectionRecord[]> {
    const conditions = [eq(eventProjections.organizationId, organizationId)];

    if (options.projectionName) {
      conditions.push(eq(eventProjections.projectionName, options.projectionName));
    }
    if (options.aggregateType) {
      conditions.push(eq(eventProjections.aggregateType, options.aggregateType));
    }
    if (options.aggregateId) {
      conditions.push(eq(eventProjections.aggregateId, options.aggregateId));
    }
    if (options.fromSequence !== undefined) {
      conditions.push(gt(eventProjections.lastGlobalSequence, options.fromSequence));
    }

    let query = this.db
      .select()
      .from(eventProjections)
      .where(and(...conditions))
      .orderBy(asc(eventProjections.lastGlobalSequence));

    if (options.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    return await query;
  }

  /**
   * Delete projection (for rebuilding)
   */
  async deleteProjection(projectionId: string): Promise<boolean> {
    const result = await this.db
      .delete(eventProjections)
      .where(eq(eventProjections.id, projectionId))
      .returning();

    return result.length > 0;
  }
}

// Export singleton instance
export const eventStoreRepository = new EventStoreRepository();
