import { eq, and, lt, lte, sql, asc } from 'drizzle-orm';
import { db } from '@glapi/database';
import { eventOutbox, type EventOutboxRecord } from '@glapi/database/schema';
import type { EventPublisher, PublishableEvent } from '../publishers/event-publisher';
import { toPublishableEvent } from '../publishers/event-publisher';
import { OutboxProcessorConfig } from '../config';
import { createChildLogger, type Logger } from '../utils/logger';
import { outboxMetrics } from '../utils/metrics';
import { registerHealthCheck, type HealthCheck } from '../utils/health';

interface ProcessorState {
  running: boolean;
  lastPollTime: Date | null;
  eventsProcessed: number;
  eventsFailed: number;
  consecutiveErrors: number;
}

/**
 * Outbox Processor - Reliably publishes events from the event_outbox table
 *
 * Implements the transactional outbox pattern:
 * 1. Poll for pending events (with locking to prevent duplicate processing)
 * 2. Publish each event to the configured publisher
 * 3. Mark as published or schedule retry on failure
 * 4. Exponential backoff for failed events
 */
export class OutboxProcessor {
  private readonly logger: Logger;
  private readonly config: OutboxProcessorConfig;
  private readonly publisher: EventPublisher;
  private state: ProcessorState;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(config: OutboxProcessorConfig, publisher: EventPublisher) {
    this.config = config;
    this.publisher = publisher;
    this.logger = createChildLogger('OutboxProcessor');
    this.state = {
      running: false,
      lastPollTime: null,
      eventsProcessed: 0,
      eventsFailed: 0,
      consecutiveErrors: 0,
    };

    // Register health check
    registerHealthCheck('outbox-processor', () => this.healthCheck());
  }

  /**
   * Start the processor
   */
  async start(): Promise<void> {
    if (this.state.running) {
      this.logger.warn('Processor already running');
      return;
    }

    this.logger.info({ config: this.config }, 'Starting outbox processor');
    this.state.running = true;
    outboxMetrics.running.set(1);

    // Initialize publisher if needed
    if (this.publisher.initialize) {
      await this.publisher.initialize();
    }

    // Start polling loop
    this.schedulePoll();
  }

  /**
   * Stop the processor gracefully
   */
  async stop(): Promise<void> {
    if (!this.state.running) {
      return;
    }

    this.logger.info('Stopping outbox processor');
    this.state.running = false;
    outboxMetrics.running.set(0);

    // Clear poll timer
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Shutdown publisher if needed
    if (this.publisher.shutdown) {
      await this.publisher.shutdown();
    }

    this.logger.info(
      {
        eventsProcessed: this.state.eventsProcessed,
        eventsFailed: this.state.eventsFailed,
      },
      'Outbox processor stopped'
    );
  }

  /**
   * Schedule the next poll cycle
   */
  private schedulePoll(): void {
    if (!this.state.running) return;

    this.pollTimer = setTimeout(async () => {
      await this.poll();
      this.schedulePoll();
    }, this.config.pollIntervalMs);
  }

  /**
   * Execute a single poll cycle
   */
  private async poll(): Promise<void> {
    const pollStart = Date.now();
    const pollTimer = outboxMetrics.pollDuration.startTimer();

    try {
      // Fetch and lock pending events
      const events = await this.fetchAndLockEvents();
      this.state.lastPollTime = new Date();

      outboxMetrics.batchSize.set(events.length);

      if (events.length === 0) {
        outboxMetrics.pollCycles.inc({ status: 'empty' });
        pollTimer({ status: 'empty' });
        return;
      }

      this.logger.debug({ count: events.length }, 'Processing batch');

      // Process each event
      for (const event of events) {
        await this.processEvent(event);
      }

      this.state.consecutiveErrors = 0;
      outboxMetrics.pollCycles.inc({ status: 'success' });
      pollTimer({ status: 'success' });
    } catch (error) {
      this.state.consecutiveErrors++;
      this.logger.error({ error, consecutiveErrors: this.state.consecutiveErrors }, 'Poll cycle failed');
      outboxMetrics.pollCycles.inc({ status: 'error' });
      pollTimer({ status: 'error' });
    }

    // Update lag metric
    await this.updateLagMetric();
  }

  /**
   * Fetch pending events with row-level locking
   * Uses FOR UPDATE SKIP LOCKED to allow concurrent processors
   */
  private async fetchAndLockEvents(): Promise<EventOutboxRecord[]> {
    const now = new Date();

    // Fetch pending events OR failed events ready for retry
    const events = await db
      .select()
      .from(eventOutbox)
      .where(
        sql`(
          ${eventOutbox.status} = 'PENDING'
          OR (
            ${eventOutbox.status} = 'FAILED'
            AND ${eventOutbox.retryCount} < ${this.config.maxRetries}
            AND (${eventOutbox.nextRetryAt} IS NULL OR ${eventOutbox.nextRetryAt} <= ${now})
          )
        )`
      )
      .orderBy(asc(eventOutbox.createdAt))
      .limit(this.config.batchSize)
      .for('update', { skipLocked: true });

    return events;
  }

