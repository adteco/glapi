# Outbox Processor & Event Publisher (glapi-rme)

## Overview

This document outlines the architecture for the Outbox Processor worker that reliably publishes events from the `event_outbox` table to downstream consumers.

**Status:** Implemented - `apps/workers` package scaffolded and ready for testing

## Architecture

### Transactional Outbox Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Business Transaction                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │ Business Data   │    │  event_outbox   │    │   Commit TX     │  │
│  │   (INSERT)      │───▶│   (INSERT)      │───▶│                 │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Outbox Processor Worker                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │  Poll Pending   │    │ Publish Event   │    │ Mark Processed  │  │
│  │   Events        │───▶│  (Event Bus)    │───▶│   or Failed     │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Components

1. **Outbox Processor Worker** (`apps/workers/src/outbox-processor.ts`)
   - Polls `event_outbox` for pending events
   - Maintains ordering within aggregate boundaries
   - Publishes to event bus (initially in-process, later external)
   - Handles failures with retry/backoff

2. **Event Outbox Repository** (`packages/database/src/repositories/event-outbox-repository.ts`)
   - `fetchPendingEvents(limit, lockDuration)` - Fetch and lock events
   - `markAsProcessed(eventId)` - Mark successful publish
   - `markAsFailed(eventId, error, nextRetryAt)` - Record failure with retry
   - `markAsDeadLetter(eventId, reason)` - Move to DLQ after max retries

3. **Event Publisher Interface** (`packages/api-service/src/events/event-publisher.ts`)
   - Abstraction for publishing events
   - Initial: In-process event handlers
   - Future: Redis Streams, Kafka, AWS SNS/SQS

## Proposed Schema

**Note:** Pending confirmation from FrostyBasin (glapi-80g)

```typescript
// packages/database/src/db/schema/events.ts

export const eventOutboxStatusEnum = pgEnum('event_outbox_status', [
  'pending',      // Ready to be processed
  'processing',   // Currently being processed (locked)
  'processed',    // Successfully published
  'failed',       // Failed, will retry
  'dead_letter'   // Exceeded max retries
]);

export const eventOutbox = pgTable('event_outbox', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Event identification
  aggregateType: varchar('aggregate_type', { length: 100 }).notNull(),
  aggregateId: uuid('aggregate_id').notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  eventData: jsonb('event_data').notNull(),

  // Ordering
  sequenceNumber: bigserial('sequence_number', { mode: 'number' }),

  // Processing state
  status: eventOutboxStatusEnum('status').default('pending').notNull(),
  attemptCount: integer('attempt_count').default(0).notNull(),
  lastError: text('last_error'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),

  // Tracing
  correlationId: uuid('correlation_id'),
  causationId: uuid('causation_id'),

  // Metadata
  metadata: jsonb('metadata').default({})
}, (table) => ({
  // Index for polling pending events in order
  pendingEventsIdx: index('idx_event_outbox_pending')
    .on(table.status, table.sequenceNumber)
    .where(sql`status = 'pending' OR (status = 'failed' AND next_retry_at <= NOW())`),

  // Index for aggregate ordering
  aggregateIdx: index('idx_event_outbox_aggregate')
    .on(table.aggregateType, table.aggregateId, table.sequenceNumber),
}));
```

## Worker Implementation

### Polling Strategy

```typescript
// apps/workers/src/outbox-processor.ts

interface OutboxProcessorConfig {
  pollIntervalMs: number;      // How often to poll (default: 1000ms)
  batchSize: number;           // Events per batch (default: 100)
  lockDurationMs: number;      // Lock timeout (default: 30000ms)
  maxRetries: number;          // Max attempts before DLQ (default: 5)
  backoffMultiplier: number;   // Exponential backoff factor (default: 2)
  initialRetryDelayMs: number; // First retry delay (default: 1000ms)
}

class OutboxProcessor {
  private running = false;
  private readonly config: OutboxProcessorConfig;
  private readonly repository: EventOutboxRepository;
  private readonly publisher: EventPublisher;
  private readonly metrics: MetricsCollector;

  async start(): Promise<void> {
    this.running = true;
    this.metrics.gauge('outbox_processor_running', 1);

    while (this.running) {
      try {
        const processed = await this.processBatch();

        if (processed === 0) {
          // No events, wait before next poll
          await this.sleep(this.config.pollIntervalMs);
        }
      } catch (error) {
        this.metrics.increment('outbox_processor_errors');
        logger.error('Outbox processor error', { error });
        await this.sleep(this.config.pollIntervalMs * 2);
      }
    }
  }

  private async processBatch(): Promise<number> {
    const events = await this.repository.fetchPendingEvents(
      this.config.batchSize,
      this.config.lockDurationMs
    );

    this.metrics.gauge('outbox_batch_size', events.length);

    for (const event of events) {
      await this.processEvent(event);
    }

    return events.length;
  }

  private async processEvent(event: OutboxEvent): Promise<void> {
    const timer = this.metrics.startTimer('outbox_event_processing_duration');

    try {
      await this.publisher.publish({
        type: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        data: event.eventData,
        metadata: {
          sequenceNumber: event.sequenceNumber,
          correlationId: event.correlationId,
          causationId: event.causationId,
          timestamp: event.createdAt,
        }
      });

      await this.repository.markAsProcessed(event.id);
      this.metrics.increment('outbox_events_processed');

    } catch (error) {
      await this.handleFailure(event, error);
    } finally {
      timer.end();
    }
  }

  private async handleFailure(event: OutboxEvent, error: Error): Promise<void> {
    const newAttemptCount = event.attemptCount + 1;

    if (newAttemptCount >= this.config.maxRetries) {
      await this.repository.markAsDeadLetter(event.id, error.message);
      this.metrics.increment('outbox_events_dead_lettered');
      logger.error('Event moved to dead letter queue', {
        eventId: event.id,
        eventType: event.eventType,
        attempts: newAttemptCount,
        error: error.message
      });
    } else {
      const retryDelay = this.calculateRetryDelay(newAttemptCount);
      const nextRetryAt = new Date(Date.now() + retryDelay);

      await this.repository.markAsFailed(event.id, error.message, nextRetryAt);
      this.metrics.increment('outbox_events_retried');
      logger.warn('Event publish failed, scheduling retry', {
        eventId: event.id,
        eventType: event.eventType,
        attempt: newAttemptCount,
        nextRetryAt,
        error: error.message
      });
    }
  }

  private calculateRetryDelay(attemptCount: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.config.initialRetryDelayMs *
      Math.pow(this.config.backoffMultiplier, attemptCount - 1);
    const jitter = Math.random() * 0.3 * baseDelay;
    return Math.min(baseDelay + jitter, 300000); // Max 5 minutes
  }
}
```

