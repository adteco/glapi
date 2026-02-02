/**
 * Magic Inbox Usage Service
 *
 * Tracks document processing usage for billing purposes.
 * Integrates with Stripe for metered billing.
 */

import {
  db,
  magicInboxUsage,
  eq,
  and,
  desc,
  isNull,
  lte,
  sql,
} from '@glapi/database';
import type {
  MagicInboxUsageRecord,
  NewMagicInboxUsageRecord,
  MagicInboxUsageSummary,
  MagicInboxBillingRecord,
} from '@glapi/database';
import { BaseService } from './base-service';
import { ServiceError, PaginationParams } from '../types';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_UNIT_PRICE = '0.10'; // $0.10 per document

// ============================================================================
// Types
// ============================================================================

export interface UsageIncrementResult {
  documentsProcessed: number;
  totalAmount: string | null;
}

export interface UsageUpdateInput {
  documentsConverted?: number;
  documentsRejected?: number;
}

// ============================================================================
// Service Class
// ============================================================================

export class MagicInboxUsageService extends BaseService {
  /**
   * Record a document processed
   * Creates or updates the usage record for the current billing period
   */
  async recordDocumentProcessed(documentId: string): Promise<UsageIncrementResult> {
    const organizationId = this.requireOrganizationContext();

    const { periodStart, periodEnd } = this.getCurrentBillingPeriod();

    // Try to get existing record for this period
    let usage = await db.query.magicInboxUsage.findFirst({
      where: and(
        eq(magicInboxUsage.organizationId, organizationId),
        eq(magicInboxUsage.billingPeriodStart, periodStart)
      ),
    });

    if (usage) {
      // Update existing record
      const [updated] = await db
        .update(magicInboxUsage)
        .set({
          documentsProcessed: sql`${magicInboxUsage.documentsProcessed} + 1`,
          totalAmount: sql`(${magicInboxUsage.documentsProcessed} + 1) * ${magicInboxUsage.unitPrice}`,
          updatedAt: new Date(),
        })
        .where(eq(magicInboxUsage.id, usage.id))
        .returning();

      return {
        documentsProcessed: updated.documentsProcessed,
        totalAmount: updated.totalAmount,
      };
    }

    // Create new record for this period
    const newUsage: NewMagicInboxUsageRecord = {
      organizationId,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      documentsProcessed: 1,
      documentsConverted: 0,
      documentsRejected: 0,
      unitPrice: DEFAULT_UNIT_PRICE,
      totalAmount: DEFAULT_UNIT_PRICE,
    };

    const [created] = await db
      .insert(magicInboxUsage)
      .values(newUsage)
      .returning();

    return {
      documentsProcessed: created.documentsProcessed,
      totalAmount: created.totalAmount,
    };
  }

  /**
   * Record document converted
   */
  async recordDocumentConverted(): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    const { periodStart } = this.getCurrentBillingPeriod();

