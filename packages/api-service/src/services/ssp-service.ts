import { BaseService } from './base-service';
import { ServiceContext, ServiceError, PaginatedResult } from '../types';
import {
  db as globalDb,
  type ContextualDatabase,
  sspEvidence,
  items,
  type SSPEvidence,
  type NewSSPEvidence
} from '@glapi/database';
import { eq, and, desc, sql } from 'drizzle-orm';

export interface SSPServiceOptions {
  db?: ContextualDatabase;
}

export interface CreateSSPData {
  organizationId?: string;
  itemId: string;
  evidenceType: 'standalone_sale' | 'competitor_pricing' | 'cost_plus_margin' | 'market_assessment';
  evidenceDate: Date | string;
  sspAmount: number;
  currency?: string;
  evidenceSource?: string;
  confidenceLevel: 'high' | 'medium' | 'low';
}

export interface ListSSPEvidenceInput {
  itemId?: string;
  evidenceType?: 'standalone_sale' | 'competitor_pricing' | 'cost_plus_margin' | 'market_assessment';
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface CurrentSSPResult {
  itemId: string;
  currentSSP: number;
  currency: string;
  evidenceType: string;
  confidenceLevel: string;
  evidenceDate: string;
  evidenceCount: number;
}

export class SSPService extends BaseService {
  private db: ContextualDatabase;

  constructor(context: ServiceContext = {}, options: SSPServiceOptions = {}) {
    super(context);
    // Use contextual db for RLS support, fall back to global (with warning in dev)
    this.db = options.db ?? globalDb;
  }

  async getSSPEvidence(input: ListSSPEvidenceInput = {}): Promise<PaginatedResult<SSPEvidence>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(input);
    
    const conditions = [eq(sspEvidence.organizationId, organizationId)];
    
    if (input.itemId) {
      conditions.push(eq(sspEvidence.itemId, input.itemId));
    }
    
    if (input.evidenceType) {
      conditions.push(eq(sspEvidence.evidenceType, input.evidenceType));
    }
    
    if (input.isActive !== undefined) {
      conditions.push(eq(sspEvidence.isActive, input.isActive));
    }
    
    const whereClause = and(...conditions);
    
    const [data, totalResult] = await Promise.all([
      this.db.select()
        .from(sspEvidence)
        .where(whereClause)
        .orderBy(desc(sspEvidence.evidenceDate), desc(sspEvidence.createdAt))
        .limit(take)
        .offset(skip),
      this.db.select({ count: sql`count(*)::int`.mapWith(Number) })
        .from(sspEvidence)
        .where(whereClause)
    ]);
    
    return this.createPaginatedResult(data, totalResult[0].count, page, limit);
  }

  async createSSPEvidence(data: CreateSSPData): Promise<SSPEvidence> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate item exists
    const [item] = await this.db.select()
      .from(items)
      .where(
        and(
          eq(items.id, data.itemId),
          eq(items.organizationId, organizationId)
        )
      )
      .limit(1);
    
    if (!item) {
      throw new ServiceError('Item not found', 'ITEM_NOT_FOUND', 404);
    }
    
    // Create SSP evidence
    const evidenceToCreate: NewSSPEvidence = {
      organizationId,
      itemId: data.itemId,
      evidenceType: data.evidenceType,
      evidenceDate: typeof data.evidenceDate === 'string' ? data.evidenceDate : data.evidenceDate.toISOString().split('T')[0],
      sspAmount: String(data.sspAmount),
      currency: data.currency || 'USD',
      evidenceSource: data.evidenceSource,
      confidenceLevel: data.confidenceLevel,
      isActive: true
    };
    
    const [created] = await this.db.insert(sspEvidence)
      .values(evidenceToCreate)
      .returning();
    
    // Update SSP calculations for affected contracts
    await this.updateContractSSPAllocations(data.itemId);
    
