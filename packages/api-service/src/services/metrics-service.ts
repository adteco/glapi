import { BaseService } from './base-service';
import { ServiceError } from '../types';
import {
  DimensionFilters,
  TimeRange,
  MetricDefinition,
  MetricValue,
  MetricCategory,
  TimeGranularity,
  KpiCard,
  DashboardSummary,
  SegmentPerformance,
  TrendData,
  TimeSeriesDataPoint,
  DimensionBreakdown,
  SavedView,
  SavedViewConfiguration,
  CreateSavedViewInput,
  UpdateSavedViewInput,
  DashboardQueryInput,
  SegmentAnalysisInput,
  TrendAnalysisInput,
  MetricComparisonInput,
  DashboardResponse,
  SegmentAnalysisResponse,
  MetricComparisonResponse,
} from '../types/metrics.types';
import {
  GlReportingRepository,
  MetricsRepository,
  AccountingPeriodRepository,
  type ContextualDatabase,
} from '@glapi/database';

export interface MetricsServiceOptions {
  db?: ContextualDatabase;
}

// ==========================================
// Built-in Metric Definitions
// ==========================================

const BUILT_IN_METRICS: MetricDefinition[] = [
  // Revenue metrics
  {
    id: 'total_revenue',
    name: 'Total Revenue',
    category: 'revenue',
    formula: 'SUM(credit) WHERE account_type = REVENUE',
    unit: 'USD',
    aggregation: 'sum',
    thresholds: { direction: 'higher_is_better' },
  },
  {
    id: 'revenue_growth',
    name: 'Revenue Growth',
    category: 'revenue',
    formula: '(current_revenue - previous_revenue) / previous_revenue * 100',
    unit: '%',
    aggregation: 'latest',
    isPercentage: true,
    precision: 2,
    thresholds: { good: 10, warning: 0, critical: -10, direction: 'higher_is_better' },
  },

  // Expense metrics
  {
    id: 'total_expenses',
    name: 'Total Expenses',
    category: 'expenses',
    formula: 'SUM(debit) WHERE account_type IN (EXPENSE, COGS)',
    unit: 'USD',
    aggregation: 'sum',
    thresholds: { direction: 'lower_is_better' },
  },
  {
    id: 'expense_ratio',
    name: 'Expense Ratio',
    category: 'expenses',
    formula: 'total_expenses / total_revenue * 100',
    unit: '%',
    aggregation: 'latest',
    isPercentage: true,
    precision: 2,
    thresholds: { good: 70, warning: 85, critical: 100, direction: 'lower_is_better' },
  },

  // Profitability metrics
  {
    id: 'net_income',
    name: 'Net Income',
    category: 'profitability',
    formula: 'total_revenue - total_expenses',
    unit: 'USD',
    aggregation: 'sum',
    thresholds: { good: 0, direction: 'higher_is_better' },
  },
  {
    id: 'gross_margin',
    name: 'Gross Margin',
    category: 'profitability',
    formula: '(revenue - cogs) / revenue * 100',
    unit: '%',
    aggregation: 'latest',
    isPercentage: true,
    precision: 2,
    thresholds: { good: 40, warning: 25, critical: 10, direction: 'higher_is_better' },
  },
  {
    id: 'operating_margin',
    name: 'Operating Margin',
    category: 'profitability',
    formula: 'operating_income / revenue * 100',
    unit: '%',
    aggregation: 'latest',
    isPercentage: true,
    precision: 2,
    thresholds: { good: 20, warning: 10, critical: 0, direction: 'higher_is_better' },
  },
  {
    id: 'ebitda',
    name: 'EBITDA',
    category: 'profitability',
    formula: 'operating_income + depreciation + amortization',
    unit: 'USD',
    aggregation: 'sum',
    thresholds: { direction: 'higher_is_better' },
  },

  // Liquidity metrics
  {
    id: 'current_ratio',
    name: 'Current Ratio',
    category: 'liquidity',
    formula: 'current_assets / current_liabilities',
    unit: 'ratio',
    aggregation: 'latest',
    precision: 2,
    thresholds: { good: 2, warning: 1.5, critical: 1, direction: 'higher_is_better' },
  },
  {
    id: 'quick_ratio',
    name: 'Quick Ratio',
    category: 'liquidity',
    formula: '(current_assets - inventory) / current_liabilities',
    unit: 'ratio',
    aggregation: 'latest',
    precision: 2,
    thresholds: { good: 1, warning: 0.8, critical: 0.5, direction: 'higher_is_better' },
  },
  {
    id: 'working_capital',
    name: 'Working Capital',
    category: 'liquidity',
    formula: 'current_assets - current_liabilities',
    unit: 'USD',
    aggregation: 'latest',
    thresholds: { good: 0, direction: 'higher_is_better' },
  },

  // Efficiency metrics
  {
    id: 'ar_turnover',
    name: 'AR Turnover',
    category: 'efficiency',
    formula: 'revenue / average_ar',
    unit: 'times',
    aggregation: 'latest',
    precision: 2,
    thresholds: { good: 12, warning: 6, critical: 4, direction: 'higher_is_better' },
  },
  {
    id: 'days_sales_outstanding',
    name: 'Days Sales Outstanding',
    category: 'efficiency',
    formula: '(average_ar / revenue) * 365',
    unit: 'days',
    aggregation: 'latest',
    precision: 1,
    thresholds: { good: 30, warning: 45, critical: 60, direction: 'lower_is_better' },
  },
  {
    id: 'ap_turnover',
    name: 'AP Turnover',
    category: 'efficiency',
    formula: 'cogs / average_ap',
    unit: 'times',
    aggregation: 'latest',
    precision: 2,
  },
];

