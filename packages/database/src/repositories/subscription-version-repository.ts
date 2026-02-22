import { eq, and, desc, sql } from 'drizzle-orm';
import { db as globalDb } from '../db';
import type { ContextualDatabase } from '../context';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  subscriptionVersions,
  type SubscriptionVersion,
  type NewSubscriptionVersion,
} from '../db/schema/subscription-versions';

export class SubscriptionVersionRepository {
  private db: NodePgDatabase<any>;
  private versionReturning = {
    id: subscriptionVersions.id,
    organizationId: subscriptionVersions.organizationId,
    subscriptionId: subscriptionVersions.subscriptionId,
    versionNumber: subscriptionVersions.versionNumber,
    versionType: subscriptionVersions.versionType,
    versionSource: subscriptionVersions.versionSource,
    changeSummary: subscriptionVersions.changeSummary,
    changeReason: subscriptionVersions.changeReason,
    effectiveDate: subscriptionVersions.effectiveDate,
    modificationId: subscriptionVersions.modificationId,
    metadata: subscriptionVersions.metadata,
    subscriptionSnapshot: subscriptionVersions.subscriptionSnapshot,
    itemsSnapshot: subscriptionVersions.itemsSnapshot,
    createdBy: subscriptionVersions.createdBy,
    previousVersionId: subscriptionVersions.previousVersionId,
    createdAt: subscriptionVersions.createdAt,
  } as const;

  constructor(db?: ContextualDatabase | NodePgDatabase<any>) {
    this.db = db ?? globalDb;
  }
  /**
   * Create a new subscription version record
   */
  async create(data: NewSubscriptionVersion): Promise<SubscriptionVersion> {
    const [version] = await this.db
      .insert(subscriptionVersions)
      .values(data)
      .returning(this.versionReturning);
    return version;
  }

  /**
   * Find a version by ID
   */
  async findById(id: string): Promise<SubscriptionVersion | null> {
    const [version] = await this.db
      .select()
      .from(subscriptionVersions)
      .where(eq(subscriptionVersions.id, id))
      .limit(1);
    return version || null;
  }

  /**
   * Get all versions for a subscription, ordered by version number descending
   */
  async findBySubscriptionId(subscriptionId: string): Promise<SubscriptionVersion[]> {
    return await this.db
      .select()
      .from(subscriptionVersions)
      .where(eq(subscriptionVersions.subscriptionId, subscriptionId))
      .orderBy(desc(subscriptionVersions.versionNumber));
  }

  /**
   * Get the latest version for a subscription
   */
  async findLatestVersion(subscriptionId: string): Promise<SubscriptionVersion | null> {
    const [version] = await this.db
      .select()
      .from(subscriptionVersions)
      .where(eq(subscriptionVersions.subscriptionId, subscriptionId))
      .orderBy(desc(subscriptionVersions.versionNumber))
      .limit(1);
    return version || null;
  }

  /**
   * Get the next version number for a subscription
   */
  async getNextVersionNumber(subscriptionId: string): Promise<number> {
    const latest = await this.findLatestVersion(subscriptionId);
    return latest ? latest.versionNumber + 1 : 1;
  }

  /**
   * Get version history with pagination
   */
  async getVersionHistory(
    subscriptionId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ data: SubscriptionVersion[]; total: number }> {
    const { limit = 50, offset = 0 } = options;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptionVersions)
      .where(eq(subscriptionVersions.subscriptionId, subscriptionId));

    const data = await this.db
      .select()
      .from(subscriptionVersions)
      .where(eq(subscriptionVersions.subscriptionId, subscriptionId))
      .orderBy(desc(subscriptionVersions.versionNumber))
      .limit(limit)
      .offset(offset);

