/**
 * SSP Analytics Engine
 * Advanced Standalone Selling Price calculation with VSOE, statistical analysis, and ML
 */

import { v4 as uuidv4 } from 'uuid';
import {
  sspCalculationRuns,
  vsoeEvidence,
  sspPricingBands,
  sspExceptions,
  sspEvidence,
  items,
  subscriptionItems,
  subscriptions,
  CalculationMethods,
  ExceptionTypes,
  ExceptionSeverity,
  RunStatus,
  type NewSSPCalculationRun,
  type NewVSOEEvidence,
  type NewSSPPricingBand,
  type NewSSPException
} from '@glapi/database';
import { eq, and, gte, lte, sql, desc, ne, isNull } from 'drizzle-orm';
import * as stats from 'simple-statistics';

export interface SSPCalculationOptions {
  startDate: Date;
  endDate: Date;
  method?: 'vsoe' | 'statistical' | 'ml' | 'hybrid';
  minTransactions?: number;
  confidenceThreshold?: number;
  includeOutliers?: boolean;
  itemIds?: string[];
}

export interface SSPCalculationResult {
  runId: string;
  itemsProcessed: number;
  vsoeResults: VSOEAnalysisResult[];
  statisticalResults: StatisticalAnalysisResult[];
  mlResults?: MLPredictionResult[];
  exceptions: SSPExceptionDetail[];
  summary: SSPSummary;
}

export interface VSOEAnalysisResult {
  itemId: string;
  meetsVSOE: boolean;
  vsoePrice?: number;
  confidence: number;
  standalonePercentage: number;
  coefficientOfVariation: number;
  reason?: string;
}

export interface StatisticalAnalysisResult {
  itemId: string;
  recommendedSSP: number;
  method: string;
  confidence: number;
  pricingBands: PricingBands;
  outliers: OutlierAnalysis;
  seasonality?: SeasonalityAnalysis;
}

export interface MLPredictionResult {
  itemId: string;
  predictedSSP: number;
  confidence: number;
  features: Record<string, number>;
  modelVersion: string;
}

export interface PricingBands {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  iqr: number;
  lowerFence: number;
  upperFence: number;
}

export interface OutlierAnalysis {
  count: number;
  percentage: number;
  outlierIds: string[];
  method: string;
}

export interface SeasonalityAnalysis {
  hasSeasonality: boolean;
  pattern?: Record<string, number>;
  trendDirection?: 'increasing' | 'decreasing' | 'stable';
  trendStrength?: number;
}

export interface SSPExceptionDetail {
  itemId: string;
  type: string;
  severity: string;
  message: string;
  details?: any;
}

export interface SSPSummary {
  totalItems: number;
  vsoeCompliant: number;
  statisticallyDerived: number;
  mlPredicted: number;
  exceptionsCount: number;
  averageConfidence: number;
}

export class SSPAnalyticsEngine {
  private runId: string = '';
  
  constructor(
    private db: any,
    private organizationId: string
  ) {}

