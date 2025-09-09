import { Database } from '@glapi/database';
import {
  scenarioAnalysis,
  ScenarioAnalysis
} from '@glapi/database/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { RevenueForecastingEngine, ForecastResult } from './revenue-forecasting-engine';

export interface ScenarioAssumptions {
  // Growth assumptions
  customerGrowthRate?: number;
  newLogoGrowthRate?: number;
  expansionRate?: number;
  
  // Churn and contraction
  churnRateChange?: number;
  contractionRate?: number;
  
  // Pricing
  priceChangePercent?: number;
  discountingChange?: number;
  
  // Market factors
  marketGrowthRate?: number;
  competitorImpact?: 'none' | 'low' | 'medium' | 'high';
  economicConditions?: 'recession' | 'slowdown' | 'normal' | 'growth' | 'boom';
  
  // Product changes
  newProductLaunch?: boolean;
  productSunset?: boolean;
  featureExpansion?: boolean;
  
  // Operational changes
  salesEfficiencyChange?: number;
  customerSuccessInvestment?: number;
  marketingSpendChange?: number;
}

export interface ScenarioResult {
  scenarioId: string;
  scenarioName: string;
  baseline: {
    arr: number;
    mrr: number;
    customerCount: number;
    forecast: ForecastResult;
  };
  scenario: {
    arr: number;
    mrr: number;
    customerCount: number;
    forecast: ForecastResult;
  };
  impact: {
    arrDifference: number;
    arrPercentChange: number;
    mrrDifference: number;
    customersDifference: number;
    breakEvenPoint?: Date;
    paybackPeriod?: number;
  };
  riskAssessment: {
    riskLevel: 'low' | 'medium' | 'high';
    confidenceLevel: number;
    keyRisks: string[];
    mitigationStrategies: string[];
  };
  recommendations: string[];
  sensitivityAnalysis: Array<{
    variable: string;
    currentValue: number;
    impact: number;
    sensitivity: 'low' | 'medium' | 'high';
  }>;
}

export interface MonteCarloSimulation {
  scenarios: number;
  results: {
    mean: number;
    median: number;
    stdDev: number;
    percentile5: number;
    percentile25: number;
    percentile75: number;
    percentile95: number;
    distribution: Array<{ value: number; probability: number }>;
  };
  mostLikelyOutcome: number;
  confidenceInterval: [number, number];
}

export class ScenarioAnalysisService {
  private forecastingEngine: RevenueForecastingEngine;
  
  constructor(
    private db: typeof Database,
    private organizationId: string
  ) {
    this.forecastingEngine = new RevenueForecastingEngine(db, organizationId);
  }

  /**
   * Run what-if scenario analysis
   */
  async runScenario(
    scenarioName: string,
    scenarioType: 'growth' | 'recession' | 'best_case' | 'worst_case' | 'custom',
    assumptions: ScenarioAssumptions,
    horizon: number = 12 // months
  ): Promise<ScenarioResult> {
    // Generate baseline forecast
    const baseline = await this.generateBaselineForecast(horizon);
    
    // Apply scenario assumptions to generate scenario forecast
    const scenarioForecast = await this.generateScenarioForecast(assumptions, horizon);
    
    // Calculate current metrics
    const currentMetrics = await this.getCurrentMetrics();
    
    // Calculate baseline end state
    const baselineEndState = this.calculateEndState(baseline, currentMetrics);
    
    // Calculate scenario end state
    const scenarioEndState = this.calculateEndState(scenarioForecast, currentMetrics, assumptions);
    
    // Calculate impact
    const impact = this.calculateImpact(baselineEndState, scenarioEndState, horizon);
    
    // Assess risks
    const riskAssessment = this.assessScenarioRisk(assumptions, impact);
    
    // Run sensitivity analysis
    const sensitivityAnalysis = await this.runSensitivityAnalysis(assumptions, baseline);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(
      scenarioType,
      assumptions,
      impact,
      riskAssessment
    );
    
    // Save scenario to database
    const scenarioId = await this.saveScenario(
      scenarioName,
      scenarioType,
      assumptions,
      baselineEndState,
      scenarioEndState,
      impact,
      recommendations
    );
    
    return {
      scenarioId,
      scenarioName,
      baseline: {
        arr: baselineEndState.arr,
        mrr: baselineEndState.mrr,
        customerCount: baselineEndState.customers,
        forecast: baseline
      },
      scenario: {
        arr: scenarioEndState.arr,
        mrr: scenarioEndState.mrr,
        customerCount: scenarioEndState.customers,
        forecast: scenarioForecast
      },
      impact,
      riskAssessment,
      recommendations,
      sensitivityAnalysis
    };
  }

