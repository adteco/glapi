import { Database } from '@glapi/database';
import {
  churnPredictions,
  ChurnPrediction
} from '@glapi/database/schema';
import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm';

export interface ChurnRiskFactor {
  factor: string;
  impact: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  description: string;
}

export interface CustomerChurnPrediction {
  customerId: string;
  customerName: string;
  churnProbability: number;
  riskLevel: 'low' | 'medium' | 'high';
  revenueAtRisk: number;
  predictedChurnDate?: Date;
  factors: ChurnRiskFactor[];
  recommendedActions: string[];
}

export interface ChurnAnalysisSummary {
  totalCustomersAtRisk: number;
  totalRevenueAtRisk: number;
  averageChurnProbability: number;
  byRiskLevel: {
    high: { count: number; revenue: number };
    medium: { count: number; revenue: number };
    low: { count: number; revenue: number };
  };
  topRiskFactors: Array<{
    factor: string;
    affectedCustomers: number;
    averageImpact: number;
  }>;
  predictedChurnByMonth: Array<{
    month: Date;
    predictedChurns: number;
    revenueImpact: number;
  }>;
}

export interface ChurnModelFeatures {
  // Usage metrics
  loginFrequency: number;
  featureUsage: number;
  apiCalls: number;
  usageTrend: number;
  
  // Engagement metrics
  supportTickets: number;
  npsScore?: number;
  lastContactDays: number;
  productFeedback?: number;
  
  // Commercial metrics
  contractValue: number;
  paymentHistory: number;
  discountLevel: number;
  contractLength: number;
  renewalCount: number;
  
  // Account health
  healthScore: number;
  adoptionRate: number;
  integrationCount: number;
  userCount: number;
  userGrowthRate: number;
}

export class ChurnPredictionService {
  private modelVersion = '1.0.0';
  private modelWeights: Record<string, number>;
  
  constructor(
    private db: Database,
    private organizationId: string
  ) {
    // Initialize model weights (would be loaded from trained model)
    this.modelWeights = this.initializeModelWeights();
  }

  /**
   * Predict churn for all customers
   */
  async predictChurn(options?: {
    timeHorizon?: number; // months
    customerSegment?: string;
    minRevenue?: number;
    includeNewCustomers?: boolean;
  }): Promise<{
    predictions: CustomerChurnPrediction[];
    summary: ChurnAnalysisSummary;
  }> {
    const timeHorizon = options?.timeHorizon || 3;
    
    // Get customers to analyze
    const customers = await this.getCustomersForAnalysis(options);
    
    const predictions: CustomerChurnPrediction[] = [];
    const factorFrequency: Map<string, { count: number; totalImpact: number }> = new Map();
    
    for (const customer of customers) {
      // Extract features for prediction
      const features = await this.extractCustomerFeatures(customer);
      
      // Calculate churn probability
      const churnProb = this.calculateChurnProbability(features);
      
      // Identify risk factors
      const factors = this.identifyRiskFactors(features, churnProb);
      
      // Track factor frequency
      factors.forEach(factor => {
        const existing = factorFrequency.get(factor.factor) || { count: 0, totalImpact: 0 };
        factorFrequency.set(factor.factor, {
          count: existing.count + 1,
          totalImpact: existing.totalImpact + factor.impact
        });
      });
      
      // Calculate revenue at risk
      const revenueAtRisk = this.calculateRevenueAtRisk(
        customer.monthlyRevenue,
        churnProb,
        timeHorizon
      );
      
      // Predict churn date if high risk
      const predictedChurnDate = churnProb > 0.5 
        ? this.estimateChurnDate(customer, churnProb, timeHorizon)
        : undefined;
      
      // Generate recommended actions
      const recommendedActions = this.generateRecommendedActions(factors, churnProb);
      
      // Determine risk level
      const riskLevel = this.determineRiskLevel(churnProb);
      
      predictions.push({
        customerId: customer.id,
        customerName: customer.name,
        churnProbability: churnProb,
        riskLevel,
        revenueAtRisk,
        predictedChurnDate,
        factors,
        recommendedActions
      });
      
      // Save prediction to database
      await this.savePrediction(customer, churnProb, riskLevel, revenueAtRisk, predictedChurnDate, factors);
    }
    
    // Generate summary
    const summary = this.generateChurnSummary(predictions, factorFrequency, timeHorizon);
    
    return { predictions, summary };
  }

