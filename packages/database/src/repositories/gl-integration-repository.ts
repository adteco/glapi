import { db, Database } from '../db';
import { 
  glJournalEntries,
  journalEntryBatches,
  revenueSchedules,
  GLJournalStatus,
  BatchStatuses
} from '../db/schema';
import { eq, and, gte, lte, sql, desc, isNull, or } from 'drizzle-orm';

export class GLIntegrationRepository {
  constructor(private database: Database = db) {}

  /**
   * Get journal entries for batch
   */
  async getJournalEntriesForBatch(batchId: string) {
    return await this.database
      .select()
      .from(glJournalEntries)
      .where(eq(glJournalEntries.batchId, batchId));
  }

  /**
   * Get pending journal entries for period
   */
  async getPendingJournalEntries(
    organizationId: string,
    startDate: string,
    endDate: string
  ) {
    return await this.database
      .select()
      .from(glJournalEntries)
      .where(
        and(
          eq(glJournalEntries.organizationId, organizationId),
          gte(glJournalEntries.entryDate, startDate),
          lte(glJournalEntries.entryDate, endDate),
          eq(glJournalEntries.status, GLJournalStatus.PENDING)
        )
      );
  }

  /**
   * Create GL journal entries from revenue schedules
   */
  async createJournalEntriesFromSchedules(
    organizationId: string,
    scheduleIds: string[],
    batchId?: string
  ) {
    const schedules = await this.database
      .select()
      .from(revenueSchedules)
      .where(
        and(
          eq(revenueSchedules.organizationId, organizationId),
          sql`${revenueSchedules.id} IN (${sql.raw(scheduleIds.map(id => `'${id}'`).join(','))})`
        )
      );

    const entries = schedules.map((schedule) => {
      const entryDate = schedule.periodStartDate ?? schedule.scheduleDate;
      if (!entryDate) {
        throw new Error(`Revenue schedule ${schedule.id} missing entry date`);
      }

      return {
        ...(batchId ? { batchId } : {}),
        organizationId,
        revenueScheduleId: schedule.id,
        entryDate,
        description: `Revenue recognition for ${entryDate}`,
        amount: schedule.scheduledAmount ?? '0',
        deferredRevenueAmount: schedule.scheduledAmount ?? '0',
        recognizedRevenueAmount: '0',
        status: GLJournalStatus.DRAFT as "draft" | "pending" | "posted" | "reversed" | "failed",
      };
    });

    if (entries.length > 0) {
      const created = await this.database
        .insert(glJournalEntries)
        .values(entries)
        .returning();
      return created;
    }

    return [];
  }

  /**
   * Update journal entry status
   */
  async updateJournalEntryStatus(
    entryId: string,
    status: "draft" | "pending" | "posted" | "reversed" | "failed",
    externalData?: {
      externalTransactionId?: string;
      externalPostStatus?: string;
      externalPostDate?: Date;
    }
  ) {
    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    if (externalData) {
      Object.assign(updateData, externalData);
    }

    if (status === 'posted') {
      updateData.posted = true;
      updateData.postedAt = new Date();
    }

    const [updated] = await this.database
      .update(glJournalEntries)
      .set(updateData)
      .where(eq(glJournalEntries.id, entryId))
      .returning();

    return updated;
  }

  /**
   * Create a new journal entry batch
   */
  async createBatch(data: {
    organizationId: string;
    batchNumber: string;
    description?: string;
    totalEntries: number;
    scheduledAt?: Date;
    metadata?: any;
    createdBy?: string;
  }) {
    const [batch] = await this.database
      .insert(journalEntryBatches)
      .values({
        ...data,
        status: BatchStatuses.DRAFT as "draft",
        processedEntries: 0,
        failedEntries: 0
      })
      .returning();

    return batch;
  }

  /**
   * Update batch status
   */
  async updateBatchStatus(
    batchId: string,
    status: "draft" | "pending" | "processing" | "completed" | "failed" | "cancelled",
    updateData?: {
      processedEntries?: number;
      failedEntries?: number;
      completedAt?: Date;
      errors?: any;
      externalBatchId?: string;
      externalSystemId?: string;
    }
  ) {
    const data: any = {
      status,
      updatedAt: new Date(),
      ...updateData
    };

    if (status === 'processing' && !data.startedAt) {
      data.startedAt = new Date();
    }

    if (status === 'completed' && !data.completedAt) {
      data.completedAt = new Date();
    }

    const [updated] = await this.database
      .update(journalEntryBatches)
      .set(data)
      .where(eq(journalEntryBatches.id, batchId))
      .returning();

    return updated;
  }

  /**
   * Get batch with entries
   */
  async getBatchWithEntries(batchId: string) {
    const batch = await this.database
      .select()
      .from(journalEntryBatches)
      .where(eq(journalEntryBatches.id, batchId))
      .limit(1);

    if (batch.length === 0) {
      return null;
    }

    const entries = await this.database
      .select()
      .from(glJournalEntries)
      .where(eq(glJournalEntries.batchId, batchId));

    return {
      batch: batch[0],
      entries
    };
  }

  /**
   * Get unposted entries
   */
  async getUnpostedEntries(organizationId: string, limit: number = 100) {
    return await this.database
      .select()
      .from(glJournalEntries)
      .where(
        and(
          eq(glJournalEntries.organizationId, organizationId),
          or(
            eq(glJournalEntries.status, GLJournalStatus.DRAFT),
            eq(glJournalEntries.status, GLJournalStatus.PENDING)
          ),
          eq(glJournalEntries.posted, false)
        )
      )
      .orderBy(glJournalEntries.entryDate)
      .limit(limit);
  }

  /**
   * Mark entries as posted
   */
  async markEntriesAsPosted(
    entryIds: string[],
    externalBatchId: string,
    postedBy?: string
  ) {
    if (entryIds.length === 0) return [];

    return await this.database
      .update(glJournalEntries)
      .set({
        status: GLJournalStatus.POSTED as "posted",
        posted: true,
        postedAt: new Date(),
        postedBy,
        externalTransactionId: externalBatchId,
        externalPostStatus: 'posted',
        externalPostDate: new Date(),
        updatedAt: new Date()
      })
      .where(
        sql`${glJournalEntries.id} IN (${sql.raw(entryIds.map(id => `'${id}'`).join(','))})`
      )
      .returning();
  }

  /**
   * Get journal entries by date range
   */
  async getJournalEntriesByDateRange(
    organizationId: string,
    startDate: string,
    endDate: string
  ) {
    return await this.database
      .select()
      .from(glJournalEntries)
      .where(
        and(
          eq(glJournalEntries.organizationId, organizationId),
          gte(glJournalEntries.entryDate, startDate),
          lte(glJournalEntries.entryDate, endDate)
        )
      )
      .orderBy(glJournalEntries.entryDate);
  }
}

export const glIntegrationRepository = new GLIntegrationRepository();
