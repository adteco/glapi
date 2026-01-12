import { eq, and, gt, asc, sql } from 'drizzle-orm';
import { db } from '@glapi/database';
import { eventStore, type EventStoreRecord } from '@glapi/database/schema';
import { createChildLogger, type Logger } from '../utils/logger.js';
import { auditMetrics } from '../utils/audit-metrics.js';
import { registerHealthCheck, type HealthCheck } from '../utils/health.js';
import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface AuditProcessorConfig {
  /** How often to poll for new events (ms) */
  pollIntervalMs: number;
  /** Number of events to process per batch */
  batchSize: number;
  /** Maximum retry attempts before giving up */
  maxRetries: number;
  /** Initial retry delay (ms) */
  initialRetryDelayMs: number;
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
  /** Maximum retry delay (ms) */
  maxRetryDelayMs: number;
}

interface ProcessorState {
  running: boolean;
  lastPollTime: Date | null;
  lastProcessedSequence: number;
  eventsProcessed: number;
  eventsFailed: number;
  consecutiveErrors: number;
}

// Default configuration
const DEFAULT_CONFIG: AuditProcessorConfig = {
  pollIntervalMs: 1000,
  batchSize: 100,
  maxRetries: 3,
  initialRetryDelayMs: 100,
  backoffMultiplier: 2,
  maxRetryDelayMs: 5000,
};

// ============================================================================
// Audit Processor
// ============================================================================

/**
 * Audit Processor - Consumes events and creates unified audit log entries
 *
 * Implements event-driven audit logging:
 * 1. Poll for new events from event_store (using global_sequence as checkpoint)
 * 2. Transform each event into an audit log entry
 * 3. Persist to unified_audit_log table
 * 4. Update checkpoint for resume capability
 */
export class AuditProcessor {
  private readonly logger: Logger;
  private readonly config: AuditProcessorConfig;
  private state: ProcessorState;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<AuditProcessorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = createChildLogger('AuditProcessor');
    this.state = {
      running: false,
      lastPollTime: null,
      lastProcessedSequence: 0,
      eventsProcessed: 0,
      eventsFailed: 0,
      consecutiveErrors: 0,
    };

