import type { EventOutboxRecord } from '@glapi/database';

/**
 * Event payload to be published
 */
export interface PublishableEvent {
  /** Unique event ID from outbox */
  id: string;
  /** Target topic/channel */
  topic: string;
  /** Optional partition key for ordering */
  partitionKey?: string | null;
  /** Event payload */
  payload: Record<string, unknown>;
  /** Source event ID from event store */
  eventId: string;
  /** Organization context */
  organizationId: string;
  /** When the event was created */
  createdAt: Date;
}

/**
 * Result of publishing an event
 */
export interface PublishResult {
  success: boolean;
  error?: Error;
  /** Optional message ID from the target system */
  messageId?: string;
}

/**
 * Interface for event publishers
 * Implementations can target different messaging systems
 */
export interface EventPublisher {
  /** Publisher name for logging/metrics */
  readonly name: string;

  /**
   * Publish an event to the target system
   */
  publish(event: PublishableEvent): Promise<PublishResult>;

  /**
   * Publish multiple events (batch operation if supported)
   */
  publishBatch?(events: PublishableEvent[]): Promise<PublishResult[]>;

  /**
   * Initialize the publisher (connect, validate config, etc.)
   */
  initialize?(): Promise<void>;

  /**
   * Gracefully shutdown the publisher
   */
  shutdown?(): Promise<void>;

  /**
   * Health check for the publisher
   */
  healthCheck?(): Promise<{ healthy: boolean; message?: string }>;
}

/**
 * Convert an outbox record to a publishable event
 */
export function toPublishableEvent(record: EventOutboxRecord): PublishableEvent {
  return {
    id: record.id,
    topic: record.topic,
    partitionKey: record.partitionKey,
    payload: record.payload as Record<string, unknown>,
    eventId: record.eventId,
    organizationId: record.organizationId,
    createdAt: record.createdAt,
  };
}