    return {
      data,
      total: countResult?.count || 0,
    };
  }

  /**
   * Get a specific version by subscription ID and version number
   */
  async findBySubscriptionAndVersion(
    subscriptionId: string,
    versionNumber: number
  ): Promise<SubscriptionVersion | null> {
    const [version] = await this.db
      .select()
      .from(subscriptionVersions)
      .where(
        and(
          eq(subscriptionVersions.subscriptionId, subscriptionId),
          eq(subscriptionVersions.versionNumber, versionNumber)
        )
      )
      .limit(1);
    return version || null;
  }

  /**
   * Get versions by type (e.g., all amendments)
   */
  async findByType(
    subscriptionId: string,
    versionType: string
  ): Promise<SubscriptionVersion[]> {
    return await this.db
      .select()
      .from(subscriptionVersions)
      .where(
        and(
          eq(subscriptionVersions.subscriptionId, subscriptionId),
          eq(subscriptionVersions.versionType, versionType as any)
        )
      )
      .orderBy(desc(subscriptionVersions.versionNumber));
  }

  /**
   * Get versions created by a specific user
   */
  async findByCreatedBy(
    organizationId: string,
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<SubscriptionVersion[]> {
    const { limit = 50, offset = 0 } = options;

    return await this.db
      .select()
      .from(subscriptionVersions)
      .where(
        and(
          eq(subscriptionVersions.organizationId, organizationId),
          eq(subscriptionVersions.createdBy, userId)
        )
      )
      .orderBy(desc(subscriptionVersions.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get versions within a date range
   */
  async findByDateRange(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SubscriptionVersion[]> {
    return await this.db
      .select()
      .from(subscriptionVersions)
      .where(
        and(
          eq(subscriptionVersions.organizationId, organizationId),
          sql`${subscriptionVersions.createdAt} >= ${startDate.toISOString()}`,
          sql`${subscriptionVersions.createdAt} <= ${endDate.toISOString()}`
        )
      )
      .orderBy(desc(subscriptionVersions.createdAt));
  }

  /**
   * Count versions for a subscription
   */
  async countBySubscriptionId(subscriptionId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptionVersions)
      .where(eq(subscriptionVersions.subscriptionId, subscriptionId));
    return result?.count || 0;
  }

  /**
   * Get total contract value changes for a subscription
   */
  async getContractValueHistory(subscriptionId: string): Promise<{
    versionNumber: number;
    effectiveDate: string;
    contractValue: string | null;
    delta: string | null;
  }[]> {
    const versions = await this.db
      .select({
        versionNumber: subscriptionVersions.versionNumber,
        // Normalize to text for callers (avoid timezone surprises in UI).
        effectiveDate: sql<string>`${subscriptionVersions.effectiveDate}::text`,
        contractValue: sql<string | null>`${subscriptionVersions.subscriptionSnapshot} ->> 'contractValue'`,
        // Not stored as a dedicated column in the live table. Caller can compute from snapshots if needed.
        delta: sql<string | null>`null`,
      })
      .from(subscriptionVersions)
      .where(eq(subscriptionVersions.subscriptionId, subscriptionId))
      .orderBy(subscriptionVersions.versionNumber);

    return versions;
  }

  /**
   * Record a version with calculated fields
   */
  async recordVersion(params: {
    organizationId: string;
    subscriptionId: string;
    versionType: NewSubscriptionVersion['versionType'];
    versionSource?: NewSubscriptionVersion['versionSource'];
    subscriptionSnapshot: Record<string, unknown>;
    itemsSnapshot: Record<string, unknown>[];
    changeSummary?: string;
    changeReason?: string;
    effectiveDate: Date;
    createdBy?: string;
    modificationId?: string;
    previousVersionId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<SubscriptionVersion> {
    const nextVersion = await this.getNextVersionNumber(params.subscriptionId);

    return this.create({
      organizationId: params.organizationId,
      subscriptionId: params.subscriptionId,
      versionNumber: nextVersion,
      versionType: params.versionType,
      versionSource: params.versionSource || 'user',
      subscriptionSnapshot: params.subscriptionSnapshot,
      itemsSnapshot: params.itemsSnapshot,
      changeSummary: params.changeSummary,
      changeReason: params.changeReason,
      effectiveDate: params.effectiveDate,
      createdBy: params.createdBy,
      modificationId: params.modificationId,
      previousVersionId: params.previousVersionId,
      metadata: params.metadata,
    });
  }
}
