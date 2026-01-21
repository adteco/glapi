import { db, Database } from '../db';
import { 
  scenarioAnalysis,
  ScenarioAnalysis,
  NewScenarioAnalysis
} from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export class ScenarioAnalysisRepository {
  constructor(private database: Database = db) {}

  /**
   * Create a new scenario analysis
   */
  async createScenario(data: NewScenarioAnalysis): Promise<ScenarioAnalysis> {
    const [scenario] = await this.database
      .insert(scenarioAnalysis)
      .values(data)
      .returning();
    
    return scenario;
  }

  /**
   * Update scenario analysis
   */
  async updateScenario(
    id: string,
    data: Partial<ScenarioAnalysis>
  ): Promise<ScenarioAnalysis | null> {
    const [updated] = await this.database
      .update(scenarioAnalysis)
      .set(data)
      .where(eq(scenarioAnalysis.id, id))
      .returning();
    
    return updated || null;
  }

  /**
   * Get scenario by ID
   */
  async getScenario(id: string): Promise<ScenarioAnalysis | null> {
    const [scenario] = await this.database
      .select()
      .from(scenarioAnalysis)
      .where(eq(scenarioAnalysis.id, id))
      .limit(1);
    
    return scenario || null;
  }

  /**
   * Get scenarios by type
   */
  async getScenariosByType(
    organizationId: string,
    scenarioType: string
  ): Promise<ScenarioAnalysis[]> {
    return await this.database
      .select()
      .from(scenarioAnalysis)
      .where(
        and(
          eq(scenarioAnalysis.organizationId, organizationId),
          eq(scenarioAnalysis.scenarioType, scenarioType as any)
        )
      )
      .orderBy(desc(scenarioAnalysis.createdAt));
  }

  /**
   * Get active scenarios
   */
  async getActiveScenarios(
    organizationId: string
  ): Promise<ScenarioAnalysis[]> {
    return await this.database
      .select()
      .from(scenarioAnalysis)
      .where(
        and(
          eq(scenarioAnalysis.organizationId, organizationId),
          eq(scenarioAnalysis.status, 'active')
        )
      )
      .orderBy(desc(scenarioAnalysis.createdAt));
  }

  /**
   * Get recent scenarios
   */
  async getRecentScenarios(
    organizationId: string,
    limit = 10
  ): Promise<ScenarioAnalysis[]> {
    return await this.database
      .select()
      .from(scenarioAnalysis)
      .where(eq(scenarioAnalysis.organizationId, organizationId))
      .orderBy(desc(scenarioAnalysis.createdAt))
      .limit(limit);
  }

  /**
   * Compare scenarios
   */
  async compareScenarios(
    organizationId: string,
    scenarioIds: string[]
  ): Promise<ScenarioAnalysis[]> {
    if (scenarioIds.length === 0) return [];
    
    return await this.database
      .select()
      .from(scenarioAnalysis)
      .where(
        and(
          eq(scenarioAnalysis.organizationId, organizationId),
          sql`${scenarioAnalysis.id} IN (${sql.raw(scenarioIds.map(id => `'${id}'`).join(','))})`
        )
      );
  }

  /**
   * Archive scenario
   */
  async archiveScenario(id: string): Promise<ScenarioAnalysis | null> {
    return await this.updateScenario(id, {
      status: 'archived',
      updatedAt: new Date()
    });
  }

  /**
   * Delete scenario
   */
  async deleteScenario(id: string): Promise<void> {
    await this.database
      .delete(scenarioAnalysis)
      .where(eq(scenarioAnalysis.id, id));
  }

  /**
   * Get scenario statistics
   */
  async getScenarioStatistics(organizationId: string) {
    const stats = await this.database
      .select({
        scenarioType: scenarioAnalysis.scenarioType,
        count: sql<number>`COUNT(*)`,
        avgProjectedRevenue: sql<number>`AVG(CAST(${scenarioAnalysis.projectedRevenue} AS DECIMAL))`,
        avgProjectedCosts: sql<number>`AVG(CAST(${scenarioAnalysis.projectedCosts} AS DECIMAL))`,
        avgProjectedProfit: sql<number>`AVG(CAST(${scenarioAnalysis.projectedProfit} AS DECIMAL))`
      })
      .from(scenarioAnalysis)
      .where(eq(scenarioAnalysis.organizationId, organizationId))
      .groupBy(scenarioAnalysis.scenarioType);
    
    return stats;
  }

  /**
   * Clone scenario
   */
  async cloneScenario(
    scenarioId: string,
    newName: string
  ): Promise<ScenarioAnalysis | null> {
    const original = await this.getScenario(scenarioId);
    if (!original) return null;
    
    const cloned = await this.createScenario({
      organizationId: original.organizationId,
      scenarioName: newName,
      scenarioType: original.scenarioType,
      description: original.description,
      assumptions: original.assumptions,
      variables: original.variables,
      projectedRevenue: original.projectedRevenue,
      projectedCosts: original.projectedCosts,
      projectedProfit: original.projectedProfit,
      revenueImpact: original.revenueImpact,
      cashFlowImpact: original.cashFlowImpact,
      profitabilityImpact: original.profitabilityImpact,
      baselineComparison: original.baselineComparison,
      sensitivityAnalysis: original.sensitivityAnalysis,
      status: 'draft',
      metadata: {
        ...(original.metadata as any || {}),
        clonedFrom: scenarioId,
        clonedAt: new Date().toISOString()
      }
    });
    
    return cloned;
  }
}