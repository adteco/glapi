import { db, Database } from '../db';
import { 
  cohortAnalysis,
  deferredRevenueRollforward,
  CohortAnalysis,
  NewCohortAnalysis,
  DeferredRevenueRollforward,
  NewDeferredRevenueRollforward
} from '../db/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';

export class CohortAnalysisRepository {
  constructor(private database: Database = db) {}

  /**
   * Create a new cohort analysis
   */
  async createCohortAnalysis(data: NewCohortAnalysis): Promise<CohortAnalysis> {
    const [analysis] = await this.database
      .insert(cohortAnalysis)
      .values(data)
      .returning();
    
    return analysis;
  }

  /**
   * Update cohort analysis
   */
  async updateCohortAnalysis(
    id: string,
    data: Partial<CohortAnalysis>
  ): Promise<CohortAnalysis | null> {
    const [updated] = await this.database
      .update(cohortAnalysis)
      .set(data)
      .where(eq(cohortAnalysis.id, id))
      .returning();
    
    return updated || null;
  }

  /**
   * Get cohort analysis by ID
   */
  async getCohortAnalysis(id: string): Promise<CohortAnalysis | null> {
    const [analysis] = await this.database
      .select()
      .from(cohortAnalysis)
      .where(eq(cohortAnalysis.id, id))
      .limit(1);
    
    return analysis || null;
  }

  /**
   * Get analyses by cohort type
   */
  async getByCohorteType(
    organizationId: string,
    cohortType: string
  ): Promise<CohortAnalysis[]> {
    return await this.database
      .select()
      .from(cohortAnalysis)
      .where(
        and(
          eq(cohortAnalysis.organizationId, organizationId),
          eq(cohortAnalysis.cohortType, cohortType as any)
        )
      )
      .orderBy(desc(cohortAnalysis.createdAt));
  }

  /**
   * Get recent cohort analyses
   */
  async getRecentAnalyses(
    organizationId: string,
    limit = 10
  ): Promise<CohortAnalysis[]> {
    return await this.database
      .select()
      .from(cohortAnalysis)
      .where(eq(cohortAnalysis.organizationId, organizationId))
      .orderBy(desc(cohortAnalysis.createdAt))
      .limit(limit);
  }

  /**
   * Create deferred revenue rollforward
   */
  async createRollforward(
    data: NewDeferredRevenueRollforward
  ): Promise<DeferredRevenueRollforward> {
    const [rollforward] = await this.database
      .insert(deferredRevenueRollforward)
      .values(data)
      .returning();
    
    return rollforward;
  }

  /**
   * Update deferred revenue rollforward
   */
  async updateRollforward(
    id: string,
    data: Partial<DeferredRevenueRollforward>
  ): Promise<DeferredRevenueRollforward | null> {
    const [updated] = await this.database
      .update(deferredRevenueRollforward)
      .set(data)
      .where(eq(deferredRevenueRollforward.id, id))
      .returning();
    
    return updated || null;
  }

  /**
   * Get rollforward by period
   */
  async getRollforwardByPeriod(
    organizationId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<DeferredRevenueRollforward | null> {
    const [rollforward] = await this.database
      .select()
      .from(deferredRevenueRollforward)
      .where(
        and(
          eq(deferredRevenueRollforward.organizationId, organizationId),
          eq(deferredRevenueRollforward.periodStart, periodStart),
          eq(deferredRevenueRollforward.periodEnd, periodEnd)
        )
      )
      .limit(1);
    
    return rollforward || null;
  }

  /**
   * Get recent rollforwards
   */
  async getRecentRollforwards(
    organizationId: string,
    limit = 12
  ): Promise<DeferredRevenueRollforward[]> {
    return await this.database
      .select()
      .from(deferredRevenueRollforward)
      .where(eq(deferredRevenueRollforward.organizationId, organizationId))
      .orderBy(desc(deferredRevenueRollforward.periodEnd))
      .limit(limit);
  }

  /**
   * Get rollforwards in date range
   */
  async getRollforwardsInDateRange(
    organizationId: string,
    startDate: string,
    endDate: string
  ): Promise<DeferredRevenueRollforward[]> {
    return await this.database
      .select()
      .from(deferredRevenueRollforward)
      .where(
        and(
          eq(deferredRevenueRollforward.organizationId, organizationId),
          gte(deferredRevenueRollforward.periodStart, startDate),
          lte(deferredRevenueRollforward.periodEnd, endDate)
        )
      )
      .orderBy(deferredRevenueRollforward.periodStart);
  }

  /**
   * Delete old analyses
   */
  async deleteOldAnalyses(
    organizationId: string,
    olderThan: Date
  ): Promise<void> {
    await this.database
      .delete(cohortAnalysis)
      .where(
        and(
          eq(cohortAnalysis.organizationId, organizationId),
          lte(cohortAnalysis.createdAt, olderThan)
        )
      );
  }
}