  /**
   * Process a single outbox event
   */
  private async processEvent(record: EventOutboxRecord): Promise<void> {
    const eventTimer = outboxMetrics.processingDuration.startTimer({
      topic: record.topic,
    });

    const event = toPublishableEvent(record);

    try {
      // Publish the event
      const result = await this.publisher.publish(event);

      if (result.success) {
        await this.markAsPublished(record.id);
        this.state.eventsProcessed++;
        outboxMetrics.eventsProcessed.inc({ topic: record.topic, event_type: 'unknown' });
        eventTimer({ status: 'success' });

        this.logger.debug(
          { outboxId: record.id, topic: record.topic, messageId: result.messageId },
          'Event published successfully'
        );
      } else {
        await this.handleFailure(record, result.error || new Error('Unknown publish error'));
        eventTimer({ status: 'failed' });
      }
    } catch (error) {
      await this.handleFailure(record, error instanceof Error ? error : new Error(String(error)));
      eventTimer({ status: 'error' });
    }
  }

  /**
   * Mark an outbox entry as published
   */
  private async markAsPublished(outboxId: string): Promise<void> {
    await db
      .update(eventOutbox)
      .set({
        status: 'PUBLISHED',
        publishedAt: new Date(),
      })
      .where(eq(eventOutbox.id, outboxId));
  }

  /**
   * Handle a failed publish attempt
   */
  private async handleFailure(record: EventOutboxRecord, error: Error): Promise<void> {
    const newRetryCount = record.retryCount + 1;
    this.state.eventsFailed++;

    if (newRetryCount >= this.config.maxRetries) {
      // Max retries exceeded - leave in FAILED state for manual intervention
      await db
        .update(eventOutbox)
        .set({
          status: 'FAILED',
          errorMessage: `Max retries (${this.config.maxRetries}) exceeded. Last error: ${error.message}`,
          retryCount: newRetryCount,
          nextRetryAt: null, // No more retries
        })
        .where(eq(eventOutbox.id, record.id));

      outboxMetrics.eventsDeadLettered.inc({ topic: record.topic, event_type: 'unknown' });
      this.logger.error(
        { outboxId: record.id, topic: record.topic, retryCount: newRetryCount, error: error.message },
        'Event exceeded max retries, moved to dead letter'
      );
    } else {
      // Schedule retry with exponential backoff
      const retryDelay = this.calculateRetryDelay(newRetryCount);
      const nextRetryAt = new Date(Date.now() + retryDelay);

      await db
        .update(eventOutbox)
        .set({
          status: 'FAILED',
          errorMessage: error.message,
          retryCount: newRetryCount,
          nextRetryAt,
        })
        .where(eq(eventOutbox.id, record.id));

      outboxMetrics.eventsFailed.inc({
        topic: record.topic,
        event_type: 'unknown',
        error_type: error.name || 'Error',
      });
      outboxMetrics.retryAttempts.inc({
        topic: record.topic,
        attempt_number: String(newRetryCount),
      });

      this.logger.warn(
        {
          outboxId: record.id,
          topic: record.topic,
          retryCount: newRetryCount,
          nextRetryAt,
          error: error.message,
        },
        'Event publish failed, scheduled for retry'
      );
    }
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attemptCount: number): number {
    const baseDelay =
      this.config.initialRetryDelayMs *
      Math.pow(this.config.backoffMultiplier, attemptCount - 1);

    // Add jitter (0-30% of base delay)
    const jitter = Math.random() * 0.3 * baseDelay;

    return Math.min(baseDelay + jitter, this.config.maxRetryDelayMs);
  }

  /**
   * Update the lag metric (age of oldest pending event)
   */
  private async updateLagMetric(): Promise<void> {
    try {
      const result = await db
        .select({ oldest: sql<Date>`MIN(${eventOutbox.createdAt})` })
        .from(eventOutbox)
        .where(eq(eventOutbox.status, 'PENDING'));

      if (result[0]?.oldest) {
        const lagSeconds = (Date.now() - new Date(result[0].oldest).getTime()) / 1000;
        outboxMetrics.oldestEventAge.set(lagSeconds);
      } else {
        outboxMetrics.oldestEventAge.set(0);
      }

      // Also update pending count
      const pendingCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(eventOutbox)
        .where(eq(eventOutbox.status, 'PENDING'));

      outboxMetrics.eventsPending.set(Number(pendingCount[0]?.count || 0));

      // And retry count
      const retryCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(eventOutbox)
        .where(
          and(
            eq(eventOutbox.status, 'FAILED'),
            lt(eventOutbox.retryCount, this.config.maxRetries)
          )
        );

      outboxMetrics.eventsAwaitingRetry.set(Number(retryCount[0]?.count || 0));
    } catch (error) {
      this.logger.error({ error }, 'Failed to update lag metrics');
    }
  }

  /**
   * Health check for the processor
   */
  private async healthCheck(): Promise<HealthCheck> {
    const timestamp = new Date().toISOString();

    if (!this.state.running) {
      return { status: 'fail', message: 'Processor not running', timestamp };
    }

    // Check if we've had too many consecutive errors
    if (this.state.consecutiveErrors >= 5) {
      return {
        status: 'warn',
        message: `High error rate: ${this.state.consecutiveErrors} consecutive errors`,
        timestamp,
      };
    }

    // Check if publisher is healthy
    if (this.publisher.healthCheck) {
      const publisherHealth = await this.publisher.healthCheck();
      if (!publisherHealth.healthy) {
        return {
          status: 'warn',
          message: `Publisher unhealthy: ${publisherHealth.message}`,
          timestamp,
        };
      }
    }

    return { status: 'pass', timestamp };
  }

  /**
   * Get current processor state (for debugging/monitoring)
   */
  getState(): ProcessorState {
    return { ...this.state };
  }
}
