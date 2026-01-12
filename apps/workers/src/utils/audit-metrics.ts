import { Counter, Gauge, Histogram } from 'prom-client';
import { metricsRegistry } from './metrics.js';

// Audit processor metrics
export const auditMetrics = {
  /** Whether the processor is currently running */
  running: new Gauge({
    name: 'audit_processor_running',
    help: 'Whether the audit processor is currently running (1 = running, 0 = stopped)',
    registers: [metricsRegistry],
  }),

  /** Total events processed successfully */
  eventsProcessed: new Counter({
    name: 'audit_events_processed_total',
    help: 'Total number of events successfully processed into audit logs',
    labelNames: ['event_type', 'action_type'] as const,
    registers: [metricsRegistry],
  }),

  /** Total events that failed processing */
  eventsFailed: new Counter({
    name: 'audit_events_failed_total',
    help: 'Total number of events that failed to be processed into audit logs',
    labelNames: ['event_type', 'error_type'] as const,
    registers: [metricsRegistry],
  }),

  /** Events currently pending in the event store (not yet in audit log) */
  eventsPending: new Gauge({
    name: 'audit_events_pending',
    help: 'Number of events in event store not yet processed into audit log',
    registers: [metricsRegistry],
  }),

  /** Size of the current processing batch */
  batchSize: new Gauge({
    name: 'audit_batch_size',
    help: 'Number of events in the current processing batch',
    registers: [metricsRegistry],
  }),

  /** Age of the oldest pending event in seconds */
  oldestEventAge: new Gauge({
    name: 'audit_oldest_event_age_seconds',
    help: 'Age of the oldest event not yet processed into audit log (seconds)',
    registers: [metricsRegistry],
  }),

  /** Event processing duration histogram */
  processingDuration: new Histogram({
    name: 'audit_event_processing_duration_seconds',
    help: 'Time taken to process a single event into audit log',
    labelNames: ['event_type', 'status'] as const,
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [metricsRegistry],
  }),

  /** Polling cycle duration histogram */
  pollDuration: new Histogram({
    name: 'audit_poll_duration_seconds',
    help: 'Time taken to complete a polling cycle',
    labelNames: ['status'] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    registers: [metricsRegistry],
  }),

  /** Number of poll cycles */
  pollCycles: new Counter({
    name: 'audit_poll_cycles_total',
    help: 'Total number of polling cycles completed',
    labelNames: ['status'] as const,
    registers: [metricsRegistry],
  }),

  /** Current checkpoint sequence */
  checkpointSequence: new Gauge({
    name: 'audit_checkpoint_sequence',
    help: 'Last processed global sequence number',
    registers: [metricsRegistry],
  }),

  /** Audit logs by severity */
  logsBySeverity: new Counter({
    name: 'audit_logs_by_severity_total',
    help: 'Total audit logs created by severity level',
    labelNames: ['severity'] as const,
    registers: [metricsRegistry],
  }),

  /** Audit logs by action type */
  logsByActionType: new Counter({
    name: 'audit_logs_by_action_type_total',
    help: 'Total audit logs created by action type',
    labelNames: ['action_type'] as const,
    registers: [metricsRegistry],
  }),

  /** Coverage percentage (percentage of events successfully logged) */
  coveragePercent: new Gauge({
    name: 'audit_coverage_percent',
    help: 'Percentage of events successfully converted to audit logs',
    registers: [metricsRegistry],
  }),
};

/**
 * Update coverage metric
 */
export function updateCoverageMetric(): void {
  const processed = (auditMetrics.eventsProcessed as any).hashMap;
  const failed = (auditMetrics.eventsFailed as any).hashMap;

  let totalProcessed = 0;
  let totalFailed = 0;

  // Sum all processed events
  if (processed) {
    for (const key of Object.keys(processed)) {
      totalProcessed += processed[key].value || 0;
    }
  }

  // Sum all failed events
  if (failed) {
    for (const key of Object.keys(failed)) {
      totalFailed += failed[key].value || 0;
    }
  }

  const total = totalProcessed + totalFailed;
  if (total > 0) {
    const coverage = (totalProcessed / total) * 100;
    auditMetrics.coveragePercent.set(coverage);
  }
}