    return created;
  }

  async getCurrentSSP(itemId: string): Promise<CurrentSSPResult | null> {
    const organizationId = this.requireOrganizationContext();
    
    // Get all active SSP evidence for the item
    const evidenceList = await this.db.select()
      .from(sspEvidence)
      .where(
        and(
          eq(sspEvidence.organizationId, organizationId),
          eq(sspEvidence.itemId, itemId),
          eq(sspEvidence.isActive, true)
        )
      )
      .orderBy(
        // Priority: standalone_sale > competitor_pricing > cost_plus_margin > market_assessment
        sql`
          CASE ${sspEvidence.evidenceType}
            WHEN 'standalone_sale' THEN 1
            WHEN 'competitor_pricing' THEN 2
            WHEN 'cost_plus_margin' THEN 3
            WHEN 'market_assessment' THEN 4
          END
        `,
        desc(sspEvidence.confidenceLevel),
        desc(sspEvidence.evidenceDate)
      );
    
    if (evidenceList.length === 0) {
      return null;
    }
    
    // Apply hierarchy and confidence levels
    const bestEvidence = this.selectBestSSPEvidence(evidenceList);
    
    if (!bestEvidence) {
      return null;
    }
    
    return {
      itemId,
      currentSSP: parseFloat(bestEvidence.sspAmount),
      currency: bestEvidence.currency || 'USD',
      evidenceType: bestEvidence.evidenceType,
      confidenceLevel: bestEvidence.confidenceLevel,
      evidenceDate: bestEvidence.evidenceDate,
      evidenceCount: evidenceList.length
    };
  }

  async updateSSPEvidence(id: string, data: Partial<SSPEvidence>): Promise<SSPEvidence | null> {
    const organizationId = this.requireOrganizationContext();
    
    // Verify evidence exists and belongs to organization
    const [existing] = await this.db.select()
      .from(sspEvidence)
      .where(
        and(
          eq(sspEvidence.id, id),
          eq(sspEvidence.organizationId, organizationId)
        )
      )
      .limit(1);
    
    if (!existing) {
      throw new ServiceError('SSP evidence not found', 'NOT_FOUND', 404);
    }
    
    const [updated] = await this.db.update(sspEvidence)
      .set(data)
      .where(eq(sspEvidence.id, id))
      .returning();
    
    // Update affected contract allocations if SSP amount changed
    if (data.sspAmount && data.sspAmount !== existing.sspAmount) {
      await this.updateContractSSPAllocations(existing.itemId);
    }
    
    return updated || null;
  }

  async deactivateSSPEvidence(id: string): Promise<SSPEvidence | null> {
    const organizationId = this.requireOrganizationContext();
    
    const [existing] = await this.db.select()
      .from(sspEvidence)
      .where(
        and(
          eq(sspEvidence.id, id),
          eq(sspEvidence.organizationId, organizationId)
        )
      )
      .limit(1);
    
    if (!existing) {
      throw new ServiceError('SSP evidence not found', 'NOT_FOUND', 404);
    }
    
    const [updated] = await this.db.update(sspEvidence)
      .set({ isActive: false })
      .where(eq(sspEvidence.id, id))
      .returning();
    
    // Update affected contract allocations
    await this.updateContractSSPAllocations(existing.itemId);
    
    return updated || null;
  }

  async getSSPSummary(itemIds?: string[]): Promise<any> {
    const organizationId = this.requireOrganizationContext();
    
    const conditions = [
      eq(sspEvidence.organizationId, organizationId),
      eq(sspEvidence.isActive, true)
    ];
    
    if (itemIds && itemIds.length > 0) {
      conditions.push(sql`${sspEvidence.itemId} = ANY(${itemIds})`);
    }
    
    const summary = await this.db.select({
      itemId: sspEvidence.itemId,
      evidenceCount: sql`count(*)::int`.mapWith(Number),
      avgSSP: sql`avg(${sspEvidence.sspAmount})::text`.mapWith(String),
      minSSP: sql`min(${sspEvidence.sspAmount})::text`.mapWith(String),
      maxSSP: sql`max(${sspEvidence.sspAmount})::text`.mapWith(String),
      latestEvidenceDate: sql`max(${sspEvidence.evidenceDate})`.mapWith(String)
    })
      .from(sspEvidence)
      .where(and(...conditions))
      .groupBy(sspEvidence.itemId);
    
    return summary.map(s => ({
      itemId: s.itemId,
      evidenceCount: s.evidenceCount,
      averageSSP: parseFloat(s.avgSSP),
      minSSP: parseFloat(s.minSSP),
      maxSSP: parseFloat(s.maxSSP),
      latestEvidenceDate: s.latestEvidenceDate,
      currency: 'USD'
    }));
  }

  async calculateSSPRange(itemId: string): Promise<any> {
    const organizationId = this.requireOrganizationContext();
    
    // Get all active evidence
    const evidence = await this.db.select()
      .from(sspEvidence)
      .where(
        and(
          eq(sspEvidence.organizationId, organizationId),
          eq(sspEvidence.itemId, itemId),
          eq(sspEvidence.isActive, true)
        )
      );
    
    if (evidence.length === 0) {
      return null;
    }
    
    // Calculate statistical range
    const amounts = evidence.map(e => parseFloat(e.sspAmount));
    const mean = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
    const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      itemId,
      mean,
      median: this.calculateMedian(amounts),
      standardDeviation: stdDev,
      lowerBound: Math.max(0, mean - stdDev),
      upperBound: mean + stdDev,
      confidenceLevel: this.calculateConfidenceLevel(evidence),
      dataPoints: evidence.length
    };
  }

  // Private helper methods
  private selectBestSSPEvidence(evidenceList: SSPEvidence[]): SSPEvidence | null {
    if (evidenceList.length === 0) return null;
    
    // Group by evidence type
    const byType: Record<string, SSPEvidence[]> = {};
    for (const evidence of evidenceList) {
      if (!byType[evidence.evidenceType]) {
        byType[evidence.evidenceType] = [];
      }
      byType[evidence.evidenceType].push(evidence);
    }
    
    // Priority order
    const priorityOrder = ['standalone_sale', 'competitor_pricing', 'cost_plus_margin', 'market_assessment'];
    
    for (const type of priorityOrder) {
      if (byType[type] && byType[type].length > 0) {
        // Within type, prefer higher confidence and more recent
        const sorted = byType[type].sort((a, b) => {
          // First by confidence level
          const confOrder = { high: 3, medium: 2, low: 1 };
          const confDiff = (confOrder[b.confidenceLevel] || 0) - (confOrder[a.confidenceLevel] || 0);
          if (confDiff !== 0) return confDiff;
          
          // Then by date
          return new Date(b.evidenceDate).getTime() - new Date(a.evidenceDate).getTime();
        });
        
        return sorted[0];
      }
    }
    
    return evidenceList[0];
  }

  private async updateContractSSPAllocations(itemId: string): Promise<void> {
    // TODO: Implement contract SSP allocation updates
    // This would recalculate SSP allocations for all active contracts
    // that include this item
    console.log(`Updating SSP allocations for contracts with item ${itemId}`);
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = values.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    
    return sorted[mid];
  }

  private calculateConfidenceLevel(evidence: SSPEvidence[]): string {
    if (evidence.length === 0) return 'low';
    
    // Calculate weighted confidence based on evidence types and counts
    const typeWeights = {
      standalone_sale: 1.0,
      competitor_pricing: 0.8,
      cost_plus_margin: 0.6,
      market_assessment: 0.4
    };
    
    const confWeights = {
      high: 1.0,
      medium: 0.6,
      low: 0.3
    };
    
    let totalWeight = 0;
    let weightedScore = 0;
    
    for (const e of evidence) {
      const typeWeight = typeWeights[e.evidenceType] || 0.5;
      const confWeight = confWeights[e.confidenceLevel] || 0.5;
      const weight = typeWeight * confWeight;
      
      totalWeight += weight;
      weightedScore += weight;
    }
    
    const averageScore = totalWeight > 0 ? weightedScore / evidence.length : 0;
    
    if (averageScore >= 0.7) return 'high';
    if (averageScore >= 0.4) return 'medium';
    return 'low';
  }
}