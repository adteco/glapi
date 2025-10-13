import { db } from '../db';
import { 
  churnPredictions,
  ChurnPrediction,
  NewChurnPrediction
} from '../db/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';

export class ChurnPredictionRepository {
  constructor(private database = db) {}

  /**
   * Create a new churn prediction
   */
  async createChurnPrediction(data: NewChurnPrediction): Promise<ChurnPrediction> {
    const [prediction] = await this.database
      .insert(churnPredictions)
      .values(data)
      .returning();
    
    return prediction;
  }

  /**
   * Update a churn prediction
   */
  async updateChurnPrediction(
    id: string,
    data: Partial<ChurnPrediction>
  ): Promise<ChurnPrediction | null> {
    const [updated] = await this.database
      .update(churnPredictions)
      .set(data)
      .where(eq(churnPredictions.id, id))
      .returning();
    
    return updated || null;
  }

  /**
   * Get churn prediction by subscription ID
   */
  async getBySubscriptionId(
    subscriptionId: string,
    organizationId: string
  ): Promise<ChurnPrediction | null> {
    const [prediction] = await this.database
      .select()
      .from(churnPredictions)
      .where(
        and(
          eq(churnPredictions.subscriptionId, subscriptionId),
          eq(churnPredictions.organizationId, organizationId)
        )
      )
      .orderBy(desc(churnPredictions.createdAt))
      .limit(1);
    
    return prediction || null;
  }

  /**
   * Get predictions by risk level
   */
  async getByRiskLevel(
    organizationId: string,
    riskLevel: string
  ): Promise<ChurnPrediction[]> {
    return await this.database
      .select()
      .from(churnPredictions)
      .where(
        and(
          eq(churnPredictions.organizationId, organizationId),
          eq(churnPredictions.riskLevel, riskLevel as any)
        )
      )
      .orderBy(desc(churnPredictions.churnProbability));
  }

  /**
   * Get recent predictions
   */
  async getRecentPredictions(
    organizationId: string,
    limit = 100
  ): Promise<ChurnPrediction[]> {
    return await this.database
      .select()
      .from(churnPredictions)
      .where(eq(churnPredictions.organizationId, organizationId))
      .orderBy(desc(churnPredictions.createdAt))
      .limit(limit);
  }

  /**
   * Get predictions within date range
   */
  async getPredictionsInDateRange(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ChurnPrediction[]> {
    return await this.database
      .select()
      .from(churnPredictions)
      .where(
        and(
          eq(churnPredictions.organizationId, organizationId),
          gte(churnPredictions.createdAt, startDate),
          lte(churnPredictions.createdAt, endDate)
        )
      );
  }

  /**
   * Delete old predictions
   */
  async deleteOldPredictions(
    organizationId: string,
    olderThan: Date
  ): Promise<void> {
    await this.database
      .delete(churnPredictions)
      .where(
        and(
          eq(churnPredictions.organizationId, organizationId),
          lte(churnPredictions.createdAt, olderThan)
        )
      );
  }
}