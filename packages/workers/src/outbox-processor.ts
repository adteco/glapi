/**
 * Outbox Processor Worker
 *
 * Processes the event outbox table to reliably publish events.
 * Implements the transactional outbox pattern for guaranteed delivery.
 *
 * Features:
 * - Batch processing of pending events
 * - Retry with exponential backoff for failed events
 * - Dead letter handling for events that exceed max retries
 * - Metrics and monitoring
 */

import { WorkerBase, WorkerConfig, WorkerLogger } from './worker-base';
import { eventStoreRepository, db, eventOutbox, eq, and, lte, or, isNull, sql } from '@glapi/database';

export interface OutboxProcessorConfig extends Partial<WorkerConfig> {
  /** Maximum number of retries before moving to dead letter */
  maxDeliveryAttempts?: number;
  /** Organization ID to process (optional, processes all if not set) */
  organizationId?: string;
  /** Event publisher function (override for custom publishing) */
  publisher?: (event: OutboxEvent) => Promise<void>;
}

export interface OutboxEvent {
  id: string;
  eventId: string;
  topic: string;
  partitionKey: string | null;
  payload: unknown;
  organizationId: string;
  retryCount: number;
}

/**
 * Default publisher - logs events (replace with actual message broker)
 */
const defaultPublisher = async (event: OutboxEvent): Promise<void> => {
  console.log(`[OutboxProcessor] Publishing event to ${event.topic}`, {
    eventId: event.eventId,
    partitionKey: event.partitionKey,
  });
  // In production, this would publish to Kafka, RabbitMQ, SQS, etc.
};

/**
 * Worker that processes the event outbox for reliable event publishing
 */
export class OutboxProcessor extends WorkerBase {
  private organizationId?: string;
  private maxDeliveryAttempts: number;
  private publisher: (event: OutboxEvent) => Promise<void>;

  constructor(config: OutboxProcessorConfig = {}, logger?: WorkerLogger) {
    super(
      {
        name: 'outbox-processor',
        pollingIntervalMs: 100, // Very fast polling for low latency
        batchSize: 50,
        ...config,
      },
      logger
    );
    this.organizationId = config.organizationId;
    this.maxDeliveryAttempts = config.maxDeliveryAttempts ?? 5;
    this.publisher = config.publisher ?? defaultPublisher;
  }

  /**
   * Get the current checkpoint (number of pending events)
   */
  protected async getCheckpoint(): Promise<number> {
    // For outbox, we return processed count
    return this.metrics.eventsProcessed;
  }

  /**
   * Get the count of pending events
   */
  protected async getLatestSequence(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(eventOutbox)
      .where(eq(eventOutbox.status, 'PENDING'));

    return this.metrics.eventsProcessed + (result[0]?.count ?? 0);
  }

  /**
   * Process a batch of pending outbox events
   */
  protected async processBatch(): Promise<number> {
    // Find pending events that are ready for processing
    const now = new Date();

    const pendingEvents = await db
      .select()
      .from(eventOutbox)
      .where(
        and(
          eq(eventOutbox.status, 'PENDING'),
          or(
            isNull(eventOutbox.nextRetryAt),
            lte(eventOutbox.nextRetryAt, now)
          ),
          this.organizationId
            ? eq(eventOutbox.organizationId, this.organizationId)
            : undefined
        )
      )
      .limit(this.config.batchSize)
      .orderBy(eventOutbox.createdAt);

    if (pendingEvents.length === 0) {
      return 0;
    }

    let processedCount = 0;

    for (const event of pendingEvents) {
      try {
        await this.processEvent({
          id: event.id,
          eventId: event.eventId,
          topic: event.topic,
          partitionKey: event.partitionKey,
          payload: event.payload,
          organizationId: event.organizationId,
          retryCount: event.retryCount,
        });

        // Mark as published
        await db
          .update(eventOutbox)
          .set({
            status: 'PUBLISHED',
            publishedAt: new Date(),
          })
          .where(eq(eventOutbox.id, event.id));

        processedCount++;
      } catch (error) {
        await this.handleFailure(event, error);
      }
    }

    return processedCount;
  }

  /**
   * Process a single outbox event
   */
  private async processEvent(event: OutboxEvent): Promise<void> {
    await this.withRetry(
      () => this.publisher(event),
      `Publishing event ${event.eventId} to ${event.topic}`
    );
  }

  /**
   * Handle failed event processing
   */
  private async handleFailure(
    event: { id: string; retryCount: number },
    error: unknown
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const newRetryCount = event.retryCount + 1;

    if (newRetryCount >= this.maxDeliveryAttempts) {
      // Move to failed status (dead letter)
      await db
        .update(eventOutbox)
        .set({
          status: 'FAILED',
          retryCount: newRetryCount,
          errorMessage: `Max retries exceeded: ${errorMessage}`,
        })
        .where(eq(eventOutbox.id, event.id));

      this.logger.error('Event moved to dead letter after max retries', {
        eventId: event.id,
        retryCount: newRetryCount,
        error: errorMessage,
      });
    } else {
      // Schedule retry with exponential backoff
      const backoffMs = this.config.retryDelayMs * Math.pow(2, newRetryCount);
      const nextRetryAt = new Date(Date.now() + backoffMs);

      await db
        .update(eventOutbox)
        .set({
          retryCount: newRetryCount,
          nextRetryAt,
          errorMessage,
        })
        .where(eq(eventOutbox.id, event.id));

      this.logger.warn('Event processing failed, scheduled for retry', {
        eventId: event.id,
        retryCount: newRetryCount,
        nextRetryAt: nextRetryAt.toISOString(),
        error: errorMessage,
      });
    }

    this.metrics.errorsCount++;
  }

  /**
   * Get dead letter events (failed events)
   */
  async getDeadLetterEvents(
    limit: number = 100
  ): Promise<Array<{ id: string; eventId: string; topic: string; errorMessage: string | null }>> {
    return db
      .select({
        id: eventOutbox.id,
        eventId: eventOutbox.eventId,
        topic: eventOutbox.topic,
        errorMessage: eventOutbox.errorMessage,
      })
      .from(eventOutbox)
      .where(eq(eventOutbox.status, 'FAILED'))
      .limit(limit)
      .orderBy(eventOutbox.createdAt);
  }

  /**
   * Retry a dead letter event
   */
  async retryDeadLetter(eventId: string): Promise<void> {
    await db
      .update(eventOutbox)
      .set({
        status: 'PENDING',
        retryCount: 0,
        nextRetryAt: null,
        errorMessage: null,
      })
      .where(eq(eventOutbox.id, eventId));

    this.logger.info('Dead letter event reset for retry', { eventId });
  }

  /**
   * Get outbox statistics
   */
  async getStats(): Promise<{
    pending: number;
    published: number;
    failed: number;
  }> {
    const stats = await db
      .select({
        status: eventOutbox.status,
        count: sql<number>`count(*)`,
      })
      .from(eventOutbox)
      .groupBy(eventOutbox.status);

    const result = { pending: 0, published: 0, failed: 0 };

    for (const stat of stats) {
      if (stat.status === 'PENDING') result.pending = stat.count;
      if (stat.status === 'PUBLISHED') result.published = stat.count;
      if (stat.status === 'FAILED') result.failed = stat.count;
    }

    return result;
  }
}