  /**
   * Update churn prediction for a specific customer
   */
  async updateCustomerPrediction(customerId: string): Promise<CustomerChurnPrediction> {
    const customer = await this.getCustomerById(customerId);
    
    if (!customer) {
      throw new Error(`Customer ${customerId} not found`);
    }
    
    const features = await this.extractCustomerFeatures(customer);
    const churnProb = this.calculateChurnProbability(features);
    const factors = this.identifyRiskFactors(features, churnProb);
    const revenueAtRisk = this.calculateRevenueAtRisk(customer.monthlyRevenue, churnProb, 3);
    const predictedChurnDate = churnProb > 0.5 ? this.estimateChurnDate(customer, churnProb, 3) : undefined;
    const recommendedActions = this.generateRecommendedActions(factors, churnProb);
    const riskLevel = this.determineRiskLevel(churnProb);
    
    await this.savePrediction(customer, churnProb, riskLevel, revenueAtRisk, predictedChurnDate, factors);
    
    return {
      customerId: customer.id,
      customerName: customer.name,
      churnProbability: churnProb,
      riskLevel,
      revenueAtRisk,
      predictedChurnDate,
      factors,
      recommendedActions
    };
  }

  /**
   * Get churn prevention recommendations
   */
  async getChurnPreventionStrategy(customerId: string): Promise<{
    customer: any;
    currentRisk: CustomerChurnPrediction;
    strategy: {
      immediateActions: Array<{
        action: string;
        priority: 'critical' | 'high' | 'medium';
        expectedImpact: number;
        timeline: string;
      }>;
      longTermActions: Array<{
        action: string;
        expectedImpact: number;
        timeline: string;
      }>;
      successMetrics: Array<{
        metric: string;
        currentValue: number;
        targetValue: number;
        timeframe: string;
      }>;
    };
    estimatedRetentionImprovement: number;
  }> {
    const customer = await this.getCustomerById(customerId);
    const currentRisk = await this.updateCustomerPrediction(customerId);
    
    // Generate prevention strategy based on risk factors
    const strategy = this.generatePreventionStrategy(currentRisk, customer);
    
    // Estimate retention improvement if actions are taken
    const estimatedRetentionImprovement = this.estimateRetentionImprovement(
      currentRisk.churnProbability,
      strategy.immediateActions
    );
    
    return {
      customer,
      currentRisk,
      strategy,
      estimatedRetentionImprovement
    };
  }

  /**
   * Track prediction accuracy
   */
  async trackPredictionAccuracy(
    startDate: Date,
    endDate: Date
  ): Promise<{
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    confusionMatrix: {
      truePositives: number;
      falsePositives: number;
      trueNegatives: number;
      falseNegatives: number;
    };
    byRiskLevel: Record<string, { accuracy: number; count: number }>;
  }> {
    // Get predictions made during the period
    const predictions = await this.getPredictionsInPeriod(startDate, endDate);
    
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;
    
    const byRiskLevel: Record<string, { correct: number; total: number }> = {
      high: { correct: 0, total: 0 },
      medium: { correct: 0, total: 0 },
      low: { correct: 0, total: 0 }
    };
    
    for (const prediction of predictions) {
      const actualChurned = prediction.actualChurned || false;
      const predictedChurn = prediction.churnProbability > 0.5;
      
      if (predictedChurn && actualChurned) {
        truePositives++;
      } else if (predictedChurn && !actualChurned) {
        falsePositives++;
      } else if (!predictedChurn && !actualChurned) {
        trueNegatives++;
      } else {
        falseNegatives++;
      }
      
      // Track by risk level
      const riskLevel = prediction.riskLevel;
      byRiskLevel[riskLevel].total++;
      
      if ((predictedChurn && actualChurned) || (!predictedChurn && !actualChurned)) {
        byRiskLevel[riskLevel].correct++;
      }
    }
    
    const total = truePositives + falsePositives + trueNegatives + falseNegatives;
    const accuracy = total > 0 ? (truePositives + trueNegatives) / total : 0;
    const precision = (truePositives + falsePositives) > 0 
      ? truePositives / (truePositives + falsePositives) 
      : 0;
    const recall = (truePositives + falseNegatives) > 0
      ? truePositives / (truePositives + falseNegatives)
      : 0;
    const f1Score = (precision + recall) > 0
      ? 2 * (precision * recall) / (precision + recall)
      : 0;
    
    return {
      accuracy,
      precision,
      recall,
      f1Score,
      confusionMatrix: {
        truePositives,
        falsePositives,
        trueNegatives,
        falseNegatives
      },
      byRiskLevel: Object.entries(byRiskLevel).reduce((acc, [level, data]) => ({
        ...acc,
        [level]: {
          accuracy: data.total > 0 ? data.correct / data.total : 0,
          count: data.total
        }
      }), {})
    };
  }