// ==========================================
// Metrics Service
// ==========================================

export class MetricsService extends BaseService {
  private reportingRepository: GlReportingRepository;
  private metricsRepository: MetricsRepository;
  private periodRepository: AccountingPeriodRepository;

  constructor(context: { organizationId?: string } = {}, options: MetricsServiceOptions = {}) {
    super(context);
    // Pass the contextual db to all repositories for RLS support
    this.reportingRepository = new GlReportingRepository(options.db);
    this.metricsRepository = new MetricsRepository(options.db);
    this.periodRepository = new AccountingPeriodRepository(options.db);
  }

  // ==========================================
  // Dashboard Methods
  // ==========================================

  /**
   * Get comprehensive dashboard data
   */
  async getDashboard(input: DashboardQueryInput): Promise<DashboardResponse> {
    const organizationId = this.requireOrganizationContext();

    // Get period info
    const period = await this.resolvePeriod(input.periodId, organizationId);
    if (!period) {
      throw new ServiceError('Period not found', 'PERIOD_NOT_FOUND', 404);
    }

    // Get previous period for comparison if requested
    let previousPeriod = null;
    if (input.compareWithPrevious) {
      previousPeriod = await this.getPreviousPeriod(period.id, organizationId);
    }

    // Fetch financial data with dimension filters
    const currentData = await this.fetchPeriodFinancials(
      period.id,
      organizationId,
      input.filters
    );

    const previousData = previousPeriod
      ? await this.fetchPeriodFinancials(previousPeriod.id, organizationId, input.filters)
      : null;

    // Build summary metrics
    const summary = this.buildDashboardSummary(currentData, previousData);

    // Build KPI cards
    const kpiCards = this.buildKpiCards(currentData, previousData, input.metrics);

    // Build segment breakdowns if no specific dimension filter is applied
    const segmentBreakdowns = await this.buildSegmentBreakdowns(
      period.id,
      organizationId,
      input.filters
    );

    return {
      summary,
      kpiCards,
      segmentBreakdowns,
      generatedAt: new Date().toISOString(),
      period: {
        id: period.id,
        name: period.periodName,
        startDate: period.startDate,
        endDate: period.endDate,
      },
      appliedFilters: input.filters || {},
    };
  }

  /**
   * Get KPI cards for specific metrics
   */
  async getKpiCards(
    periodId: string,
    metricIds?: string[],
    filters?: DimensionFilters
  ): Promise<KpiCard[]> {
    const organizationId = this.requireOrganizationContext();

    const period = await this.resolvePeriod(periodId, organizationId);
    if (!period) {
      throw new ServiceError('Period not found', 'PERIOD_NOT_FOUND', 404);
    }

    const previousPeriod = await this.getPreviousPeriod(period.id, organizationId);
    const currentData = await this.fetchPeriodFinancials(period.id, organizationId, filters);
    const previousData = previousPeriod
      ? await this.fetchPeriodFinancials(previousPeriod.id, organizationId, filters)
      : null;

    return this.buildKpiCards(currentData, previousData, metricIds);
  }

  // ==========================================
  // Segment Analysis Methods
  // ==========================================

