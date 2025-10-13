import { Database, schema } from '@glapi/database';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { 
  CohortAnalysisRepository, 
  ChurnPredictionRepository, 
  ScenarioAnalysisRepository 
} from '@glapi/database';
import { 
  RevenueForecastingEngine,
  ForecastRequest,
  ForecastResult,
  CohortAnalysisService,
  CohortMetrics,
  DeferredRevenueMovement,
  ChurnPredictionService,
  CustomerChurnPrediction,
  ScenarioAnalysisService,
  ScenarioAssumptions,
  ScenarioResult,
  MonteCarloSimulation
} from '@glapi/business';

export interface ForecastingSummary {
  currentMetrics: {
    arr: number;
    mrr: number;
    customerCount: number;
    avgContractValue: number;
    churnRate: number;
    growthRate: number;
  };
  forecasts: {
    default: ForecastResult;
    optimistic?: ForecastResult;
    pessimistic?: ForecastResult;
  };
  risks: {
    totalCustomersAtRisk: number;
    totalRevenueAtRisk: number;
    topRisks: Array<{
      customerId: string;
      customerName: string;
      revenue: number;
      riskLevel: string;
    }>;
  };
  opportunities: {
    expansionOpportunities: number;
    upsellPotential: number;
    newLogoTarget: number;
  };
}

export class ForecastingService {
  private forecastingEngine: RevenueForecastingEngine;
  private cohortService: CohortAnalysisService;
  private churnService: ChurnPredictionService;
  private scenarioService: ScenarioAnalysisService;

  constructor(
    private db: NodePgDatabase<typeof schema>,
    private organizationId: string
  ) {
    this.forecastingEngine = new RevenueForecastingEngine(organizationId);
    this.cohortService = new CohortAnalysisService(new CohortAnalysisRepository(db as any), organizationId);
    this.churnService = new ChurnPredictionService(new ChurnPredictionRepository(db as any), organizationId);
    this.scenarioService = new ScenarioAnalysisService(new ScenarioAnalysisRepository(db as any), organizationId);
  }

  /**
   * Get comprehensive forecasting dashboard data
   */
  async getForecastingSummary(
    options?: {
      includeScenarios?: boolean;
      forecastHorizon?: number;
    }
  ): Promise<ForecastingSummary> {
    const horizon = options?.forecastHorizon || 12;

    // Get current metrics
    const currentMetrics = await this.getCurrentMetrics();

    // Generate default forecast
    const defaultForecast = await this.forecastingEngine.generateForecast({
      forecastPeriods: horizon,
      periodType: 'month',
      model: 'auto',
      includeSeasonality: true
    });

    // Generate scenario forecasts if requested
    let optimisticForecast: ForecastResult | undefined;
    let pessimisticForecast: ForecastResult | undefined;

    if (options?.includeScenarios) {
      // Optimistic scenario
      const optimisticScenario = await this.scenarioService.runScenario(
        'Optimistic',
        'growth',
        {
          customerGrowthRate: 0.2,
          churnRateChange: -0.1,
          priceChangePercent: 0.05,
          expansionRate: 0.15
        },
        horizon
      );
      optimisticForecast = optimisticScenario.scenario.forecast;

      // Pessimistic scenario
      const pessimisticScenario = await this.scenarioService.runScenario(
        'Pessimistic',
        'recession',
        {
          customerGrowthRate: -0.05,
          churnRateChange: 0.1,
          priceChangePercent: -0.05,
          contractionRate: 0.1
        },
        horizon
      );
      pessimisticForecast = pessimisticScenario.scenario.forecast;
    }

    // Get churn predictions for risk assessment
    const churnPredictions = await this.churnService.predictChurn({
      timeHorizon: 3,
      minRevenue: 1000
    });

    // Calculate opportunities
    const opportunities = await this.calculateOpportunities(currentMetrics);

    return {
      currentMetrics,
      forecasts: {
        default: defaultForecast,
        optimistic: optimisticForecast,
        pessimistic: pessimisticForecast
      },
      risks: {
        totalCustomersAtRisk: churnPredictions.summary.totalCustomersAtRisk,
        totalRevenueAtRisk: churnPredictions.summary.totalRevenueAtRisk,
        topRisks: churnPredictions.predictions
          .filter(p => p.riskLevel === 'high')
          .slice(0, 5)
          .map(p => ({
            customerId: p.customerId,
            customerName: p.customerName,
            revenue: p.revenueAtRisk,
            riskLevel: p.riskLevel
          }))
      },
      opportunities
    };
  }

