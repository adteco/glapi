import { Database } from '@glapi/database';
import {
  revenueForecastRuns,
  revenueForecastDetails,
  ForecastModel,
  RevenueForecastRun,
  RevenueForecastDetail
} from '@glapi/database/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

export interface ForecastRequest {
  forecastPeriods: number;
  periodType: 'day' | 'week' | 'month' | 'quarter' | 'year';
  model?: 'auto' | 'linear' | 'arima' | 'prophet' | 'ml_ensemble' | 'weighted_average' | 'exponential_smoothing';
  includeSeasonality?: boolean;
  includeExternalFactors?: boolean;
  confidenceLevel?: number;
  name?: string;
}

export interface ForecastPeriod {
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
}

export interface ForecastResult {
  forecastId: string;
  periods: ForecastPeriod[];
  accuracy: {
    mape: number;
    rmse: number;
    r2Score: number;
  };
  insights: string[];
  metadata: {
    model: string;
    dataPointsUsed: number;
    historicalPeriod: {
      start: Date;
      end: Date;
    };
  };
}

export interface HistoricalDataPoint {
  date: Date;
  revenue: number;
  customers: number;
  churn?: number;
  newCustomers?: number;
}

export interface PatternAnalysis {
  trend: 'increasing' | 'decreasing' | 'stable';
  trendStrength: number;
  seasonality: boolean;
  seasonalPeriod?: number;
  seasonalStrength?: number;
  volatility: number;
  outliers: Date[];
}

export class RevenueForecastingEngine {
  constructor(
    private db: typeof Database,
    private organizationId: string
  ) {}

  /**
   * Generate revenue forecast
   */
  async generateForecast(request: ForecastRequest): Promise<ForecastResult> {
    // Step 1: Gather historical data
    const historicalData = await this.getHistoricalRevenue(request.periodType);
    
    if (historicalData.length < 12) {
      throw new Error('Insufficient historical data for forecasting (minimum 12 periods required)');
    }

    // Step 2: Detect patterns and seasonality
    const patterns = this.detectPatterns(historicalData);
    
    // Step 3: Select best model if auto mode
    const selectedModel = request.model === 'auto' 
      ? await this.selectBestModel(historicalData, patterns)
      : this.mapRequestModelToForecastModel(request.model || 'weighted_average');

    // Step 4: Create forecast run record
    const forecastRun = await this.createForecastRun(request, selectedModel, historicalData);

    try {
      // Step 5: Generate forecast based on selected model
      let forecast: ForecastResult;
      
      switch (selectedModel) {
        case ForecastModel.LINEAR_REGRESSION:
          forecast = await this.linearRegression(historicalData, request, forecastRun.id);
          break;
        case ForecastModel.EXPONENTIAL_SMOOTHING:
          forecast = await this.exponentialSmoothing(historicalData, request, forecastRun.id);
          break;
        case ForecastModel.WEIGHTED_AVERAGE:
          forecast = await this.weightedAverageForecast(historicalData, request, forecastRun.id);
          break;
        case ForecastModel.ARIMA:
          forecast = await this.arimaForecast(historicalData, request, forecastRun.id);
          break;
        case ForecastModel.ML_ENSEMBLE:
          forecast = await this.mlEnsembleForecast(historicalData, request, forecastRun.id);
          break;
        default:
          forecast = await this.weightedAverageForecast(historicalData, request, forecastRun.id);
      }

      // Step 6: Apply seasonality adjustments if requested
      if (request.includeSeasonality && patterns.seasonality) {
        forecast = this.applySeasonalityAdjustments(forecast, patterns);
      }

      // Step 7: Generate insights
      forecast.insights = await this.generateInsights(forecast, historicalData, patterns);

      // Step 8: Save forecast details
      await this.saveForecastDetails(forecast);

      // Step 9: Update forecast run with results
      await this.updateForecastRun(forecastRun.id, forecast);

      return forecast;
    } catch (error) {
      // Update forecast run with error status
      await this.db.update(revenueForecastRuns)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
        .where(eq(revenueForecastRuns.id, forecastRun.id));
      
      throw error;
    }
  }

