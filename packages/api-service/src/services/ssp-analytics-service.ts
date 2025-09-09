import { Database } from '@glapi/database';
import { 
  sspCalculationRuns,
  vsoeEvidence,
  sspPricingBands,
  sspExceptions,
  SSPCalculationRun,
  VSOEEvidence,
  SSPPricingBand,
  SSPException,
  NewSSPCalculationRun,
  RunStatus,
  CalculationMethods
} from '@glapi/database/schema';
import { eq, and, desc, gte, lte, inArray, sql } from 'drizzle-orm';
import { SSPAnalyticsEngine } from '@glapi/business/services/ssp-analytics-engine';
import { SSPExceptionMonitor } from '@glapi/business/services/ssp-exception-monitor';
import { SSPMLTrainingService } from '@glapi/business/services/ssp-ml-training-service';
import { createId } from '@paralleldrive/cuid2';

export interface SSPAnalyticsRunConfig {
  organizationId: string;
  startDate: string;
  endDate: string;
  calculationMethod: typeof CalculationMethods[keyof typeof CalculationMethods];
  minTransactions?: number;
  confidenceThreshold?: number;
  runType?: 'scheduled' | 'manual' | 'triggered';
}

export interface SSPAnalyticsResult {
  runId: string;
  status: string;
  itemsProcessed: number;
  itemsWithVSOE: number;
  itemsWithStatistical: number;
  itemsWithML: number;
  exceptions: number;
  processingTime: number;
}

export interface SSPItemAnalysis {
  itemId: string;
  itemName: string;
  vsoeEvidence?: VSOEEvidence;
  pricingBand?: SSPPricingBand;
  recommendedSSP: string;
  recommendationMethod: string;
  confidence: string;
  exceptions: SSPException[];
  lastUpdated: Date;
}

export interface SSPDashboardData {
  summary: {
    totalItems: number;
    itemsWithSSP: number;
    itemsNeedingReview: number;
    averageConfidence: number;
    lastRunDate: Date | null;
  };
  methodBreakdown: {
    vsoe: number;
    statistical: number;
    ml: number;
    manual: number;
  };
  recentRuns: SSPCalculationRun[];
  topExceptions: Array<{
    itemId: string;
    itemName: string;
    exceptionCount: number;
    severity: string;
  }>;
  trends: {
    date: string;
    itemsProcessed: number;
    averageConfidence: number;
  }[];
}

export class SSPAnalyticsService {
  private db: Database;
  private analyticsEngine: SSPAnalyticsEngine;
  private exceptionMonitor: SSPExceptionMonitor;
  private mlService: SSPMLTrainingService;

  constructor(db: Database) {
    this.db = db;
    this.analyticsEngine = new SSPAnalyticsEngine(db);
    this.exceptionMonitor = new SSPExceptionMonitor(db);
    this.mlService = new SSPMLTrainingService(db);
  }