  /**
   * Get segment performance breakdown by dimension
   */
  async getSegmentPerformance(input: SegmentAnalysisInput): Promise<SegmentPerformance> {
    const organizationId = this.requireOrganizationContext();

    const segments = await this.metricsRepository.getSegmentBreakdown(
      organizationId,
      input.periodId,
      input.dimensionType,
      input.metric,
      input.filters
    );

    const total = segments.reduce((sum, s) => sum + s.value, 0);

    return {
      dimensionType: input.dimensionType,
      segments: segments
        .map((s) => ({
          id: s.dimensionId,
          name: s.dimensionName,
          code: s.dimensionCode,
          revenue: input.metric === 'revenue' ? s.value : 0,
          expenses: input.metric === 'expenses' ? s.value : 0,
          netIncome: input.metric === 'netIncome' ? s.value : 0,
          margin: input.metric === 'margin' ? s.value : 0,
          percentOfTotal: total > 0 ? (s.value / total) * 100 : 0,
        }))
        .slice(0, input.topN || 10),
      total: {
        revenue: input.metric === 'revenue' ? total : 0,
        expenses: input.metric === 'expenses' ? total : 0,
        netIncome: input.metric === 'netIncome' ? total : 0,
      },
    };
  }

  /**
   * Get dimension breakdown for a metric
   */
  async getDimensionBreakdown(
    periodId: string,
    dimensionType: 'class' | 'department' | 'location',
    metric: string,
    filters?: DimensionFilters
  ): Promise<DimensionBreakdown[]> {
    const organizationId = this.requireOrganizationContext();

    const segments = await this.metricsRepository.getSegmentBreakdown(
      organizationId,
      periodId,
      dimensionType,
      metric as any,
      filters
    );

    const total = segments.reduce((sum, s) => sum + s.value, 0);

    return segments.map((s) => ({
      dimensionType,
      dimensionId: s.dimensionId,
      dimensionName: s.dimensionName,
      dimensionCode: s.dimensionCode,
      value: s.value,
      percentage: total > 0 ? (s.value / total) * 100 : 0,
    }));
  }

  // ==========================================
  // Trend Analysis Methods
  // ==========================================

  /**
   * Get trend data for a metric over time
   */
  async getTrend(input: TrendAnalysisInput): Promise<TrendData> {
    const organizationId = this.requireOrganizationContext();

    const metric = this.getMetricDefinition(input.metricId);

    // Get periods based on time range or period IDs
    const periods = await this.resolvePeriods(
      input.periodIds,
      input.timeRange,
      organizationId,
      input.granularity
    );

    // Fetch metric values for each period
    const dataPoints: TimeSeriesDataPoint[] = [];
    for (const period of periods) {
      const value = await this.calculateMetricValue(
        input.metricId,
        period.id,
        organizationId,
        input.filters
      );
      dataPoints.push({
        date: period.endDate,
        value: value.value,
        periodId: period.id,
      });
    }

    // Calculate trend direction
    const trend = this.calculateTrend(dataPoints);

    return {
      metricId: input.metricId,
      metricName: metric.name,
      granularity: input.granularity,
      dataPoints,
      trend: trend.direction,
      trendStrength: trend.strength,
    };
  }

  /**
   * Get multiple trends for dashboard charts
   */
  async getMultipleTrends(
    metricIds: string[],
    periodIds: string[],
    filters?: DimensionFilters
  ): Promise<TrendData[]> {
    const trends: TrendData[] = [];
    for (const metricId of metricIds) {
      const trend = await this.getTrend({
        metricId,
        periodIds,
        granularity: 'month',
        filters,
      });
      trends.push(trend);
    }
    return trends;
  }

  // ==========================================
  // Metric Comparison Methods
  // ==========================================

  /**
   * Compare metrics between periods
   */
  async compareMetrics(input: MetricComparisonInput): Promise<MetricComparisonResponse> {
    const organizationId = this.requireOrganizationContext();

    const currentPeriod = await this.resolvePeriod(input.currentPeriodId, organizationId);
    if (!currentPeriod) {
      throw new ServiceError('Current period not found', 'PERIOD_NOT_FOUND', 404);
    }

    const comparePeriod = input.comparePeriodId
      ? await this.resolvePeriod(input.comparePeriodId, organizationId)
      : await this.getPreviousPeriod(currentPeriod.id, organizationId);

    const metrics: MetricComparisonResponse['metrics'] = [];

    for (const metricId of input.metricIds) {
      const definition = this.getMetricDefinition(metricId);
      const current = await this.calculateMetricValue(
        metricId,
        input.currentPeriodId,
        organizationId,
        input.filters
      );

      let previous: MetricValue | undefined;
      if (comparePeriod) {
        previous = await this.calculateMetricValue(
          metricId,
          comparePeriod.id,
          organizationId,
          input.filters
        );
      }

      const variance = previous ? current.value - previous.value : undefined;
      const variancePercent =
        previous && previous.value !== 0 ? (variance! / previous.value) * 100 : undefined;

      metrics.push({
        metricId,
        metricName: definition.name,
        current,
        previous,
        variance,
        variancePercent,
      });
    }

    return {
      metrics,
      currentPeriod: { id: currentPeriod.id, name: currentPeriod.periodName },
      comparePeriod: comparePeriod
        ? { id: comparePeriod.id, name: comparePeriod.periodName }
        : undefined,
      generatedAt: new Date().toISOString(),
    };
  }

