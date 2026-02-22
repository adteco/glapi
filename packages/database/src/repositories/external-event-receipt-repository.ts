import { and, desc, eq } from "drizzle-orm";
import {
  externalEventReceipts,
  type ExternalEventReceipt,
  type ExternalEventProcessingStatus,
  type NewExternalEventReceipt,
} from "../db/schema/external-event-receipts";
import type { ContextualDatabase } from "../context";
import { BaseRepository } from "./base-repository";

export class ExternalEventReceiptRepository extends BaseRepository {
  constructor(db?: ContextualDatabase) {
    super(db);
  }

  async findByProviderEventId(
    provider: string,
    externalEventId: string
  ): Promise<ExternalEventReceipt | null> {
    const [result] = await this.db
      .select()
      .from(externalEventReceipts)
      .where(
        and(
          eq(externalEventReceipts.provider, provider),
          eq(externalEventReceipts.externalEventId, externalEventId)
        )
      )
      .limit(1);

    return result ?? null;
  }

  async createOrGet(
    data: NewExternalEventReceipt
  ): Promise<{ receipt: ExternalEventReceipt; created: boolean }> {
    const inserted = await this.db
      .insert(externalEventReceipts)
      .values(data)
      .onConflictDoNothing({
        target: [externalEventReceipts.provider, externalEventReceipts.externalEventId],
      })
      .returning();

    if (inserted.length > 0) {
      return { receipt: inserted[0], created: true };
    }

    const existing = await this.findByProviderEventId(data.provider, data.externalEventId);
    if (!existing) {
      throw new Error("Failed to create or fetch external event receipt");
    }

    return { receipt: existing, created: false };
  }

  async updateProcessingResult(
    id: string,
    input: {
      processingStatus: ExternalEventProcessingStatus;
      organizationId?: string | null;
      processingError?: string | null;
      metadata?: Record<string, unknown>;
      processedAt?: Date | null;
    }
  ): Promise<ExternalEventReceipt | null> {
    const processedAt =
      input.processedAt !== undefined
        ? input.processedAt
        : input.processingStatus === "received"
          ? null
          : new Date();

    const [result] = await this.db
      .update(externalEventReceipts)
      .set({
        processingStatus: input.processingStatus,
        organizationId: input.organizationId,
        processingError: input.processingError,
        processedAt,
        metadata: input.metadata,
        updatedAt: new Date(),
      })
      .where(eq(externalEventReceipts.id, id))
      .returning();

    return result ?? null;
  }

  async listRecentByProvider(
    provider: string,
    limit = 50
  ): Promise<ExternalEventReceipt[]> {
    return await this.db
      .select()
      .from(externalEventReceipts)
      .where(eq(externalEventReceipts.provider, provider))
      .orderBy(desc(externalEventReceipts.receivedAt))
      .limit(limit);
  }
}