    // Register health check
    registerHealthCheck('audit-processor', () => this.healthCheck());
  }

  /**
   * Start the processor
   */
  async start(): Promise<void> {
    if (this.state.running) {
      this.logger.warn('Processor already running');
      return;
    }

    this.logger.info({ config: this.config }, 'Starting audit processor');

    // Load last processed sequence from checkpoint
    await this.loadCheckpoint();

    this.state.running = true;
    auditMetrics.running.set(1);

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

    this.logger.info('Stopping audit processor');
    this.state.running = false;
    auditMetrics.running.set(0);

    // Clear poll timer
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Save checkpoint
    await this.saveCheckpoint();

    this.logger.info(
      {
        eventsProcessed: this.state.eventsProcessed,
        eventsFailed: this.state.eventsFailed,
        lastSequence: this.state.lastProcessedSequence,
      },
      'Audit processor stopped'
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
    const pollTimer = auditMetrics.pollDuration.startTimer();

    try {
      // Fetch new events since last checkpoint
      const events = await this.fetchNewEvents();
      this.state.lastPollTime = new Date();

      auditMetrics.batchSize.set(events.length);

      if (events.length === 0) {
        auditMetrics.pollCycles.inc({ status: 'empty' });
        pollTimer({ status: 'empty' });
        return;
      }

      this.logger.debug({ count: events.length }, 'Processing batch');

      // Process each event
      for (const event of events) {
        await this.processEvent(event);
      }

      this.state.consecutiveErrors = 0;
      auditMetrics.pollCycles.inc({ status: 'success' });
      pollTimer({ status: 'success' });
    } catch (error) {
      this.state.consecutiveErrors++;
      this.logger.error(
        { error, consecutiveErrors: this.state.consecutiveErrors },
        'Poll cycle failed'
      );
      auditMetrics.pollCycles.inc({ status: 'error' });
      pollTimer({ status: 'error' });
    }

    // Update lag metric
    await this.updateLagMetric();
  }

  /**
   * Fetch new events since last processed sequence
   */
  private async fetchNewEvents(): Promise<EventStoreRecord[]> {
    const events = await db
      .select()
      .from(eventStore)
      .where(gt(eventStore.globalSequence, this.state.lastProcessedSequence))
      .orderBy(asc(eventStore.globalSequence))
      .limit(this.config.batchSize);

    return events;
  }

  /**
   * Process a single event
   */
  private async processEvent(event: EventStoreRecord): Promise<void> {
    const eventTimer = auditMetrics.processingDuration.startTimer({
      event_type: event.eventType,
    });

    try {
      // Transform event to audit log entry
      const auditEntry = this.transformEventToAuditLog(event);

      // Insert audit log entry
      await db.execute(sql`
        INSERT INTO unified_audit_log (
          id, organization_id, event_id, correlation_id, causation_id,
          actor_id, actor_type, session_id,
          action_type, action_description, severity,
          resource_type, resource_id,
          previous_state, new_state, changed_fields, payload_hash,
          metadata, occurred_at, recorded_at
        ) VALUES (
          ${auditEntry.id},
          ${auditEntry.organizationId},
          ${auditEntry.eventId},
          ${auditEntry.correlationId},
          ${auditEntry.causationId},
          ${auditEntry.actorId},
          ${auditEntry.actorType},
          ${auditEntry.sessionId},
          ${auditEntry.actionType},
          ${auditEntry.actionDescription},
          ${auditEntry.severity},
          ${auditEntry.resourceType},
          ${auditEntry.resourceId},
          ${JSON.stringify(auditEntry.previousState)},
          ${JSON.stringify(auditEntry.newState)},
          ${JSON.stringify(auditEntry.changedFields)},
          ${auditEntry.payloadHash},
          ${JSON.stringify(auditEntry.metadata)},
          ${auditEntry.occurredAt},
          NOW()
        )
        ON CONFLICT DO NOTHING
      `);

      // Update checkpoint
      this.state.lastProcessedSequence = event.globalSequence;
      this.state.eventsProcessed++;

      auditMetrics.eventsProcessed.inc({
        event_type: event.eventType,
        action_type: auditEntry.actionType,
      });
      eventTimer({ status: 'success' });

      this.logger.debug(
        {
          eventId: event.id,
          sequence: event.globalSequence,
          eventType: event.eventType,
        },
        'Event processed successfully'
      );
    } catch (error) {
      this.state.eventsFailed++;
      auditMetrics.eventsFailed.inc({
        event_type: event.eventType,
        error_type: (error as Error).name || 'Error',
      });
      eventTimer({ status: 'error' });

      this.logger.error(
        {
          eventId: event.id,
          sequence: event.globalSequence,
          error: (error as Error).message,
        },
        'Failed to process event'
      );

      // Still update sequence to avoid getting stuck
      // Failed events will be logged in metrics for alerting
      this.state.lastProcessedSequence = event.globalSequence;
    }
  }

  /**
   * Transform an event store record to an audit log entry
   */
  private transformEventToAuditLog(event: EventStoreRecord): {
    id: string;
    organizationId: string;
    eventId: string;
    correlationId: string;
    causationId: string | null;
    actorId: string;
    actorType: string;
    sessionId: string | null;
    actionType: string;
    actionDescription: string;
    severity: string;
    resourceType: string;
    resourceId: string;
    previousState: Record<string, unknown> | null;
    newState: Record<string, unknown>;
    changedFields: string[] | null;
    payloadHash: string;
    metadata: Record<string, unknown> | null;
    occurredAt: Date;
  } {
    const eventData = event.eventData as Record<string, unknown>;
    const previousState = eventData.previousState as Record<string, unknown> | undefined;
    const newState = eventData.newState as Record<string, unknown> | undefined;
    const changedFields = eventData.changedFields as string[] | undefined;

    // Calculate payload hash
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          previousState,
          newState: newState || eventData,
          changedFields,
        })
      )
      .digest('hex');

    return {
      id: crypto.randomUUID(),
      organizationId: event.organizationId,
      eventId: event.id,
      correlationId: event.correlationId,
      causationId: event.causationId,
      actorId: event.userId || 'SYSTEM',
      actorType: event.userId ? 'USER' : 'SYSTEM',
      sessionId: event.sessionId,
      actionType: this.mapEventTypeToActionType(event.eventType),
      actionDescription: `${event.eventType} on ${event.aggregateType}`,
      severity: this.determineSeverity(event.eventType),
      resourceType: event.aggregateType,
      resourceId: event.aggregateId,
      previousState: previousState || null,
      newState: newState || eventData,
      changedFields: changedFields || null,
      payloadHash,
      metadata: event.metadata as Record<string, unknown> | null,
      occurredAt: event.eventTimestamp,
    };
  }

  /**
   * Map event type to audit action type
   */
  private mapEventTypeToActionType(eventType: string): string {
    const typeMap: Record<string, string> = {
      Created: 'CREATE',
      Registered: 'CREATE',
      Added: 'CREATE',
      Updated: 'UPDATE',
      Modified: 'UPDATE',
      Changed: 'UPDATE',
      Deleted: 'DELETE',
      Removed: 'DELETE',
      Approved: 'APPROVE',
      Rejected: 'REJECT',
      Submitted: 'SUBMIT',
      Posted: 'POST',
      Reversed: 'REVERSE',
      Closed: 'CLOSE',
      Reopened: 'REOPEN',
      Archived: 'ARCHIVE',
      Restored: 'RESTORE',
      LoggedIn: 'LOGIN',
      LoggedOut: 'LOGOUT',
      PermissionGranted: 'PERMISSION_CHANGE',
      PermissionRevoked: 'PERMISSION_CHANGE',
      RoleAssigned: 'ROLE_CHANGE',
      RoleRevoked: 'ROLE_CHANGE',
      Exported: 'EXPORT',
      Imported: 'IMPORT',
    };

    for (const [suffix, actionType] of Object.entries(typeMap)) {
      if (eventType.endsWith(suffix)) {
        return actionType;
      }
    }

    if (eventType.includes('Create') || eventType.includes('New')) return 'CREATE';
    if (eventType.includes('Update') || eventType.includes('Edit')) return 'UPDATE';
    if (eventType.includes('Delete') || eventType.includes('Remove')) return 'DELETE';

    return 'UPDATE';
  }

  /**
   * Determine severity based on event type
   */
  private determineSeverity(eventType: string): string {
    const criticalPatterns = ['Delete', 'Remove', 'Permission', 'Role'];
    const warningPatterns = ['Reverse', 'Reject', 'Archive', 'Failed', 'Error'];

    for (const pattern of criticalPatterns) {
      if (eventType.includes(pattern)) return 'CRITICAL';
    }

    for (const pattern of warningPatterns) {
      if (eventType.includes(pattern)) return 'WARNING';
    }

    return 'INFO';
  }

  /**
   * Load checkpoint from database or storage
   */
  private async loadCheckpoint(): Promise<void> {
    try {
      // Try to get the last processed sequence from a checkpoint table
      // For now, start from the latest audit log entry
      const result = await db.execute(sql`
        SELECT MAX(global_sequence) as last_sequence
        FROM event_store es
        WHERE EXISTS (
          SELECT 1 FROM unified_audit_log ual
          WHERE ual.event_id = es.id
        )
      `);

      const lastSequence = (result as any)[0]?.last_sequence;
      if (lastSequence) {
        this.state.lastProcessedSequence = Number(lastSequence);
        this.logger.info({ lastSequence: this.state.lastProcessedSequence }, 'Loaded checkpoint');
      } else {
        this.logger.info('No checkpoint found, starting from beginning');
      }
    } catch (error) {
      this.logger.warn({ error }, 'Failed to load checkpoint, starting from beginning');
    }
  }

  /**
   * Save checkpoint to database or storage
   */
  private async saveCheckpoint(): Promise<void> {
    // Checkpoint is implicitly saved through the audit log entries
    // The last processed sequence can be recovered from the audit log
    this.logger.debug(
      { lastSequence: this.state.lastProcessedSequence },
      'Checkpoint saved'
    );
  }

  /**
   * Update the lag metric
   */
  private async updateLagMetric(): Promise<void> {
    try {
      // Count unprocessed events
      const result = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(eventStore)
        .where(gt(eventStore.globalSequence, this.state.lastProcessedSequence));

      const pendingCount = Number(result[0]?.count || 0);
      auditMetrics.eventsPending.set(pendingCount);

      // Get age of oldest unprocessed event
      const oldestResult = await db
        .select({ oldest: sql<Date>`MIN(${eventStore.createdAt})` })
        .from(eventStore)
        .where(gt(eventStore.globalSequence, this.state.lastProcessedSequence));

      if (oldestResult[0]?.oldest) {
        const lagSeconds =
          (Date.now() - new Date(oldestResult[0].oldest).getTime()) / 1000;
        auditMetrics.oldestEventAge.set(lagSeconds);
      } else {
        auditMetrics.oldestEventAge.set(0);
      }
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

    if (this.state.consecutiveErrors >= 5) {
      return {
        status: 'warn',
        message: `High error rate: ${this.state.consecutiveErrors} consecutive errors`,
        timestamp,
      };
    }

    return { status: 'pass', timestamp };
  }

  /**
   * Get current processor state
   */
  getState(): ProcessorState {
    return { ...this.state };
  }
}
