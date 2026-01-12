import type { EventPublisher, PublishableEvent, PublishResult } from './event-publisher.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('InProcessPublisher');

/**
 * Event handler function type
 */
export type EventHandler = (event: PublishableEvent) => Promise<void>;

/**
 * In-process event publisher for development and simple deployments
 *
 * Events are dispatched to registered handlers synchronously.
 * This is useful for:
 * - Development/testing without external message brokers
 * - Simple single-instance deployments
 * - Triggering in-process projections
 */
export class InProcessPublisher implements EventPublisher {
  readonly name = 'in-process';
  private handlers: Map<string, EventHandler[]> = new Map();
  private globalHandlers: EventHandler[] = [];

  /**
   * Register a handler for a specific topic
   */
  on(topic: string, handler: EventHandler): void {
    const existing = this.handlers.get(topic) || [];
    existing.push(handler);
    this.handlers.set(topic, existing);
    logger.debug({ topic }, 'Registered handler for topic');
  }

  /**
   * Register a handler for all events
   */
  onAll(handler: EventHandler): void {
    this.globalHandlers.push(handler);
    logger.debug('Registered global handler');
  }

  /**
   * Remove a handler for a specific topic
   */
  off(topic: string, handler: EventHandler): void {
    const existing = this.handlers.get(topic) || [];
    const index = existing.indexOf(handler);
    if (index !== -1) {
      existing.splice(index, 1);
      this.handlers.set(topic, existing);
    }
  }

  async publish(event: PublishableEvent): Promise<PublishResult> {
    const topicHandlers = this.handlers.get(event.topic) || [];
    const allHandlers = [...globalHandlers, ...topicHandlers];

    if (allHandlers.length === 0) {
      logger.debug({ topic: event.topic, eventId: event.id }, 'No handlers registered for topic');
      return { success: true };
    }

    try {
      // Execute all handlers
      await Promise.all(
        allHandlers.map(async (handler) => {
          try {
            await handler(event);
          } catch (error) {
            logger.error({ error, topic: event.topic, eventId: event.id }, 'Handler failed');
            throw error;
          }
        })
      );

      logger.debug(
        { topic: event.topic, eventId: event.id, handlerCount: allHandlers.length },
        'Event published to in-process handlers'
      );

      return { success: true, messageId: event.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async publishBatch(events: PublishableEvent[]): Promise<PublishResult[]> {
    return Promise.all(events.map((event) => this.publish(event)));
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true, message: 'In-process publisher is always healthy' };
  }
}

// Fix: use instance method reference
const globalHandlers: EventHandler[] = [];

// Singleton instance for convenience
export const inProcessPublisher = new InProcessPublisher();
