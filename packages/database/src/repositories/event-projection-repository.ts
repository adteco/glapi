/**
 * Event Projection Repository
 *
 * Manages projection state for event-sourced aggregates.
 * Projections are read-optimized views built from event streams.
 */

import { eq, and, desc, asc, lte, gte, sql } from 'drizzle-orm';
import { db } from '../db';
import { eventProjections } from '../db/schema';
import type {
  EventProjectionRecord,
  NewEventProjectionRecord,
} from '../db/schema/event-store';

/**
 * Checkpoint for tracking projection processing state
 */
export interface ProjectionCheckpoint {
  projectionName: string;
  lastGlobalSequence: number;
  lastProcessedAt: Date;
}

/**
 * Repository for event projection management
 */
export class EventProjectionRepository {
  /**
   * Get the current checkpoint for a projection
   * Returns the highest global sequence processed by this projection
   */
  async getCheckpoint(
    projectionName: string,
    organizationId: string
  ): Promise<ProjectionCheckpoint | null> {
    const result = await db
      .select({
        lastGlobalSequence: sql<number>`MAX(${eventProjections.lastGlobalSequence})`,
        lastProcessedAt: sql<Date>`MAX(${eventProjections.updatedAt})`,
      })
      .from(eventProjections)
      .where(
        and(
          eq(eventProjections.projectionName, projectionName),
          eq(eventProjections.organizationId, organizationId)
        )
      );

    if (!result[0] || result[0].lastGlobalSequence === null) {
      return null;
    }

    return {
      projectionName,
      lastGlobalSequence: result[0].lastGlobalSequence,
      lastProcessedAt: result[0].lastProcessedAt,
    };
  }

  /**
   * Get global checkpoint across all organizations for a projection
   */
  async getGlobalCheckpoint(projectionName: string): Promise<number> {
    const result = await db
      .select({
        minSequence: sql<number>`COALESCE(MIN(${eventProjections.lastGlobalSequence}), 0)`,
      })
      .from(eventProjections)
      .where(eq(eventProjections.projectionName, projectionName));

    return result[0]?.minSequence ?? 0;
  }

  /**
   * Find a projection by aggregate
   */
  async findByAggregate(
    projectionName: string,
    aggregateId: string,
    organizationId: string
  ): Promise<EventProjectionRecord | null> {
    const result = await db.query.eventProjections.findFirst({
      where: and(
        eq(eventProjections.projectionName, projectionName),
        eq(eventProjections.aggregateId, aggregateId),
        eq(eventProjections.organizationId, organizationId)
      ),
    });

    return result ?? null;
  }

