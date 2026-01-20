import { BaseService } from './base-service';
import { ServiceContext, ServiceError } from '../types';
import {
  eventStoreRepository,
  type EventStoreRepository,
  type EventQueryOptions,
  type AppendEventResult,
  type EventStoreRecord,
  type BaseEvent,
  type EventCategoryType,
  EventCategory,
} from '@glapi/database';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for event publishing
 */
export interface EventPublishConfig {
  /** Topic to publish to */
  topic: string;
  /** Optional partition key for ordering */
  partitionKey?: string;
  /** Custom payload (defaults to event data) */
  payload?: Record<string, unknown>;
}

/**
 * Input for emitting a single event
 */
export interface EmitEventInput<TData = Record<string, unknown>> {
  /** Specific event type (e.g., 'TransactionPosted') */
  eventType: string;
  /** High-level category */
  eventCategory: EventCategoryType;
  /** ID of the entity being changed */
  aggregateId: string;
  /** Type of entity (e.g., 'GLTransaction') */
  aggregateType: string;
  /** Event payload */
  data: TData;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** When the event occurred (defaults to now) */
  timestamp?: Date;
  /** Correlation ID for tracing (auto-generated if not provided) */
  correlationId?: string;
  /** Parent event that caused this event */
  causationId?: string;
  /** Session identifier */
  sessionId?: string;
  /** Expected version for optimistic concurrency (optional) */
  expectedVersion?: number;
  /** Publishing configuration */
  publishConfig?: EventPublishConfig;
}

/**
 * Result of emitting an event
 */
export interface EmitEventResult {
  event: EventStoreRecord;
  published: boolean;
  outboxId?: string;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retries */
  maxRetries: number;
  /** Base delay in milliseconds */
  baseDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Exponential backoff factor */
  backoffFactor: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  backoffFactor: 2,
};

// ============================================================================
// Logger Interface
// ============================================================================

export interface EventServiceLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * Default console logger
 */
const defaultLogger: EventServiceLogger = {
  debug: (msg, ctx) => console.debug(`[EventService] ${msg}`, ctx || ''),
  info: (msg, ctx) => console.info(`[EventService] ${msg}`, ctx || ''),
  warn: (msg, ctx) => console.warn(`[EventService] ${msg}`, ctx || ''),
  error: (msg, ctx) => console.error(`[EventService] ${msg}`, ctx || ''),
};

// ============================================================================
// Event Service
// ============================================================================

/**
 * Event Ingestion Service
 *
 * Provides a high-level API for emitting events to the event store with:
 * - Automatic versioning and correlation tracking
 * - Optimistic concurrency control
 * - Retry with exponential backoff
 * - Structured logging
 * - Outbox pattern support for reliable publishing
 */
export class EventService extends BaseService {
  private repository: EventStoreRepository;
  private logger: EventServiceLogger;
  private retryConfig: RetryConfig;