  /**
   * Generate revenue forecast
   */
  async generateForecast(request: ForecastRequest): Promise<ForecastResult> {
    return await this.forecastingEngine.generateForecast(request);
  }

  /**
   * Analyze customer cohorts
   */
  async analyzeCohorts(options?: {
    startDate?: Date;
    endDate?: Date;
    cohortSize?: 'month' | 'quarter';
  }): Promise<{
    cohorts: CohortMetrics[];
    insights: any;
  }> {
    return await this.cohortService.analyzeCohorts(options);
  }

  /**
   * Generate deferred revenue rollforward
   */
  async generateDeferredRevenueRollforward(
    startDate: Date,
    endDate: Date,
    periodType: 'month' | 'quarter' = 'month'
  ): Promise<{
    periods: DeferredRevenueMovement[];
    summary: any;
  }> {
    return await this.cohortService.generateDeferredRevenueRollforward(
      startDate,
      endDate,
      periodType
    );
  }

  /**
   * Predict customer churn
   */
  async predictChurn(options?: {
    timeHorizon?: number;
    customerSegment?: string;
    minRevenue?: number;
  }): Promise<{
    predictions: CustomerChurnPrediction[];
    summary: any;
  }> {
    return await this.churnService.predictChurn(options);
  }

  /**
   * Get churn prevention strategy for a customer
   */
  async getChurnPreventionStrategy(customerId: string): Promise<any> {
    return await this.churnService.getChurnPreventionStrategy(customerId);
  }

  /**
   * Run scenario analysis
   */
  async runScenarioAnalysis(
    scenarioName: string,
    scenarioType: 'growth' | 'recession' | 'best_case' | 'worst_case' | 'custom',
    assumptions: ScenarioAssumptions,
    horizon?: number
  ): Promise<ScenarioResult> {
    return await this.scenarioService.runScenario(
      scenarioName,
      scenarioType,
      assumptions,
      horizon
    );
  }

  /**
   * Run Monte Carlo simulation
   */
  async runMonteCarloSimulation(
    baseAssumptions: ScenarioAssumptions,
    varianceRanges: Record<string, { min: number; max: number }>,
    scenarios?: number,
    horizon?: number
  ): Promise<MonteCarloSimulation> {
    return await this.scenarioService.runMonteCarloSimulation(
      baseAssumptions,
      varianceRanges,
      scenarios,
      horizon
    );
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
    horizon?: number
  ): Promise<any> {
    return await this.scenarioService.compareScenarios(scenarios, horizon);
  }

  /**
   * Goal seek analysis
   */
  async goalSeek(
    targetARR: number,
    variableToOptimize: keyof ScenarioAssumptions,
    constraints: Partial<ScenarioAssumptions>,
    horizon?: number
  ): Promise<any> {
    return await this.scenarioService.goalSeek(
      targetARR,
      variableToOptimize,
      constraints,
      horizon
    );
  }

  /**
   * Get standard scenario templates
   */
  async getScenarioTemplates(): Promise<any> {
    return await this.scenarioService.createStandardScenarios();
  }

  /**
   * Calculate customer lifetime value
   */
  async calculateCustomerLTV(
    customerId: string,
    options?: {
      method?: 'historical' | 'predictive' | 'hybrid';
      discountRate?: number;
      maxPeriods?: number;
    }
  ): Promise<any> {
    return await this.cohortService.calculateCustomerLTV(customerId, options);
  }

