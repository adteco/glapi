import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { MetricsService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

// ==========================================
// Input Schemas
// ==========================================

const dimensionFiltersSchema = z
  .object({
    subsidiaryIds: z.array(z.string()).optional(),
    classIds: z.array(z.string()).optional(),
    departmentIds: z.array(z.string()).optional(),
    locationIds: z.array(z.string()).optional(),
  })
  .optional();

const timeRangeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
  })
  .optional();

const thresholdsSchema = z
  .object({
    good: z.number().optional(),
    warning: z.number().optional(),
    critical: z.number().optional(),
    direction: z.enum(['higher_is_better', 'lower_is_better', 'target']),
    target: z.number().optional(),
  })
  .optional();

const savedViewConfigSchema = z.object({
  filters: dimensionFiltersSchema,
  timeRange: timeRangeSchema,
  periodFilter: z
    .object({
      periodId: z.string().optional(),
      periodIds: z.array(z.string()).optional(),
      fiscalYear: z.number().optional(),
      fiscalQuarter: z.number().optional(),
    })
    .optional(),
  granularity: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional(),
  metrics: z.array(z.string()).optional(),
  chartTypes: z.record(z.enum(['line', 'bar', 'pie', 'area'])).optional(),
  comparePeriod: z.boolean().optional(),
  showTrend: z.boolean().optional(),
  layout: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(['kpi', 'chart', 'table', 'breakdown']),
        width: z.number().min(1).max(12),
        height: z.number().min(1),
        config: z.record(z.any()).optional(),
      })
    )
    .optional(),
});

// ==========================================
// Metrics Router
// ==========================================

