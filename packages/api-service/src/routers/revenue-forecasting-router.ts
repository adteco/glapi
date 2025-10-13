import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { ForecastingService } from '../services/forecasting-service';
import { TRPCError } from '@trpc/server';

// Input schemas
const forecastRequestSchema = z.object({
  forecastPeriods: z.number().min(1).max(60),
  periodType: z.enum(['day', 'week', 'month', 'quarter', 'year']),
  model: z.enum(['auto', 'linear', 'arima', 'prophet', 'ml_ensemble', 'weighted_average', 'exponential_smoothing']).optional(),
  includeSeasonality: z.boolean().optional(),
  includeExternalFactors: z.boolean().optional(),
  confidenceLevel: z.number().min(0.8).max(0.99).optional(),
  name: z.string().optional()
});

const scenarioAssumptionsSchema = z.object({
  customerGrowthRate: z.number().min(-1).max(2).optional(),
  newLogoGrowthRate: z.number().min(-1).max(2).optional(),
  expansionRate: z.number().min(-1).max(1).optional(),
  churnRateChange: z.number().min(-1).max(1).optional(),
  contractionRate: z.number().min(0).max(1).optional(),
  priceChangePercent: z.number().min(-0.5).max(1).optional(),
  discountingChange: z.number().min(-0.5).max(0.5).optional(),
  marketGrowthRate: z.number().min(-1).max(1).optional(),
  competitorImpact: z.enum(['none', 'low', 'medium', 'high']).optional(),
  economicConditions: z.enum(['recession', 'slowdown', 'normal', 'growth', 'boom']).optional(),
  newProductLaunch: z.boolean().optional(),
  productSunset: z.boolean().optional(),
  featureExpansion: z.boolean().optional(),
  salesEfficiencyChange: z.number().min(-1).max(2).optional(),
  customerSuccessInvestment: z.number().min(-1).max(2).optional(),
  marketingSpendChange: z.number().min(-1).max(2).optional()
});

const monteCarloRequestSchema = z.object({
  baseAssumptions: scenarioAssumptionsSchema,
  varianceRanges: z.record(z.object({
    min: z.number(),
    max: z.number()
  })),
  scenarios: z.number().min(100).max(10000).optional(),
  horizon: z.number().min(1).max(60).optional()
});

const cohortAnalysisOptionsSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  cohortSize: z.enum(['month', 'quarter']).optional(),
  maxPeriods: z.number().min(1).max(60).optional()
});

const churnPredictionOptionsSchema = z.object({
  timeHorizon: z.number().min(1).max(12).optional(),
  customerSegment: z.string().optional(),
  minRevenue: z.number().min(0).optional(),
  includeNewCustomers: z.boolean().optional()
});