  /**
   * Execute SSP calculation run
   */
  async calculateSSP(options: SSPCalculationOptions): Promise<SSPCalculationResult> {
    const startTime = Date.now();
    
    // Create calculation run record
    this.runId = await this.createCalculationRun(options);
    
    const result: SSPCalculationResult = {
      runId: this.runId,
      itemsProcessed: 0,
      vsoeResults: [],
      statisticalResults: [],
      mlResults: [],
      exceptions: [],
      summary: {
        totalItems: 0,
        vsoeCompliant: 0,
        statisticallyDerived: 0,
        mlPredicted: 0,
        exceptionsCount: 0,
        averageConfidence: 0
      }
    };

    try {
      // Get items to process
      const itemsToProcess = await this.getItemsToProcess(options.itemIds);
      result.summary.totalItems = itemsToProcess.length;

      // Process each item
      for (const item of itemsToProcess) {
        try {
          // Get transaction data for the item
          const transactions = await this.getItemTransactions(
            item.id,
            options.startDate,
            options.endDate
          );

          if (transactions.length < (options.minTransactions || 5)) {
            result.exceptions.push({
              itemId: item.id,
              type: ExceptionTypes.INSUFFICIENT_DATA,
              severity: ExceptionSeverity.WARNING,
              message: `Only ${transactions.length} transactions found`,
              details: { minRequired: options.minTransactions || 5 }
            });
            continue;
          }

          // Run VSOE analysis
          if (options.method === 'vsoe' || options.method === 'hybrid') {
            const vsoeResult = await this.analyzeVSOE(item.id, transactions);
            result.vsoeResults.push(vsoeResult);
            
            if (vsoeResult.meetsVSOE) {
              result.summary.vsoeCompliant++;
            }
          }

          // Run statistical analysis
          if (options.method === 'statistical' || options.method === 'hybrid') {
            const statResult = await this.analyzeStatistical(
              item.id,
              transactions,
              options.includeOutliers
            );
            result.statisticalResults.push(statResult);
            result.summary.statisticallyDerived++;
          }

          // Run ML prediction if enabled
          if (options.method === 'ml' || options.method === 'hybrid') {
            const mlResult = await this.predictWithML(item.id, transactions);
            if (mlResult) {
              result.mlResults?.push(mlResult);
              result.summary.mlPredicted++;
            }
          }

          result.itemsProcessed++;

        } catch (itemError) {
          result.exceptions.push({
            itemId: item.id,
            type: ExceptionTypes.OUTLIER,
            severity: ExceptionSeverity.WARNING,
            message: `Processing failed: ${(itemError as Error).message}`,
            details: { error: itemError }
          });
        }
      }

      // Calculate average confidence
      const allConfidences = [
        ...result.vsoeResults.map(r => r.confidence),
        ...result.statisticalResults.map(r => r.confidence),
        ...(result.mlResults?.map(r => r.confidence) || [])
      ];
      
      if (allConfidences.length > 0) {
        result.summary.averageConfidence = stats.mean(allConfidences);
      }

      // Store exceptions
      await this.storeExceptions(result.exceptions);

      // Update run status
      await this.updateRunStatus(
        this.runId,
        RunStatus.COMPLETED,
        result.summary,
        Date.now() - startTime
      );

    } catch (error) {
      await this.updateRunStatus(
        this.runId,
        RunStatus.FAILED,
        null,
        Date.now() - startTime,
        (error as Error).message
      );
      throw error;
    }

    return result;
  }

