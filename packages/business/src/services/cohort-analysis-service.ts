import { Database } from '@glapi/database';
import {
  cohortAnalysis,
  CohortAnalysis,
  deferredRevenueRollforward,
  DeferredRevenueRollforward
} from '@glapi/database/schema';
import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm';

export interface CohortMetrics {
  cohortMonth: Date;
  size: number;
  retention: number[];
  revenue: number[];
  ltv: number;
  paybackPeriod: number;
  cac: number;
  ltvCacRatio: number;
}

export interface CohortInsights {
  bestPerformingCohort: Date;
  worstPerformingCohort: Date;
  averageRetention: number[];
  averageLTV: number;
  retentionTrend: 'improving' | 'declining' | 'stable';
  revenueAcceleration: boolean;
  recommendations: string[];
}

export interface DeferredRevenueMovement {
  period: Date;
  beginningBalance: number;
  additions: number;
  recognitions: number;
  adjustments: number;
  endingBalance: number;
  components: {
    shortTerm: number;
    longTerm: number;
  };
  byProduct?: Record<string, number>;
  bySegment?: Record<string, number>;
}

export interface DeferredRevenueSummary {
  totalAdditions: number;
  totalRecognitions: number;
  netChange: number;
  averageRecognitionPeriod: number;
  recognitionVelocity: number;
  trends: {
    additionsTrend: 'increasing' | 'decreasing' | 'stable';
    recognitionsTrend: 'increasing' | 'decreasing' | 'stable';
    balanceTrend: 'increasing' | 'decreasing' | 'stable';
  };
}

export class CohortAnalysisService {
  constructor(
    private db: typeof Database,
    private organizationId: string
  ) {}

  /**
   * Analyze customer cohorts
   */
  async analyzeCohorts(options?: {
    startDate?: Date;
    endDate?: Date;
    cohortSize?: 'month' | 'quarter';
    maxPeriods?: number;
  }): Promise<{
    cohorts: CohortMetrics[];
    insights: CohortInsights;
  }> {
    const cohortSize = options?.cohortSize || 'month';
    const maxPeriods = options?.maxPeriods || 24;
    
    // Get or calculate cohort data
    const cohorts = await this.getCohortData(options?.startDate, options?.endDate);
    
    const analyzedCohorts: CohortMetrics[] = [];
    
    for (const cohort of cohorts) {
      // Calculate retention curve
      const retention = await this.calculateRetentionCurve(cohort, maxPeriods);
      
      // Calculate revenue by period
      const revenue = await this.calculateCohortRevenue(cohort, maxPeriods);
      
      // Predict LTV using retention and revenue patterns
      const ltv = await this.predictLTV(retention, revenue, cohort);
      
      // Get CAC for the cohort
      const cac = await this.getCAC(cohort.cohortMonth);
      
      // Calculate payback period
      const paybackPeriod = this.calculatePaybackPeriod(revenue, cac);
      
      // Calculate LTV/CAC ratio
      const ltvCacRatio = cac > 0 ? ltv / cac : 0;
      
      analyzedCohorts.push({
        cohortMonth: cohort.cohortMonth,
        size: cohort.size,
        retention,
        revenue,
        ltv,
        paybackPeriod,
        cac,
        ltvCacRatio
      });
      
      // Save analysis to database
      await this.saveCohortAnalysis(cohort, retention, revenue, ltv, cac, paybackPeriod);
    }
    
    // Generate cohort insights
    const insights = this.generateCohortInsights(analyzedCohorts);
    
    return {
      cohorts: analyzedCohorts,
      insights
    };
  }

