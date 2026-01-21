import { db, Database } from '../db';
import { 
  revenueForecastRuns,
  revenueForecastDetails,
  RevenueForecastRun,
  RevenueForecastDetail,
  NewRevenueForecastRun,
  NewRevenueForecastDetail
} from '../db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

export class RevenueForecastingRepository {
  constructor(private database: Database = db) {}

  /**
   * Create a new forecast run
   */
  async createForecastRun(data: NewRevenueForecastRun): Promise<RevenueForecastRun> {
    const [run] = await this.database
      .insert(revenueForecastRuns)
      .values(data)
      .returning();
    
    return run;
  }

  /**
   * Update forecast run
   */
  async updateForecastRun(
    id: string,
    data: Partial<RevenueForecastRun>
  ): Promise<RevenueForecastRun | null> {
    const [updated] = await this.database
      .update(revenueForecastRuns)
      .set(data)
      .where(eq(revenueForecastRuns.id, id))
      .returning();
    
    return updated || null;
  }

  /**
   * Create forecast details
   */
  async createForecastDetails(
    details: NewRevenueForecastDetail[]
  ): Promise<RevenueForecastDetail[]> {
    if (details.length === 0) return [];
    
    const inserted = await this.database
      .insert(revenueForecastDetails)
      .values(details)
      .returning();
    
    return inserted;
  }

  /**
   * Get forecast run by ID
   */
  async getForecastRun(id: string): Promise<RevenueForecastRun | null> {
    const [run] = await this.database
      .select()
      .from(revenueForecastRuns)
      .where(eq(revenueForecastRuns.id, id))
      .limit(1);
    
    return run || null;
  }

  /**
   * Get forecast details for a run
   */
  async getForecastDetails(forecastRunId: string): Promise<RevenueForecastDetail[]> {
    const details = await this.database
      .select()
      .from(revenueForecastDetails)
      .where(eq(revenueForecastDetails.forecastRunId, forecastRunId))
      .orderBy(revenueForecastDetails.forecastDate);
    
    return details;
  }

  /**
   * Get recent forecast runs for an organization
   */
  async getRecentForecastRuns(
    organizationId: string,
    limit = 10
  ): Promise<RevenueForecastRun[]> {
    const runs = await this.database
      .select()
      .from(revenueForecastRuns)
      .where(eq(revenueForecastRuns.organizationId, organizationId))
      .orderBy(desc(revenueForecastRuns.createdAt))
      .limit(limit);
    
    return runs;
  }

  /**
   * Delete forecast run and its details
   */
  async deleteForecastRun(id: string): Promise<boolean> {
    // Delete details first due to foreign key constraint
    await this.database
      .delete(revenueForecastDetails)
      .where(eq(revenueForecastDetails.forecastRunId, id));
    
    const result = await this.database
      .delete(revenueForecastRuns)
      .where(eq(revenueForecastRuns.id, id));
    
    return true;
  }

  /**
   * Get forecast runs by status
   */
  async getForecastRunsByStatus(
    organizationId: string,
    status: string
  ): Promise<RevenueForecastRun[]> {
    const runs = await this.database
      .select()
      .from(revenueForecastRuns)
      .where(
        and(
          eq(revenueForecastRuns.organizationId, organizationId),
          eq(revenueForecastRuns.status, status)
        )
      );
    
    return runs;
  }

  /**
   * Get forecast runs within date range
   */
  async getForecastRunsInDateRange(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<RevenueForecastRun[]> {
    const runs = await this.database
      .select()
      .from(revenueForecastRuns)
      .where(
        and(
          eq(revenueForecastRuns.organizationId, organizationId),
          gte(revenueForecastRuns.forecastStartDate, startDate.toISOString().split('T')[0]),
          lte(revenueForecastRuns.forecastEndDate, endDate.toISOString().split('T')[0])
        )
      );
    
    return runs;
  }

  /**
   * Get aggregated forecast accuracy metrics
   */
  async getForecastAccuracyMetrics(
    organizationId: string,
    modelType?: string
  ) {
    const conditions = [
      eq(revenueForecastRuns.organizationId, organizationId),
      eq(revenueForecastRuns.status, 'completed')
    ];
    
    if (modelType) {
      conditions.push(eq(revenueForecastRuns.forecastModel, modelType as any));
    }

    const metrics = await this.database
      .select({
        model: revenueForecastRuns.forecastModel,
        avgMape: sql<number>`AVG(CAST(${revenueForecastRuns.mape} AS DECIMAL))`,
        avgRmse: sql<number>`AVG(CAST(${revenueForecastRuns.rmse} AS DECIMAL))`,
        avgR2Score: sql<number>`AVG(CAST(${revenueForecastRuns.r2Score} AS DECIMAL))`,
        count: sql<number>`COUNT(*)`
      })
      .from(revenueForecastRuns)
      .where(and(...conditions))
      .groupBy(revenueForecastRuns.forecastModel);
    
    return metrics;
  }
}