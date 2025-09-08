# TASK-018: Revenue Forecasting & Advanced Analytics

## Description
Implement comprehensive revenue forecasting capabilities with predictive analytics, cohort-based projections, deferred revenue rollforward reports, and what-if scenario analysis. This includes machine learning models for churn prediction and revenue optimization recommendations.

## Acceptance Criteria
- [ ] Revenue forecasting models with multiple methods
- [ ] Predictive analytics for customer churn
- [ ] Cohort-based revenue analysis and projections  
- [ ] Deferred revenue rollforward reports
- [ ] What-if scenario analysis tools
- [ ] Revenue optimization recommendations
- [ ] Seasonal trend analysis and adjustments
- [ ] Customer lifetime value (CLV) calculations
- [ ] Revenue at risk identification
- [ ] Forecast accuracy tracking and improvement

## Dependencies
- TASK-010: Reporting engine (for base metrics)
- TASK-009: Revenue calculation engine
- TASK-015: Advanced SSP Analytics (for ML infrastructure)

## Estimated Effort
5 days

## Technical Implementation

### Forecasting Schema
```typescript
// packages/database/src/db/schema/revenue-forecasting.ts
import { pgTable, uuid, varchar, decimal, timestamp, jsonb, date, integer, boolean } from "drizzle-orm/pg-core";

export const forecastModelEnum = pgEnum("forecast_model", [
  "linear_regression",
  "arima",
  "prophet",
  "ml_ensemble",
  "weighted_average",
  "exponential_smoothing"
]);

export const revenueForecastRuns = pgTable("revenue_forecast_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  
  // Forecast parameters
  forecastName: varchar("forecast_name", { length: 100 }).notNull(),
  forecastModel: forecastModelEnum("forecast_model").notNull(),
  forecastStartDate: date("forecast_start_date").notNull(),
  forecastEndDate: date("forecast_end_date").notNull(),
  
  // Historical data used
  historicalStartDate: date("historical_start_date").notNull(),
  historicalEndDate: date("historical_end_date").notNull(),
  dataPointsUsed: integer("data_points_used").notNull(),
  
  // Model parameters
  modelParameters: jsonb("model_parameters"),
  confidenceLevel: decimal("confidence_level", { precision: 3, scale: 2 }).default("0.95"),
  
  // Results summary
  forecastedARR: decimal("forecasted_arr", { precision: 15, scale: 2 }),
  forecastedMRR: decimal("forecasted_mrr", { precision: 15, scale: 2 }),
  expectedChurn: decimal("expected_churn", { precision: 15, scale: 2 }),
  expectedGrowth: decimal("expected_growth", { precision: 8, scale: 4 }),
  
  // Model performance
  mape: decimal("mape", { precision: 8, scale: 4 }), // Mean Absolute Percentage Error
  rmse: decimal("rmse", { precision: 15, scale: 2 }), // Root Mean Square Error
  r2Score: decimal("r2_score", { precision: 5, scale: 4 }),
  
  status: varchar("status", { length: 20 }).notNull(), // running, completed, failed
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const revenueForecastDetails = pgTable("revenue_forecast_details", {
  id: uuid("id").defaultRandom().primaryKey(),
  forecastRunId: uuid("forecast_run_id").references(() => revenueForecastRuns.id).notNull(),
  
  // Forecast period
  forecastDate: date("forecast_date").notNull(),
  periodType: varchar("period_type", { length: 20 }).notNull(), // day, week, month, quarter, year
  
  // Forecasted values
  forecastedRevenue: decimal("forecasted_revenue", { precision: 15, scale: 2 }).notNull(),
  lowerBound: decimal("lower_bound", { precision: 15, scale: 2 }).notNull(),
  upperBound: decimal("upper_bound", { precision: 15, scale: 2 }).notNull(),
  
  // Components
  baseRevenue: decimal("base_revenue", { precision: 15, scale: 2 }),
  newRevenue: decimal("new_revenue", { precision: 15, scale: 2 }),
  expansionRevenue: decimal("expansion_revenue", { precision: 15, scale: 2 }),
  contractionRevenue: decimal("contraction_revenue", { precision: 15, scale: 2 }),
  churnRevenue: decimal("churn_revenue", { precision: 15, scale: 2 }),
  
  // Actuals (updated when period completes)
  actualRevenue: decimal("actual_revenue", { precision: 15, scale: 2 }),
  variance: decimal("variance", { precision: 15, scale: 2 }),
  accuracyScore: decimal("accuracy_score", { precision: 5, scale: 4 }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const cohortAnalysis = pgTable("cohort_analysis", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  
  // Cohort definition
  cohortName: varchar("cohort_name", { length: 100 }).notNull(),
  cohortMonth: date("cohort_month").notNull(),
  cohortSize: integer("cohort_size").notNull(),
  
  // Revenue metrics by period
  periodOffset: integer("period_offset").notNull(), // Months since cohort start
  activeCustomers: integer("active_customers").notNull(),
  retentionRate: decimal("retention_rate", { precision: 5, scale: 4 }).notNull(),
  
  // Revenue values
  periodRevenue: decimal("period_revenue", { precision: 15, scale: 2 }).notNull(),
  cumulativeRevenue: decimal("cumulative_revenue", { precision: 15, scale: 2 }).notNull(),
  averageRevenue: decimal("average_revenue", { precision: 12, scale: 2 }).notNull(),
  
  // LTV metrics
  predictedLTV: decimal("predicted_ltv", { precision: 15, scale: 2 }),
  paybackPeriod: integer("payback_period"), // Months to recover CAC
  
  analysisDate: date("analysis_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const scenarioAnalysis = pgTable("scenario_analysis", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  
  scenarioName: varchar("scenario_name", { length: 100 }).notNull(),
  scenarioType: varchar("scenario_type", { length: 50 }).notNull(), // growth, recession, best_case, worst_case, custom
  
  // Scenario parameters
  assumptions: jsonb("assumptions").notNull(),
  /*
    Example assumptions:
    {
      newCustomerGrowth: 0.15, // 15% growth
      churnRateChange: -0.02,  // 2% reduction in churn
      priceIncreasePercent: 0.05, // 5% price increase
      marketExpansion: true,
      competitorImpact: "low"
    }
  */
  
  // Impact analysis
  baselineARR: decimal("baseline_arr", { precision: 15, scale: 2 }).notNull(),
  scenarioARR: decimal("scenario_arr", { precision: 15, scale: 2 }).notNull(),
  arrImpact: decimal("arr_impact", { precision: 15, scale: 2 }).notNull(),
  impactPercentage: decimal("impact_percentage", { precision: 8, scale: 4 }).notNull(),
  
  // Time horizon
  analysisStartDate: date("analysis_start_date").notNull(),
  analysisEndDate: date("analysis_end_date").notNull(),
  
  // Probability and confidence
  probability: decimal("probability", { precision: 3, scale: 2 }), // 0-1 scale
  confidenceInterval: jsonb("confidence_interval"),
  
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});
```

