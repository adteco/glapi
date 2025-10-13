import { db } from '../db';
import { 
  items, 
  subscriptionItems, 
  invoices, 
  payments,
  sspEvidence,
  vsoeEvidence,
  sspPricingBands,
  sspCalculationRuns,
  sspExceptions
} from '../db/schema';
import { eq, and, gte, lte, sql, desc, asc } from 'drizzle-orm';

export class SSPAnalyticsRepository {
  constructor(private database = db) {}

  /**
   * Get transaction data for ML training
   */
  async getMLTrainingData(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ) {
    // Since we don't have a transactions table, we'll use invoice line items
    // as a proxy for transaction data
    const result = await this.database
      .select({
        itemId: items.id,
        itemName: items.name,
        itemType: items.itemType,
        categoryId: items.categoryId,
        quantity: subscriptionItems.quantity,
        unitPrice: subscriptionItems.unitPrice,
        startDate: subscriptionItems.startDate,
        endDate: subscriptionItems.endDate,
        discountPercentage: subscriptionItems.discountPercentage,
        subscriptionId: subscriptionItems.subscriptionId,
        createdAt: subscriptionItems.createdAt
      })
      .from(subscriptionItems)
      .innerJoin(items, eq(items.id, subscriptionItems.itemId))
      .where(
        and(
          eq(subscriptionItems.organizationId, organizationId),
          gte(subscriptionItems.startDate, startDate.toISOString().split('T')[0]),
          lte(subscriptionItems.startDate, endDate.toISOString().split('T')[0])
        )
      );

    return result;
  }

  /**
   * Get aggregated pricing statistics for items
   */
  async getItemPricingStatistics(
    organizationId: string,
    itemIds?: string[]
  ) {
    const conditions = [eq(subscriptionItems.organizationId, organizationId)];
    
    if (itemIds && itemIds.length > 0) {
      conditions.push(sql`${subscriptionItems.itemId} IN (${sql.raw(itemIds.map(id => `'${id}'`).join(','))})`);
    }

    const result = await this.database
      .select({
        itemId: subscriptionItems.itemId,
        avgPrice: sql<number>`AVG(CAST(${subscriptionItems.unitPrice} AS DECIMAL))`,
        minPrice: sql<number>`MIN(CAST(${subscriptionItems.unitPrice} AS DECIMAL))`,
        maxPrice: sql<number>`MAX(CAST(${subscriptionItems.unitPrice} AS DECIMAL))`,
        stdDev: sql<number>`STDDEV(CAST(${subscriptionItems.unitPrice} AS DECIMAL))`,
        transactionCount: sql<number>`COUNT(*)`,
        avgDiscount: sql<number>`AVG(CAST(${subscriptionItems.discountPercentage} AS DECIMAL))`,
        uniqueCustomers: sql<number>`COUNT(DISTINCT ${subscriptionItems.subscriptionId})`
      })
      .from(subscriptionItems)
      .where(and(...conditions))
      .groupBy(subscriptionItems.itemId);

    return result;
  }

  /**
   * Get historical SSP evidence
   */
  async getHistoricalSSPEvidence(
    organizationId: string,
    itemId: string,
    startDate: Date,
    endDate: Date
  ) {
    return await this.database
      .select()
      .from(sspEvidence)
      .where(
        and(
          eq(sspEvidence.organizationId, organizationId),
          eq(sspEvidence.itemId, itemId),
          gte(sspEvidence.evidenceDate, startDate.toISOString().split('T')[0]),
          lte(sspEvidence.evidenceDate, endDate.toISOString().split('T')[0])
        )
      )
      .orderBy(desc(sspEvidence.evidenceDate));
  }

  /**
   * Get VSOE evidence for items
   */
  async getVSOEEvidence(
    organizationId: string,
    itemIds: string[]
  ) {
    return await this.database
      .select()
      .from(vsoeEvidence)
      .where(
        and(
          eq(vsoeEvidence.organizationId, organizationId),
          sql`${vsoeEvidence.itemId} IN (${sql.raw(itemIds.map(id => `'${id}'`).join(','))})`
        )
      )
      .orderBy(desc(vsoeEvidence.validFrom));
  }

  /**
   * Save SSP calculation run
   */
  async createSSPCalculationRun(data: typeof sspCalculationRuns.$inferInsert) {
    const [result] = await this.database
      .insert(sspCalculationRuns)
      .values(data)
      .returning();
    return result;
  }

  /**
   * Save VSOE evidence
   */
  async createVSOEEvidence(data: typeof vsoeEvidence.$inferInsert) {
    const [result] = await this.database
      .insert(vsoeEvidence)
      .values(data)
      .returning();
    return result;
  }

  /**
   * Save SSP pricing band
   */
  async createSSPPricingBand(data: typeof sspPricingBands.$inferInsert) {
    const [result] = await this.database
      .insert(sspPricingBands)
      .values(data)
      .returning();
    return result;
  }

  /**
   * Save SSP exception
   */
  async createSSPException(data: typeof sspExceptions.$inferInsert) {
    const [result] = await this.database
      .insert(sspExceptions)
      .values(data)
      .returning();
    return result;
  }

  /**
   * Get pricing bands for monitoring
   */
  async getPricingBands(
    organizationId: string,
    itemId?: string
  ) {
    const conditions = [eq(sspPricingBands.organizationId, organizationId)];
    
    if (itemId) {
      conditions.push(eq(sspPricingBands.itemId, itemId));
    }

    return await this.database
      .select()
      .from(sspPricingBands)
      .where(and(...conditions))
      .orderBy(desc(sspPricingBands.createdAt));
  }

  /**
   * Get recent exceptions
   */
  async getRecentExceptions(
    organizationId: string,
    limit: number = 100
  ) {
    return await this.database
      .select()
      .from(sspExceptions)
      .where(eq(sspExceptions.organizationId, organizationId))
      .orderBy(desc(sspExceptions.createdAt))
      .limit(limit);
  }

  /**
   * Update calculation run status
   */
  async updateCalculationRunStatus(
    runId: string,
    status: string,
    metadata?: any
  ) {
    const [result] = await this.database
      .update(sspCalculationRuns)
      .set({
        status,
        resultsSummary: metadata,
        updatedAt: new Date()
      })
      .where(eq(sspCalculationRuns.id, runId))
      .returning();
    return result;
  }
}

export const sspAnalyticsRepository = new SSPAnalyticsRepository();