  /**
   * Generate deferred revenue rollforward report
   */
  async generateDeferredRevenueRollforward(
    startDate: Date,
    endDate: Date,
    periodType: 'month' | 'quarter' = 'month'
  ): Promise<{
    periods: DeferredRevenueMovement[];
    summary: DeferredRevenueSummary;
  }> {
    const periods: DeferredRevenueMovement[] = [];
    let currentDate = new Date(startDate);
    let previousBalance = await this.getDeferredBalanceAtDate(new Date(startDate.getTime() - 1));
    
    while (currentDate <= endDate) {
      const periodEnd = this.getPeriodEnd(currentDate, periodType);
      
      // Get deferred revenue movements for the period
      const movements = await this.getDeferredMovements(currentDate, periodEnd);
      
      // Calculate ending balance
      const endingBalance = previousBalance + movements.additions - movements.recognitions + movements.adjustments;
      
      // Get component breakdown
      const components = await this.getDeferredComponents(periodEnd);
      
      // Get product and segment breakdown
      const byProduct = await this.getDeferredByProduct(periodEnd);
      const bySegment = await this.getDeferredBySegment(periodEnd);
      
      periods.push({
        period: new Date(currentDate),
        beginningBalance: previousBalance,
        additions: movements.additions,
        recognitions: movements.recognitions,
        adjustments: movements.adjustments,
        endingBalance,
        components: {
          shortTerm: components.shortTerm,
          longTerm: components.longTerm
        },
        byProduct,
        bySegment
      });
      
      // Save rollforward record
      await this.saveRollforwardRecord(currentDate, periodEnd, {
        beginningBalance: previousBalance,
        ...movements,
        endingBalance,
        ...components
      });
      
      previousBalance = endingBalance;
      currentDate = this.getNextPeriod(currentDate, periodType);
    }
    
    // Calculate summary metrics
    const summary = this.calculateRollforwardSummary(periods);
    
    return { periods, summary };
  }

  /**
   * Calculate Customer Lifetime Value (CLV/LTV)
   */
  async calculateCustomerLTV(
    customerId: string,
    options?: {
      method?: 'historical' | 'predictive' | 'hybrid';
      discountRate?: number;
      maxPeriods?: number;
    }
  ): Promise<{
    ltv: number;
    breakdown: {
      historicalValue: number;
      predictedFutureValue: number;
      retentionProbability: number[];
      expectedRevenue: number[];
    };
    confidence: number;
  }> {
    const method = options?.method || 'hybrid';
    const discountRate = options?.discountRate || 0.1; // 10% annual discount rate
    const maxPeriods = options?.maxPeriods || 60; // 5 years
    
    // Get historical customer data
    const historicalData = await this.getCustomerHistory(customerId);
    
    // Calculate historical value
    const historicalValue = historicalData.reduce((sum, d) => sum + d.revenue, 0);
    
    let predictedFutureValue = 0;
    let retentionProbability: number[] = [];
    let expectedRevenue: number[] = [];
    
    if (method === 'predictive' || method === 'hybrid') {
      // Predict future value
      const prediction = await this.predictCustomerFutureValue(
        customerId,
        historicalData,
        maxPeriods,
        discountRate
      );
      
      predictedFutureValue = prediction.totalValue;
      retentionProbability = prediction.retentionCurve;
      expectedRevenue = prediction.revenueByPeriod;
    }
    
    // Calculate total LTV
    let ltv: number;
    if (method === 'historical') {
      ltv = historicalValue;
    } else if (method === 'predictive') {
      ltv = predictedFutureValue;
    } else {
      ltv = historicalValue + predictedFutureValue;
    }
    
    // Calculate confidence based on data quality and prediction accuracy
    const confidence = this.calculateLTVConfidence(historicalData, method);
    
    return {
      ltv,
      breakdown: {
        historicalValue,
        predictedFutureValue,
        retentionProbability,
        expectedRevenue
      },
      confidence
    };
  }

