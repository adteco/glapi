import { eq, desc, sql } from 'drizzle-orm';
import {
  subscriptionVersions,
  type SubscriptionVersion,
  type NewSubscriptionVersion,
  type SubscriptionVersionTypeValue,
  type SubscriptionVersionSourceValue,
} from '../db/schema/subscription-versions';
import type { SubscriptionWithItems } from './subscription-repository';
import { BaseRepository } from './base-repository';

export interface CreateSubscriptionVersionInput {
  subscription: SubscriptionWithItems;
  versionType: SubscriptionVersionTypeValue;
  versionSource?: SubscriptionVersionSourceValue;
  changeSummary?: string;
  changeReason?: string;
  effectiveDate?: Date;
  modificationId?: string;
  metadata?: Record<string, any>;
  createdBy?: string;
}

export class SubscriptionVersionRepository extends BaseRepository {
  async recordVersion(
    input: CreateSubscriptionVersionInput,
  ): Promise<SubscriptionVersion> {
    const previous = await this.getLatestVersion(input.subscription.id);
    const versionNumber = previous ? previous.versionNumber + 1 : 1;

    const payload: NewSubscriptionVersion = {
      organizationId: input.subscription.organizationId,
      subscriptionId: input.subscription.id,
      versionNumber,
      versionType: input.versionType,
      versionSource: input.versionSource ?? 'system',
      changeSummary: input.changeSummary,
      changeReason: input.changeReason,
      effectiveDate: input.effectiveDate ?? new Date(),
      modificationId: input.modificationId,
      metadata: input.metadata,
      subscriptionSnapshot: serializeForJson(input.subscription),
      itemsSnapshot: serializeForJson(input.subscription.items || []),
      createdBy: input.createdBy,
      previousVersionId: previous?.id,
    };

    const [record] = await this.db
      .insert(subscriptionVersions)
      .values(payload)
      .returning();

    return record;
  }

  async listVersions(
    subscriptionId: string,
    options: { limit?: number } = {},
  ): Promise<SubscriptionVersion[]> {
    const limit = options.limit ?? 25;

    return this.db
      .select()
      .from(subscriptionVersions)
      .where(eq(subscriptionVersions.subscriptionId, subscriptionId))
      .orderBy(desc(subscriptionVersions.versionNumber))
      .limit(limit);
  }

  async getVersion(versionId: string): Promise<SubscriptionVersion | null> {
    const [version] = await this.db
      .select()
      .from(subscriptionVersions)
      .where(eq(subscriptionVersions.id, versionId))
      .limit(1);

    return version || null;
  }

  async getLatestVersion(
    subscriptionId: string,
  ): Promise<SubscriptionVersion | null> {
    const [version] = await this.db
      .select()
      .from(subscriptionVersions)
      .where(eq(subscriptionVersions.subscriptionId, subscriptionId))
      .orderBy(desc(subscriptionVersions.versionNumber))
      .limit(1);

    return version || null;
  }

  async getVersionCount(subscriptionId: string): Promise<number> {
    const [result] = await this.db
      .select({
        count: sql<number>`COUNT(${subscriptionVersions.id})`,
      })
      .from(subscriptionVersions)
      .where(eq(subscriptionVersions.subscriptionId, subscriptionId));

    return Number(result?.count ?? 0);
  }
}

function serializeForJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