  /**
   * Linear regression forecasting
   */
  private async linearRegression(
    historicalData: HistoricalDataPoint[],
    request: ForecastRequest,
    forecastRunId: string
  ): Promise<ForecastResult> {
    const values = historicalData.map(d => d.revenue);
    const n = values.length;
    
    // Calculate linear regression coefficients
    const xValues = Array.from({ length: n }, (_, i) => i);
    const xMean = xValues.reduce((a, b) => a + b) / n;
    const yMean = values.reduce((a, b) => a + b) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (values[i] - yMean);
      denominator += Math.pow(xValues[i] - xMean, 2);
    }
    
    const slope = numerator / denominator;
    const intercept = yMean - slope * xMean;
    
    // Generate forecasts
    const periods: ForecastPeriod[] = [];
    const standardError = this.calculateStandardError(values, xValues, slope, intercept);
    const confidenceMultiplier = this.getConfidenceMultiplier(request.confidenceLevel || 0.95);
    
    for (let i = 0; i < request.forecastPeriods; i++) {
      const x = n + i;
      const forecast = slope * x + intercept;
      const margin = confidenceMultiplier * standardError * Math.sqrt(1 + 1/n + Math.pow(x - xMean, 2) / denominator);
      
      const date = this.addPeriods(
        historicalData[historicalData.length - 1].date,
        i + 1,
        request.periodType
      );
      
      periods.push({
        date,
        forecast: Math.max(0, forecast),
        lowerBound: Math.max(0, forecast - margin),
        upperBound: forecast + margin,
        components: {
          base: intercept,
          trend: slope * x,
          seasonal: 0
        }
      });
    }
    
    // Calculate accuracy metrics
    const accuracy = this.calculateAccuracyMetrics(values, xValues, slope, intercept);
    