  /**
   * Run Monte Carlo simulation for probabilistic forecasting
   */
  async runMonteCarloSimulation(
    baseAssumptions: ScenarioAssumptions,
    varianceRanges: Record<string, { min: number; max: number }>,
    scenarios: number = 1000,
    horizon: number = 12
  ): Promise<MonteCarloSimulation> {
    const results: number[] = [];
    
    for (let i = 0; i < scenarios; i++) {
      // Generate random assumptions within variance ranges
      const randomAssumptions = this.generateRandomAssumptions(baseAssumptions, varianceRanges);
      
      // Run scenario with random assumptions
      const scenarioResult = await this.generateScenarioForecast(randomAssumptions, horizon);
      
      // Calculate end-state ARR
      const endStateARR = this.calculateTotalRevenue(scenarioResult);
      results.push(endStateARR);
    }
    
    // Calculate statistics
    results.sort((a, b) => a - b);
    
    const mean = results.reduce((sum, val) => sum + val, 0) / results.length;
    const median = results[Math.floor(results.length / 2)];
    
    const variance = results.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / results.length;
    const stdDev = Math.sqrt(variance);
    
    const percentile5 = results[Math.floor(results.length * 0.05)];
    const percentile25 = results[Math.floor(results.length * 0.25)];
    const percentile75 = results[Math.floor(results.length * 0.75)];
    const percentile95 = results[Math.floor(results.length * 0.95)];
    
    // Create distribution histogram
    const distribution = this.createDistribution(results);
    
    // Find most likely outcome (mode)
    const mostLikelyOutcome = this.findMode(results);
    
    // 90% confidence interval
    const confidenceInterval: [number, number] = [percentile5, percentile95];
    
    return {
      scenarios,
      results: {
        mean,
        median,
        stdDev,
        percentile5,
        percentile25,
        percentile75,
        percentile95,
        distribution
      },
      mostLikelyOutcome,
      confidenceInterval
    };
  }

  /**
   * Compare multiple scenarios
   */
  async compareScenarios(
    scenarios: Array<{
      name: string;
      type: 'growth' | 'recession' | 'best_case' | 'worst_case' | 'custom';
      assumptions: ScenarioAssumptions;
      probability?: number;
    }>,
    horizon: number = 12
  ): Promise<{
    baseline: ForecastResult;
    scenarios: ScenarioResult[];
    comparison: {
      bestCase: ScenarioResult;
      worstCase: ScenarioResult;
      mostLikely: ScenarioResult;
      expectedValue: number;
    };
    recommendations: string[];
  }> {
    // Generate baseline
    const baseline = await this.generateBaselineForecast(horizon);
    
    // Run all scenarios
    const scenarioResults: ScenarioResult[] = [];
    
    for (const scenario of scenarios) {
      const result = await this.runScenario(
        scenario.name,
        scenario.type,
        scenario.assumptions,
        horizon
      );
      scenarioResults.push(result);
    }
    
    // Find best and worst cases
    const bestCase = scenarioResults.reduce((best, current) => 
      current.scenario.arr > best.scenario.arr ? current : best
    );
    
    const worstCase = scenarioResults.reduce((worst, current) =>
      current.scenario.arr < worst.scenario.arr ? current : worst
    );
    
    // Calculate expected value if probabilities provided
    let expectedValue = 0;
    let mostLikely = scenarioResults[0];
    
    if (scenarios.some(s => s.probability)) {
      const totalProbability = scenarios.reduce((sum, s) => sum + (s.probability || 0), 0);
      
      if (totalProbability > 0) {
        expectedValue = scenarioResults.reduce((sum, result, index) => {
          const probability = (scenarios[index].probability || 0) / totalProbability;
          return sum + result.scenario.arr * probability;
        }, 0);
        
        // Find most likely scenario
        const maxProbIndex = scenarios.reduce((maxIdx, current, idx) =>
          (current.probability || 0) > (scenarios[maxIdx].probability || 0) ? idx : maxIdx, 0
        );
        mostLikely = scenarioResults[maxProbIndex];
      }
    }
    
    // Generate comparative recommendations
    const recommendations = this.generateComparativeRecommendations(
      scenarioResults,
      bestCase,
      worstCase,
      expectedValue
    );
    
    return {
      baseline,
      scenarios: scenarioResults,
      comparison: {
        bestCase,
        worstCase,
        mostLikely,
        expectedValue
      },
      recommendations
    };
  }