  /**
   * Find all projections for a given name
   */
  async findByProjectionName(
    projectionName: string,
    organizationId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<EventProjectionRecord[]> {
    return db.query.eventProjections.findMany({
      where: and(
        eq(eventProjections.projectionName, projectionName),
        eq(eventProjections.organizationId, organizationId)
      ),
      limit: options?.limit ?? 100,
      offset: options?.offset ?? 0,
      orderBy: [desc(eventProjections.updatedAt)],
    });
  }

  /**
   * Find projections that are behind a given global sequence
   * Used for catch-up processing
   */
  async findStaleProjections(
    projectionName: string,
    targetGlobalSequence: number,
    limit = 100
  ): Promise<EventProjectionRecord[]> {
    return db.query.eventProjections.findMany({
      where: and(
        eq(eventProjections.projectionName, projectionName),
        lte(eventProjections.lastGlobalSequence, targetGlobalSequence)
      ),
      limit,
      orderBy: [asc(eventProjections.lastGlobalSequence)],
    });
  }

  /**
   * Create or update a projection
   */
  async upsertProjection(
    data: NewEventProjectionRecord
  ): Promise<EventProjectionRecord> {
    const [result] = await db
      .insert(eventProjections)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          eventProjections.projectionName,
          eventProjections.aggregateId,
          eventProjections.organizationId,
        ],
        set: {
          lastEventVersion: data.lastEventVersion,
          lastGlobalSequence: data.lastGlobalSequence,
          projectionData: data.projectionData,
          aggregateType: data.aggregateType,
          updatedAt: new Date(),
        },
        where: lte(eventProjections.lastGlobalSequence, data.lastGlobalSequence),
      })
      .returning();

    return result;
  }

  /**
   * Update projection data only (for partial updates)
   */
  async updateProjectionData(
    projectionName: string,
    aggregateId: string,
    organizationId: string,
    projectionData: unknown,
    globalSequence: number
  ): Promise<EventProjectionRecord | null> {
    const [result] = await db
      .update(eventProjections)
      .set({
        projectionData,
        lastGlobalSequence: globalSequence,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(eventProjections.projectionName, projectionName),
          eq(eventProjections.aggregateId, aggregateId),
          eq(eventProjections.organizationId, organizationId)
        )
      )
      .returning();

    return result ?? null;
  }

  /**
   * Delete a projection
   */
  async deleteProjection(
    projectionName: string,
    aggregateId: string,
    organizationId: string
  ): Promise<boolean> {
    const result = await db
      .delete(eventProjections)
      .where(
        and(
          eq(eventProjections.projectionName, projectionName),
          eq(eventProjections.aggregateId, aggregateId),
          eq(eventProjections.organizationId, organizationId)
        )
      )
      .returning({ id: eventProjections.id });

    return result.length > 0;
  }

  /**
   * Delete all projections for a given name (for rebuild)
   */
  async deleteAllByProjectionName(
    projectionName: string,
    organizationId?: string
  ): Promise<number> {
    const conditions = organizationId
      ? and(
          eq(eventProjections.projectionName, projectionName),
          eq(eventProjections.organizationId, organizationId)
        )
      : eq(eventProjections.projectionName, projectionName);

    const result = await db
      .delete(eventProjections)
      .where(conditions)
      .returning({ id: eventProjections.id });

    return result.length;
  }

  /**
   * Get projection statistics
   */
  async getProjectionStats(projectionName: string): Promise<{
    projectionName: string;
    totalAggregates: number;
    minGlobalSequence: number;
    maxGlobalSequence: number;
    avgGlobalSequence: number;
    oldestUpdate: Date | null;
    newestUpdate: Date | null;
  }> {
    const result = await db
      .select({
        totalAggregates: sql<number>`COUNT(*)`,
        minGlobalSequence: sql<number>`MIN(${eventProjections.lastGlobalSequence})`,
        maxGlobalSequence: sql<number>`MAX(${eventProjections.lastGlobalSequence})`,
        avgGlobalSequence: sql<number>`AVG(${eventProjections.lastGlobalSequence})`,
        oldestUpdate: sql<Date>`MIN(${eventProjections.updatedAt})`,
        newestUpdate: sql<Date>`MAX(${eventProjections.updatedAt})`,
      })
      .from(eventProjections)
      .where(eq(eventProjections.projectionName, projectionName));

    const row = result[0];

    return {
      projectionName,
      totalAggregates: row?.totalAggregates ?? 0,
      minGlobalSequence: row?.minGlobalSequence ?? 0,
      maxGlobalSequence: row?.maxGlobalSequence ?? 0,
      avgGlobalSequence: row?.avgGlobalSequence ?? 0,
      oldestUpdate: row?.oldestUpdate ?? null,
      newestUpdate: row?.newestUpdate ?? null,
    };
  }

  /**
   * Find projections by aggregate type
   */
  async findByAggregateType(
    projectionName: string,
    aggregateType: string,
    organizationId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<EventProjectionRecord[]> {
    return db.query.eventProjections.findMany({
      where: and(
        eq(eventProjections.projectionName, projectionName),
        eq(eventProjections.aggregateType, aggregateType),
        eq(eventProjections.organizationId, organizationId)
      ),
      limit: options?.limit ?? 100,
      offset: options?.offset ?? 0,
      orderBy: [desc(eventProjections.updatedAt)],
    });
  }
}