  constructor(
    context: ServiceContext = {},
    options?: {
      repository?: EventStoreRepository;
      logger?: EventServiceLogger;
      retryConfig?: Partial<RetryConfig>;
    }
  ) {
    super(context);
    this.repository = options?.repository || eventStoreRepository;
    this.logger = options?.logger || defaultLogger;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options?.retryConfig };
  }

  /**
   * Emit a single event to the event store
   */
  async emit<TData = Record<string, unknown>>(
    input: EmitEventInput<TData>
  ): Promise<EmitEventResult> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;

    const correlationId = input.correlationId || uuidv4();
    const timestamp = input.timestamp || new Date();

    this.logger.debug('Emitting event', {
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      correlationId,
    });

    // Get current version for optimistic concurrency
    const currentVersion = await this.repository.getLatestVersion(
      organizationId,
      input.aggregateType,
      input.aggregateId
    );

    // Check expected version if provided
    if (input.expectedVersion !== undefined && input.expectedVersion !== currentVersion) {
      throw new ServiceError(
        `Concurrency conflict: expected version ${input.expectedVersion}, but current is ${currentVersion}`,
        'CONCURRENCY_CONFLICT',
        409,
        {
          expectedVersion: input.expectedVersion,
          currentVersion,
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
        }
      );
    }

    const newVersion = currentVersion + 1;

    // Build the event record
    const eventRecord = {
      eventType: input.eventType,
      eventCategory: input.eventCategory,
      aggregateId: input.aggregateId,
      aggregateType: input.aggregateType,
      eventVersion: newVersion,
      eventData: input.data as Record<string, unknown>,
      metadata: input.metadata,
      eventTimestamp: timestamp,
      userId,
      sessionId: input.sessionId,
      correlationId,
      causationId: input.causationId,
      organizationId,
    };

    // Emit with retry
    const result = await this.withRetry(
      () => this.repository.appendEvent(eventRecord, input.publishConfig),
      `emit event ${input.eventType}`
    );

    this.logger.info('Event emitted successfully', {
      eventId: result.event.id,
      eventType: input.eventType,
      version: newVersion,
      globalSequence: result.event.globalSequence,
      hasOutbox: !!result.outboxEntry,
    });

    return {
      event: result.event,
      published: false, // Will be true after outbox processor runs
      outboxId: result.outboxEntry?.id,
    };
  }

  /**
   * Emit multiple events atomically
   */
  async emitBatch<TData = Record<string, unknown>>(
    inputs: EmitEventInput<TData>[],
    sharedCorrelationId?: string
  ): Promise<EmitEventResult[]> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;
    const correlationId = sharedCorrelationId || uuidv4();

    this.logger.debug('Emitting batch of events', {
      count: inputs.length,
      correlationId,
    });

    // Group inputs by aggregate for version tracking
    const versionMap = new Map<string, number>();

    const preparedEvents = await Promise.all(
      inputs.map(async (input) => {
        const aggregateKey = `${input.aggregateType}:${input.aggregateId}`;

        // Get or compute version
        let version: number;
        if (versionMap.has(aggregateKey)) {
          version = versionMap.get(aggregateKey)! + 1;
        } else {
          const currentVersion = await this.repository.getLatestVersion(
            organizationId,
            input.aggregateType,
            input.aggregateId
          );
          version = currentVersion + 1;
        }
        versionMap.set(aggregateKey, version);

        return {
          event: {
            eventType: input.eventType,
            eventCategory: input.eventCategory,
            aggregateId: input.aggregateId,
            aggregateType: input.aggregateType,
            eventVersion: version,
            eventData: input.data as Record<string, unknown>,
            metadata: input.metadata,
            eventTimestamp: input.timestamp || new Date(),
            userId,
            sessionId: input.sessionId,
            correlationId: input.correlationId || correlationId,
            causationId: input.causationId,
            organizationId,
          },
          outboxConfig: input.publishConfig,
        };
      })
    );

    // Emit with retry
    const results = await this.withRetry(
      () => this.repository.appendEvents(preparedEvents),
      `emit batch of ${inputs.length} events`
    );

    this.logger.info('Batch of events emitted successfully', {
      count: results.length,
      correlationId,
    });

    return results.map((result) => ({
      event: result.event,
      published: false,
      outboxId: result.outboxEntry?.id,
    }));
  }

  /**
   * Query events for an aggregate
   */
  async getAggregateHistory(
    aggregateType: string,
    aggregateId: string,
    options?: {
      fromVersion?: number;
      limit?: number;
    }
  ): Promise<EventStoreRecord[]> {
    const organizationId = this.requireOrganizationContext();

    return this.repository.queryEvents(organizationId, {
      aggregateType,
      aggregateId,
      fromVersion: options?.fromVersion,
      limit: options?.limit,
      orderBy: 'asc',
    });
  }

  /**
   * Query events by correlation ID (for distributed tracing)
   */
  async getCorrelatedEvents(correlationId: string): Promise<EventStoreRecord[]> {
    const organizationId = this.requireOrganizationContext();

    return this.repository.queryEvents(organizationId, {
      correlationId,
      orderBy: 'asc',
    });
  }

  /**
   * Query events with flexible filtering
   */
  async queryEvents(options: EventQueryOptions): Promise<EventStoreRecord[]> {
    const organizationId = this.requireOrganizationContext();

    return this.repository.queryEvents(organizationId, options);
  }

  /**
   * Get the current version of an aggregate
   */
  async getAggregateVersion(
    aggregateType: string,
    aggregateId: string
  ): Promise<number> {
    const organizationId = this.requireOrganizationContext();

    return this.repository.getLatestVersion(
      organizationId,
      aggregateType,
      aggregateId
    );
  }

  /**
   * Start a new correlation context
   * Returns a correlation ID to use for related events
   */
  startCorrelation(): string {
    const correlationId = uuidv4();
    this.logger.debug('Started new correlation context', { correlationId });
    return correlationId;
  }

  /**
   * Create a causation chain
   * Returns a causation ID based on a parent event
   */
  causedBy(parentEventId: string): string {
    return parentEventId;
  }

  // --------------------------------------------------------------------------
  // Retry Helper
  // --------------------------------------------------------------------------

  /**
   * Execute an operation with exponential backoff retry
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;
    let delay = this.retryConfig.baseDelayMs;

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Don't retry concurrency conflicts
        if (error instanceof ServiceError && error.code === 'CONCURRENCY_CONFLICT') {
          throw error;
        }

        if (attempt <= this.retryConfig.maxRetries) {
          this.logger.warn(`Retry ${attempt}/${this.retryConfig.maxRetries} for ${operationName}`, {
            error: lastError.message,
            nextDelayMs: delay,
          });

          await this.sleep(delay);
          delay = Math.min(delay * this.retryConfig.backoffFactor, this.retryConfig.maxDelayMs);
        }
      }
    }

    this.logger.error(`All retries exhausted for ${operationName}`, {
      error: lastError?.message,
      maxRetries: this.retryConfig.maxRetries,
    });

    throw new ServiceError(
      `Failed after ${this.retryConfig.maxRetries} retries: ${lastError?.message}`,
      'RETRY_EXHAUSTED',
      500,
      { originalError: lastError?.message, operationName }
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new EventService instance
 */