  /**
   * Create standard scenarios (recession, growth, etc.)
   */
  async createStandardScenarios(): Promise<{
    scenarios: Array<{
      name: string;
      type: string;
      assumptions: ScenarioAssumptions;
    }>;
  }> {
    return {
      scenarios: [
        {
          name: 'Aggressive Growth',
          type: 'best_case',
          assumptions: {
            customerGrowthRate: 0.3, // 30% growth
            newLogoGrowthRate: 0.4,
            expansionRate: 0.2,
            churnRateChange: -0.2, // 20% churn reduction
            priceChangePercent: 0.1,
            marketGrowthRate: 0.25,
            competitorImpact: 'low',
            economicConditions: 'boom',
            newProductLaunch: true,
            salesEfficiencyChange: 0.3
          }
        },
        {
          name: 'Moderate Growth',
          type: 'growth',
          assumptions: {
            customerGrowthRate: 0.15,
            newLogoGrowthRate: 0.2,
            expansionRate: 0.1,
            churnRateChange: -0.05,
            priceChangePercent: 0.05,
            marketGrowthRate: 0.1,
            competitorImpact: 'low',
            economicConditions: 'growth'
          }
        },
        {
          name: 'Status Quo',
          type: 'custom',
          assumptions: {
            customerGrowthRate: 0.05,
            newLogoGrowthRate: 0.05,
            expansionRate: 0.05,
            churnRateChange: 0,
            priceChangePercent: 0,
            marketGrowthRate: 0.05,
            competitorImpact: 'medium',
            economicConditions: 'normal'
          }
        },
        {
          name: 'Economic Slowdown',
          type: 'recession',
          assumptions: {
            customerGrowthRate: -0.05,
            newLogoGrowthRate: -0.1,
            expansionRate: -0.05,
            churnRateChange: 0.1,
            contractionRate: 0.1,
            priceChangePercent: -0.05,
            marketGrowthRate: -0.05,
            competitorImpact: 'high',
            economicConditions: 'slowdown'
          }
        },
        {
          name: 'Severe Recession',
          type: 'worst_case',
          assumptions: {
            customerGrowthRate: -0.2,
            newLogoGrowthRate: -0.3,
            expansionRate: -0.15,
            churnRateChange: 0.3,
            contractionRate: 0.2,
            priceChangePercent: -0.1,
            marketGrowthRate: -0.2,
            competitorImpact: 'high',
            economicConditions: 'recession',
            customerSuccessInvestment: -0.3
          }
        }
      ]
    };
  }