  /**
   * Analyze revenue at risk
   */
  async analyzeRevenueAtRisk(
    timeHorizon: number = 3 // months
  ): Promise<{
    totalAtRisk: number;
    byRiskLevel: {
      high: number;
      medium: number;
      low: number;
    };
    byCategory: {
      churn: number;
      contraction: number;
      nonRenewal: number;
      competitorSwitch: number;
    };
    topRisks: Array<{
      customerId: string;
      customerName: string;
      revenue: number;
      riskLevel: 'high' | 'medium' | 'low';
      riskFactors: string[];
    }>;
    recommendations: string[];
  }> {
    // Get all active customers
    const customers = await this.getActiveCustomers();
    
    let totalAtRisk = 0;
    const byRiskLevel = { high: 0, medium: 0, low: 0 };
    const byCategory = { 
      churn: 0, 
      contraction: 0, 
      nonRenewal: 0, 
      competitorSwitch: 0 
    };
    const risks: any[] = [];
    
    for (const customer of customers) {
      // Assess risk for each customer
      const riskAssessment = await this.assessCustomerRisk(customer, timeHorizon);
      
      if (riskAssessment.riskScore > 0) {
        const revenueAtRisk = customer.monthlyRevenue * timeHorizon * riskAssessment.riskScore;
        totalAtRisk += revenueAtRisk;
        
        // Categorize by risk level
        byRiskLevel[riskAssessment.riskLevel] += revenueAtRisk;
        
        // Categorize by risk type
        byCategory[riskAssessment.primaryRiskCategory] += revenueAtRisk;
        
        risks.push({
          customerId: customer.id,
          customerName: customer.name,
          revenue: revenueAtRisk,
          riskLevel: riskAssessment.riskLevel,
          riskFactors: riskAssessment.factors
        });
      }
    }
    
    // Sort risks by revenue impact
    const topRisks = risks
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    
    // Generate recommendations
    const recommendations = this.generateRiskMitigationRecommendations(
      byRiskLevel,
      byCategory,
      topRisks
    );
    
    return {
      totalAtRisk,
      byRiskLevel,
      byCategory,
      topRisks,
      recommendations
    };
  }

  // Private helper methods

  private async getCohortData(startDate?: Date, endDate?: Date): Promise<any[]> {
    // This would query actual customer cohort data
    // For now, returning mock data
    const cohorts = [];
    const currentDate = new Date();
    currentDate.setDate(1); // Start of month
    
    for (let i = 0; i < 12; i++) {
      const cohortDate = new Date(currentDate);
      cohortDate.setMonth(cohortDate.getMonth() - i);
      
      cohorts.push({
        cohortMonth: cohortDate,
        size: 50 + Math.floor(Math.random() * 50),
        customers: [] // Would contain actual customer IDs
      });
    }
    
    return cohorts;
  }

  private async calculateRetentionCurve(cohort: any, maxPeriods: number): Promise<number[]> {
    const retention: number[] = [1.0]; // 100% retention at period 0
    
    // Simulate retention decay
    let currentRetention = 1.0;
    for (let i = 1; i <= maxPeriods; i++) {
      // Typical SaaS retention curve
      const monthlyChurn = 0.05 - (0.03 * Math.exp(-i / 6)); // Decreasing churn over time
      currentRetention = currentRetention * (1 - monthlyChurn);
      retention.push(Math.max(0, currentRetention));
    }
    
    return retention;
  }

  private async calculateCohortRevenue(cohort: any, maxPeriods: number): Promise<number[]> {
    const revenue: number[] = [];
    const baseRevenue = cohort.size * 1000; // Average revenue per customer
    
    for (let i = 0; i <= maxPeriods; i++) {
      // Revenue with some growth and variation
      const periodRevenue = baseRevenue * (1 + 0.02 * i) * (0.9 + Math.random() * 0.2);
      revenue.push(periodRevenue);
    }
    
    return revenue;
  }

  private async predictLTV(retention: number[], revenue: number[], cohort: any): Promise<number> {
    let ltv = 0;
    const monthlyDiscountRate = 0.01; // ~12% annual
    
    // Calculate discounted cash flows
    for (let i = 0; i < Math.min(retention.length, revenue.length); i++) {
      const discountFactor = Math.pow(1 / (1 + monthlyDiscountRate), i);
      const expectedRevenue = revenue[i] * retention[i];
      ltv += expectedRevenue * discountFactor;
    }
    
    // Adjust for cohort size
    return ltv / cohort.size;
  }

  private async getCAC(cohortMonth: Date): Promise<number> {
    // This would query actual CAC data
    // For now, returning mock value
    return 500 + Math.random() * 500; // $500-$1000 CAC
  }

  private calculatePaybackPeriod(revenue: number[], cac: number): number {
    let cumulativeRevenue = 0;
    
    for (let i = 0; i < revenue.length; i++) {
      cumulativeRevenue += revenue[i];
      if (cumulativeRevenue >= cac) {
        return i + 1; // Months to payback
      }
    }
    
    return -1; // Never pays back
  }