  /**
   * Analyze VSOE compliance
   */
  private async analyzeVSOE(
    itemId: string,
    transactions: any[]
  ): Promise<VSOEAnalysisResult> {
    // Separate standalone and bundled transactions
    const standaloneTransactions = transactions.filter(t => t.isStandalone);
    const standalonePercentage = (standaloneTransactions.length / transactions.length) * 100;
    
    // Extract prices
    const prices = standaloneTransactions.map(t => parseFloat(t.unitPrice));
    
    if (prices.length === 0) {
      return {
        itemId,
        meetsVSOE: false,
        confidence: 0,
        standalonePercentage: 0,
        coefficientOfVariation: 0,
        reason: 'No standalone transactions'
      };
    }

    // Calculate statistics
    const mean = stats.mean(prices);
    const stdDev = stats.standardDeviation(prices);
    const cv = stdDev / mean;
    
    // VSOE criteria: 80% standalone sales with CV < 0.15
    const meetsVSOE = standalonePercentage >= 80 && cv < 0.15;
    
    // Calculate confidence based on sample size and variability
    const confidence = this.calculateVSOEConfidence(
      standaloneTransactions.length,
      cv,
      standalonePercentage
    );

    // Store VSOE evidence
    const evidence: NewVSOEEvidence = {
      id: uuidv4(),
      organizationId: this.organizationId,
      itemId,
      calculationRunId: this.runId,
      analysisStartDate: transactions[0].transactionDate,
      analysisEndDate: transactions[transactions.length - 1].transactionDate,
      standaloneTransactions: standaloneTransactions.length,
      totalTransactions: transactions.length,
      standalonePercentage: standalonePercentage.toString(),
      minPrice: Math.min(...prices).toString(),
      maxPrice: Math.max(...prices).toString(),
      meanPrice: mean.toString(),
      medianPrice: stats.median(prices).toString(),
      standardDeviation: stdDev.toString(),
      coefficientOfVariation: cv.toString(),
      meetsVSOECriteria: meetsVSOE,
      vsoePrice: meetsVSOE ? mean.toString() : null,
      vsoeConfidence: confidence.toString(),
      failureReason: !meetsVSOE ? 
        (standalonePercentage < 80 ? 'insufficient_standalone' : 'high_variability') : null,
      normalityTest: this.performNormalityTest(prices),
      outlierAnalysis: this.detectOutliers(prices),
      validFrom: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.insert(vsoeEvidence).values(evidence);

    return {
      itemId,
      meetsVSOE,
      vsoePrice: meetsVSOE ? mean : undefined,
      confidence,
      standalonePercentage,
      coefficientOfVariation: cv,
      reason: evidence.failureReason || undefined
    };
  }

  /**
   * Perform statistical analysis
   */
  private async analyzeStatistical(
    itemId: string,
    transactions: any[],
    includeOutliers?: boolean
  ): Promise<StatisticalAnalysisResult> {
    let prices = transactions.map(t => parseFloat(t.unitPrice));
    
    // Detect outliers
    const outlierAnalysis = this.detectOutliers(prices);
    
    // Remove outliers if requested
    if (!includeOutliers && outlierAnalysis.outlierIndices.length > 0) {
      prices = prices.filter((_, idx) => !outlierAnalysis.outlierIndices.includes(idx));
    }

    // Calculate pricing bands
    const pricingBands = this.calculatePricingBands(prices);
    
    // Analyze seasonality
    const seasonality = this.analyzeSeasonality(transactions);
    
    // Determine recommended SSP
    const recommendedSSP = this.determineRecommendedSSP(prices, pricingBands, seasonality);
    
    // Calculate confidence
    const confidence = this.calculateStatisticalConfidence(
      prices.length,
      pricingBands,
      outlierAnalysis
    );

    // Store pricing bands
    const band: NewSSPPricingBand = {
      id: uuidv4(),
      organizationId: this.organizationId,
      itemId,
      calculationRunId: this.runId,
      periodStartDate: transactions[0].transactionDate,
      periodEndDate: transactions[transactions.length - 1].transactionDate,
      p5Price: pricingBands.p5.toString(),
      p25Price: pricingBands.p25.toString(),
      p50Price: pricingBands.p50.toString(),
      p75Price: pricingBands.p75.toString(),
      p95Price: pricingBands.p95.toString(),
      iqr: pricingBands.iqr.toString(),
      lowerFence: pricingBands.lowerFence.toString(),
      upperFence: pricingBands.upperFence.toString(),
      skewness: this.calculateSkewness(prices).toString(),
      kurtosis: this.calculateKurtosis(prices).toString(),
      isNormalDistribution: this.isNormalDistribution(prices),
      outlierCount: outlierAnalysis.outlierIndices.length,
      outlierPercentage: outlierAnalysis.percentage.toString(),
      outlierTransactionIds: outlierAnalysis.outlierIds,
      hasSeasonality: seasonality.hasSeasonality,
      seasonalityPattern: seasonality.pattern,
      trendDirection: seasonality.trendDirection,
      trendStrength: seasonality.trendStrength?.toString(),
      recommendedSSP: recommendedSSP.value.toString(),
      recommendationMethod: recommendedSSP.method,
      recommendationConfidence: confidence.toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.insert(sspPricingBands).values(band);

    return {
      itemId,
      recommendedSSP: recommendedSSP.value,
      method: recommendedSSP.method,
      confidence,
      pricingBands,
      outliers: {
        count: outlierAnalysis.outlierIndices.length,
        percentage: outlierAnalysis.percentage,
        outlierIds: outlierAnalysis.outlierIds,
        method: 'IQR'
      },
      seasonality
    };
  }

  /**
   * ML prediction (placeholder - would integrate with TensorFlow.js)
   */
  private async predictWithML(
    itemId: string,
    transactions: any[]
  ): Promise<MLPredictionResult | null> {
    // This would integrate with a trained ML model
    // For now, returning a mock result
    
    const prices = transactions.map(t => parseFloat(t.unitPrice));
    const features = {
      mean: stats.mean(prices),
      median: stats.median(prices),
      stdDev: stats.standardDeviation(prices),
      transactionCount: transactions.length,
      daysSinceFirst: this.daysBetween(
        new Date(transactions[0].transactionDate),
        new Date()
      )
    };

    // Mock ML prediction
    const predictedSSP = features.median * 1.05; // Simple mock
    const confidence = Math.min(0.95, transactions.length / 100);

    return {
      itemId,
      predictedSSP,
      confidence,
      features,
      modelVersion: 'v1.0.0-mock'
    };
  }

  /**
   * Helper Methods
   */

  private calculatePricingBands(prices: number[]): PricingBands {
    const sorted = [...prices].sort((a, b) => a - b);
    
    return {
      p5: stats.quantile(sorted, 0.05),
      p25: stats.quantile(sorted, 0.25),
      p50: stats.quantile(sorted, 0.50),
      p75: stats.quantile(sorted, 0.75),
      p95: stats.quantile(sorted, 0.95),
      iqr: stats.interquartileRange(sorted),
      lowerFence: stats.quantile(sorted, 0.25) - 1.5 * stats.interquartileRange(sorted),
      upperFence: stats.quantile(sorted, 0.75) + 1.5 * stats.interquartileRange(sorted)
    };
  }

  private detectOutliers(prices: number[]): any {
    const q1 = stats.quantile(prices, 0.25);
    const q3 = stats.quantile(prices, 0.75);
    const iqr = q3 - q1;
    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;
    
    const outlierIndices: number[] = [];
    prices.forEach((price, idx) => {
      if (price < lowerFence || price > upperFence) {
        outlierIndices.push(idx);
      }
    });

    return {
      outlierIndices,
      outlierIds: outlierIndices.map(idx => `txn-${idx}`),
      percentage: (outlierIndices.length / prices.length) * 100,
      lowerFence,
      upperFence
    };
  }

  private analyzeSeasonality(transactions: any[]): SeasonalityAnalysis {
    // Group by month
    const monthlyPrices: Record<number, number[]> = {};
    
    transactions.forEach(t => {
      const month = new Date(t.transactionDate).getMonth();
      if (!monthlyPrices[month]) {
        monthlyPrices[month] = [];
      }
      monthlyPrices[month].push(parseFloat(t.unitPrice));
    });

    // Calculate monthly averages
    const monthlyAverages: Record<string, number> = {};
    Object.entries(monthlyPrices).forEach(([month, prices]) => {
      monthlyAverages[month] = stats.mean(prices);
    });

    // Simple seasonality detection
    const values = Object.values(monthlyAverages);
    const hasSeasonality = values.length >= 3 && 
      stats.standardDeviation(values) / stats.mean(values) > 0.1;

    // Trend analysis
    const trend = this.calculateTrend(transactions);

    return {
      hasSeasonality,
      pattern: hasSeasonality ? monthlyAverages : undefined,
      trendDirection: trend.direction,
      trendStrength: trend.strength
    };
  }

  private calculateTrend(transactions: any[]): { direction?: 'increasing' | 'decreasing' | 'stable'; strength?: number } {
    if (transactions.length < 10) {
      return { direction: 'stable', strength: 0 };
    }

    // Simple linear regression on prices over time
    const x = transactions.map((_, idx) => idx);
    const y = transactions.map(t => parseFloat(t.unitPrice));
    
    const regression = stats.linearRegression([x, y]);
    const slope = regression.m;
    
    let direction: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(slope) < 0.01) {
      direction = 'stable';
    } else if (slope > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }

    return {
      direction,
      strength: Math.abs(slope)
    };
  }

  private determineRecommendedSSP(
    prices: number[],
    bands: PricingBands,
    seasonality?: SeasonalityAnalysis
  ): { value: number; method: string } {
    // Use trimmed mean if we have outliers
    const trimmedPrices = prices.filter(p => 
      p >= bands.lowerFence && p <= bands.upperFence
    );

    if (trimmedPrices.length >= prices.length * 0.8) {
      return {
        value: stats.mean(trimmedPrices),
        method: 'trimmed_mean'
      };
    }

    // Otherwise use median
    return {
      value: bands.p50,
      method: 'median'
    };
  }

  private calculateVSOEConfidence(
    sampleSize: number,
    cv: number,
    standalonePercentage: number
  ): number {
    // Base confidence on sample size
    let confidence = Math.min(1, sampleSize / 100);
    
    // Adjust for variability
    if (cv < 0.1) {
      confidence *= 1.2;
    } else if (cv > 0.2) {
      confidence *= 0.8;
    }
    
    // Adjust for standalone percentage
    confidence *= standalonePercentage / 100;
    
    return Math.min(1, Math.max(0, confidence));
  }

  private calculateStatisticalConfidence(
    sampleSize: number,
    bands: PricingBands,
    outliers: any
  ): number {
    let confidence = Math.min(1, sampleSize / 50);
    
    // Reduce confidence for high outlier percentage
    if (outliers.percentage > 10) {
      confidence *= 0.8;
    }
    
    // Increase confidence for tight bands
    const spread = (bands.p75 - bands.p25) / bands.p50;
    if (spread < 0.2) {
      confidence *= 1.1;
    }
    
    return Math.min(1, Math.max(0, confidence));
  }

  private calculateSkewness(data: number[]): number {
    const n = data.length;
    const mean = stats.mean(data);
    const stdDev = stats.standardDeviation(data);
    
    const skew = data.reduce((sum, x) => 
      sum + Math.pow((x - mean) / stdDev, 3), 0
    ) / n;
    
    return skew;
  }

  private calculateKurtosis(data: number[]): number {
    const n = data.length;
    const mean = stats.mean(data);
    const stdDev = stats.standardDeviation(data);
    
    const kurt = data.reduce((sum, x) => 
      sum + Math.pow((x - mean) / stdDev, 4), 0
    ) / n - 3;
    
    return kurt;
  }

  private isNormalDistribution(prices: number[]): boolean {
    const skewness = Math.abs(this.calculateSkewness(prices));
    const kurtosis = Math.abs(this.calculateKurtosis(prices));
    
    // Simple normality check
    return skewness < 2 && kurtosis < 7;
  }

  private performNormalityTest(prices: number[]): any {
    // Simplified normality test
    const skewness = this.calculateSkewness(prices);
    const kurtosis = this.calculateKurtosis(prices);
    
    return {
      test_name: 'Simplified',
      skewness,
      kurtosis,
      is_normal: this.isNormalDistribution(prices)
    };
  }

  private daysBetween(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private async createCalculationRun(options: SSPCalculationOptions): Promise<string> {
    const run: NewSSPCalculationRun = {
      id: uuidv4(),
      organizationId: this.organizationId,
      runNumber: `RUN-${Date.now()}`,
      runType: 'manual',
      runDate: new Date(),
      calculationMethod: options.method || 'hybrid',
      startDate: options.startDate.toISOString().split('T')[0],
      endDate: options.endDate.toISOString().split('T')[0],
      minTransactions: options.minTransactions || 5,
      confidenceThreshold: (options.confidenceThreshold || 0.8).toString(),
      status: RunStatus.RUNNING,
      itemsProcessed: 0,
      itemsWithVSOE: 0,
      itemsWithStatistical: 0,
      itemsWithML: 0,
      itemsWithExceptions: 0,
      dataPointsAnalyzed: 0,
      outlierDetected: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const [created] = await this.db
      .insert(sspCalculationRuns)
      .values(run)
      .returning();

    return created.id;
  }

  private async updateRunStatus(
    runId: string,
    status: string,
    summary: any,
    duration: number,
    error?: string
  ): Promise<void> {
    await this.db
      .update(sspCalculationRuns)
      .set({
        status,
        completedAt: status === RunStatus.COMPLETED ? new Date() : null,
        processingDuration: duration,
        resultsSummary: summary,
        errorMessage: error,
        updatedAt: new Date()
      })
      .where(eq(sspCalculationRuns.id, runId));
  }

  private async getItemsToProcess(itemIds?: string[]): Promise<any[]> {
    const query = this.db
      .select()
      .from(items)
      .where(eq(items.organizationId, this.organizationId));

    if (itemIds && itemIds.length > 0) {
      // Would add filter for specific items
    }

    return await query;
  }

  private async getItemTransactions(
    itemId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    // Get transactions for the item
    const transactions = await this.db
      .select({
        transactionDate: subscriptions.startDate,
        unitPrice: subscriptionItems.unitPrice,
        quantity: subscriptionItems.quantity,
        isStandalone: sql`CASE WHEN COUNT(*) OVER (PARTITION BY ${subscriptions.id}) = 1 THEN true ELSE false END`
      })
      .from(subscriptionItems)
      .leftJoin(subscriptions, eq(subscriptionItems.subscriptionId, subscriptions.id))
      .where(
        and(
          eq(subscriptionItems.itemId, itemId),
          gte(subscriptions.startDate, startDate.toISOString().split('T')[0]),
          lte(subscriptions.startDate, endDate.toISOString().split('T')[0])
        )
      )
      .orderBy(subscriptions.startDate);

    return transactions;
  }

  private async storeExceptions(exceptions: SSPExceptionDetail[]): Promise<void> {
    if (exceptions.length === 0) return;

    const exceptionRecords = exceptions.map(e => ({
      id: uuidv4(),
      organizationId: this.organizationId,
      itemId: e.itemId,
      calculationRunId: this.runId,
      exceptionType: e.type,
      severity: e.severity,
      message: e.message,
      details: e.details,
      status: 'open',
      alertSent: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await this.db.insert(sspExceptions).values(exceptionRecords);
  }
}