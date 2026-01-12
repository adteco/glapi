import { Registry, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';

// Create a custom registry
export const metricsRegistry = new Registry();

// Collect default Node.js metrics
collectDefaultMetrics({ register: metricsRegistry });

// Outbox processor metrics
export const outboxMetrics = {
  /** Whether the processor is currently running */
  running: new Gauge({
    name: 'outbox_processor_running',
    help: 'Whether the outbox processor is currently running (1 = running, 0 = stopped)',
    registers: [metricsRegistry],
  }),

  /** Total events processed successfully */
  eventsProcessed: new Counter({
    name: 'outbox_events_processed_total',
    help: 'Total number of events successfully processed',
    labelNames: ['topic', 'event_type'] as const,
    registers: [metricsRegistry],
  }),

  /** Total events that failed processing */
  eventsFailed: new Counter({
    name: 'outbox_events_failed_total',
    help: 'Total number of events that failed processing',
    labelNames: ['topic', 'event_type', 'error_type'] as const,
    registers: [metricsRegistry],
  }),

  /** Total events moved to dead letter (exceeded max retries) */
  eventsDeadLettered: new Counter({
    name: 'outbox_events_dead_lettered_total',
    help: 'Total number of events moved to dead letter queue',
    labelNames: ['topic', 'event_type'] as const,
    registers: [metricsRegistry],
  }),

  /** Events currently pending in the outbox */
  eventsPending: new Gauge({
    name: 'outbox_events_pending',
    help: 'Number of events currently pending in the outbox',
    registers: [metricsRegistry],
  }),

  /** Events currently in failed state awaiting retry */
  eventsAwaitingRetry: new Gauge({
    name: 'outbox_events_awaiting_retry',
    help: 'Number of events in failed state awaiting retry',
    registers: [metricsRegistry],
  }),

  /** Size of the current processing batch */
  batchSize: new Gauge({
    name: 'outbox_batch_size',
    help: 'Number of events in the current processing batch',
    registers: [metricsRegistry],
  }),

  /** Age of the oldest pending event in seconds */
  oldestEventAge: new Gauge({
    name: 'outbox_oldest_event_age_seconds',
    help: 'Age of the oldest pending event in seconds',
    registers: [metricsRegistry],
  }),

  /** Event processing duration histogram */
  processingDuration: new Histogram({
    name: 'outbox_event_processing_duration_seconds',
    help: 'Time taken to process a single event',
    labelNames: ['topic', 'status'] as const,
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [metricsRegistry],
  }),

  /** Polling cycle duration histogram */
  pollDuration: new Histogram({
    name: 'outbox_poll_duration_seconds',
    help: 'Time taken to complete a polling cycle',
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    registers: [metricsRegistry],
  }),

  /** Number of poll cycles */
  pollCycles: new Counter({
    name: 'outbox_poll_cycles_total',
    help: 'Total number of polling cycles completed',
    labelNames: ['status'] as const,
    registers: [metricsRegistry],
  }),

  /** Retry attempts */
  retryAttempts: new Counter({
    name: 'outbox_retry_attempts_total',
    help: 'Total number of retry attempts',
    labelNames: ['topic', 'attempt_number'] as const,
    registers: [metricsRegistry],
  }),
};

/**
 * Get all metrics as a string for the /metrics endpoint
 */
export async function getMetrics(): Promise<string> {
  return metricsRegistry.metrics();
}

/**
 * Get the content type for metrics
 */
export function getMetricsContentType(): string {
  return metricsRegistry.contentType;
}