export function createEventService(
  context: ServiceContext,
  options?: {
    logger?: EventServiceLogger;
    retryConfig?: Partial<RetryConfig>;
  }
): EventService {
  return new EventService(context, options);
}

// ============================================================================
// Domain Event Helpers
// ============================================================================

/**
 * Helper to create a strongly-typed event input
 */
export function createEventInput<TData>(
  params: Omit<EmitEventInput<TData>, 'data'> & { data: TData }
): EmitEventInput<TData> {
  return params;
}

/**
 * Transaction event types for GL integration
 */
export const TransactionEvents = {
  CREATED: 'TransactionCreated',
  UPDATED: 'TransactionUpdated',
  POSTED: 'TransactionPosted',
  REVERSED: 'TransactionReversed',
  APPROVED: 'TransactionApproved',
  REJECTED: 'TransactionRejected',
} as const;

/**
 * Contract event types
 */
export const ContractEvents = {
  CREATED: 'ContractCreated',
  ACTIVATED: 'ContractActivated',
  MODIFIED: 'ContractModified',
  TERMINATED: 'ContractTerminated',
  RENEWED: 'ContractRenewed',
} as const;

/**
 * Subscription event types
 */
export const SubscriptionEvents = {
  CREATED: 'SubscriptionCreated',
  ACTIVATED: 'SubscriptionActivated',
  PAUSED: 'SubscriptionPaused',
  RESUMED: 'SubscriptionResumed',
  CANCELLED: 'SubscriptionCancelled',
  RENEWED: 'SubscriptionRenewed',
  UPGRADED: 'SubscriptionUpgraded',
  DOWNGRADED: 'SubscriptionDowngraded',
} as const;

/**
 * Payment event types
 */
export const PaymentEvents = {
  INITIATED: 'PaymentInitiated',
  COMPLETED: 'PaymentCompleted',
  FAILED: 'PaymentFailed',
  REFUNDED: 'PaymentRefunded',
} as const;

/**
 * Invoice event types
 */
export const InvoiceEvents = {
  CREATED: 'InvoiceCreated',
  UPDATED: 'InvoiceUpdated',
  SENT: 'InvoiceSent',
  SUBMITTED_FOR_APPROVAL: 'InvoiceSubmittedForApproval',
  APPROVED: 'InvoiceApproved',
  REJECTED: 'InvoiceRejected',
  POSTED: 'InvoicePosted',
  POSTING_FAILED: 'InvoicePostingFailed',
  VOIDED: 'InvoiceVoided',
  PAID: 'InvoicePaid',
} as const;

// Re-export useful types from database
export { EventCategory } from '@glapi/database';
export type { EventCategoryType } from '@glapi/database';