  private generateCohortInsights(cohorts: CohortMetrics[]): CohortInsights {
    if (cohorts.length === 0) {
      return {
        bestPerformingCohort: new Date(),
        worstPerformingCohort: new Date(),
        averageRetention: [],
        averageLTV: 0,
        retentionTrend: 'stable',
        revenueAcceleration: false,
        recommendations: []
      };
    }
    
    // Find best and worst performing cohorts by LTV
    const sortedByLTV = [...cohorts].sort((a, b) => b.ltv - a.ltv);
    const bestPerformingCohort = sortedByLTV[0].cohortMonth;
    const worstPerformingCohort = sortedByLTV[sortedByLTV.length - 1].cohortMonth;
    
    // Calculate average retention across cohorts
    const maxRetentionLength = Math.max(...cohorts.map(c => c.retention.length));
    const averageRetention: number[] = [];
    
    for (let i = 0; i < maxRetentionLength; i++) {
      const validRetentions = cohorts
        .filter(c => c.retention.length > i)
        .map(c => c.retention[i]);
      
      if (validRetentions.length > 0) {
        averageRetention.push(
          validRetentions.reduce((a, b) => a + b) / validRetentions.length
        );
      }
    }
    
    // Calculate average LTV
    const averageLTV = cohorts.reduce((sum, c) => sum + c.ltv, 0) / cohorts.length;
    
    // Determine retention trend
    const recentCohorts = cohorts.slice(-3);
    const olderCohorts = cohorts.slice(0, 3);
    const recentAvgRetention = this.calculateAverageRetentionAtMonth(recentCohorts, 3);
    const olderAvgRetention = this.calculateAverageRetentionAtMonth(olderCohorts, 3);
    
    let retentionTrend: 'improving' | 'declining' | 'stable';
    if (recentAvgRetention > olderAvgRetention * 1.05) {
      retentionTrend = 'improving';
    } else if (recentAvgRetention < olderAvgRetention * 0.95) {
      retentionTrend = 'declining';
    } else {
      retentionTrend = 'stable';
    }
    
    // Check for revenue acceleration
    const revenueAcceleration = this.checkRevenueAcceleration(cohorts);
    
    // Generate recommendations
    const recommendations = this.generateCohortRecommendations(
      cohorts,
      retentionTrend,
      averageLTV
    );
    
    return {
      bestPerformingCohort,
      worstPerformingCohort,
      averageRetention,
      averageLTV,
      retentionTrend,
      revenueAcceleration,
      recommendations
    };
  }

  private calculateAverageRetentionAtMonth(cohorts: CohortMetrics[], month: number): number {
    const retentions = cohorts
      .filter(c => c.retention.length > month)
      .map(c => c.retention[month]);
    
    return retentions.length > 0
      ? retentions.reduce((a, b) => a + b) / retentions.length
      : 0;
  }

  private checkRevenueAcceleration(cohorts: CohortMetrics[]): boolean {
    // Check if newer cohorts are generating more revenue faster
    if (cohorts.length < 4) return false;
    
    const recentCohorts = cohorts.slice(-2);
    const olderCohorts = cohorts.slice(0, 2);
    
    const recentAvgFirstYearRevenue = recentCohorts
      .map(c => c.revenue.slice(0, 12).reduce((a, b) => a + b, 0))
      .reduce((a, b) => a + b) / recentCohorts.length;
    
    const olderAvgFirstYearRevenue = olderCohorts
      .map(c => c.revenue.slice(0, 12).reduce((a, b) => a + b, 0))
      .reduce((a, b) => a + b) / olderCohorts.length;
    
    return recentAvgFirstYearRevenue > olderAvgFirstYearRevenue * 1.2;
  }

  private generateCohortRecommendations(
    cohorts: CohortMetrics[],
    retentionTrend: string,
    averageLTV: number
  ): string[] {
    const recommendations: string[] = [];
    
    if (retentionTrend === 'declining') {
      recommendations.push('Retention is declining - consider implementing customer success initiatives');
      recommendations.push('Survey churned customers to identify improvement areas');
    }
    
    const avgLTVCAC = cohorts.reduce((sum, c) => sum + c.ltvCacRatio, 0) / cohorts.length;
    
    if (avgLTVCAC < 3) {
      recommendations.push('LTV/CAC ratio below 3:1 - focus on reducing acquisition costs');
      recommendations.push('Consider increasing prices or upselling to improve unit economics');
    }
    
    const avgPayback = cohorts.reduce((sum, c) => sum + c.paybackPeriod, 0) / cohorts.length;
    
    if (avgPayback > 12) {
      recommendations.push('Payback period exceeds 12 months - accelerate revenue capture');
      recommendations.push('Consider annual prepayment incentives');
    }
    
    return recommendations;
  }