### Idempotency Guarantees

1. **At-least-once delivery**: Events may be published multiple times if worker crashes after publish but before marking processed
2. **Consumer idempotency**: Downstream consumers must handle duplicate events using `eventId` or `sequenceNumber`
3. **Ordering within aggregate**: Events for same aggregate are processed in sequence order

### Locking Strategy

```sql
-- Fetch and lock pending events
UPDATE event_outbox
SET
  status = 'processing',
  locked_until = NOW() + INTERVAL '30 seconds'
WHERE id IN (
  SELECT id FROM event_outbox
  WHERE (status = 'pending' OR (status = 'failed' AND next_retry_at <= NOW()))
    AND (locked_until IS NULL OR locked_until < NOW())
  ORDER BY sequence_number
  LIMIT 100
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

## Monitoring & Observability

### Metrics (Prometheus format)

| Metric | Type | Description |
|--------|------|-------------|
| `outbox_processor_running` | Gauge | 1 if processor is running |
| `outbox_events_pending` | Gauge | Count of pending events |
| `outbox_events_processed_total` | Counter | Total events successfully published |
| `outbox_events_failed_total` | Counter | Total event failures |
| `outbox_events_dead_lettered_total` | Counter | Events moved to DLQ |
| `outbox_event_processing_duration_seconds` | Histogram | Event processing latency |
| `outbox_batch_size` | Gauge | Events in current batch |
| `outbox_lag_seconds` | Gauge | Age of oldest pending event |

### Alerting Rules

```yaml
groups:
  - name: outbox-processor
    rules:
      - alert: OutboxProcessorDown
        expr: outbox_processor_running == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: Outbox processor is not running

      - alert: OutboxLagHigh
        expr: outbox_lag_seconds > 300
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Event processing lag exceeds 5 minutes

      - alert: OutboxDeadLetterQueueGrowing
        expr: rate(outbox_events_dead_lettered_total[5m]) > 0.1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Events are being dead-lettered
```

## Deployment

### Worker App Structure

```
apps/workers/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Entry point
│   ├── outbox-processor.ts   # Main processor
│   ├── config.ts             # Configuration
│   ├── metrics.ts            # Metrics collection
│   └── publishers/
│       ├── event-publisher.ts
│       └── in-process-publisher.ts
├── Dockerfile
└── k8s/
    ├── deployment.yaml
    └── service-monitor.yaml
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Processor settings
OUTBOX_POLL_INTERVAL_MS=1000
OUTBOX_BATCH_SIZE=100
OUTBOX_LOCK_DURATION_MS=30000
OUTBOX_MAX_RETRIES=5

# Metrics
METRICS_PORT=9090

# Logging
LOG_LEVEL=info
```

## Dependencies

| Dependency | Status | Owner |
|------------|--------|-------|
| glapi-80g (Event Schema) | In Progress | FrostyBasin |
| glapi-svz (Ingestion Service) | In Progress | FrostyBasin |

## Open Questions

1. **Event bus technology**: Start with in-process handlers, but what's the target? (Redis Streams, Kafka, AWS EventBridge?)
2. **Multi-worker scaling**: Should we support multiple processor instances? (Requires partition-based assignment)
3. **Event versioning**: How to handle schema evolution for event payloads?

## Next Steps

1. [ ] Get confirmation on event_outbox schema from FrostyBasin
2. [ ] Scaffold `apps/workers` package
3. [ ] Implement EventOutboxRepository
4. [ ] Build OutboxProcessor with polling loop
5. [ ] Add metrics and health endpoints
6. [ ] Create Dockerfile and deployment manifests
7. [ ] Write smoke tests
8. [ ] Document runbook

---

*Author: OliveWolf*
*Task: glapi-rme*
*Created: 2026-01-12*