    await db
      .update(magicInboxUsage)
      .set({
        documentsConverted: sql`${magicInboxUsage.documentsConverted} + 1`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(magicInboxUsage.organizationId, organizationId),
        eq(magicInboxUsage.billingPeriodStart, periodStart)
      ));
  }

  /**
   * Record document rejected
   */
  async recordDocumentRejected(): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    const { periodStart } = this.getCurrentBillingPeriod();

    await db
      .update(magicInboxUsage)
      .set({
        documentsRejected: sql`${magicInboxUsage.documentsRejected} + 1`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(magicInboxUsage.organizationId, organizationId),
        eq(magicInboxUsage.billingPeriodStart, periodStart)
      ));
  }

  /**
   * Get current billing period usage summary
   */
  async getCurrentPeriodUsage(): Promise<MagicInboxUsageSummary | null> {
    const organizationId = this.requireOrganizationContext();
    const { periodStart } = this.getCurrentBillingPeriod();

    const usage = await db.query.magicInboxUsage.findFirst({
      where: and(
        eq(magicInboxUsage.organizationId, organizationId),
        eq(magicInboxUsage.billingPeriodStart, periodStart)
      ),
    });

    if (!usage) {
      // Return zero usage if no records exist
      const { periodStart: start, periodEnd: end } = this.getCurrentBillingPeriod();
      return {
        billingPeriodStart: start,
        billingPeriodEnd: end,
        documentsProcessed: 0,
        documentsConverted: 0,
        documentsRejected: 0,
        unitPrice: DEFAULT_UNIT_PRICE,
        totalAmount: '0.00',
        isBilled: false,
      };
    }

    return this.usageToSummary(usage);
  }

  /**
   * Get billing history
   */
  async getBillingHistory(pagination: PaginationParams = {}): Promise<{
    data: MagicInboxBillingRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(pagination);

    // Get billed records
    const [records, countResult] = await Promise.all([
      db.query.magicInboxUsage.findMany({
        where: and(
          eq(magicInboxUsage.organizationId, organizationId),
          sql`${magicInboxUsage.billedAt} IS NOT NULL`
        ),
        orderBy: [desc(magicInboxUsage.billingPeriodStart)],
        limit: take,
        offset: skip,
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(magicInboxUsage)
        .where(and(
          eq(magicInboxUsage.organizationId, organizationId),
          sql`${magicInboxUsage.billedAt} IS NOT NULL`
        )),
    ]);

    const total = countResult[0]?.count ?? 0;

    return {
      data: records.map((r) => this.usageToBillingRecord(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Sync usage to Stripe
   * Called by the billing sync job at the end of each billing period
   */
  async syncUsageToStripe(): Promise<{
    synced: number;
    failed: number;
    errors: string[];
  }> {
    // This method is designed to sync ALL unbilled usage records
    // across all organizations - typically called by a cron job

    const now = new Date();
    const errors: string[] = [];
    let synced = 0;
    let failed = 0;

    // Get all unbilled usage records for completed billing periods
    const unbilledRecords = await db.query.magicInboxUsage.findMany({
      where: and(
        isNull(magicInboxUsage.billedAt),
        lte(magicInboxUsage.billingPeriodEnd, now.toISOString().split('T')[0])
      ),
    });

    for (const record of unbilledRecords) {
      try {
        // TODO: Integrate with Stripe to create usage record
        // For now, just mark as billed
        await db
          .update(magicInboxUsage)
          .set({
            billedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(magicInboxUsage.id, record.id));

        synced++;
      } catch (error) {
        failed++;
        errors.push(`Failed to sync usage ${record.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { synced, failed, errors };
  }

  /**
   * Sync a single organization's usage to Stripe
   */
  async syncOrganizationUsageToStripe(stripeSubscriptionItemId: string): Promise<string | null> {
    const organizationId = this.requireOrganizationContext();
    const { periodStart } = this.getCurrentBillingPeriod();

    const usage = await db.query.magicInboxUsage.findFirst({
      where: and(
        eq(magicInboxUsage.organizationId, organizationId),
        eq(magicInboxUsage.billingPeriodStart, periodStart),
        isNull(magicInboxUsage.billedAt)
      ),
    });

    if (!usage || usage.documentsProcessed === 0) {
      return null;
    }

    // TODO: Create Stripe usage record
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    // const usageRecord = await stripe.subscriptionItems.createUsageRecord(
    //   stripeSubscriptionItemId,
    //   {
    //     quantity: usage.documentsProcessed,
    //     timestamp: Math.floor(Date.now() / 1000),
    //     action: 'set',
    //   }
    // );

    // For now, simulate the Stripe record ID
    const stripeUsageRecordId = `ur_simulated_${Date.now()}`;

    await db
      .update(magicInboxUsage)
      .set({
        stripeUsageRecordId,
        billedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(magicInboxUsage.id, usage.id));

    return stripeUsageRecordId;
  }

  /**
   * Get usage for a specific organization (for admin/internal use)
   * Does not require organization context
   */
  static async getUsageForOrganization(
    organizationId: string,
    periodStart: string
  ): Promise<MagicInboxUsageRecord | null> {
    const usage = await db.query.magicInboxUsage.findFirst({
      where: and(
        eq(magicInboxUsage.organizationId, organizationId),
        eq(magicInboxUsage.billingPeriodStart, periodStart)
      ),
    });

    return usage ?? null;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private getCurrentBillingPeriod(): { periodStart: string; periodEnd: string } {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // Billing period is the calendar month
    const periodStart = new Date(year, month, 1);
    const periodEnd = new Date(year, month + 1, 0); // Last day of month

    return {
      periodStart: periodStart.toISOString().split('T')[0],
      periodEnd: periodEnd.toISOString().split('T')[0],
    };
  }

  private usageToSummary(usage: MagicInboxUsageRecord): MagicInboxUsageSummary {
    return {
      billingPeriodStart: String(usage.billingPeriodStart),
      billingPeriodEnd: String(usage.billingPeriodEnd),
      documentsProcessed: usage.documentsProcessed,
      documentsConverted: usage.documentsConverted,
      documentsRejected: usage.documentsRejected,
      unitPrice: usage.unitPrice,
      totalAmount: usage.totalAmount,
      isBilled: usage.billedAt !== null,
    };
  }

  private usageToBillingRecord(usage: MagicInboxUsageRecord): MagicInboxBillingRecord {
    return {
      billingPeriodStart: String(usage.billingPeriodStart),
      billingPeriodEnd: String(usage.billingPeriodEnd),
      documentsProcessed: usage.documentsProcessed,
      totalAmount: usage.totalAmount ?? '0.00',
      billedAt: usage.billedAt?.toISOString() ?? '',
      stripeUsageRecordId: usage.stripeUsageRecordId,
    };
  }
}

// Export singleton factory pattern
export const magicInboxUsageService = {
  create: (context = {}) => new MagicInboxUsageService(context),
  getUsageForOrganization: MagicInboxUsageService.getUsageForOrganization,
};