export const metricsRouter = router({
  // ==========================================
  // Dashboard Endpoints
  // ==========================================

  /**
   * Get comprehensive dashboard data
   */
  getDashboard: protectedProcedure
    .input(
      z.object({
        periodId: z.string().optional(),
        timeRange: timeRangeSchema,
        filters: dimensionFiltersSchema,
        compareWithPrevious: z.boolean().optional().default(true),
        metrics: z.array(z.string()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new MetricsService({ organizationId: ctx.organizationId }, { db: ctx.db });
      return service.getDashboard({
        periodId: input.periodId,
        timeRange: input.timeRange as { from: string; to: string } | undefined,
        filters: input.filters,
        compareWithPrevious: input.compareWithPrevious,
        metrics: input.metrics,
      });
    }),

  /**
   * Get KPI cards for specific metrics
   */
  getKpiCards: protectedProcedure
    .input(
      z.object({
        periodId: z.string(),
        metricIds: z.array(z.string()).optional(),
        filters: dimensionFiltersSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new MetricsService({ organizationId: ctx.organizationId }, { db: ctx.db });
      return service.getKpiCards(input.periodId, input.metricIds, input.filters);
    }),

  // ==========================================
  // Segment Analysis Endpoints
  // ==========================================

  /**
   * Get segment performance breakdown by dimension
   */
  getSegmentPerformance: protectedProcedure
    .input(
      z.object({
        periodId: z.string(),
        dimensionType: z.enum(['class', 'department', 'location']),
        metric: z.enum(['revenue', 'expenses', 'netIncome', 'margin']),
        filters: dimensionFiltersSchema,
        topN: z.number().min(1).max(50).optional().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new MetricsService({ organizationId: ctx.organizationId }, { db: ctx.db });
      return service.getSegmentPerformance({
        periodId: input.periodId,
        dimensionType: input.dimensionType,
        metric: input.metric,
        filters: input.filters,
        topN: input.topN,
      });
    }),

  /**
   * Get dimension breakdown for a metric
   */
  getDimensionBreakdown: protectedProcedure
    .input(
      z.object({
        periodId: z.string(),
        dimensionType: z.enum(['class', 'department', 'location']),
        metric: z.string(),
        filters: dimensionFiltersSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new MetricsService({ organizationId: ctx.organizationId }, { db: ctx.db });
      return service.getDimensionBreakdown(
        input.periodId,
        input.dimensionType,
        input.metric,
        input.filters
      );
    }),

  // ==========================================
  // Trend Analysis Endpoints
  // ==========================================

  /**
   * Get trend data for a metric over time
   */
  getTrend: protectedProcedure
    .input(
      z.object({
        metricId: z.string(),
        periodIds: z.array(z.string()).optional(),
        timeRange: timeRangeSchema,
        granularity: z.enum(['day', 'week', 'month', 'quarter', 'year']).default('month'),
        filters: dimensionFiltersSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new MetricsService({ organizationId: ctx.organizationId }, { db: ctx.db });
      return service.getTrend({
        metricId: input.metricId,
        periodIds: input.periodIds,
        timeRange: input.timeRange as { from: string; to: string } | undefined,
        granularity: input.granularity,
        filters: input.filters,
      });
    }),

  /**
   * Get multiple trends for dashboard charts
   */
  getMultipleTrends: protectedProcedure
    .input(
      z.object({
        metricIds: z.array(z.string()),
        periodIds: z.array(z.string()),
        filters: dimensionFiltersSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new MetricsService({ organizationId: ctx.organizationId }, { db: ctx.db });
      return service.getMultipleTrends(input.metricIds, input.periodIds, input.filters);
    }),

  // ==========================================
  // Metric Comparison Endpoints
  // ==========================================

  /**
   * Compare metrics between periods
   */
  compareMetrics: protectedProcedure
    .input(
      z.object({
        metricIds: z.array(z.string()),
        currentPeriodId: z.string(),
        comparePeriodId: z.string().optional(),
        filters: dimensionFiltersSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new MetricsService({ organizationId: ctx.organizationId }, { db: ctx.db });
      return service.compareMetrics({
        metricIds: input.metricIds,
        currentPeriodId: input.currentPeriodId,
        comparePeriodId: input.comparePeriodId,
        filters: input.filters,
      });
    }),

  // ==========================================
  // Metric Definition Endpoints
  // ==========================================

  /**
   * List all available metric definitions
   */
  listMetricDefinitions: protectedProcedure
    .input(
      z
        .object({
          category: z
            .enum(['revenue', 'expenses', 'profitability', 'liquidity', 'efficiency', 'project', 'custom'])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new MetricsService({ organizationId: ctx.organizationId }, { db: ctx.db });
      return service.listMetricDefinitions(input?.category);
    }),

  /**
   * Create a custom metric definition
   */
  createCustomMetric: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        category: z.enum([
          'revenue',
          'expenses',
          'profitability',
          'liquidity',
          'efficiency',
          'project',
          'custom',
        ]),
        formula: z.string().min(1).max(1000),
        unit: z.string().min(1).max(20),
        aggregation: z.enum(['sum', 'avg', 'min', 'max', 'count', 'latest']),
        isPercentage: z.boolean().optional().default(false),
        precision: z.number().min(0).max(10).optional().default(2),
        thresholds: thresholdsSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new MetricsService({ organizationId: ctx.organizationId }, { db: ctx.db });
      return service.createCustomMetric({
        name: input.name,
        description: input.description,
        category: input.category,
        formula: input.formula,
        unit: input.unit,
        aggregation: input.aggregation,
        isPercentage: input.isPercentage,
        precision: input.precision,
        thresholds: input.thresholds as { direction: 'higher_is_better' | 'lower_is_better' | 'target'; good?: number; warning?: number; critical?: number; target?: number } | undefined,
      });
    }),

  /**
   * Update a custom metric definition
   */
  updateCustomMetric: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        category: z
          .enum([
            'revenue',
            'expenses',
            'profitability',
            'liquidity',
            'efficiency',
            'project',
            'custom',
          ])
          .optional(),
        formula: z.string().min(1).max(1000).optional(),
        unit: z.string().min(1).max(20).optional(),
        aggregation: z.enum(['sum', 'avg', 'min', 'max', 'count', 'latest']).optional(),
        isPercentage: z.boolean().optional(),
        precision: z.number().min(0).max(10).optional(),
        thresholds: thresholdsSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new MetricsService({ organizationId: ctx.organizationId }, { db: ctx.db });
      const { id, thresholds, ...updateData } = input;
      return service.updateCustomMetric(id, {
        ...updateData,
        thresholds: thresholds as { direction: 'higher_is_better' | 'lower_is_better' | 'target'; good?: number; warning?: number; critical?: number; target?: number } | undefined,
      });
    }),

  /**
   * Delete a custom metric definition
   */
  deleteCustomMetric: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new MetricsService({ organizationId: ctx.organizationId }, { db: ctx.db });
      await service.deleteCustomMetric(input.id);
      return { success: true };
    }),

  // ==========================================
  // Saved Views Endpoints
  // ==========================================

  /**
   * List saved views
   */
  listSavedViews: protectedProcedure
    .input(
      z
        .object({
          viewType: z.enum(['dashboard', 'report', 'analysis']).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new MetricsService({ organizationId: ctx.organizationId }, { db: ctx.db });
      return service.listSavedViews(input?.viewType);
    }),

  /**
   * Get a saved view by ID
   */
  getSavedView: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new MetricsService({ organizationId: ctx.organizationId }, { db: ctx.db });
      const view = await service.getSavedView(input.id);
      if (!view) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Saved view not found',
        });
      }
      return view;
    }),

  /**
   * Create a saved view
   */
  createSavedView: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        viewType: z.enum(['dashboard', 'report', 'analysis']),
        configuration: savedViewConfigSchema,
        isDefault: z.boolean().optional().default(false),
        isShared: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new MetricsService({ organizationId: ctx.organizationId }, { db: ctx.db });
      return service.createSavedView({
        name: input.name,
        description: input.description,
        viewType: input.viewType,
        configuration: {
          filters: input.configuration.filters ?? {},
          timeRange: input.configuration.timeRange as { from: string; to: string } | undefined,
          periodFilter: input.configuration.periodFilter,
          granularity: input.configuration.granularity,
          metrics: input.configuration.metrics,
          chartTypes: input.configuration.chartTypes,
          comparePeriod: input.configuration.comparePeriod,
          showTrend: input.configuration.showTrend,
          layout: input.configuration.layout as Array<{ id: string; type: 'kpi' | 'chart' | 'table' | 'breakdown'; width: number; height: number; config?: Record<string, any> }> | undefined,
        },
        isDefault: input.isDefault,
        isShared: input.isShared,
      }, ctx.user!.id);
    }),

  /**
   * Update a saved view
   */
  updateSavedView: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        configuration: savedViewConfigSchema.optional(),
        isDefault: z.boolean().optional(),
        isShared: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new MetricsService({ organizationId: ctx.organizationId }, { db: ctx.db });
      const { id, configuration, ...updateData } = input;
      return service.updateSavedView(id, {
        ...updateData,
        configuration: configuration ? {
          filters: configuration.filters ?? {},
          timeRange: configuration.timeRange as { from: string; to: string } | undefined,
          periodFilter: configuration.periodFilter,
          granularity: configuration.granularity,
          metrics: configuration.metrics,
          chartTypes: configuration.chartTypes,
          comparePeriod: configuration.comparePeriod,
          showTrend: configuration.showTrend,
          layout: configuration.layout as Array<{ id: string; type: 'kpi' | 'chart' | 'table' | 'breakdown'; width: number; height: number; config?: Record<string, any> }> | undefined,
        } : undefined,
      });
    }),

  /**
   * Delete a saved view
   */
  deleteSavedView: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new MetricsService({ organizationId: ctx.organizationId }, { db: ctx.db });
      await service.deleteSavedView(input.id);
      return { success: true };
    }),
});
