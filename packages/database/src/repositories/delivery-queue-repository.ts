import { eq, and, lte, or, sql, desc, isNull, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  deliveryQueue,
  deliveryAttempts,
  DeliveryQueueItem,
  NewDeliveryQueueItem,
  UpdateDeliveryQueueItem,
  DeliveryAttempt,
  NewDeliveryAttempt,
  DeliveryStatus,
  DeliveryType,
} from '../db/schema';

export class DeliveryQueueRepository {
  // ============================================================================
  // Queue Item CRUD
  // ============================================================================

  async create(data: NewDeliveryQueueItem): Promise<DeliveryQueueItem> {
    const [result] = await db.insert(deliveryQueue).values(data).returning();
    return result;
  }

  async createMany(data: NewDeliveryQueueItem[]): Promise<DeliveryQueueItem[]> {
    if (data.length === 0) return [];
    return db.insert(deliveryQueue).values(data).returning();
  }

  async findById(id: string): Promise<DeliveryQueueItem | null> {
    const [result] = await db.select().from(deliveryQueue).where(eq(deliveryQueue.id, id));
    return result ?? null;
  }

  async findByJobExecutionId(jobExecutionId: string): Promise<DeliveryQueueItem[]> {
    return db
      .select()
      .from(deliveryQueue)
      .where(eq(deliveryQueue.jobExecutionId, jobExecutionId));
  }

  async findByScheduleId(scheduleId: string, limit = 100): Promise<DeliveryQueueItem[]> {
    return db
      .select()
      .from(deliveryQueue)
      .where(eq(deliveryQueue.reportScheduleId, scheduleId))
      .orderBy(desc(deliveryQueue.createdAt))
      .limit(limit);
  }