  /**
   * Analyze revenue at risk
   */
  async analyzeRevenueAtRisk(timeHorizon?: number): Promise<any> {
    return await this.cohortService.analyzeRevenueAtRisk(timeHorizon);
  }

  /**
   * Track forecast accuracy
   */
  async trackForecastAccuracy(
    forecastId: string,
    actualRevenue: number
  ): Promise<{
    forecastId: string;
    forecasted: number;
    actual: number;
    variance: number;
    variancePercent: number;
    accuracy: number;
  }> {
    // This would update the forecast with actuals and calculate accuracy
    // For now, returning mock data
    const forecasted = 100000;
    const variance = actualRevenue - forecasted;
    const variancePercent = (variance / forecasted) * 100;
    const accuracy = 1 - Math.abs(variance / forecasted);

    return {
      forecastId,
      forecasted,
      actual: actualRevenue,
      variance,
      variancePercent,
      accuracy
    };
  }

  /**
   * Get forecast recommendations
   */
  async getForecastRecommendations(): Promise<{
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  }> {
    const currentMetrics = await this.getCurrentMetrics();
    const churnPredictions = await this.churnService.predictChurn({ timeHorizon: 3 });
    
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    // Churn-based recommendations
    if (churnPredictions.summary.totalCustomersAtRisk > 10) {
      immediate.push('Address high churn risk - ' + churnPredictions.summary.totalCustomersAtRisk + ' customers at risk');
    }

    // Growth-based recommendations
    if (currentMetrics.growthRate < 0.1) {
      shortTerm.push('Accelerate growth initiatives - current growth rate below 10%');
      shortTerm.push('Consider new customer acquisition campaigns');
    }

    // Revenue optimization
    if (currentMetrics.avgContractValue < 10000) {
      shortTerm.push('Focus on upselling to increase average contract value');
      longTerm.push('Develop premium product tiers');
    }

    // Efficiency recommendations
    if (currentMetrics.churnRate > 0.1) {
      immediate.push('Implement customer retention program - churn rate exceeds 10%');
      shortTerm.push('Enhance customer success operations');
    }

    // Strategic recommendations
    longTerm.push('Explore new market segments for expansion');
    longTerm.push('Invest in product innovation for competitive advantage');
    longTerm.push('Build predictive models for proactive management');

    return {
      immediate,
      shortTerm,
      longTerm
    };
  }

  // Private helper methods

  private async getCurrentMetrics(): Promise<{
    arr: number;
    mrr: number;
    customerCount: number;
    avgContractValue: number;
    churnRate: number;
    growthRate: number;
  }> {
    // This would query actual metrics from the database
    // For now, returning mock data
    return {
      arr: 1200000,
      mrr: 100000,
      customerCount: 100,
      avgContractValue: 12000,
      churnRate: 0.05,
      growthRate: 0.15
    };
  }

  private async calculateOpportunities(currentMetrics: any): Promise<{
    expansionOpportunities: number;
    upsellPotential: number;
    newLogoTarget: number;
  }> {
    // Calculate expansion opportunities based on current customers
    const expansionRate = 0.2; // 20% of customers have expansion potential
    const expansionOpportunities = currentMetrics.customerCount * expansionRate * currentMetrics.avgContractValue * 0.3;

    // Calculate upsell potential
    const upsellRate = 0.3; // 30% of customers can be upsold
    const upsellPotential = currentMetrics.customerCount * upsellRate * currentMetrics.avgContractValue * 0.2;

    // Calculate new logo target based on growth rate
    const newLogoTarget = currentMetrics.customerCount * currentMetrics.growthRate;

    return {
      expansionOpportunities,
      upsellPotential,
      newLogoTarget: Math.round(newLogoTarget)
    };
  }
}