  /**
   * Goal seek analysis - find required inputs for target outcome
   */
  async goalSeek(
    targetARR: number,
    variableToOptimize: keyof ScenarioAssumptions,
    constraints: Partial<ScenarioAssumptions>,
    horizon: number = 12
  ): Promise<{
    requiredValue: number;
    feasibility: 'feasible' | 'challenging' | 'unrealistic';
    scenario: ScenarioResult;
    alternativeApproaches: Array<{
      variable: string;
      requiredValue: number;
      feasibility: string;
    }>;
  }> {
    // Binary search for the required value
    let low = -1;
    let high = 1;
    let requiredValue = 0;
    let bestScenario: ScenarioResult | null = null;
    
    // Determine reasonable bounds for the variable
    const bounds = this.getVariableBounds(variableToOptimize);
    low = bounds.min;
    high = bounds.max;
    
    // Binary search
    while (high - low > 0.001) {
      const mid = (low + high) / 2;
      
      const assumptions: ScenarioAssumptions = {
        ...constraints,
        [variableToOptimize]: mid
      };
      
      const scenario = await this.runScenario(
        'Goal Seek',
        'custom',
        assumptions,
        horizon
      );
      
      if (scenario.scenario.arr < targetARR) {
        low = mid;
      } else {
        high = mid;
        requiredValue = mid;
        bestScenario = scenario;
      }
    }
    
    // Assess feasibility
    const feasibility = this.assessFeasibility(variableToOptimize, requiredValue);
    
    // Find alternative approaches
    const alternativeApproaches = await this.findAlternativeApproaches(
      targetARR,
      variableToOptimize,
      constraints,
      horizon
    );
    
    return {
      requiredValue,
      feasibility,
      scenario: bestScenario!,
      alternativeApproaches
    };
  }

  // Private helper methods

  private async generateBaselineForecast(horizon: number): Promise<ForecastResult> {
    return await this.forecastingEngine.generateForecast({
      forecastPeriods: horizon,
      periodType: 'month',
      model: 'auto',
      includeSeasonality: true
    });
  }

  private async generateScenarioForecast(
    assumptions: ScenarioAssumptions,
    horizon: number
  ): Promise<ForecastResult> {
    // Generate base forecast
    const baseForecast = await this.forecastingEngine.generateForecast({
      forecastPeriods: horizon,
      periodType: 'month',
      model: 'auto'
    });
    
    // Apply scenario assumptions to modify forecast
    const modifiedForecast = { ...baseForecast };
    
    modifiedForecast.periods = baseForecast.periods.map((period, index) => {
      let adjustmentFactor = 1;
      
      // Apply growth rate
      if (assumptions.customerGrowthRate) {
        adjustmentFactor *= 1 + (assumptions.customerGrowthRate * (index + 1) / horizon);
      }
      
      // Apply price changes
      if (assumptions.priceChangePercent) {
        adjustmentFactor *= 1 + assumptions.priceChangePercent;
      }
      
      // Apply churn impact
      if (assumptions.churnRateChange) {
        adjustmentFactor *= 1 - (assumptions.churnRateChange * 0.1); // Churn affects 10% of base
      }
      
      // Apply market factors
      if (assumptions.marketGrowthRate) {
        adjustmentFactor *= 1 + (assumptions.marketGrowthRate * 0.5); // Market affects 50% of growth
      }
      
      // Apply competitive impact
      if (assumptions.competitorImpact) {
        const competitorImpactFactors = {
          none: 1,
          low: 0.95,
          medium: 0.9,
          high: 0.8
        };
        adjustmentFactor *= competitorImpactFactors[assumptions.competitorImpact];
      }
      
      // Apply economic conditions
      if (assumptions.economicConditions) {
        const economicFactors = {
          recession: 0.8,
          slowdown: 0.9,
          normal: 1,
          growth: 1.1,
          boom: 1.2
        };
        adjustmentFactor *= economicFactors[assumptions.economicConditions];
      }
      
      return {
        ...period,
        forecast: period.forecast * adjustmentFactor,
        lowerBound: period.lowerBound * adjustmentFactor,
        upperBound: period.upperBound * adjustmentFactor,
        components: {
          ...period.components,
          base: period.components.base * adjustmentFactor
        }
      };
    });
    
    return modifiedForecast;
  }

  private async getCurrentMetrics(): Promise<{
    arr: number;
    mrr: number;
    customers: number;
    avgContractValue: number;
  }> {
    // Query actual current metrics
    // For now, returning mock data
    return {
      arr: 1200000,
      mrr: 100000,
      customers: 100,
      avgContractValue: 12000
    };
  }