  async update(id: string, data: UpdateDeliveryQueueItem): Promise<DeliveryQueueItem | null> {
    const [result] = await db
      .update(deliveryQueue)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(deliveryQueue.id, id))
      .returning();
    return result ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(deliveryQueue).where(eq(deliveryQueue.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ============================================================================
  // Queue Processing Operations
  // ============================================================================

  /**
   * Find pending deliveries that are ready for processing
   * (status is pending or failed, and next_attempt_at is null or in the past)
   */
  async findPendingDeliveries(limit = 50): Promise<DeliveryQueueItem[]> {
    const now = new Date();
    return db
      .select()
      .from(deliveryQueue)
      .where(
        and(
          inArray(deliveryQueue.status, ['pending', 'failed']),
          or(
            isNull(deliveryQueue.nextAttemptAt),
            lte(deliveryQueue.nextAttemptAt, now)
          )
        )
      )
      .orderBy(deliveryQueue.scheduledAt)
      .limit(limit);
  }

  /**
   * Find pending deliveries by type
   */
  async findPendingByType(type: DeliveryType, limit = 50): Promise<DeliveryQueueItem[]> {
    const now = new Date();
    return db
      .select()
      .from(deliveryQueue)
      .where(
        and(
          eq(deliveryQueue.deliveryType, type),
          inArray(deliveryQueue.status, ['pending', 'failed']),
          or(
            isNull(deliveryQueue.nextAttemptAt),
            lte(deliveryQueue.nextAttemptAt, now)
          )
        )
      )
      .orderBy(deliveryQueue.scheduledAt)
      .limit(limit);
  }

  /**
   * Mark a delivery as processing (to prevent duplicate processing)
   */
  async markAsProcessing(id: string): Promise<DeliveryQueueItem | null> {
    const [result] = await db
      .update(deliveryQueue)
      .set({
        status: 'processing',
        startedAt: new Date(),
        attemptCount: sql`${deliveryQueue.attemptCount} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(deliveryQueue.id, id),
          inArray(deliveryQueue.status, ['pending', 'failed'])
        )
      )
      .returning();
    return result ?? null;
  }

  /**
   * Mark a delivery as delivered (successful)
   */
  async markAsDelivered(
    id: string,
    response: Record<string, unknown>
  ): Promise<DeliveryQueueItem | null> {
    const [result] = await db
      .update(deliveryQueue)
      .set({
        status: 'delivered',
        completedAt: new Date(),
        deliveryResponse: response,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastErrorStack: null,
        updatedAt: new Date(),
      })
      .where(eq(deliveryQueue.id, id))
      .returning();
    return result ?? null;
  }

  /**
   * Mark a delivery as failed (with retry scheduling)
   */
  async markAsFailed(
    id: string,
    error: { code?: string; message: string; stack?: string },
    nextRetryAt?: Date
  ): Promise<DeliveryQueueItem | null> {
    const item = await this.findById(id);
    if (!item) return null;

    // Check if we should move to dead letter
    const shouldDeadLetter = item.attemptCount >= item.maxAttempts;

    const [result] = await db
      .update(deliveryQueue)
      .set({
        status: shouldDeadLetter ? 'dead_letter' : 'failed',
        lastErrorCode: error.code ?? null,
        lastErrorMessage: error.message,
        lastErrorStack: error.stack ?? null,
        nextAttemptAt: shouldDeadLetter ? null : nextRetryAt,
        movedToDeadLetterAt: shouldDeadLetter ? new Date() : null,
        deadLetterReason: shouldDeadLetter
          ? `Max attempts (${item.maxAttempts}) exceeded: ${error.message}`
          : null,
        updatedAt: new Date(),
      })
      .where(eq(deliveryQueue.id, id))
      .returning();
    return result ?? null;
  }

  /**
   * Move a delivery to dead letter queue
   */
  async moveToDeadLetter(id: string, reason: string): Promise<DeliveryQueueItem | null> {
    const [result] = await db
      .update(deliveryQueue)
      .set({
        status: 'dead_letter',
        movedToDeadLetterAt: new Date(),
        deadLetterReason: reason,
        nextAttemptAt: null,
        updatedAt: new Date(),
      })
      .where(eq(deliveryQueue.id, id))
      .returning();
    return result ?? null;
  }

  /**
   * Retry a dead letter item (reset for reprocessing)
   */
  async retryDeadLetter(id: string): Promise<DeliveryQueueItem | null> {
    const [result] = await db
      .update(deliveryQueue)
      .set({
        status: 'pending',
        attemptCount: 0,
        nextAttemptAt: null,
        movedToDeadLetterAt: null,
        deadLetterReason: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastErrorStack: null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(deliveryQueue.id, id), eq(deliveryQueue.status, 'dead_letter'))
      )
      .returning();
    return result ?? null;
  }

  // ============================================================================
  // Delivery Attempts (Audit Log)
  // ============================================================================

  async recordAttempt(data: NewDeliveryAttempt): Promise<DeliveryAttempt> {
    const [result] = await db.insert(deliveryAttempts).values(data).returning();
    return result;
  }

  async getAttemptsByDeliveryId(deliveryId: string): Promise<DeliveryAttempt[]> {
    return db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryQueueId, deliveryId))
      .orderBy(desc(deliveryAttempts.attemptNumber));
  }

  // ============================================================================
  // Statistics and Queries
  // ============================================================================

  /**
   * Get queue statistics by status
   */
  async getStats(organizationId?: string): Promise<{
    pending: number;
    processing: number;
    delivered: number;
    failed: number;
    deadLetter: number;
    total: number;
  }> {
    const baseCondition = organizationId
      ? eq(deliveryQueue.organizationId, organizationId)
      : undefined;

    const stats = await db
      .select({
        status: deliveryQueue.status,
        count: sql<number>`count(*)::int`,
      })
      .from(deliveryQueue)
      .where(baseCondition)
      .groupBy(deliveryQueue.status);

    const result = {
      pending: 0,
      processing: 0,
      delivered: 0,
      failed: 0,
      deadLetter: 0,
      total: 0,
    };

    for (const stat of stats) {
      const count = stat.count ?? 0;
      result.total += count;
      if (stat.status === 'pending') result.pending = count;
      if (stat.status === 'processing') result.processing = count;
      if (stat.status === 'delivered') result.delivered = count;
      if (stat.status === 'failed') result.failed = count;
      if (stat.status === 'dead_letter') result.deadLetter = count;
    }

    return result;
  }

  /**
   * Get dead letter items for review
   */
  async getDeadLetterItems(
    organizationId?: string,
    limit = 100
  ): Promise<DeliveryQueueItem[]> {
    const conditions = [eq(deliveryQueue.status, 'dead_letter')];
    if (organizationId) {
      conditions.push(eq(deliveryQueue.organizationId, organizationId));
    }

    return db
      .select()
      .from(deliveryQueue)
      .where(and(...conditions))
      .orderBy(desc(deliveryQueue.movedToDeadLetterAt))
      .limit(limit);
  }

  /**
   * List deliveries with pagination and filters
   */
  async list(options: {
    organizationId?: string;
    status?: DeliveryStatus | DeliveryStatus[];
    deliveryType?: DeliveryType;
    page?: number;
    limit?: number;
  }): Promise<{ items: DeliveryQueueItem[]; total: number }> {
    const { page = 1, limit = 50 } = options;
    const offset = (page - 1) * limit;
    const conditions: ReturnType<typeof eq>[] = [];

    if (options.organizationId) {
      conditions.push(eq(deliveryQueue.organizationId, options.organizationId));
    }
    if (options.status) {
      if (Array.isArray(options.status)) {
        conditions.push(inArray(deliveryQueue.status, options.status));
      } else {
        conditions.push(eq(deliveryQueue.status, options.status));
      }
    }
    if (options.deliveryType) {
      conditions.push(eq(deliveryQueue.deliveryType, options.deliveryType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(deliveryQueue)
        .where(whereClause)
        .orderBy(desc(deliveryQueue.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(deliveryQueue)
        .where(whereClause),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
    };
  }

  /**
   * Clean up old delivered items (retention policy)
   */
  async cleanupOldDeliveries(olderThanDays = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await db
      .delete(deliveryQueue)
      .where(
        and(
          eq(deliveryQueue.status, 'delivered'),
          lte(deliveryQueue.completedAt, cutoffDate)
        )
      );

    return result.rowCount ?? 0;
  }
}

// Export singleton instance
export const deliveryQueueRepository = new DeliveryQueueRepository();