  /**
   * Start a new SSP calculation run
   */
  async startCalculationRun(config: SSPAnalyticsRunConfig): Promise<SSPAnalyticsResult> {
    const runId = createId();
    const runNumber = await this.generateRunNumber(config.organizationId);
    const startTime = Date.now();

    try {
      // Create calculation run record
      await this.db.insert(sspCalculationRuns).values({
        id: runId,
        organizationId: config.organizationId,
        runNumber,
        runType: config.runType || 'manual',
        runDate: new Date(),
        calculationMethod: config.calculationMethod,
        startDate: config.startDate,
        endDate: config.endDate,
        minTransactions: config.minTransactions || 5,
        confidenceThreshold: config.confidenceThreshold?.toString() || '0.8000',
        status: RunStatus.RUNNING,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Run SSP calculations
      const results = await this.analyticsEngine.calculateSSP(
        config.organizationId,
        config.startDate,
        config.endDate,
        {
          calculationRunId: runId,
          minTransactions: config.minTransactions || 5,
          confidenceThreshold: config.confidenceThreshold || 0.8,
          method: config.calculationMethod
        }
      );

      // Detect and record exceptions
      const exceptions = await this.exceptionMonitor.detectExceptions(
        config.organizationId,
        runId
      );

      // Update run statistics
      const processingTime = Date.now() - startTime;
      await this.updateRunStatistics(runId, results, exceptions.length, processingTime);

      // Auto-resolve previous exceptions if applicable
      await this.exceptionMonitor.autoResolveExceptions(config.organizationId, runId);

      return {
        runId,
        status: RunStatus.COMPLETED,
        itemsProcessed: results.itemsProcessed,
        itemsWithVSOE: results.vsoeCount,
        itemsWithStatistical: results.statisticalCount,
        itemsWithML: results.mlCount,
        exceptions: exceptions.length,
        processingTime
      };
    } catch (error) {
      // Mark run as failed
      await this.db.update(sspCalculationRuns)
        .set({
          status: RunStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date()
        })
        .where(eq(sspCalculationRuns.id, runId));

      throw error;
    }
  }

  /**
   * Get SSP analysis for a specific item
   */
  async getItemAnalysis(
    organizationId: string,
    itemId: string
  ): Promise<SSPItemAnalysis | null> {
    // Get latest VSOE evidence
    const vsoe = await this.db.select()
      .from(vsoeEvidence)
      .where(and(
        eq(vsoeEvidence.organizationId, organizationId),
        eq(vsoeEvidence.itemId, itemId)
      ))
      .orderBy(desc(vsoeEvidence.createdAt))
      .limit(1);

    // Get latest pricing band
    const pricingBand = await this.db.select()
      .from(sspPricingBands)
      .where(and(
        eq(sspPricingBands.organizationId, organizationId),
        eq(sspPricingBands.itemId, itemId)
      ))
      .orderBy(desc(sspPricingBands.createdAt))
      .limit(1);

    // Get open exceptions
    const exceptions = await this.db.select()
      .from(sspExceptions)
      .where(and(
        eq(sspExceptions.organizationId, organizationId),
        eq(sspExceptions.itemId, itemId),
        inArray(sspExceptions.status, ['open', 'acknowledged'])
      ));

    if (!vsoe[0] && !pricingBand[0]) {
      return null;
    }

    // Determine recommended SSP and method
    let recommendedSSP: string;
    let recommendationMethod: string;
    let confidence: string;

    if (vsoe[0]?.meetsVSOECriteria) {
      recommendedSSP = vsoe[0].vsoePrice || '0';
      recommendationMethod = 'VSOE';
      confidence = vsoe[0].vsoeConfidence;
    } else if (pricingBand[0]) {
      recommendedSSP = pricingBand[0].recommendedSSP;
      recommendationMethod = pricingBand[0].recommendationMethod;
      confidence = pricingBand[0].recommendationConfidence;
    } else {
      recommendedSSP = '0';
      recommendationMethod = 'None';
      confidence = '0';
    }

    return {
      itemId,
      itemName: `Item ${itemId}`, // Would need to join with items table
      vsoeEvidence: vsoe[0] || undefined,
      pricingBand: pricingBand[0] || undefined,
      recommendedSSP,
      recommendationMethod,
      confidence,
      exceptions,
      lastUpdated: vsoe[0]?.updatedAt || pricingBand[0]?.updatedAt || new Date()
    };
  }

  /**
   * Get SSP dashboard data
   */
  async getDashboardData(organizationId: string): Promise<SSPDashboardData> {
    // Get summary statistics
    const summary = await this.getSummaryStatistics(organizationId);

    // Get method breakdown
    const methodBreakdown = await this.getMethodBreakdown(organizationId);

    // Get recent runs
    const recentRuns = await this.db.select()
      .from(sspCalculationRuns)
      .where(eq(sspCalculationRuns.organizationId, organizationId))
      .orderBy(desc(sspCalculationRuns.runDate))
      .limit(10);

    // Get top exceptions
    const topExceptions = await this.getTopExceptions(organizationId);

    // Get trends
    const trends = await this.getTrends(organizationId, 30);

    return {
      summary,
      methodBreakdown,
      recentRuns,
      topExceptions,
      trends
    };
  }

  /**
   * Approve a calculation run
   */
  async approveRun(
    runId: string,
    approvedBy: string
  ): Promise<SSPCalculationRun> {
    const [updated] = await this.db.update(sspCalculationRuns)
      .set({
        status: RunStatus.APPROVED,
        approvedBy,
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(sspCalculationRuns.id, runId))
      .returning();

    return updated;
  }

  /**
   * Train ML model for SSP prediction
   */
  async trainMLModel(
    organizationId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ modelId: string; accuracy: number }> {
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      return d.toISOString().split('T')[0];
    })();

    const result = await this.mlService.trainModel(organizationId, start, end);

    return {
      modelId: result.modelId,
      accuracy: result.metrics.accuracy
    };
  }

  /**
   * Get ML predictions for items
   */
  async getMLPredictions(
    organizationId: string,
    itemIds: string[]
  ): Promise<Array<{
    itemId: string;
    predictedSSP: number;
    confidence: number;
    predictionInterval: { lower: number; upper: number };
  }>> {
    return await this.mlService.predictSSP(organizationId, itemIds);
  }

  /**
   * Schedule automated SSP calculation runs
   */
  async scheduleAutomatedRun(
    organizationId: string,
    schedule: 'daily' | 'weekly' | 'monthly'
  ): Promise<void> {
    // This would integrate with a job scheduler like Bull or node-cron
    // For now, just creating a placeholder
    console.log(`Scheduling ${schedule} SSP calculation for organization ${organizationId}`);
  }

  /**
   * Export SSP data for reporting
   */
  async exportSSPData(
    organizationId: string,
    format: 'csv' | 'json' | 'excel'
  ): Promise<Buffer> {
    // Get all current SSP data
    const data = await this.getAllSSPData(organizationId);

    switch (format) {
      case 'csv':
        return this.exportToCSV(data);
      case 'json':
        return Buffer.from(JSON.stringify(data, null, 2));
      case 'excel':
        return this.exportToExcel(data);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Private helper methods
   */

  private async generateRunNumber(organizationId: string): Promise<string> {
    const today = new Date();
    const prefix = `SSP-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    
    const lastRun = await this.db.select({ runNumber: sspCalculationRuns.runNumber })
      .from(sspCalculationRuns)
      .where(and(
        eq(sspCalculationRuns.organizationId, organizationId),
        sql`${sspCalculationRuns.runNumber} LIKE ${prefix + '%'}`
      ))
      .orderBy(desc(sspCalculationRuns.runNumber))
      .limit(1);

    if (lastRun.length === 0) {
      return `${prefix}-001`;
    }

    const lastNumber = parseInt(lastRun[0].runNumber.split('-').pop() || '0');
    return `${prefix}-${(lastNumber + 1).toString().padStart(3, '0')}`;
  }

  private async updateRunStatistics(
    runId: string,
    results: any,
    exceptionCount: number,
    processingTime: number
  ): Promise<void> {
    await this.db.update(sspCalculationRuns)
      .set({
        itemsProcessed: results.itemsProcessed,
        itemsWithVSOE: results.vsoeCount,
        itemsWithStatistical: results.statisticalCount,
        itemsWithML: results.mlCount,
        itemsWithExceptions: exceptionCount,
        processingDuration: processingTime,
        dataPointsAnalyzed: results.totalDataPoints,
        status: RunStatus.COMPLETED,
        completedAt: new Date(),
        resultsSummary: {
          totalItems: results.itemsProcessed,
          methodBreakdown: {
            vsoe: results.vsoeCount,
            statistical: results.statisticalCount,
            ml: results.mlCount
          },
          averageConfidence: results.averageConfidence,
          exceptions: exceptionCount
        },
        updatedAt: new Date()
      })
      .where(eq(sspCalculationRuns.id, runId));
  }

  private async getSummaryStatistics(organizationId: string): Promise<any> {
    const stats = await this.db.select({
      totalItems: sql<number>`COUNT(DISTINCT ${sspPricingBands.itemId})`,
      itemsWithSSP: sql<number>`COUNT(DISTINCT CASE WHEN ${sspPricingBands.recommendedSSP} > 0 THEN ${sspPricingBands.itemId} END)`,
      averageConfidence: sql<number>`AVG(${sspPricingBands.recommendationConfidence}::numeric)`
    })
    .from(sspPricingBands)
    .where(eq(sspPricingBands.organizationId, organizationId))
    .execute();

    const openExceptions = await this.db.select({
      count: sql<number>`COUNT(*)`
    })
    .from(sspExceptions)
    .where(and(
      eq(sspExceptions.organizationId, organizationId),
      eq(sspExceptions.status, 'open')
    ))
    .execute();

    const lastRun = await this.db.select({ runDate: sspCalculationRuns.runDate })
      .from(sspCalculationRuns)
      .where(and(
        eq(sspCalculationRuns.organizationId, organizationId),
        eq(sspCalculationRuns.status, RunStatus.COMPLETED)
      ))
      .orderBy(desc(sspCalculationRuns.runDate))
      .limit(1);

    return {
      totalItems: stats[0]?.totalItems || 0,
      itemsWithSSP: stats[0]?.itemsWithSSP || 0,
      itemsNeedingReview: openExceptions[0]?.count || 0,
      averageConfidence: stats[0]?.averageConfidence || 0,
      lastRunDate: lastRun[0]?.runDate || null
    };
  }

  private async getMethodBreakdown(organizationId: string): Promise<any> {
    const breakdown = await this.db.select({
      method: sspPricingBands.recommendationMethod,
      count: sql<number>`COUNT(DISTINCT ${sspPricingBands.itemId})`
    })
    .from(sspPricingBands)
    .where(eq(sspPricingBands.organizationId, organizationId))
    .groupBy(sspPricingBands.recommendationMethod)
    .execute();

    const result = {
      vsoe: 0,
      statistical: 0,
      ml: 0,
      manual: 0
    };

    breakdown.forEach(row => {
      const method = row.method.toLowerCase();
      if (method.includes('vsoe')) result.vsoe = row.count;
      else if (method.includes('statistical') || method.includes('median') || method.includes('trimmed')) result.statistical = row.count;
      else if (method.includes('ml') || method.includes('predicted')) result.ml = row.count;
      else result.manual = row.count;
    });

    return result;
  }

  private async getTopExceptions(organizationId: string): Promise<any[]> {
    const exceptions = await this.db.select({
      itemId: sspExceptions.itemId,
      exceptionCount: sql<number>`COUNT(*)`,
      severity: sql<string>`MAX(${sspExceptions.severity})`
    })
    .from(sspExceptions)
    .where(and(
      eq(sspExceptions.organizationId, organizationId),
      eq(sspExceptions.status, 'open')
    ))
    .groupBy(sspExceptions.itemId)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(10)
    .execute();

    return exceptions.map(e => ({
      itemId: e.itemId,
      itemName: `Item ${e.itemId}`, // Would need to join with items
      exceptionCount: e.exceptionCount,
      severity: e.severity
    }));
  }

  private async getTrends(organizationId: string, days: number): Promise<any[]> {
    const trends = await this.db.select({
      date: sql<string>`DATE(${sspCalculationRuns.runDate})`,
      itemsProcessed: sspCalculationRuns.itemsProcessed,
      averageConfidence: sql<number>`
        (${sspCalculationRuns.itemsWithVSOE} * 0.95 + 
         ${sspCalculationRuns.itemsWithStatistical} * 0.85 + 
         ${sspCalculationRuns.itemsWithML} * 0.75) / 
        NULLIF(${sspCalculationRuns.itemsProcessed}, 0)
      `
    })
    .from(sspCalculationRuns)
    .where(and(
      eq(sspCalculationRuns.organizationId, organizationId),
      eq(sspCalculationRuns.status, RunStatus.COMPLETED),
      gte(sspCalculationRuns.runDate, sql`CURRENT_DATE - INTERVAL '${days} days'`)
    ))
    .orderBy(sspCalculationRuns.runDate)
    .execute();

    return trends.map(t => ({
      date: t.date,
      itemsProcessed: t.itemsProcessed,
      averageConfidence: t.averageConfidence || 0
    }));
  }

  private async getAllSSPData(organizationId: string): Promise<any[]> {
    return await this.db.select({
      itemId: sspPricingBands.itemId,
      recommendedSSP: sspPricingBands.recommendedSSP,
      method: sspPricingBands.recommendationMethod,
      confidence: sspPricingBands.recommendationConfidence,
      p5Price: sspPricingBands.p5Price,
      p25Price: sspPricingBands.p25Price,
      p50Price: sspPricingBands.p50Price,
      p75Price: sspPricingBands.p75Price,
      p95Price: sspPricingBands.p95Price,
      outlierCount: sspPricingBands.outlierCount,
      hasSeasonality: sspPricingBands.hasSeasonality,
      trendDirection: sspPricingBands.trendDirection,
      createdAt: sspPricingBands.createdAt
    })
    .from(sspPricingBands)
    .where(eq(sspPricingBands.organizationId, organizationId))
    .execute();
  }

  private exportToCSV(data: any[]): Buffer {
    if (data.length === 0) return Buffer.from('');

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
          return value.toString();
        }).join(',')
      )
    ].join('\n');

    return Buffer.from(csv);
  }

  private exportToExcel(data: any[]): Buffer {
    // This would use a library like xlsx or exceljs
    // For now, returning CSV as placeholder
    return this.exportToCSV(data);
  }
}