  private calculateEndState(
    forecast: ForecastResult,
    currentMetrics: any,
    assumptions?: ScenarioAssumptions
  ): {
    arr: number;
    mrr: number;
    customers: number;
  } {
    const lastPeriod = forecast.periods[forecast.periods.length - 1];
    const totalForecastRevenue = forecast.periods.reduce((sum, p) => sum + p.forecast, 0);
    const avgMonthlyRevenue = totalForecastRevenue / forecast.periods.length;
    
    let customerGrowthFactor = 1;
    if (assumptions?.customerGrowthRate) {
      customerGrowthFactor = 1 + assumptions.customerGrowthRate;
    }
    
    return {
      arr: avgMonthlyRevenue * 12,
      mrr: avgMonthlyRevenue,
      customers: Math.round(currentMetrics.customers * customerGrowthFactor)
    };
  }

  private calculateImpact(
    baseline: any,
    scenario: any,
    horizon: number
  ): {
    arrDifference: number;
    arrPercentChange: number;
    mrrDifference: number;
    customersDifference: number;
    breakEvenPoint?: Date;
    paybackPeriod?: number;
  } {
    return {
      arrDifference: scenario.arr - baseline.arr,
      arrPercentChange: ((scenario.arr - baseline.arr) / baseline.arr) * 100,
      mrrDifference: scenario.mrr - baseline.mrr,
      customersDifference: scenario.customers - baseline.customers,
      breakEvenPoint: scenario.arr > baseline.arr ? new Date() : undefined,
      paybackPeriod: scenario.arr > baseline.arr ? Math.ceil(horizon / 2) : undefined
    };
  }

  private assessScenarioRisk(
    assumptions: ScenarioAssumptions,
    impact: any
  ): {
    riskLevel: 'low' | 'medium' | 'high';
    confidenceLevel: number;
    keyRisks: string[];
    mitigationStrategies: string[];
  } {
    let riskScore = 0;
    const keyRisks: string[] = [];
    const mitigationStrategies: string[] = [];
    
    // Assess assumption aggressiveness
    if (Math.abs(assumptions.customerGrowthRate || 0) > 0.3) {
      riskScore += 2;
      keyRisks.push('Aggressive customer growth assumptions');
      mitigationStrategies.push('Develop phased growth plan with milestones');
    }
    
    if (Math.abs(assumptions.churnRateChange || 0) > 0.2) {
      riskScore += 2;
      keyRisks.push('Significant churn rate change assumed');
      mitigationStrategies.push('Implement customer success initiatives');
    }
    
    if (assumptions.competitorImpact === 'high') {
      riskScore += 3;
      keyRisks.push('High competitive pressure');
      mitigationStrategies.push('Strengthen competitive differentiation');
    }
    
    if (assumptions.economicConditions === 'recession') {
      riskScore += 3;
      keyRisks.push('Economic downturn risk');
      mitigationStrategies.push('Build cash reserves and reduce costs');
    }
    
    // Assess impact magnitude
    if (Math.abs(impact.arrPercentChange) > 30) {
      riskScore += 2;
      keyRisks.push('High variance from baseline');
    }
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high';
    if (riskScore >= 7) riskLevel = 'high';
    else if (riskScore >= 4) riskLevel = 'medium';
    else riskLevel = 'low';
    
    // Calculate confidence level
    const confidenceLevel = Math.max(0.3, 1 - (riskScore * 0.1));
    
    return {
      riskLevel,
      confidenceLevel,
      keyRisks,
      mitigationStrategies
    };
  }