  // ==========================================
  // Metric Definition Methods
  // ==========================================

  /**
   * Get all available metric definitions
   */
  async listMetricDefinitions(category?: MetricCategory): Promise<MetricDefinition[]> {
    const organizationId = this.requireOrganizationContext();

    // Get built-in metrics
    let metrics = [...BUILT_IN_METRICS];

    // Get custom metrics from database
    const customMetrics = await this.metricsRepository.findCustomMetrics(organizationId);
    metrics = metrics.concat(
      customMetrics.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description || undefined,
        category: m.category as MetricCategory,
        formula: m.formula,
        unit: m.unit,
        aggregation: m.aggregation as any,
        isPercentage: m.isPercentage || false,
        precision: m.precision || 2,
        thresholds: m.thresholds ? JSON.parse(m.thresholds) : undefined,
      }))
    );

    // Filter by category if specified
    if (category) {
      metrics = metrics.filter((m) => m.category === category);
    }

    return metrics;
  }

  /**
   * Create a custom metric definition
   */
  async createCustomMetric(
    input: Omit<MetricDefinition, 'id'>
  ): Promise<MetricDefinition> {
    const organizationId = this.requireOrganizationContext();

    const metric = await this.metricsRepository.createCustomMetric({
      organizationId,
      name: input.name,
      description: input.description,
      category: input.category,
      formula: input.formula,
      unit: input.unit,
      aggregation: input.aggregation,
      isPercentage: input.isPercentage || false,
      precision: input.precision || 2,
      thresholds: input.thresholds ? JSON.stringify(input.thresholds) : null,
    });

    return {
      id: metric.id,
      ...input,
    };
  }

  /**
   * Update a custom metric definition
   */
  async updateCustomMetric(
    id: string,
    input: Partial<Omit<MetricDefinition, 'id'>>
  ): Promise<MetricDefinition> {
    const organizationId = this.requireOrganizationContext();

    const existing = await this.metricsRepository.findCustomMetricById(id, organizationId);
    if (!existing) {
      throw new ServiceError('Custom metric not found', 'METRIC_NOT_FOUND', 404);
    }

    await this.metricsRepository.updateCustomMetric(id, {
      name: input.name,
      description: input.description,
      category: input.category,
      formula: input.formula,
      unit: input.unit,
      aggregation: input.aggregation,
      isPercentage: input.isPercentage,
      precision: input.precision,
      thresholds: input.thresholds ? JSON.stringify(input.thresholds) : undefined,
    });

    const updated = await this.metricsRepository.findCustomMetricById(id, organizationId);
    return {
      id: updated!.id,
      name: updated!.name,
      description: updated!.description || undefined,
      category: updated!.category as MetricCategory,
      formula: updated!.formula,
      unit: updated!.unit,
      aggregation: updated!.aggregation as any,
      isPercentage: updated!.isPercentage || false,
      precision: updated!.precision || 2,
      thresholds: updated!.thresholds ? JSON.parse(updated!.thresholds) : undefined,
    };
  }

  /**
   * Delete a custom metric definition
   */
  async deleteCustomMetric(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    const existing = await this.metricsRepository.findCustomMetricById(id, organizationId);
    if (!existing) {
      throw new ServiceError('Custom metric not found', 'METRIC_NOT_FOUND', 404);
    }

    await this.metricsRepository.deleteCustomMetric(id);
  }

  // ==========================================
  // Saved Views Methods
  // ==========================================

  /**
   * List saved views
   */
  async listSavedViews(
    viewType?: 'dashboard' | 'report' | 'analysis'
  ): Promise<SavedView[]> {
    const organizationId = this.requireOrganizationContext();

    const views = await this.metricsRepository.findSavedViews(organizationId, viewType);

    return views.map((v) => ({
      id: v.id,
      organizationId: v.organizationId,
      name: v.name,
      description: v.description || undefined,
      viewType: v.viewType as SavedView['viewType'],
      configuration: JSON.parse(v.configuration) as SavedViewConfiguration,
      isDefault: v.isDefault || false,
      isShared: v.isShared || false,
      createdBy: v.createdBy,
      createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt),
      updatedAt: v.updatedAt instanceof Date ? v.updatedAt.toISOString() : String(v.updatedAt),
    }));
  }

  /**
   * Get a saved view by ID
   */
  async getSavedView(id: string): Promise<SavedView | null> {
    const organizationId = this.requireOrganizationContext();

    const view = await this.metricsRepository.findSavedViewById(id, organizationId);
    if (!view) return null;

    return {
      id: view.id,
      organizationId: view.organizationId,
      name: view.name,
      description: view.description || undefined,
      viewType: view.viewType as SavedView['viewType'],
      configuration: JSON.parse(view.configuration) as SavedViewConfiguration,
      isDefault: view.isDefault || false,
      isShared: view.isShared || false,
      createdBy: view.createdBy,
      createdAt: view.createdAt instanceof Date ? view.createdAt.toISOString() : String(view.createdAt),
      updatedAt: view.updatedAt instanceof Date ? view.updatedAt.toISOString() : String(view.updatedAt),
    };
  }

  /**
   * Create a saved view
   */
  async createSavedView(input: CreateSavedViewInput, userId: string): Promise<SavedView> {
    const organizationId = this.requireOrganizationContext();

    // If setting as default, unset other defaults
    if (input.isDefault) {
      await this.metricsRepository.clearDefaultViews(organizationId, input.viewType);
    }

    const view = await this.metricsRepository.createSavedView({
      organizationId,
      name: input.name,
      description: input.description,
      viewType: input.viewType,
      configuration: JSON.stringify(input.configuration),
      isDefault: input.isDefault || false,
      isShared: input.isShared || false,
      createdBy: userId,
    });

    return {
      id: view.id,
      organizationId: view.organizationId,
      name: view.name,
      description: view.description || undefined,
      viewType: view.viewType as SavedView['viewType'],
      configuration: input.configuration,
      isDefault: view.isDefault || false,
      isShared: view.isShared || false,
      createdBy: view.createdBy,
      createdAt: view.createdAt instanceof Date ? view.createdAt.toISOString() : String(view.createdAt),
      updatedAt: view.updatedAt instanceof Date ? view.updatedAt.toISOString() : String(view.updatedAt),
    };
  }

  /**
   * Update a saved view
   */
  async updateSavedView(id: string, input: UpdateSavedViewInput): Promise<SavedView> {
    const organizationId = this.requireOrganizationContext();

    const existing = await this.metricsRepository.findSavedViewById(id, organizationId);
    if (!existing) {
      throw new ServiceError('Saved view not found', 'VIEW_NOT_FOUND', 404);
    }

    // If setting as default, unset other defaults
    if (input.isDefault) {
      await this.metricsRepository.clearDefaultViews(
        organizationId,
        existing.viewType as SavedView['viewType']
      );
    }

    const existingConfig = JSON.parse(existing.configuration);
    const newConfig = input.configuration
      ? { ...existingConfig, ...input.configuration }
      : existingConfig;

    await this.metricsRepository.updateSavedView(id, {
      name: input.name,
      description: input.description,
      configuration: JSON.stringify(newConfig),
      isDefault: input.isDefault,
      isShared: input.isShared,
    });

    const updated = await this.metricsRepository.findSavedViewById(id, organizationId);
    return {
      id: updated!.id,
      organizationId: updated!.organizationId,
      name: updated!.name,
      description: updated!.description || undefined,
      viewType: updated!.viewType as SavedView['viewType'],
      configuration: JSON.parse(updated!.configuration),
      isDefault: updated!.isDefault || false,
      isShared: updated!.isShared || false,
      createdBy: updated!.createdBy,
      createdAt: updated!.createdAt instanceof Date ? updated!.createdAt.toISOString() : String(updated!.createdAt),
      updatedAt: updated!.updatedAt instanceof Date ? updated!.updatedAt.toISOString() : String(updated!.updatedAt),
    };
  }

  /**
   * Delete a saved view
   */
  async deleteSavedView(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    const existing = await this.metricsRepository.findSavedViewById(id, organizationId);
    if (!existing) {
      throw new ServiceError('Saved view not found', 'VIEW_NOT_FOUND', 404);
    }

    await this.metricsRepository.deleteSavedView(id);
  }

  // ==========================================
  // Private Helper Methods
  // ==========================================

  private getMetricDefinition(metricId: string): MetricDefinition {
    const builtIn = BUILT_IN_METRICS.find((m) => m.id === metricId);
    if (builtIn) return builtIn;

    // For custom metrics, return a placeholder - actual fetch happens in calculate
    return {
      id: metricId,
      name: metricId,
      category: 'custom',
      formula: '',
      unit: 'USD',
      aggregation: 'sum',
    };
  }

  private async resolvePeriod(
    periodId: string | undefined,
    organizationId: string
  ): Promise<any | null> {
    if (periodId) {
      return this.periodRepository.findByIdForOrganization(periodId, organizationId);
    }
    // Get current open period
    return this.periodRepository.findCurrentPeriod(organizationId);
  }

  private async getPreviousPeriod(
    currentPeriodId: string,
    organizationId: string
  ): Promise<any | null> {
    return this.periodRepository.findPreviousPeriod(currentPeriodId, organizationId);
  }

  private async resolvePeriods(
    periodIds: string[] | undefined,
    timeRange: TimeRange | undefined,
    organizationId: string,
    granularity: TimeGranularity
  ): Promise<any[]> {
    if (periodIds && periodIds.length > 0) {
      const periods = [];
      for (const id of periodIds) {
        const period = await this.periodRepository.findByIdForOrganization(id, organizationId);
        if (period) periods.push(period);
      }
      return periods;
    }

    if (timeRange) {
      return this.periodRepository.findByDateRange(
        organizationId,
        timeRange.from.toString(),
        timeRange.to.toString()
      );
    }

    // Default to last 12 periods
    return this.periodRepository.findRecentPeriods(organizationId, 12);
  }

  private async fetchPeriodFinancials(
    periodId: string,
    organizationId: string,
    filters?: DimensionFilters
  ): Promise<{
    revenue: number;
    cogs: number;
    operatingExpenses: number;
    otherExpenses: number;
    currentAssets: number;
    currentLiabilities: number;
    inventory: number;
    accountsReceivable: number;
    accountsPayable: number;
  }> {
    const data = await this.metricsRepository.getPeriodFinancials(
      organizationId,
      periodId,
      filters
    );

    return {
      revenue: parseFloat(data.revenue || '0'),
      cogs: parseFloat(data.cogs || '0'),
      operatingExpenses: parseFloat(data.operatingExpenses || '0'),
      otherExpenses: parseFloat(data.otherExpenses || '0'),
      currentAssets: parseFloat(data.currentAssets || '0'),
      currentLiabilities: parseFloat(data.currentLiabilities || '0'),
      inventory: parseFloat(data.inventory || '0'),
      accountsReceivable: parseFloat(data.accountsReceivable || '0'),
      accountsPayable: parseFloat(data.accountsPayable || '0'),
    };
  }

  private buildDashboardSummary(
    current: ReturnType<typeof this.fetchPeriodFinancials> extends Promise<infer T> ? T : never,
    previous: ReturnType<typeof this.fetchPeriodFinancials> extends Promise<infer T>
      ? T | null
      : never
  ): DashboardSummary {
    const totalExpenses = current.cogs + current.operatingExpenses + current.otherExpenses;
    const netIncome = current.revenue - totalExpenses;
    const grossMargin =
      current.revenue > 0 ? ((current.revenue - current.cogs) / current.revenue) * 100 : 0;
    const operatingIncome = current.revenue - current.cogs - current.operatingExpenses;
    const operatingMargin = current.revenue > 0 ? (operatingIncome / current.revenue) * 100 : 0;

    const prevExpenses = previous
      ? previous.cogs + previous.operatingExpenses + previous.otherExpenses
      : 0;
    const prevNetIncome = previous ? previous.revenue - prevExpenses : 0;

    return {
      totalRevenue: this.buildMetricValue('total_revenue', current.revenue, previous?.revenue),
      totalExpenses: this.buildMetricValue('total_expenses', totalExpenses, prevExpenses),
      netIncome: this.buildMetricValue('net_income', netIncome, prevNetIncome),
      grossMargin: this.buildMetricValue(
        'gross_margin',
        grossMargin,
        previous && previous.revenue > 0
          ? ((previous.revenue - previous.cogs) / previous.revenue) * 100
          : undefined
      ),
      operatingMargin: this.buildMetricValue(
        'operating_margin',
        operatingMargin,
        previous && previous.revenue > 0
          ? ((previous.revenue - previous.cogs - previous.operatingExpenses) / previous.revenue) *
              100
          : undefined
      ),
      currentRatio:
        current.currentLiabilities > 0
          ? this.buildMetricValue(
              'current_ratio',
              current.currentAssets / current.currentLiabilities,
              previous && previous.currentLiabilities > 0
                ? previous.currentAssets / previous.currentLiabilities
                : undefined
            )
          : undefined,
      quickRatio:
        current.currentLiabilities > 0
          ? this.buildMetricValue(
              'quick_ratio',
              (current.currentAssets - current.inventory) / current.currentLiabilities,
              previous && previous.currentLiabilities > 0
                ? (previous.currentAssets - previous.inventory) / previous.currentLiabilities
                : undefined
            )
          : undefined,
      workingCapital: this.buildMetricValue(
        'working_capital',
        current.currentAssets - current.currentLiabilities,
        previous ? previous.currentAssets - previous.currentLiabilities : undefined
      ),
    };
  }

  private buildMetricValue(
    metricId: string,
    value: number,
    previousValue?: number
  ): MetricValue {
    const definition = this.getMetricDefinition(metricId);
    const change = previousValue !== undefined ? value - previousValue : undefined;
    const changePercent =
      previousValue !== undefined && previousValue !== 0
        ? (change! / previousValue) * 100
        : undefined;

    let status: MetricValue['status'] = 'neutral';
    if (definition.thresholds) {
      const { thresholds } = definition;
      if (thresholds.direction === 'higher_is_better') {
        if (thresholds.good !== undefined && value >= thresholds.good) status = 'good';
        else if (thresholds.warning !== undefined && value >= thresholds.warning)
          status = 'warning';
        else if (thresholds.critical !== undefined && value < thresholds.critical)
          status = 'critical';
      } else if (thresholds.direction === 'lower_is_better') {
        if (thresholds.good !== undefined && value <= thresholds.good) status = 'good';
        else if (thresholds.warning !== undefined && value <= thresholds.warning)
          status = 'warning';
        else if (thresholds.critical !== undefined && value > thresholds.critical)
          status = 'critical';
      }
    }

    return {
      metricId,
      value,
      previousValue,
      change,
      changePercent,
      status,
      asOf: new Date().toISOString(),
    };
  }

  private buildKpiCards(
    current: ReturnType<typeof this.fetchPeriodFinancials> extends Promise<infer T> ? T : never,
    previous: ReturnType<typeof this.fetchPeriodFinancials> extends Promise<infer T>
      ? T | null
      : never,
    metricIds?: string[]
  ): KpiCard[] {
    const defaultMetrics = [
      'total_revenue',
      'total_expenses',
      'net_income',
      'gross_margin',
      'operating_margin',
    ];
    const metricsToInclude = metricIds || defaultMetrics;

    const cards: KpiCard[] = [];
    const totalExpenses = current.cogs + current.operatingExpenses + current.otherExpenses;
    const prevExpenses = previous
      ? previous.cogs + previous.operatingExpenses + previous.otherExpenses
      : 0;

    for (const metricId of metricsToInclude) {
      const definition = this.getMetricDefinition(metricId);
      let value = 0;
      let prevValue: number | undefined;

      switch (metricId) {
        case 'total_revenue':
          value = current.revenue;
          prevValue = previous?.revenue;
          break;
        case 'total_expenses':
          value = totalExpenses;
          prevValue = previous ? prevExpenses : undefined;
          break;
        case 'net_income':
          value = current.revenue - totalExpenses;
          prevValue = previous ? previous.revenue - prevExpenses : undefined;
          break;
        case 'gross_margin':
          value =
            current.revenue > 0 ? ((current.revenue - current.cogs) / current.revenue) * 100 : 0;
          prevValue =
            previous && previous.revenue > 0
              ? ((previous.revenue - previous.cogs) / previous.revenue) * 100
              : undefined;
          break;
        case 'operating_margin':
          value =
            current.revenue > 0
              ? ((current.revenue - current.cogs - current.operatingExpenses) / current.revenue) *
                100
              : 0;
          prevValue =
            previous && previous.revenue > 0
              ? ((previous.revenue - previous.cogs - previous.operatingExpenses) /
                  previous.revenue) *
                100
              : undefined;
          break;
        case 'current_ratio':
          value =
            current.currentLiabilities > 0
              ? current.currentAssets / current.currentLiabilities
              : 0;
          prevValue =
            previous && previous.currentLiabilities > 0
              ? previous.currentAssets / previous.currentLiabilities
              : undefined;
          break;
        default:
          continue;
      }

      const change = prevValue !== undefined ? value - prevValue : undefined;
      const changePercent =
        prevValue !== undefined && prevValue !== 0 ? (change! / prevValue) * 100 : undefined;

      cards.push({
        id: metricId,
        title: definition.name,
        value,
        formattedValue: this.formatValue(value, definition),
        previousValue: prevValue,
        change,
        changePercent,
        changeDirection: change !== undefined ? (change > 0 ? 'up' : change < 0 ? 'down' : 'flat') : undefined,
        status: this.getMetricStatus(value, definition),
        unit: definition.unit,
        period: 'current',
      });
    }

    return cards;
  }

  private formatValue(value: number, definition: MetricDefinition): string {
    const precision = definition.precision || 2;
    if (definition.isPercentage || definition.unit === '%') {
      return `${value.toFixed(precision)}%`;
    }
    if (definition.unit === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    if (definition.unit === 'ratio' || definition.unit === 'times') {
      return value.toFixed(precision);
    }
    return value.toFixed(precision);
  }

  private getMetricStatus(
    value: number,
    definition: MetricDefinition
  ): KpiCard['status'] {
    if (!definition.thresholds) return 'neutral';

    const { thresholds } = definition;
    if (thresholds.direction === 'higher_is_better') {
      if (thresholds.good !== undefined && value >= thresholds.good) return 'good';
      if (thresholds.warning !== undefined && value >= thresholds.warning) return 'warning';
      if (thresholds.critical !== undefined) return 'critical';
    } else if (thresholds.direction === 'lower_is_better') {
      if (thresholds.good !== undefined && value <= thresholds.good) return 'good';
      if (thresholds.warning !== undefined && value <= thresholds.warning) return 'warning';
      if (thresholds.critical !== undefined) return 'critical';
    }
    return 'neutral';
  }

  private async buildSegmentBreakdowns(
    periodId: string,
    organizationId: string,
    filters?: DimensionFilters
  ): Promise<SegmentPerformance[]> {
    const breakdowns: SegmentPerformance[] = [];

    // Only build breakdowns for dimensions not already filtered
    const dimensionTypes: Array<'class' | 'department' | 'location'> = [];

    if (!filters?.classIds || filters.classIds.length === 0) {
      dimensionTypes.push('class');
    }
    if (!filters?.departmentIds || filters.departmentIds.length === 0) {
      dimensionTypes.push('department');
    }
    if (!filters?.locationIds || filters.locationIds.length === 0) {
      dimensionTypes.push('location');
    }

    for (const dimensionType of dimensionTypes) {
      try {
        const performance = await this.getSegmentPerformance({
          periodId,
          dimensionType,
          metric: 'revenue',
          filters,
          topN: 5,
        });
        breakdowns.push(performance);
      } catch {
        // Skip if no data available for this dimension
      }
    }

    return breakdowns;
  }

  private async calculateMetricValue(
    metricId: string,
    periodId: string,
    organizationId: string,
    filters?: DimensionFilters
  ): Promise<MetricValue> {
    const data = await this.fetchPeriodFinancials(periodId, organizationId, filters);
    const totalExpenses = data.cogs + data.operatingExpenses + data.otherExpenses;

    let value = 0;
    switch (metricId) {
      case 'total_revenue':
        value = data.revenue;
        break;
      case 'total_expenses':
        value = totalExpenses;
        break;
      case 'net_income':
        value = data.revenue - totalExpenses;
        break;
      case 'gross_margin':
        value = data.revenue > 0 ? ((data.revenue - data.cogs) / data.revenue) * 100 : 0;
        break;
      case 'operating_margin':
        value =
          data.revenue > 0
            ? ((data.revenue - data.cogs - data.operatingExpenses) / data.revenue) * 100
            : 0;
        break;
      case 'current_ratio':
        value = data.currentLiabilities > 0 ? data.currentAssets / data.currentLiabilities : 0;
        break;
      case 'quick_ratio':
        value =
          data.currentLiabilities > 0
            ? (data.currentAssets - data.inventory) / data.currentLiabilities
            : 0;
        break;
      case 'working_capital':
        value = data.currentAssets - data.currentLiabilities;
        break;
      default:
        value = 0;
    }

    return this.buildMetricValue(metricId, value, undefined);
  }

  private calculateTrend(dataPoints: TimeSeriesDataPoint[]): {
    direction: 'increasing' | 'decreasing' | 'stable';
    strength: number;
  } {
    if (dataPoints.length < 2) {
      return { direction: 'stable', strength: 0 };
    }

    // Simple linear regression to determine trend
    const n = dataPoints.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += dataPoints[i].value;
      sumXY += i * dataPoints[i].value;
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const avgValue = sumY / n;
    const normalizedSlope = avgValue !== 0 ? slope / avgValue : 0;

    let direction: 'increasing' | 'decreasing' | 'stable';
    if (normalizedSlope > 0.01) {
      direction = 'increasing';
    } else if (normalizedSlope < -0.01) {
      direction = 'decreasing';
    } else {
      direction = 'stable';
    }

    return {
      direction,
      strength: Math.abs(normalizedSlope),
    };
  }
}