  // Private helper methods

  private initializeModelWeights(): Record<string, number> {
    // These would be loaded from a trained ML model
    return {
      loginFrequency: -0.3,
      featureUsage: -0.25,
      apiCalls: -0.15,
      usageTrend: -0.4,
      supportTickets: 0.2,
      npsScore: -0.35,
      lastContactDays: 0.15,
      productFeedback: -0.2,
      contractValue: -0.1,
      paymentHistory: -0.25,
      discountLevel: 0.1,
      contractLength: -0.15,
      renewalCount: -0.3,
      healthScore: -0.45,
      adoptionRate: -0.35,
      integrationCount: -0.2,
      userCount: -0.15,
      userGrowthRate: -0.25
    };
  }

  private async getCustomersForAnalysis(options?: any): Promise<any[]> {
    // Query actual customers based on options
    // For now, returning mock data
    const customers = [];
    const count = 100;
    
    for (let i = 0; i < count; i++) {
      customers.push({
        id: `customer-${i}`,
        name: `Customer ${i}`,
        monthlyRevenue: 1000 + Math.random() * 10000,
        segment: ['Enterprise', 'Mid-Market', 'SMB'][Math.floor(Math.random() * 3)],
        contractEndDate: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - Math.random() * 2 * 365 * 24 * 60 * 60 * 1000)
      });
    }
    