  private async runSensitivityAnalysis(
    baseAssumptions: ScenarioAssumptions,
    baseline: ForecastResult
  ): Promise<Array<{
    variable: string;
    currentValue: number;
    impact: number;
    sensitivity: 'low' | 'medium' | 'high';
  }>> {
    const results = [];
    const variables = [
      'customerGrowthRate',
      'churnRateChange',
      'priceChangePercent',
      'expansionRate'
    ];
    
    for (const variable of variables) {
      const currentValue = (baseAssumptions as any)[variable] || 0;
      
      // Test +/- 10% change
      const upAssumptions = { ...baseAssumptions, [variable]: currentValue + 0.1 };
      const downAssumptions = { ...baseAssumptions, [variable]: currentValue - 0.1 };
      
      const upScenario = await this.generateScenarioForecast(upAssumptions, 12);
      const downScenario = await this.generateScenarioForecast(downAssumptions, 12);
      
      const upRevenue = this.calculateTotalRevenue(upScenario);
      const downRevenue = this.calculateTotalRevenue(downScenario);
      const baseRevenue = this.calculateTotalRevenue(baseline);
      
      const impact = Math.abs((upRevenue - downRevenue) / baseRevenue);
      
      let sensitivity: 'low' | 'medium' | 'high';
      if (impact > 0.2) sensitivity = 'high';
      else if (impact > 0.1) sensitivity = 'medium';
      else sensitivity = 'low';
      
      results.push({
        variable,
        currentValue,
        impact,
        sensitivity
      });
    }
    
    return results.sort((a, b) => b.impact - a.impact);
  }

  private generateRecommendations(
    scenarioType: string,
    assumptions: ScenarioAssumptions,
    impact: any,
    riskAssessment: any
  ): string[] {
    const recommendations: string[] = [];
    
    // Scenario-specific recommendations
    if (scenarioType === 'growth' || scenarioType === 'best_case') {
      recommendations.push('Invest in sales and marketing to capture growth opportunity');
      recommendations.push('Scale customer success team to maintain quality');
      recommendations.push('Consider raising capital to accelerate growth');
    } else if (scenarioType === 'recession' || scenarioType === 'worst_case') {
      recommendations.push('Focus on customer retention and reduce churn');
      recommendations.push('Optimize costs and extend runway');
      recommendations.push('Prioritize high-value customers and segments');
    }
    
    // Impact-based recommendations
    if (impact.arrPercentChange > 20) {
      recommendations.push('Develop contingency plans for high-impact scenario');
    }
    
    if (impact.customersDifference < 0) {
      recommendations.push('Implement customer retention programs');
    }
    
    // Risk-based recommendations
    if (riskAssessment.riskLevel === 'high') {
      recommendations.push('Increase monitoring frequency and establish early warning metrics');
      recommendations.push('Develop multiple scenario response plans');
    }
    
    // Assumption-specific recommendations
    if (assumptions.newProductLaunch) {
      recommendations.push('Allocate resources for product development and go-to-market');
    }
    
    if (assumptions.competitorImpact === 'high') {
      recommendations.push('Strengthen competitive positioning and differentiation');
    }
    
    return recommendations;
  }

  private async saveScenario(
    name: string,
    type: string,
    assumptions: ScenarioAssumptions,
    baseline: any,
    scenario: any,
    impact: any,
    recommendations: string[]
  ): Promise<string> {
    const [saved] = await this.db.insert(scenarioAnalysis).values({
      organizationId: this.organizationId,
      scenarioName: name,
      scenarioType: type,
      scenarioDescription: `${type} scenario with ${Object.keys(assumptions).length} assumptions`,
      assumptions,
      baselineARR: String(baseline.arr),
      scenarioARR: String(scenario.arr),
      arrImpact: String(impact.arrDifference),
      impactPercentage: String(impact.arrPercentChange),
      analysisStartDate: new Date(),
      analysisEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      probability: String(0.5), // Default probability
      riskLevel: 'medium',
      recommendations,
      actionItems: []
    }).returning();
    
    return saved.id;
  }

  private generateRandomAssumptions(
    base: ScenarioAssumptions,
    ranges: Record<string, { min: number; max: number }>
  ): ScenarioAssumptions {
    const random: any = { ...base };
    
    for (const [key, range] of Object.entries(ranges)) {
      if (range && typeof range.min === 'number' && typeof range.max === 'number') {
        random[key] = range.min + Math.random() * (range.max - range.min);
      }
    }
    
    return random;
  }

  private calculateTotalRevenue(forecast: ForecastResult): number {
    return forecast.periods.reduce((sum, p) => sum + p.forecast, 0);
  }