export const revenueForecastingRouter = router({
  /**
   * Get forecasting dashboard summary
   */
  getDashboardSummary: protectedProcedure
    .input(z.object({
      includeScenarios: z.boolean().optional(),
      forecastHorizon: z.number().min(1).max(60).optional()
    }))
    .query(async ({ ctx, input }) => {
      const service = new ForecastingService(ctx.db, ctx.user.organizationId);
      
      try {
        const summary = await service.getForecastingSummary({
          includeScenarios: input.includeScenarios,
          forecastHorizon: input.forecastHorizon
        });
        
        return {
          success: true,
          data: summary
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get forecasting summary'
        });
      }
    }),

  /**
   * Generate revenue forecast
   */
  generateForecast: protectedProcedure
    .input(forecastRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ForecastingService(ctx.db, ctx.user.organizationId);
      
      try {
        const forecast = await service.generateForecast({
          forecastPeriods: input.forecastPeriods,
          periodType: input.periodType,
          model: input.model,
          includeSeasonality: input.includeSeasonality,
          includeExternalFactors: input.includeExternalFactors,
          confidenceLevel: input.confidenceLevel,
          name: input.name
        });
        
        return {
          success: true,
          data: forecast
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to generate forecast'
        });
      }
    }),

  /**
   * Analyze customer cohorts
   */
  analyzeCohorts: protectedProcedure
    .input(cohortAnalysisOptionsSchema)
    .query(async ({ ctx, input }) => {
      const service = new ForecastingService(ctx.db, ctx.user.organizationId);
      
      try {
        const analysis = await service.analyzeCohorts(input);
        
        return {
          success: true,
          data: analysis
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to analyze cohorts'
        });
      }
    }),

  /**
   * Generate deferred revenue rollforward
   */
  generateDeferredRevenueRollforward: protectedProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      periodType: z.enum(['month', 'quarter']).optional()
    }))
    .query(async ({ ctx, input }) => {
      const service = new ForecastingService(ctx.db, ctx.user.organizationId);
      
      try {
        const rollforward = await service.generateDeferredRevenueRollforward(
          input.startDate,
          input.endDate,
          input.periodType
        );
        
        return {
          success: true,
          data: rollforward
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate rollforward'
        });
      }
    }),

  /**
   * Predict customer churn
   */
  predictChurn: protectedProcedure
    .input(churnPredictionOptionsSchema)
    .query(async ({ ctx, input }) => {
      const service = new ForecastingService(ctx.db, ctx.user.organizationId);
      
      try {
        const predictions = await service.predictChurn(input);
        
        return {
          success: true,
          data: predictions
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to predict churn'
        });
      }
    }),

  /**
   * Get churn prevention strategy for a customer
   */
  getChurnPreventionStrategy: protectedProcedure
    .input(z.object({
      customerId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const service = new ForecastingService(ctx.db, ctx.user.organizationId);
      
      try {
        const strategy = await service.getChurnPreventionStrategy(input.customerId);
        
        return {
          success: true,
          data: strategy
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to get prevention strategy'
        });
      }
    }),

  /**
   * Run scenario analysis
   */
  runScenarioAnalysis: protectedProcedure
    .input(z.object({
      scenarioName: z.string(),
      scenarioType: z.enum(['growth', 'recession', 'best_case', 'worst_case', 'custom']),
      assumptions: scenarioAssumptionsSchema,
      horizon: z.number().min(1).max(60).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ForecastingService(ctx.db, ctx.user.organizationId);
      
      try {
        const result = await service.runScenarioAnalysis(
          input.scenarioName,
          input.scenarioType,
          input.assumptions,
          input.horizon
        );
        
        return {
          success: true,
          data: result
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to run scenario analysis'
        });
      }
    }),

  /**
   * Run Monte Carlo simulation
   */
  runMonteCarloSimulation: protectedProcedure
    .input(monteCarloRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ForecastingService(ctx.db, ctx.user.organizationId);
      
      try {
        // Ensure variance ranges have required min/max properties
        const validatedRanges: Record<string, { min: number; max: number }> = {};
        for (const [key, range] of Object.entries(input.varianceRanges)) {
          if (range.min !== undefined && range.max !== undefined) {
            validatedRanges[key] = { min: range.min, max: range.max };
          }
        }
        
        const simulation = await service.runMonteCarloSimulation(
          input.baseAssumptions,
          validatedRanges,
          input.scenarios,
          input.horizon
        );
        
        return {
          success: true,
          data: simulation
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to run Monte Carlo simulation'
        });
      }
    }),

  /**
   * Compare multiple scenarios
   */
  compareScenarios: protectedProcedure
    .input(z.object({
      scenarios: z.array(z.object({
        name: z.string(),
        type: z.enum(['growth', 'recession', 'best_case', 'worst_case', 'custom']),
        assumptions: scenarioAssumptionsSchema,
        probability: z.number().min(0).max(1).optional()
      })),
      horizon: z.number().min(1).max(60).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ForecastingService(ctx.db, ctx.user.organizationId);
      
      try {
        // Ensure scenario objects have required properties
        const validatedScenarios = input.scenarios.map(scenario => ({
          name: scenario.name,
          type: scenario.type,
          assumptions: scenario.assumptions || {},
          probability: scenario.probability
        }));
        
        const comparison = await service.compareScenarios(
          validatedScenarios,
          input.horizon
        );
        
        return {
          success: true,
          data: comparison
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to compare scenarios'
        });
      }
    }),

  /**
   * Goal seek analysis
   */
  goalSeek: protectedProcedure
    .input(z.object({
      targetARR: z.number().min(0),
      variableToOptimize: z.string(),
      constraints: scenarioAssumptionsSchema,
      horizon: z.number().min(1).max(60).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ForecastingService(ctx.db, ctx.user.organizationId);
      
      try {
        const result = await service.goalSeek(
          input.targetARR,
          input.variableToOptimize as any,
          input.constraints,
          input.horizon
        );
        
        return {
          success: true,
          data: result
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to perform goal seek'
        });
      }
    }),

  /**
   * Get scenario templates
   */
  getScenarioTemplates: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new ForecastingService(ctx.db, ctx.user.organizationId);
      
      try {
        const templates = await service.getScenarioTemplates();
        
        return {
          success: true,
          data: templates
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get scenario templates'
        });
      }
    }),

  /**
   * Calculate customer lifetime value
   */
  calculateCustomerLTV: protectedProcedure
    .input(z.object({
      customerId: z.string(),
      method: z.enum(['historical', 'predictive', 'hybrid']).optional(),
      discountRate: z.number().min(0).max(1).optional(),
      maxPeriods: z.number().min(1).max(120).optional()
    }))
    .query(async ({ ctx, input }) => {
      const service = new ForecastingService(ctx.db, ctx.user.organizationId);
      
      try {
        const ltv = await service.calculateCustomerLTV(
          input.customerId,
          {
            method: input.method,
            discountRate: input.discountRate,
            maxPeriods: input.maxPeriods
          }
        );
        
        return {
          success: true,
          data: ltv
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to calculate LTV'
        });
      }
    }),

  /**
   * Analyze revenue at risk
   */
  analyzeRevenueAtRisk: protectedProcedure
    .input(z.object({
      timeHorizon: z.number().min(1).max(12).optional()
    }))
    .query(async ({ ctx, input }) => {
      const service = new ForecastingService(ctx.db, ctx.user.organizationId);
      
      try {
        const analysis = await service.analyzeRevenueAtRisk(input.timeHorizon);
        
        return {
          success: true,
          data: analysis
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to analyze revenue at risk'
        });
      }
    }),

  /**
   * Track forecast accuracy
   */
  trackForecastAccuracy: protectedProcedure
    .input(z.object({
      forecastId: z.string(),
      actualRevenue: z.number().min(0)
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ForecastingService(ctx.db, ctx.user.organizationId);
      
      try {
        const accuracy = await service.trackForecastAccuracy(
          input.forecastId,
          input.actualRevenue
        );
        
        return {
          success: true,
          data: accuracy
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to track accuracy'
        });
      }
    }),

  /**
   * Get forecast recommendations
   */
  getForecastRecommendations: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new ForecastingService(ctx.db, ctx.user.organizationId);
      
      try {
        const recommendations = await service.getForecastRecommendations();
        
        return {
          success: true,
          data: recommendations
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get recommendations'
        });
      }
    })
});

export type RevenueForecastingRouter = typeof revenueForecastingRouter;