    return {
      forecastId: forecastRunId,
      periods,
      accuracy,
      insights: [],
      metadata: {
        model: 'linear_regression',
        dataPointsUsed: n,
        historicalPeriod: {
          start: historicalData[0].date,
          end: historicalData[n - 1].date
        }
      }
    };
  }

  /**
   * Exponential smoothing forecast
   */
  private async exponentialSmoothing(
    historicalData: HistoricalDataPoint[],
    request: ForecastRequest,
    forecastRunId: string
  ): Promise<ForecastResult> {
    const values = historicalData.map(d => d.revenue);
    const alpha = 0.3; // Smoothing parameter (could be optimized)
    const beta = 0.1;  // Trend smoothing parameter
    
    // Initialize level and trend
    let level = values[0];
    let trend = values.length > 1 ? (values[1] - values[0]) : 0;
    
    // Apply double exponential smoothing to historical data
    const smoothedValues: number[] = [level];
    
    for (let i = 1; i < values.length; i++) {
      const prevLevel = level;
      level = alpha * values[i] + (1 - alpha) * (level + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
      smoothedValues.push(level);
    }
    
    // Generate forecasts
    const periods: ForecastPeriod[] = [];
    const mse = this.calculateMSE(values, smoothedValues);
    const confidenceMultiplier = this.getConfidenceMultiplier(request.confidenceLevel || 0.95);
    
    for (let i = 0; i < request.forecastPeriods; i++) {
      const forecast = level + trend * (i + 1);
      const margin = confidenceMultiplier * Math.sqrt(mse * (i + 1));
      
      const date = this.addPeriods(
        historicalData[historicalData.length - 1].date,
        i + 1,
        request.periodType
      );
      
      periods.push({
        date,
        forecast: Math.max(0, forecast),
        lowerBound: Math.max(0, forecast - margin),
        upperBound: forecast + margin,
        components: {
          base: level,
          trend: trend * (i + 1),
          seasonal: 0
        }
      });
    }
    
    const accuracy = {
      mape: this.calculateMAPE(values.slice(1), smoothedValues.slice(1)),
      rmse: Math.sqrt(mse),
      r2Score: this.calculateR2(values, smoothedValues)
    };
    
    return {
      forecastId: forecastRunId,
      periods,
      accuracy,
      insights: [],
      metadata: {
        model: 'exponential_smoothing',
        dataPointsUsed: values.length,
        historicalPeriod: {
          start: historicalData[0].date,
          end: historicalData[values.length - 1].date
        }
      }
    };
  }

  /**
   * Weighted average forecast
   */
  private async weightedAverageForecast(
    historicalData: HistoricalDataPoint[],
    request: ForecastRequest,
    forecastRunId: string
  ): Promise<ForecastResult> {
    const values = historicalData.map(d => d.revenue);
    const n = values.length;
    
    // Calculate weights (more recent data gets higher weight)
    const weights = Array.from({ length: n }, (_, i) => Math.exp((i - n + 1) * 0.1));
    const weightSum = weights.reduce((a, b) => a + b);
    const normalizedWeights = weights.map(w => w / weightSum);
    
    // Calculate weighted average and trend
    let weightedAvg = 0;
    for (let i = 0; i < n; i++) {
      weightedAvg += values[i] * normalizedWeights[i];
    }
    
    // Calculate trend from recent periods
    const recentPeriods = Math.min(6, Math.floor(n / 2));
    const recentValues = values.slice(-recentPeriods);
    const trend = recentPeriods > 1 
      ? (recentValues[recentValues.length - 1] - recentValues[0]) / (recentPeriods - 1)
      : 0;
    
    // Calculate volatility for confidence intervals
    const deviations = values.map(v => Math.abs(v - weightedAvg));
    const avgDeviation = deviations.reduce((a, b) => a + b) / n;
    const confidenceMultiplier = this.getConfidenceMultiplier(request.confidenceLevel || 0.95);
    
    // Generate forecasts
    const periods: ForecastPeriod[] = [];
    
    for (let i = 0; i < request.forecastPeriods; i++) {
      const forecast = weightedAvg + trend * (i + 1);
      const margin = confidenceMultiplier * avgDeviation * Math.sqrt(1 + (i + 1) / n);
      
      const date = this.addPeriods(
        historicalData[historicalData.length - 1].date,
        i + 1,
        request.periodType
      );
      
      periods.push({
        date,
        forecast: Math.max(0, forecast),
        lowerBound: Math.max(0, forecast - margin),
        upperBound: forecast + margin,
        components: {
          base: weightedAvg,
          trend: trend * (i + 1),
          seasonal: 0
        }
      });
    }
    
    // Simple accuracy calculation
    const accuracy = {
      mape: 0.15, // Placeholder - would calculate from backtesting
      rmse: avgDeviation,
      r2Score: 0.7 // Placeholder
    };
    
    return {
      forecastId: forecastRunId,
      periods,
      accuracy,
      insights: [],
      metadata: {
        model: 'weighted_average',
        dataPointsUsed: n,
        historicalPeriod: {
          start: historicalData[0].date,
          end: historicalData[n - 1].date
        }
      }
    };
  }

  /**
   * ARIMA forecast (simplified implementation)
   */
  private async arimaForecast(
    historicalData: HistoricalDataPoint[],
    request: ForecastRequest,
    forecastRunId: string
  ): Promise<ForecastResult> {
    // Simplified ARIMA(1,1,1) implementation
    const values = historicalData.map(d => d.revenue);
    
    // Difference the series
    const diffValues: number[] = [];
    for (let i = 1; i < values.length; i++) {
      diffValues.push(values[i] - values[i - 1]);
    }
    
    // Calculate AR and MA parameters (simplified)
    const mean = diffValues.reduce((a, b) => a + b) / diffValues.length;
    const ar1 = 0.7; // Simplified AR coefficient
    const ma1 = 0.3; // Simplified MA coefficient
    
    // Generate forecasts
    const periods: ForecastPeriod[] = [];
    let lastValue = values[values.length - 1];
    let lastDiff = diffValues[diffValues.length - 1];
    let lastError = 0;
    
    const variance = this.calculateVariance(diffValues);
    const confidenceMultiplier = this.getConfidenceMultiplier(request.confidenceLevel || 0.95);
    
    for (let i = 0; i < request.forecastPeriods; i++) {
      const forecastDiff = mean + ar1 * (lastDiff - mean) + ma1 * lastError;
      const forecast = lastValue + forecastDiff;
      
      const margin = confidenceMultiplier * Math.sqrt(variance * (i + 1));
      
      const date = this.addPeriods(
        historicalData[historicalData.length - 1].date,
        i + 1,
        request.periodType
      );
      
      periods.push({
        date,
        forecast: Math.max(0, forecast),
        lowerBound: Math.max(0, forecast - margin),
        upperBound: forecast + margin,
        components: {
          base: lastValue,
          trend: forecastDiff,
          seasonal: 0
        }
      });
      
      lastValue = forecast;
      lastDiff = forecastDiff;
      lastError = 0; // Simplified - would track actual errors in real implementation
    }
    
    const accuracy = {
      mape: 0.12, // Placeholder
      rmse: Math.sqrt(variance),
      r2Score: 0.75 // Placeholder
    };
    
    return {
      forecastId: forecastRunId,
      periods,
      accuracy,
      insights: [],
      metadata: {
        model: 'arima',
        dataPointsUsed: values.length,
        historicalPeriod: {
          start: historicalData[0].date,
          end: historicalData[values.length - 1].date
        }
      }
    };
  }

  /**
   * ML Ensemble forecast (simplified implementation)
   */
  private async mlEnsembleForecast(
    historicalData: HistoricalDataPoint[],
    request: ForecastRequest,
    forecastRunId: string
  ): Promise<ForecastResult> {
    // Generate forecasts from multiple models
    const linearForecast = await this.linearRegression(historicalData, request, forecastRunId);
    const expSmoothingForecast = await this.exponentialSmoothing(historicalData, request, forecastRunId);
    const arimaForecast = await this.arimaForecast(historicalData, request, forecastRunId);
    
    // Ensemble the forecasts with weights based on historical accuracy
    const weights = [0.3, 0.35, 0.35]; // Could be optimized based on backtesting
    
    const periods: ForecastPeriod[] = [];
    
    for (let i = 0; i < request.forecastPeriods; i++) {
      const linearPeriod = linearForecast.periods[i];
      const expPeriod = expSmoothingForecast.periods[i];
      const arimaPeriod = arimaForecast.periods[i];
      
      const forecast = 
        linearPeriod.forecast * weights[0] +
        expPeriod.forecast * weights[1] +
        arimaPeriod.forecast * weights[2];
      
      const lowerBound = 
        linearPeriod.lowerBound * weights[0] +
        expPeriod.lowerBound * weights[1] +
        arimaPeriod.lowerBound * weights[2];
      
      const upperBound = 
        linearPeriod.upperBound * weights[0] +
        expPeriod.upperBound * weights[1] +
        arimaPeriod.upperBound * weights[2];
      
      periods.push({
        date: linearPeriod.date,
        forecast,
        lowerBound,
        upperBound,
        components: {
          base: forecast * 0.7,
          trend: forecast * 0.2,
          seasonal: forecast * 0.1
        }
      });
    }
    
    // Average the accuracy metrics
    const accuracy = {
      mape: (linearForecast.accuracy.mape + expSmoothingForecast.accuracy.mape + arimaForecast.accuracy.mape) / 3,
      rmse: (linearForecast.accuracy.rmse + expSmoothingForecast.accuracy.rmse + arimaForecast.accuracy.rmse) / 3,
      r2Score: (linearForecast.accuracy.r2Score + expSmoothingForecast.accuracy.r2Score + arimaForecast.accuracy.r2Score) / 3
    };
    
    return {
      forecastId: forecastRunId,
      periods,
      accuracy,
      insights: [],
      metadata: {
        model: 'ml_ensemble',
        dataPointsUsed: historicalData.length,
        historicalPeriod: {
          start: historicalData[0].date,
          end: historicalData[historicalData.length - 1].date
        }
      }
    };
  }

  /**
   * Detect patterns in historical data
   */
  private detectPatterns(data: HistoricalDataPoint[]): PatternAnalysis {
    const values = data.map(d => d.revenue);
    const n = values.length;
    
    // Detect trend
    const firstHalf = values.slice(0, Math.floor(n / 2));
    const secondHalf = values.slice(Math.floor(n / 2));
    const firstHalfAvg = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((a, b) => a + b) / secondHalf.length;
    
    const trendDiff = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
    let trend: 'increasing' | 'decreasing' | 'stable';
    
    if (trendDiff > 0.05) trend = 'increasing';
    else if (trendDiff < -0.05) trend = 'decreasing';
    else trend = 'stable';
    
    // Detect seasonality (simplified - check for monthly patterns)
    const seasonality = this.detectSeasonality(values);
    
    // Calculate volatility
    const mean = values.reduce((a, b) => a + b) / n;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const volatility = stdDev / mean;
    
    // Detect outliers (values beyond 2 standard deviations)
    const outliers: Date[] = [];
    for (let i = 0; i < n; i++) {
      if (Math.abs(values[i] - mean) > 2 * stdDev) {
        outliers.push(data[i].date);
      }
    }
    
    return {
      trend,
      trendStrength: Math.abs(trendDiff),
      seasonality: seasonality.isPresent,
      seasonalPeriod: seasonality.period,
      seasonalStrength: seasonality.strength,
      volatility,
      outliers
    };
  }

  /**
   * Detect seasonality in data
   */
  private detectSeasonality(values: number[]): {
    isPresent: boolean;
    period?: number;
    strength?: number;
  } {
    if (values.length < 24) {
      return { isPresent: false };
    }
    
    // Check for 12-month seasonality
    const period = 12;
    let correlation = 0;
    let count = 0;
    
    for (let i = period; i < values.length; i++) {
      correlation += values[i] * values[i - period];
      count++;
    }
    
    if (count > 0) {
      correlation = correlation / count;
      const mean = values.reduce((a, b) => a + b) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      
      const normalizedCorrelation = correlation / variance;
      
      if (normalizedCorrelation > 0.3) {
        return {
          isPresent: true,
          period,
          strength: normalizedCorrelation
        };
      }
    }
    
    return { isPresent: false };
  }

  /**
   * Select best model based on patterns
   */
  private async selectBestModel(
    data: HistoricalDataPoint[],
    patterns: PatternAnalysis
  ): Promise<string> {
    // Simple heuristic for model selection
    if (patterns.volatility > 0.3) {
      return ForecastModel.ML_ENSEMBLE; // High volatility - use ensemble
    }
    
    if (patterns.seasonality && patterns.seasonalStrength! > 0.5) {
      return ForecastModel.ARIMA; // Strong seasonality - use ARIMA
    }
    
    if (patterns.trend !== 'stable' && patterns.trendStrength > 0.2) {
      return ForecastModel.EXPONENTIAL_SMOOTHING; // Clear trend - use exponential smoothing
    }
    
    if (data.length > 36) {
      return ForecastModel.LINEAR_REGRESSION; // Lots of data - linear regression works well
    }
    
    return ForecastModel.WEIGHTED_AVERAGE; // Default to weighted average
  }

  /**
   * Generate insights from forecast
   */
  private async generateInsights(
    forecast: ForecastResult,
    historicalData: HistoricalDataPoint[],
    patterns: PatternAnalysis
  ): Promise<string[]> {
    const insights: string[] = [];
    
    // Growth insights
    const lastHistorical = historicalData[historicalData.length - 1].revenue;
    const lastForecast = forecast.periods[forecast.periods.length - 1].forecast;
    const growthRate = (lastForecast - lastHistorical) / lastHistorical;
    
    if (growthRate > 0.1) {
      insights.push(`Strong growth projected: ${(growthRate * 100).toFixed(1)}% over forecast period`);
    } else if (growthRate < -0.05) {
      insights.push(`Revenue decline warning: ${(Math.abs(growthRate) * 100).toFixed(1)}% decrease expected`);
    } else {
      insights.push(`Stable revenue expected with ${(growthRate * 100).toFixed(1)}% change`);
    }
    
    // Trend insights
    if (patterns.trend === 'increasing') {
      insights.push(`Positive trend detected with ${(patterns.trendStrength * 100).toFixed(1)}% growth momentum`);
    } else if (patterns.trend === 'decreasing') {
      insights.push(`Negative trend detected - consider intervention strategies`);
    }
    
    // Seasonality insights
    if (patterns.seasonality) {
      insights.push(`Seasonal pattern detected with ${patterns.seasonalPeriod}-period cycle`);
    }
    
    // Volatility insights
    if (patterns.volatility > 0.2) {
      insights.push('High revenue volatility detected - wider confidence intervals applied');
    }
    
    // Model accuracy insights
    if (forecast.accuracy.mape < 0.1) {
      insights.push('Model showing excellent accuracy (MAPE < 10%)');
    } else if (forecast.accuracy.mape > 0.25) {
      insights.push('Model accuracy could be improved with more data');
    }
    
    // Outlier insights
    if (patterns.outliers.length > 0) {
      insights.push(`${patterns.outliers.length} outlier periods detected in historical data`);
    }
    
    return insights;
  }

  /**
   * Apply seasonality adjustments to forecast
   */
  private applySeasonalityAdjustments(
    forecast: ForecastResult,
    patterns: PatternAnalysis
  ): ForecastResult {
    if (!patterns.seasonality || !patterns.seasonalPeriod) {
      return forecast;
    }
    
    const seasonalFactors = this.calculateSeasonalFactors(patterns.seasonalPeriod);
    
    forecast.periods = forecast.periods.map((period, index) => {
      const seasonalIndex = index % patterns.seasonalPeriod!;
      const seasonalFactor = seasonalFactors[seasonalIndex];
      
      return {
        ...period,
        forecast: period.forecast * seasonalFactor,
        lowerBound: period.lowerBound * seasonalFactor,
        upperBound: period.upperBound * seasonalFactor,
        components: {
          ...period.components,
          seasonal: period.forecast * (seasonalFactor - 1)
        }
      };
    });
    
    return forecast;
  }

  /**
   * Calculate seasonal factors
   */
  private calculateSeasonalFactors(period: number): number[] {
    // Simplified seasonal factors (would be calculated from historical data)
    const factors: number[] = [];
    
    for (let i = 0; i < period; i++) {
      // Simple sinusoidal pattern
      const factor = 1 + 0.1 * Math.sin(2 * Math.PI * i / period);
      factors.push(factor);
    }
    
    return factors;
  }

  /**
   * Get historical revenue data
   */
  private async getHistoricalRevenue(periodType: string): Promise<HistoricalDataPoint[]> {
    // This would query actual revenue data from the database
    // For now, returning mock data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 2); // 2 years of data
    
    const data: HistoricalDataPoint[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      data.push({
        date: new Date(currentDate),
        revenue: 100000 + Math.random() * 20000 + (data.length * 1000), // Trending upward with noise
        customers: 100 + data.length,
        newCustomers: 10 + Math.floor(Math.random() * 5),
        churn: Math.floor(Math.random() * 3)
      });
      
      // Increment based on period type
      if (periodType === 'month') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else if (periodType === 'week') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else {
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    return data;
  }

  /**
   * Create forecast run record
   */
  private async createForecastRun(
    request: ForecastRequest,
    model: string,
    historicalData: HistoricalDataPoint[]
  ): Promise<RevenueForecastRun> {
    const startDate = this.addPeriods(
      historicalData[historicalData.length - 1].date,
      1,
      request.periodType
    );
    
    const endDate = this.addPeriods(
      historicalData[historicalData.length - 1].date,
      request.forecastPeriods,
      request.periodType
    );
    
    const [run] = await this.db.insert(revenueForecastRuns)
      .values({
        organizationId: this.organizationId,
        forecastName: request.name || `Forecast ${new Date().toISOString()}`,
        forecastModel: model as any,
        forecastStartDate: startDate,
        forecastEndDate: endDate,
        historicalStartDate: historicalData[0].date,
        historicalEndDate: historicalData[historicalData.length - 1].date,
        dataPointsUsed: historicalData.length,
        modelParameters: {
          periodType: request.periodType,
          includeSeasonality: request.includeSeasonality,
          includeExternalFactors: request.includeExternalFactors
        },
        confidenceLevel: String(request.confidenceLevel || 0.95),
        status: 'running'
      })
      .returning();
    
    return run;
  }

  /**
   * Update forecast run with results
   */
  private async updateForecastRun(runId: string, forecast: ForecastResult): Promise<void> {
    const totalForecast = forecast.periods.reduce((sum, p) => sum + p.forecast, 0);
    const avgMonthlyForecast = totalForecast / forecast.periods.length;
    
    await this.db.update(revenueForecastRuns)
      .set({
        forecastedARR: String(avgMonthlyForecast * 12),
        forecastedMRR: String(avgMonthlyForecast),
        mape: String(forecast.accuracy.mape),
        rmse: String(forecast.accuracy.rmse),
        r2Score: String(forecast.accuracy.r2Score),
        status: 'completed',
        completedAt: new Date()
      })
      .where(eq(revenueForecastRuns.id, runId));
  }

  /**
   * Save forecast details
   */
  private async saveForecastDetails(forecast: ForecastResult): Promise<void> {
    const details = forecast.periods.map(period => ({
      forecastRunId: forecast.forecastId,
      forecastDate: period.date,
      periodType: 'month', // Would come from request
      forecastedRevenue: String(period.forecast),
      lowerBound: String(period.lowerBound),
      upperBound: String(period.upperBound),
      baseRevenue: String(period.components.base),
      trendComponent: String(period.components.trend),
      seasonalComponent: String(period.components.seasonal || 0)
    }));
    
    await this.db.insert(revenueForecastDetails).values(details);
  }

  // Helper methods
  
  private mapRequestModelToForecastModel(model: string): string {
    const mapping: Record<string, string> = {
      'linear': ForecastModel.LINEAR_REGRESSION,
      'arima': ForecastModel.ARIMA,
      'prophet': ForecastModel.PROPHET,
      'ml_ensemble': ForecastModel.ML_ENSEMBLE,
      'weighted_average': ForecastModel.WEIGHTED_AVERAGE,
      'exponential_smoothing': ForecastModel.EXPONENTIAL_SMOOTHING
    };
    return mapping[model] || ForecastModel.WEIGHTED_AVERAGE;
  }

  private addPeriods(date: Date, periods: number, periodType: string): Date {
    const newDate = new Date(date);
    
    switch (periodType) {
      case 'day':
        newDate.setDate(newDate.getDate() + periods);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + periods * 7);
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + periods);
        break;
      case 'quarter':
        newDate.setMonth(newDate.getMonth() + periods * 3);
        break;
      case 'year':
        newDate.setFullYear(newDate.getFullYear() + periods);
        break;
    }
    
    return newDate;
  }

  private calculateStandardError(values: number[], xValues: number[], slope: number, intercept: number): number {
    const n = values.length;
    let sumSquaredErrors = 0;
    
    for (let i = 0; i < n; i++) {
      const predicted = slope * xValues[i] + intercept;
      sumSquaredErrors += Math.pow(values[i] - predicted, 2);
    }
    
    return Math.sqrt(sumSquaredErrors / (n - 2));
  }

  private calculateMSE(actual: number[], predicted: number[]): number {
    const n = Math.min(actual.length, predicted.length);
    let sumSquaredErrors = 0;
    
    for (let i = 0; i < n; i++) {
      sumSquaredErrors += Math.pow(actual[i] - predicted[i], 2);
    }
    
    return sumSquaredErrors / n;
  }

  private calculateMAPE(actual: number[], predicted: number[]): number {
    const n = Math.min(actual.length, predicted.length);
    let sumPercentageErrors = 0;
    
    for (let i = 0; i < n; i++) {
      if (actual[i] !== 0) {
        sumPercentageErrors += Math.abs((actual[i] - predicted[i]) / actual[i]);
      }
    }
    
    return sumPercentageErrors / n;
  }

  private calculateR2(actual: number[], predicted: number[]): number {
    const n = Math.min(actual.length, predicted.length);
    const mean = actual.reduce((a, b) => a + b) / n;
    
    let ssRes = 0;
    let ssTot = 0;
    
    for (let i = 0; i < n; i++) {
      ssRes += Math.pow(actual[i] - predicted[i], 2);
      ssTot += Math.pow(actual[i] - mean, 2);
    }
    
    return 1 - (ssRes / ssTot);
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b) / values.length;
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  private calculateAccuracyMetrics(values: number[], xValues: number[], slope: number, intercept: number): {
    mape: number;
    rmse: number;
    r2Score: number;
  } {
    const predicted = xValues.map(x => slope * x + intercept);
    
    return {
      mape: this.calculateMAPE(values, predicted),
      rmse: Math.sqrt(this.calculateMSE(values, predicted)),
      r2Score: this.calculateR2(values, predicted)
    };
  }

  private getConfidenceMultiplier(confidenceLevel: number): number {
    // Z-scores for common confidence levels
    const zScores: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };
    
    return zScores[confidenceLevel] || 1.96;
  }
}