  private createDistribution(values: number[]): Array<{ value: number; probability: number }> {
    const buckets = 20;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const bucketSize = (max - min) / buckets;
    
    const distribution: Array<{ value: number; probability: number }> = [];
    
    for (let i = 0; i < buckets; i++) {
      const bucketMin = min + i * bucketSize;
      const bucketMax = bucketMin + bucketSize;
      const count = values.filter(v => v >= bucketMin && v < bucketMax).length;
      
      distribution.push({
        value: (bucketMin + bucketMax) / 2,
        probability: count / values.length
      });
    }
    
    return distribution;
  }

  private findMode(values: number[]): number {
    const counts = new Map<number, number>();
    const rounded = values.map(v => Math.round(v / 1000) * 1000); // Round to nearest 1000
    
    for (const value of rounded) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    
    let maxCount = 0;
    let mode = 0;
    
    for (const [value, count] of counts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mode = value;
      }
    }
    
    return mode;
  }

  private generateComparativeRecommendations(
    scenarios: ScenarioResult[],
    bestCase: ScenarioResult,
    worstCase: ScenarioResult,
    expectedValue: number
  ): string[] {
    const recommendations: string[] = [];
    
    // Range analysis
    const range = bestCase.scenario.arr - worstCase.scenario.arr;
    const rangePercent = (range / worstCase.scenario.arr) * 100;
    
    if (rangePercent > 50) {
      recommendations.push('High scenario variance - focus on risk mitigation');
      recommendations.push('Develop flexible plans that can adapt to different outcomes');
    }
    
    // Expected value analysis
    if (expectedValue > 0) {
      const currentArr = scenarios[0]?.baseline?.arr || 0;
      if (expectedValue > currentArr * 1.2) {
        recommendations.push('Expected outcome is positive - prepare for growth');
      } else if (expectedValue < currentArr * 0.9) {
        recommendations.push('Expected outcome is concerning - implement protective measures');
      }
    }
    
    // Risk concentration
    const highRiskScenarios = scenarios.filter(s => s.riskAssessment.riskLevel === 'high');
    if (highRiskScenarios.length > scenarios.length / 2) {
      recommendations.push('Multiple high-risk scenarios - strengthen business resilience');
    }
    
    recommendations.push('Monitor leading indicators monthly to detect scenario shifts early');
    recommendations.push('Create trigger-based action plans for each scenario');
    
    return recommendations;
  }

  private getVariableBounds(variable: keyof ScenarioAssumptions): { min: number; max: number } {
    const bounds: Record<string, { min: number; max: number }> = {
      customerGrowthRate: { min: -0.5, max: 1.0 },
      churnRateChange: { min: -0.5, max: 0.5 },
      priceChangePercent: { min: -0.3, max: 0.5 },
      expansionRate: { min: -0.3, max: 0.5 },
      salesEfficiencyChange: { min: -0.5, max: 1.0 }
    };
    
    return bounds[variable as string] || { min: -1, max: 1 };
  }

  private assessFeasibility(variable: keyof ScenarioAssumptions, value: number): 'feasible' | 'challenging' | 'unrealistic' {
    const bounds = this.getVariableBounds(variable);
    const range = bounds.max - bounds.min;
    const position = (value - bounds.min) / range;
    
    if (position < 0.2 || position > 0.8) return 'unrealistic';
    if (position < 0.3 || position > 0.7) return 'challenging';
    return 'feasible';
  }

  private async findAlternativeApproaches(
    targetARR: number,
    primaryVariable: keyof ScenarioAssumptions,
    constraints: Partial<ScenarioAssumptions>,
    horizon: number
  ): Promise<Array<{
    variable: string;
    requiredValue: number;
    feasibility: string;
  }>> {
    const alternatives = [];
    const variables = [
      'customerGrowthRate',
      'churnRateChange',
      'priceChangePercent',
      'expansionRate'
    ].filter(v => v !== primaryVariable);
    
    for (const variable of variables) {
      // Simple estimation - would use goal seek for each
      const estimatedValue = 0.2; // Simplified
      const feasibility = this.assessFeasibility(variable as keyof ScenarioAssumptions, estimatedValue);
      
      alternatives.push({
        variable,
        requiredValue: estimatedValue,
        feasibility
      });
    }
    
    return alternatives;
  }
}