  private async saveCohortAnalysis(
    cohort: any,
    retention: number[],
    revenue: number[],
    ltv: number,
    cac: number,
    paybackPeriod: number
  ): Promise<void> {
    // Save each period's metrics
    for (let period = 0; period < retention.length; period++) {
      await this.db.insert(cohortAnalysis).values({
        organizationId: this.organizationId,
        cohortName: `Cohort ${cohort.cohortMonth.toISOString().slice(0, 7)}`,
        cohortMonth: cohort.cohortMonth,
        cohortSize: cohort.size,
        periodOffset: period,
        activeCustomers: Math.round(cohort.size * retention[period]),
        retentionRate: String(retention[period]),
        periodRevenue: String(revenue[period] || 0),
        cumulativeRevenue: String(revenue.slice(0, period + 1).reduce((a, b) => a + b, 0)),
        averageRevenue: String((revenue[period] || 0) / Math.max(1, cohort.size * retention[period])),
        predictedLTV: String(ltv),
        paybackPeriod: paybackPeriod,
        cac: String(cac),
        ltvCacRatio: String(cac > 0 ? ltv / cac : 0),
        analysisDate: new Date()
      }).onConflictDoNothing(); // Avoid duplicates
    }
  }

  private async getDeferredBalanceAtDate(date: Date): Promise<number> {
    // Query actual deferred revenue balance
    // For now, returning mock value
    return 1000000 + Math.random() * 500000;
  }

  private async getDeferredMovements(
    startDate: Date,
    endDate: Date
  ): Promise<{
    additions: number;
    recognitions: number;
    adjustments: number;
  }> {
    // Query actual movements
    // For now, returning mock values
    return {
      additions: 100000 + Math.random() * 50000,
      recognitions: 80000 + Math.random() * 40000,
      adjustments: -5000 + Math.random() * 10000
    };
  }

  private async getDeferredComponents(date: Date): Promise<{
    shortTerm: number;
    longTerm: number;
  }> {
    // Query actual component breakdown
    const total = await this.getDeferredBalanceAtDate(date);
    return {
      shortTerm: total * 0.7,
      longTerm: total * 0.3
    };
  }

  private async getDeferredByProduct(date: Date): Promise<Record<string, number>> {
    // Query actual product breakdown
    return {
      'Product A': 500000,
      'Product B': 300000,
      'Product C': 200000
    };
  }

  private async getDeferredBySegment(date: Date): Promise<Record<string, number>> {
    // Query actual segment breakdown
    return {
      'Enterprise': 600000,
      'Mid-Market': 300000,
      'SMB': 100000
    };
  }