    return customers;
  }

  private async extractCustomerFeatures(customer: any): Promise<ChurnModelFeatures> {
    // Extract actual features from customer data
    // For now, generating mock features
    return {
      // Usage metrics
      loginFrequency: Math.random() * 30, // logins per month
      featureUsage: Math.random() * 100, // feature usage score
      apiCalls: Math.random() * 10000, // API calls per month
      usageTrend: -0.2 + Math.random() * 0.4, // trend coefficient
      
      // Engagement metrics
      supportTickets: Math.floor(Math.random() * 5),
      npsScore: Math.random() * 10,
      lastContactDays: Math.floor(Math.random() * 90),
      productFeedback: Math.random() * 5,
      
      // Commercial metrics
      contractValue: customer.monthlyRevenue,
      paymentHistory: 0.8 + Math.random() * 0.2, // payment reliability score
      discountLevel: Math.random() * 0.3,
      contractLength: 12 + Math.floor(Math.random() * 24),
      renewalCount: Math.floor(Math.random() * 5),
      
      // Account health
      healthScore: 30 + Math.random() * 70,
      adoptionRate: Math.random(),
      integrationCount: Math.floor(Math.random() * 10),
      userCount: 5 + Math.floor(Math.random() * 50),
      userGrowthRate: -0.1 + Math.random() * 0.3
    };
  }

  private calculateChurnProbability(features: ChurnModelFeatures): number {
    // Calculate weighted sum
    let logit = 0;
    
    // Normalize features and apply weights
    logit += this.modelWeights.loginFrequency * (features.loginFrequency / 30);
    logit += this.modelWeights.featureUsage * (features.featureUsage / 100);
    logit += this.modelWeights.apiCalls * Math.log10(features.apiCalls + 1) / 4;
    logit += this.modelWeights.usageTrend * features.usageTrend;
    
    logit += this.modelWeights.supportTickets * (features.supportTickets / 5);
    logit += this.modelWeights.npsScore * ((features.npsScore || 5) / 10);
    logit += this.modelWeights.lastContactDays * (features.lastContactDays / 90);
    logit += this.modelWeights.productFeedback * ((features.productFeedback || 3) / 5);
    
    logit += this.modelWeights.contractValue * Math.log10(features.contractValue) / 5;
    logit += this.modelWeights.paymentHistory * features.paymentHistory;
    logit += this.modelWeights.discountLevel * features.discountLevel;
    logit += this.modelWeights.contractLength * (features.contractLength / 36);
    logit += this.modelWeights.renewalCount * (features.renewalCount / 5);
    
    logit += this.modelWeights.healthScore * (features.healthScore / 100);
    logit += this.modelWeights.adoptionRate * features.adoptionRate;
    logit += this.modelWeights.integrationCount * (features.integrationCount / 10);
    logit += this.modelWeights.userCount * Math.log10(features.userCount + 1) / 2;
    logit += this.modelWeights.userGrowthRate * features.userGrowthRate;
    
    // Add bias term
    logit += 0.5;
    
    // Apply sigmoid function to get probability
    const probability = 1 / (1 + Math.exp(-logit));
    
    return Math.min(0.95, Math.max(0.05, probability));
  }

  private identifyRiskFactors(features: ChurnModelFeatures, churnProb: number): ChurnRiskFactor[] {
    const factors: ChurnRiskFactor[] = [];
    
    // Check usage decline
    if (features.usageTrend < -0.1) {
      factors.push({
        factor: 'usage_decline',
        impact: Math.abs(features.usageTrend) * 0.5,
        trend: 'decreasing',
        description: `Usage declining at ${(Math.abs(features.usageTrend) * 100).toFixed(1)}% per month`
      });
    }
    
    // Check low engagement
    if (features.loginFrequency < 5) {
      factors.push({
        factor: 'low_engagement',
        impact: 0.3,
        trend: 'stable',
        description: `Only ${features.loginFrequency.toFixed(0)} logins per month`
      });
    }
    
    // Check support issues
    if (features.supportTickets > 3) {
      factors.push({
        factor: 'support_issues',
        impact: 0.25,
        trend: 'increasing',
        description: `${features.supportTickets} support tickets recently`
      });
    }
    
    // Check NPS score
    if (features.npsScore && features.npsScore < 7) {
      factors.push({
        factor: 'low_satisfaction',
        impact: 0.35,
        trend: 'stable',
        description: `NPS score of ${features.npsScore.toFixed(1)}`
      });
    }
    
    // Check adoption
    if (features.adoptionRate < 0.5) {
      factors.push({
        factor: 'poor_adoption',
        impact: 0.3,
        trend: 'stable',
        description: `Only ${(features.adoptionRate * 100).toFixed(0)}% feature adoption`
      });
    }
    
    // Check integrations
    if (features.integrationCount < 2) {
      factors.push({
        factor: 'low_integration',
        impact: 0.2,
        trend: 'stable',
        description: 'Limited platform integration'
      });
    }
    
    // Check user growth
    if (features.userGrowthRate < 0) {
      factors.push({
        factor: 'user_decline',
        impact: Math.abs(features.userGrowthRate) * 0.4,
        trend: 'decreasing',
        description: `User base shrinking at ${(Math.abs(features.userGrowthRate) * 100).toFixed(1)}%`
      });
    }
    
    // Check health score
    if (features.healthScore < 50) {
      factors.push({
        factor: 'poor_health_score',
        impact: (50 - features.healthScore) / 100,
        trend: 'stable',
        description: `Health score of ${features.healthScore.toFixed(0)}/100`
      });
    }
    
    // Sort by impact
    factors.sort((a, b) => b.impact - a.impact);
    
    return factors;
  }

  private calculateRevenueAtRisk(monthlyRevenue: number, churnProb: number, timeHorizon: number): number {
    // Calculate expected revenue loss
    return monthlyRevenue * timeHorizon * churnProb;
  }

  private estimateChurnDate(customer: any, churnProb: number, timeHorizon: number): Date {
    // Estimate when churn is most likely to occur
    const daysUntilChurn = Math.floor((1 - churnProb) * timeHorizon * 30);
    const churnDate = new Date();
    churnDate.setDate(churnDate.getDate() + daysUntilChurn);
    
    // Don't predict beyond contract end
    if (customer.contractEndDate && churnDate > customer.contractEndDate) {
      return customer.contractEndDate;
    }
    
    return churnDate;
  }

  private generateRecommendedActions(factors: ChurnRiskFactor[], churnProb: number): string[] {
    const actions: string[] = [];
    
    // Priority actions based on risk level
    if (churnProb > 0.7) {
      actions.push('Schedule immediate executive business review');
      actions.push('Assign dedicated customer success manager');
    } else if (churnProb > 0.4) {
      actions.push('Schedule quarterly business review');
      actions.push('Increase check-in frequency to bi-weekly');
    }
    
    // Factor-specific actions
    for (const factor of factors.slice(0, 3)) { // Top 3 factors
      switch (factor.factor) {
        case 'usage_decline':
          actions.push('Conduct usage analysis and training session');
          actions.push('Identify and remove adoption barriers');
          break;
        case 'low_engagement':
          actions.push('Launch re-engagement campaign');
          actions.push('Offer personalized onboarding refresh');
          break;
        case 'support_issues':
          actions.push('Escalate to technical account management');
          actions.push('Conduct root cause analysis of issues');
          break;
        case 'low_satisfaction':
          actions.push('Executive outreach to address concerns');
          actions.push('Create custom success plan');
          break;
        case 'poor_adoption':
          actions.push('Provide advanced training workshops');
          actions.push('Share best practices from similar customers');
          break;
        case 'low_integration':
          actions.push('Offer integration assistance');
          actions.push('Demonstrate ROI of deeper integration');
          break;
        case 'user_decline':
          actions.push('Investigate user churn reasons');
          actions.push('Implement user retention program');
          break;
        case 'poor_health_score':
          actions.push('Develop health improvement plan');
          actions.push('Increase touchpoint frequency');
          break;
      }
    }
    
    return [...new Set(actions)]; // Remove duplicates
  }

  private determineRiskLevel(churnProb: number): 'low' | 'medium' | 'high' {
    if (churnProb > 0.7) return 'high';
    if (churnProb > 0.3) return 'medium';
    return 'low';
  }

  private async savePrediction(
    customer: any,
    churnProb: number,
    riskLevel: string,
    revenueAtRisk: number,
    predictedChurnDate: Date | undefined,
    factors: ChurnRiskFactor[]
  ): Promise<void> {
    await this.db.insert(churnPredictions).values({
      organizationId: this.organizationId,
      customerId: customer.id,
      predictionDate: new Date(),
      churnProbability: String(churnProb),
      riskLevel,
      predictedChurnDate,
      monthlyRevenue: String(customer.monthlyRevenue),
      revenueAtRisk: String(revenueAtRisk),
      lifetimeValue: String(customer.monthlyRevenue * 24), // Simplified LTV
      riskFactors: factors,
      modelVersion: this.modelVersion,
      modelConfidence: String(0.75 + Math.random() * 0.2) // Mock confidence
    }).onConflictDoUpdate({
      target: [churnPredictions.customerId, churnPredictions.predictionDate],
      set: {
        churnProbability: String(churnProb),
        riskLevel,
        revenueAtRisk: String(revenueAtRisk),
        riskFactors: factors,
        updatedAt: new Date()
      }
    });
  }

  private generateChurnSummary(
    predictions: CustomerChurnPrediction[],
    factorFrequency: Map<string, { count: number; totalImpact: number }>,
    timeHorizon: number
  ): ChurnAnalysisSummary {
    const totalCustomersAtRisk = predictions.filter(p => p.churnProbability > 0.3).length;
    const totalRevenueAtRisk = predictions.reduce((sum, p) => sum + p.revenueAtRisk, 0);
    const averageChurnProbability = predictions.reduce((sum, p) => sum + p.churnProbability, 0) / predictions.length;
    
    // Group by risk level
    const byRiskLevel = {
      high: {
        count: predictions.filter(p => p.riskLevel === 'high').length,
        revenue: predictions.filter(p => p.riskLevel === 'high').reduce((sum, p) => sum + p.revenueAtRisk, 0)
      },
      medium: {
        count: predictions.filter(p => p.riskLevel === 'medium').length,
        revenue: predictions.filter(p => p.riskLevel === 'medium').reduce((sum, p) => sum + p.revenueAtRisk, 0)
      },
      low: {
        count: predictions.filter(p => p.riskLevel === 'low').length,
        revenue: predictions.filter(p => p.riskLevel === 'low').reduce((sum, p) => sum + p.revenueAtRisk, 0)
      }
    };
    
    // Top risk factors
    const topRiskFactors = Array.from(factorFrequency.entries())
      .map(([factor, data]) => ({
        factor,
        affectedCustomers: data.count,
        averageImpact: data.totalImpact / data.count
      }))
      .sort((a, b) => b.affectedCustomers - a.affectedCustomers)
      .slice(0, 5);
    
    // Predicted churn by month
    const predictedChurnByMonth: Array<{
      month: Date;
      predictedChurns: number;
      revenueImpact: number;
    }> = [];
    
    for (let i = 0; i < timeHorizon; i++) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() + i);
      monthStart.setDate(1);
      
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      
      const monthChurns = predictions.filter(p => 
        p.predictedChurnDate && 
        p.predictedChurnDate >= monthStart && 
        p.predictedChurnDate < monthEnd
      );
      
      predictedChurnByMonth.push({
        month: monthStart,
        predictedChurns: monthChurns.length,
        revenueImpact: monthChurns.reduce((sum, p) => sum + p.revenueAtRisk, 0) / timeHorizon
      });
    }
    
    return {
      totalCustomersAtRisk,
      totalRevenueAtRisk,
      averageChurnProbability,
      byRiskLevel,
      topRiskFactors,
      predictedChurnByMonth
    };
  }

  private async getCustomerById(customerId: string): Promise<any> {
    // Query actual customer data
    // For now, returning mock data
    return {
      id: customerId,
      name: `Customer ${customerId}`,
      monthlyRevenue: 5000,
      segment: 'Mid-Market',
      contractEndDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    };
  }

  private generatePreventionStrategy(risk: CustomerChurnPrediction, customer: any): any {
    const immediateActions = [];
    const longTermActions = [];
    const successMetrics = [];
    
    // Immediate actions based on risk level
    if (risk.riskLevel === 'high') {
      immediateActions.push({
        action: 'Executive intervention within 48 hours',
        priority: 'critical' as const,
        expectedImpact: 0.3,
        timeline: '2 days'
      });
      immediateActions.push({
        action: 'Offer immediate value demonstration session',
        priority: 'critical' as const,
        expectedImpact: 0.2,
        timeline: '1 week'
      });
    }
    
    // Factor-specific immediate actions
    for (const factor of risk.factors.slice(0, 2)) {
      if (factor.impact > 0.3) {
        immediateActions.push({
          action: `Address ${factor.factor.replace('_', ' ')} issue`,
          priority: 'high' as const,
          expectedImpact: factor.impact * 0.5,
          timeline: '1 week'
        });
      }
    }
    
    // Long-term actions
    longTermActions.push({
      action: 'Implement quarterly business reviews',
      expectedImpact: 0.15,
      timeline: '3 months'
    });
    longTermActions.push({
      action: 'Develop custom success plan',
      expectedImpact: 0.2,
      timeline: '1 month'
    });
    
    // Success metrics
    successMetrics.push({
      metric: 'Login frequency',
      currentValue: 5,
      targetValue: 15,
      timeframe: '30 days'
    });
    successMetrics.push({
      metric: 'Feature adoption',
      currentValue: 0.3,
      targetValue: 0.7,
      timeframe: '60 days'
    });
    successMetrics.push({
      metric: 'Health score',
      currentValue: 45,
      targetValue: 70,
      timeframe: '90 days'
    });
    
    return {
      immediateActions,
      longTermActions,
      successMetrics
    };
  }

  private estimateRetentionImprovement(
    currentChurnProb: number,
    actions: any[]
  ): number {
    // Estimate improvement based on actions
    const totalImpact = actions.reduce((sum, action) => sum + action.expectedImpact, 0);
    const improvedChurnProb = Math.max(0.05, currentChurnProb * (1 - totalImpact));
    return currentChurnProb - improvedChurnProb;
  }

  private async getPredictionsInPeriod(startDate: Date, endDate: Date): Promise<any[]> {
    // Query predictions from database
    const predictions = await this.db.select()
      .from(churnPredictions)
      .where(and(
        eq(churnPredictions.organizationId, this.organizationId),
        gte(churnPredictions.predictionDate, startDate),
        lte(churnPredictions.predictionDate, endDate)
      ));
    
    return predictions;
  }
}