### Revenue Forecasting Engine
```typescript
// packages/business/src/services/revenue-forecasting-engine.ts
import { Database } from '@glapi/database';
import * as tf from '@tensorflow/tfjs';
import { ARIMA } from 'arima';
import { Prophet } from 'prophet-ts'; // Hypothetical TypeScript port

export interface ForecastRequest {
  forecastPeriods: number;
  periodType: 'day' | 'week' | 'month' | 'quarter' | 'year';
  model?: 'auto' | 'linear' | 'arima' | 'prophet' | 'ml_ensemble';
  includeSeasonality?: boolean;
  includeExternalFactors?: boolean;
}

export interface ForecastResult {
  forecastId: string;
  periods: Array<{
    date: Date;
    forecast: number;
    lowerBound: number;
    upperBound: number;
    components: {
      base: number;
      trend: number;
      seasonal?: number;
      events?: number;
    };
  }>;
  accuracy: {
    mape: number;
    rmse: number;
    r2Score: number;
  };
  insights: string[];
}

export class RevenueForecastingEngine {
  private mlModel?: tf.LayersModel;
  
  constructor(
    private db: Database,
    private organizationId: string
  ) {}

  // Main forecasting method
  async generateForecast(request: ForecastRequest): Promise<ForecastResult> {
    // Step 1: Gather historical data
    const historicalData = await this.getHistoricalRevenue(request.periodType);
    
    if (historicalData.length < 12) {
      throw new Error('Insufficient historical data for forecasting (minimum 12 periods required)');
    }

    // Step 2: Detect patterns and seasonality
    const patterns = this.detectPatterns(historicalData);
    
    // Step 3: Select best model
    const selectedModel = request.model === 'auto' 
      ? await this.selectBestModel(historicalData, patterns)
      : request.model!;

    // Step 4: Generate forecast
    let forecast: ForecastResult;
    
    switch (selectedModel) {
      case 'linear':
        forecast = await this.linearRegression(historicalData, request);
        break;
      case 'arima':
        forecast = await this.arimaForecast(historicalData, request);
        break;
      case 'prophet':
        forecast = await this.prophetForecast(historicalData, request);
        break;
      case 'ml_ensemble':
        forecast = await this.mlEnsembleForecast(historicalData, request);
        break;
      default:
        forecast = await this.weightedAverageForecast(historicalData, request);
    }

    // Step 5: Add external factors if requested
    if (request.includeExternalFactors) {
      forecast = await this.adjustForExternalFactors(forecast);
    }

    // Step 6: Generate insights
    forecast.insights = await this.generateInsights(forecast, historicalData, patterns);

    // Step 7: Save forecast
    await this.saveForecast(forecast);

    return forecast;
  }

  // ARIMA forecasting
  private async arimaForecast(
    historicalData: any[],
    request: ForecastRequest
  ): Promise<ForecastResult> {
    const values = historicalData.map(d => d.revenue);
    
    // Auto-fit ARIMA model
    const arima = new ARIMA({
      data: values,
      p: 2, // Autoregressive order
      d: 1, // Differencing order
      q: 2, // Moving average order
      P: 1, // Seasonal AR order
      D: 1, // Seasonal differencing
      Q: 1, // Seasonal MA order
      s: 12 // Seasonal period (monthly)
    });

    const forecasts = arima.predict(request.forecastPeriods);
    
    // Calculate confidence intervals
    const standardError = this.calculateStandardError(values);
    const confidenceMultiplier = 1.96; // 95% confidence
    
    const periods = forecasts.map((forecast, index) => {
      const date = this.addPeriods(
        new Date(historicalData[historicalData.length - 1].date),
        index + 1,
        request.periodType
      );
      
      return {
        date,
        forecast: forecast.value,
        lowerBound: forecast.value - (confidenceMultiplier * standardError),
        upperBound: forecast.value + (confidenceMultiplier * standardError),
        components: {
          base: forecast.value,
          trend: forecast.trend || 0,
          seasonal: forecast.seasonal || 0
        }
      };
    });

    return {
      forecastId: this.generateForecastId(),
      periods,
      accuracy: await this.calculateAccuracy(historicalData, 'arima'),
      insights: []
    };
  }

  // ML Ensemble forecasting
  private async mlEnsembleForecast(
    historicalData: any[],
    request: ForecastRequest
  ): Promise<ForecastResult> {
    // Prepare features
    const features = this.prepareMLFeatures(historicalData);
    
    // Load or train model
    if (!this.mlModel) {
      await this.trainForecastModel(historicalData);
    }

    // Generate predictions
    const predictions: number[] = [];
    let currentFeatures = features[features.length - 1];
    
    for (let i = 0; i < request.forecastPeriods; i++) {
      const prediction = await this.predictNextPeriod(currentFeatures);
      predictions.push(prediction);
      
      // Update features for next prediction
      currentFeatures = this.updateFeatures(currentFeatures, prediction);
    }

    // Generate confidence intervals using ensemble uncertainty
    const periods = predictions.map((pred, index) => {
      const date = this.addPeriods(
        new Date(historicalData[historicalData.length - 1].date),
        index + 1,
        request.periodType
      );
      
      const uncertainty = this.calculateEnsembleUncertainty(pred, index);
      
      return {
        date,
        forecast: pred,
        lowerBound: pred - uncertainty,
        upperBound: pred + uncertainty,
        components: {
          base: pred * 0.7,
          trend: pred * 0.2,
          seasonal: pred * 0.1
        }
      };
    });

    return {
      forecastId: this.generateForecastId(),
      periods,
      accuracy: await this.calculateAccuracy(historicalData, 'ml_ensemble'),
      insights: []
    };
  }

  // Cohort-based revenue analysis
  async analyzeCohorts(options?: {
    startDate?: Date;
    endDate?: Date;
    cohortSize?: 'month' | 'quarter';
  }): Promise<{
    cohorts: Array<{
      cohortMonth: Date;
      size: number;
      retention: number[];
      revenue: number[];
      ltv: number;
      paybackPeriod: number;
    }>;
    insights: string[];
  }> {
    const cohortSize = options?.cohortSize || 'month';
    const cohorts = await this.getCohortData(options?.startDate, options?.endDate);
    
    const analyzedCohorts = [];
    
    for (const cohort of cohorts) {
      // Calculate retention curve
      const retention = await this.calculateRetentionCurve(cohort);
      
      // Calculate revenue by period
      const revenue = await this.calculateCohortRevenue(cohort);
      
      // Predict LTV using retention and revenue patterns
      const ltv = await this.predictLTV(retention, revenue);
      
      // Calculate payback period
      const cac = await this.getCAC(cohort.cohortMonth);
      const paybackPeriod = this.calculatePaybackPeriod(revenue, cac);
      
      analyzedCohorts.push({
        cohortMonth: cohort.cohortMonth,
        size: cohort.size,
        retention,
        revenue,
        ltv,
        paybackPeriod
      });
    }

    // Generate cohort insights
    const insights = this.generateCohortInsights(analyzedCohorts);

    return {
      cohorts: analyzedCohorts,
      insights
    };
  }

  // Deferred revenue rollforward
  async generateDeferredRevenueRollforward(
    startDate: Date,
    endDate: Date
  ): Promise<{
    periods: Array<{
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
    }>;
    summary: {
      totalAdditions: number;
      totalRecognitions: number;
      netChange: number;
      averageRecognitionPeriod: number;
    };
  }> {
    const periods = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const periodEnd = new Date(currentDate);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      periodEnd.setDate(0); // Last day of month
      
      // Get deferred revenue movements
      const movements = await this.getDeferredMovements(currentDate, periodEnd);
      
      periods.push({
        period: currentDate,
        beginningBalance: movements.beginningBalance,
        additions: movements.additions,
        recognitions: movements.recognitions,
        adjustments: movements.adjustments,
        endingBalance: movements.endingBalance,
        components: {
          shortTerm: movements.shortTerm,
          longTerm: movements.longTerm
        }
      });
      
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Calculate summary metrics
    const summary = {
      totalAdditions: periods.reduce((sum, p) => sum + p.additions, 0),
      totalRecognitions: periods.reduce((sum, p) => sum + p.recognitions, 0),
      netChange: periods[periods.length - 1].endingBalance - periods[0].beginningBalance,
      averageRecognitionPeriod: await this.calculateAverageRecognitionPeriod()
    };

    return { periods, summary };
  }

  // What-if scenario analysis
  async runScenarioAnalysis(
    scenario: {
      name: string;
      type: 'growth' | 'recession' | 'custom';
      assumptions: {
        customerGrowthRate?: number;
        churnRateChange?: number;
        priceChange?: number;
        newProductLaunch?: boolean;
        competitorEntry?: boolean;
      };
      horizon: number; // months
    }
  ): Promise<{
    baseline: ForecastResult;
    scenario: ForecastResult;
    impact: {
      arrDifference: number;
      percentageChange: number;
      breakEvenPoint?: Date;
      riskLevel: 'low' | 'medium' | 'high';
    };
    recommendations: string[];
  }> {
    // Generate baseline forecast
    const baseline = await this.generateForecast({
      forecastPeriods: scenario.horizon,
      periodType: 'month',
      model: 'auto'
    });

    // Apply scenario assumptions
    const scenarioData = this.applyScenarioAssumptions(baseline, scenario.assumptions);

    // Generate scenario forecast
    const scenarioForecast = await this.generateForecast({
      forecastPeriods: scenario.horizon,
      periodType: 'month',
      model: 'auto'
    });

    // Calculate impact
    const totalBaseline = baseline.periods.reduce((sum, p) => sum + p.forecast, 0);
    const totalScenario = scenarioForecast.periods.reduce((sum, p) => sum + p.forecast, 0);
    
    const impact = {
      arrDifference: totalScenario - totalBaseline,
      percentageChange: ((totalScenario - totalBaseline) / totalBaseline) * 100,
      breakEvenPoint: this.findBreakEvenPoint(baseline, scenarioForecast),
      riskLevel: this.assessRiskLevel(scenario.assumptions)
    };

    // Generate recommendations
    const recommendations = this.generateScenarioRecommendations(
      scenario,
      impact
    );

    return {
      baseline,
      scenario: scenarioForecast,
      impact,
      recommendations
    };
  }

  // Churn prediction
  async predictChurn(options?: {
    timeHorizon?: number; // months
    customerSegment?: string;
  }): Promise<{
    predictions: Array<{
      customerId: string;
      churnProbability: number;
      riskLevel: 'low' | 'medium' | 'high';
      revenueAtRisk: number;
      predictedChurnDate?: Date;
      factors: Array<{
        factor: string;
        impact: number;
      }>;
    }>;
    summary: {
      totalAtRisk: number;
      revenueAtRisk: number;
      topRiskFactors: string[];
    };
  }> {
    const customers = await this.getActiveCustomers(options?.customerSegment);
    const predictions = [];
    
    for (const customer of customers) {
      // Extract customer features
      const features = await this.extractChurnFeatures(customer);
      
      // Predict churn probability
      const churnProb = await this.predictCustomerChurn(features);
      
      // Identify risk factors
      const factors = this.identifyChurnFactors(features, churnProb);
      
      // Calculate revenue at risk
      const revenueAtRisk = await this.calculateRevenueAtRisk(
        customer.id,
        churnProb,
        options?.timeHorizon || 3
      );
      
      predictions.push({
        customerId: customer.id,
        churnProbability: churnProb,
        riskLevel: churnProb > 0.7 ? 'high' : churnProb > 0.3 ? 'medium' : 'low',
        revenueAtRisk,
        predictedChurnDate: churnProb > 0.5 ? 
          this.estimateChurnDate(customer, churnProb) : undefined,
        factors
      });
    }

    // Calculate summary
    const summary = {
      totalAtRisk: predictions.filter(p => p.churnProbability > 0.5).length,
      revenueAtRisk: predictions.reduce((sum, p) => sum + p.revenueAtRisk, 0),
      topRiskFactors: this.aggregateRiskFactors(predictions)
    };

    return { predictions, summary };
  }

  // Helper methods
  private detectPatterns(data: any[]): {
    trend: 'increasing' | 'decreasing' | 'stable';
    seasonality: boolean;
    seasonalPeriod?: number;
    volatility: number;
  } {
    // Implement pattern detection logic
    return {
      trend: 'stable',
      seasonality: false,
      volatility: 0.1
    };
  }

  private async generateInsights(
    forecast: ForecastResult,
    historicalData: any[],
    patterns: any
  ): Promise<string[]> {
    const insights: string[] = [];
    
    // Growth insights
    const growthRate = this.calculateGrowthRate(forecast.periods);
    if (growthRate > 0.1) {
      insights.push(`Strong growth projected: ${(growthRate * 100).toFixed(1)}% over forecast period`);
    } else if (growthRate < -0.05) {
      insights.push(`Revenue decline warning: ${(Math.abs(growthRate) * 100).toFixed(1)}% decrease expected`);
    }
    
    // Seasonality insights
    if (patterns.seasonality) {
      insights.push(`Seasonal pattern detected with ${patterns.seasonalPeriod} period cycle`);
    }
    
    // Volatility insights
    if (patterns.volatility > 0.2) {
      insights.push('High revenue volatility detected - consider wider confidence intervals');
    }
    
    // Model accuracy insights
    if (forecast.accuracy.mape < 0.1) {
      insights.push('Model showing excellent accuracy (MAPE < 10%)');
    } else if (forecast.accuracy.mape > 0.25) {
      insights.push('Model accuracy could be improved - consider additional data sources');
    }
    
    return insights;
  }

  private assessRiskLevel(assumptions: any): 'low' | 'medium' | 'high' {
    let riskScore = 0;
    
    if (Math.abs(assumptions.customerGrowthRate || 0) > 0.3) riskScore++;
    if (Math.abs(assumptions.churnRateChange || 0) > 0.1) riskScore++;
    if (Math.abs(assumptions.priceChange || 0) > 0.2) riskScore++;
    if (assumptions.competitorEntry) riskScore += 2;
    
    if (riskScore >= 3) return 'high';
    if (riskScore >= 1) return 'medium';
    return 'low';
  }
}
```

### Files to Create
- `packages/database/src/db/schema/revenue-forecasting.ts`
- `packages/business/src/services/revenue-forecasting-engine.ts`
- `packages/business/src/services/cohort-analysis-service.ts`
- `packages/business/src/services/churn-prediction-service.ts`
- `packages/business/src/services/scenario-analysis-service.ts`
- `packages/api-service/src/services/forecasting-service.ts`
- `packages/trpc/src/routers/revenue-forecasting.ts`
- `packages/business/src/services/__tests__/revenue-forecasting-engine.test.ts`

### Definition of Done
- [ ] Revenue forecasting with multiple models implemented
- [ ] Churn prediction model trained and functional
- [ ] Cohort analysis with LTV calculations working
- [ ] Deferred revenue rollforward reports accurate
- [ ] What-if scenario analysis tool operational
- [ ] Revenue optimization recommendations generating
- [ ] Seasonal trend detection and adjustment working
- [ ] CLV calculations validated against actuals
- [ ] Revenue at risk identification accurate
- [ ] Forecast accuracy tracking and improvement loop
- [ ] ML models trained and validated
- [ ] Unit tests covering all forecast scenarios
- [ ] Performance optimized for large datasets
- [ ] Documentation with statistical methodology