  private calculateRollforwardSummary(periods: DeferredRevenueMovement[]): DeferredRevenueSummary {
    const totalAdditions = periods.reduce((sum, p) => sum + p.additions, 0);
    const totalRecognitions = periods.reduce((sum, p) => sum + p.recognitions, 0);
    const netChange = periods[periods.length - 1].endingBalance - periods[0].beginningBalance;
    
    // Calculate average recognition period (simplified)
    const avgBalance = periods.reduce((sum, p) => sum + p.endingBalance, 0) / periods.length;
    const avgMonthlyRecognition = totalRecognitions / periods.length;
    const averageRecognitionPeriod = avgBalance / avgMonthlyRecognition;
    
    // Calculate recognition velocity
    const recognitionVelocity = avgMonthlyRecognition / avgBalance;
    
    // Determine trends
    const firstHalf = periods.slice(0, Math.floor(periods.length / 2));
    const secondHalf = periods.slice(Math.floor(periods.length / 2));
    
    const firstHalfAdditions = firstHalf.reduce((sum, p) => sum + p.additions, 0) / firstHalf.length;
    const secondHalfAdditions = secondHalf.reduce((sum, p) => sum + p.additions, 0) / secondHalf.length;
    
    const additionsTrend = this.determineTrend(firstHalfAdditions, secondHalfAdditions);
    
    const firstHalfRecognitions = firstHalf.reduce((sum, p) => sum + p.recognitions, 0) / firstHalf.length;
    const secondHalfRecognitions = secondHalf.reduce((sum, p) => sum + p.recognitions, 0) / secondHalf.length;
    
    const recognitionsTrend = this.determineTrend(firstHalfRecognitions, secondHalfRecognitions);
    
    const firstHalfBalance = firstHalf.reduce((sum, p) => sum + p.endingBalance, 0) / firstHalf.length;
    const secondHalfBalance = secondHalf.reduce((sum, p) => sum + p.endingBalance, 0) / secondHalf.length;
    
    const balanceTrend = this.determineTrend(firstHalfBalance, secondHalfBalance);
    
    return {
      totalAdditions,
      totalRecognitions,
      netChange,
      averageRecognitionPeriod,
      recognitionVelocity,
      trends: {
        additionsTrend,
        recognitionsTrend,
        balanceTrend
      }
    };
  }

  private determineTrend(first: number, second: number): 'increasing' | 'decreasing' | 'stable' {
    const changePercent = (second - first) / first;
    
    if (changePercent > 0.05) return 'increasing';
    if (changePercent < -0.05) return 'decreasing';
    return 'stable';
  }

  private async saveRollforwardRecord(
    periodStart: Date,
    periodEnd: Date,
    data: any
  ): Promise<void> {
    await this.db.insert(deferredRevenueRollforward).values({
      organizationId: this.organizationId,
      periodStart,
      periodEnd,
      periodType: 'month',
      beginningBalance: String(data.beginningBalance),
      additions: String(data.additions),
      recognitions: String(data.recognitions),
      adjustments: String(data.adjustments),
      endingBalance: String(data.endingBalance),
      shortTermDeferred: String(data.shortTerm),
      longTermDeferred: String(data.longTerm),
      expectedRecognitionNext30Days: String(data.endingBalance * 0.08),
      expectedRecognitionNext90Days: String(data.endingBalance * 0.25),
      expectedRecognitionNext365Days: String(data.endingBalance * 0.75),
      averageRecognitionPeriod: String(12), // months
      recognitionVelocity: String(0.083) // ~8.3% per month
    }).onConflictDoNothing();
  }

  private getPeriodEnd(date: Date, periodType: string): Date {
    const end = new Date(date);
    
    if (periodType === 'month') {
      end.setMonth(end.getMonth() + 1);
      end.setDate(0); // Last day of month
    } else if (periodType === 'quarter') {
      end.setMonth(end.getMonth() + 3);
      end.setDate(0);
    }
    
    return end;
  }

  private getNextPeriod(date: Date, periodType: string): Date {
    const next = new Date(date);
    
    if (periodType === 'month') {
      next.setMonth(next.getMonth() + 1);
    } else if (periodType === 'quarter') {
      next.setMonth(next.getMonth() + 3);
    }
    
    return next;
  }

  private async getCustomerHistory(customerId: string): Promise<any[]> {
    // Query actual customer revenue history
    // For now, returning mock data
    const history = [];
    const months = 24;
    
    for (let i = 0; i < months; i++) {
      history.push({
        month: i,
        revenue: 1000 + Math.random() * 500,
        usage: 100 + Math.random() * 50
      });
    }
    
    return history;
  }

  private async predictCustomerFutureValue(
    customerId: string,
    historicalData: any[],
    maxPeriods: number,
    discountRate: number
  ): Promise<{
    totalValue: number;
    retentionCurve: number[];
    revenueByPeriod: number[];
  }> {
    const retentionCurve: number[] = [];
    const revenueByPeriod: number[] = [];
    let totalValue = 0;
    
    // Simple prediction based on historical average
    const avgRevenue = historicalData.reduce((sum, d) => sum + d.revenue, 0) / historicalData.length;
    const monthlyDiscountRate = discountRate / 12;
    
    for (let i = 0; i < maxPeriods; i++) {
      // Decay retention probability over time
      const retention = Math.exp(-0.05 * i); // 5% monthly churn
      retentionCurve.push(retention);
      
      // Expected revenue with growth
      const expectedRevenue = avgRevenue * (1 + 0.02 * Math.log(i + 1)) * retention;
      revenueByPeriod.push(expectedRevenue);
      
      // Discounted value
      const discountFactor = Math.pow(1 / (1 + monthlyDiscountRate), i);
      totalValue += expectedRevenue * discountFactor;
    }
    
    return {
      totalValue,
      retentionCurve,
      revenueByPeriod
    };
  }

  private calculateLTVConfidence(historicalData: any[], method: string): number {
    let confidence = 0.5; // Base confidence
    
    // More historical data increases confidence
    if (historicalData.length >= 24) confidence += 0.2;
    else if (historicalData.length >= 12) confidence += 0.1;
    
    // Stable revenue increases confidence
    const revenues = historicalData.map(d => d.revenue);
    const cv = this.calculateCoefficientOfVariation(revenues);
    if (cv < 0.1) confidence += 0.2;
    else if (cv < 0.2) confidence += 0.1;
    
    // Method affects confidence
    if (method === 'historical') confidence += 0.1;
    else if (method === 'hybrid') confidence += 0.05;
    
    return Math.min(0.95, confidence);
  }

  private calculateCoefficientOfVariation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    return stdDev / mean;
  }

  private async getActiveCustomers(): Promise<any[]> {
    // Query actual active customers
    // For now, returning mock data
    const customers = [];
    
    for (let i = 0; i < 100; i++) {
      customers.push({
        id: `customer-${i}`,
        name: `Customer ${i}`,
        monthlyRevenue: 1000 + Math.random() * 10000,
        contractEndDate: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000)
      });
    }
    
    return customers;
  }

  private async assessCustomerRisk(customer: any, timeHorizon: number): Promise<{
    riskScore: number;
    riskLevel: 'high' | 'medium' | 'low';
    primaryRiskCategory: 'churn' | 'contraction' | 'nonRenewal' | 'competitorSwitch';
    factors: string[];
  }> {
    const factors: string[] = [];
    let riskScore = 0;
    
    // Check contract end date
    const monthsToEnd = (customer.contractEndDate.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000);
    if (monthsToEnd <= timeHorizon) {
      riskScore += 0.3;
      factors.push('Contract expiring soon');
    }
    
    // Simulate other risk factors
    if (Math.random() > 0.7) {
      riskScore += 0.2;
      factors.push('Declining usage');
    }
    
    if (Math.random() > 0.8) {
      riskScore += 0.15;
      factors.push('Support ticket increase');
    }
    
    // Determine risk level
    let riskLevel: 'high' | 'medium' | 'low';
    if (riskScore > 0.5) riskLevel = 'high';
    else if (riskScore > 0.2) riskLevel = 'medium';
    else riskLevel = 'low';
    
    // Determine primary category
    let primaryRiskCategory: 'churn' | 'contraction' | 'nonRenewal' | 'competitorSwitch' = 'churn';
    if (monthsToEnd <= timeHorizon) primaryRiskCategory = 'nonRenewal';
    
    return {
      riskScore,
      riskLevel,
      primaryRiskCategory,
      factors
    };
  }

  private generateRiskMitigationRecommendations(
    byRiskLevel: any,
    byCategory: any,
    topRisks: any[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (byRiskLevel.high > byRiskLevel.low) {
      recommendations.push('High concentration of at-risk revenue - implement immediate intervention program');
    }
    
    if (byCategory.nonRenewal > byCategory.churn) {
      recommendations.push('Focus on renewal discussions - many contracts expiring soon');
    }
    
    if (byCategory.churn > 0) {
      recommendations.push('Implement customer health scoring to predict churn earlier');
    }
    
    if (topRisks.length > 0 && topRisks[0].revenue > 50000) {
      recommendations.push(`Priority: Save ${topRisks[0].customerName} - ${(topRisks[0].revenue / 1000).toFixed(0)}k at risk`);
    }
    
    recommendations.push('Schedule quarterly business reviews with top 20% of customers');
    
    return recommendations;
  }
}