// ==========================================
// Metrics & KPI Types
// ==========================================

/**
 * Time granularity for metrics aggregation
 */
export type TimeGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * Aggregation type for metrics
 */
export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'latest';

/**
 * Metric category for grouping
 */
export type MetricCategory =
  | 'revenue'
  | 'expenses'
  | 'profitability'
  | 'liquidity'
  | 'efficiency'
  | 'project'
  | 'custom';

/**
 * Dimension filters for segment reporting
 */
export interface DimensionFilters {
  subsidiaryIds?: string[];
  classIds?: string[];
  departmentIds?: string[];
  locationIds?: string[];
}

/**
 * Time range for metrics queries
 */
export interface TimeRange {
  from: string | Date;
  to: string | Date;
}

/**
 * Period-based filter (alternative to date range)
 */
export interface PeriodFilter {
  periodId?: string;
  periodIds?: string[];
  fiscalYear?: number;
  fiscalQuarter?: number;
}

/**
 * Metric definition for custom KPIs
 */
export interface MetricDefinition {
  id: string;
  name: string;
  description?: string;
  category: MetricCategory;
  formula: string; // e.g., "revenue - expenses" or SQL expression
  unit: string; // e.g., "USD", "%", "ratio"
  aggregation: AggregationType;
  isPercentage?: boolean;
  precision?: number;
  thresholds?: MetricThresholds;
}

/**
 * Thresholds for metric status indicators
 */
export interface MetricThresholds {
  good?: number;
  warning?: number;
  critical?: number;
  direction: 'higher_is_better' | 'lower_is_better' | 'target';
  target?: number;
}

/**
 * Metric value with metadata
 */
export interface MetricValue {
  metricId: string;
  value: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  status?: 'good' | 'warning' | 'critical' | 'neutral';
  asOf: string;
  periodId?: string;
}

/**
 * Time series data point
 */
export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  periodId?: string;
}

/**
 * Dimension breakdown data
 */
export interface DimensionBreakdown {
  dimensionType: 'class' | 'department' | 'location' | 'subsidiary';
  dimensionId: string;
  dimensionName: string;
  dimensionCode?: string;
  value: number;
  percentage: number;
}

// ==========================================
// Dashboard Types
// ==========================================

/**
 * KPI card for dashboard display
 */
export interface KpiCard {
  id: string;
  title: string;
  value: number;
  formattedValue: string;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  changeDirection?: 'up' | 'down' | 'flat';
  status?: 'good' | 'warning' | 'critical' | 'neutral';
  unit?: string;
  sparklineData?: number[];
  period: string;
}

/**
 * Dashboard summary metrics
 */
export interface DashboardSummary {
  totalRevenue: MetricValue;
  totalExpenses: MetricValue;
  netIncome: MetricValue;
  grossMargin: MetricValue;
  operatingMargin: MetricValue;
  currentRatio?: MetricValue;
  quickRatio?: MetricValue;
  workingCapital?: MetricValue;
}

/**
 * Segment performance data
 */
export interface SegmentPerformance {
  dimensionType: 'class' | 'department' | 'location';
  segments: Array<{
    id: string;
    name: string;
    code?: string;
    revenue: number;
    expenses: number;
    netIncome: number;
    margin: number;
    percentOfTotal: number;
  }>;
  total: {
    revenue: number;
    expenses: number;
    netIncome: number;
  };
}

/**
 * Trend data for charts
 */
export interface TrendData {
  metricId: string;
  metricName: string;
  granularity: TimeGranularity;
  dataPoints: TimeSeriesDataPoint[];
  trend: 'increasing' | 'decreasing' | 'stable';
  trendStrength?: number;
}

// ==========================================
// Saved Views Types
// ==========================================

/**
 * Saved view configuration
 */
export interface SavedView {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  viewType: 'dashboard' | 'report' | 'analysis';
  configuration: SavedViewConfiguration;
  isDefault?: boolean;
  isShared?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Saved view configuration details
 */
export interface SavedViewConfiguration {
  // Dimension filters
  filters: DimensionFilters;

  // Time settings
  timeRange?: TimeRange;
  periodFilter?: PeriodFilter;
  granularity?: TimeGranularity;

  // Display settings
  metrics?: string[]; // Metric IDs to display
  chartTypes?: Record<string, 'line' | 'bar' | 'pie' | 'area'>;
  comparePeriod?: boolean;
  showTrend?: boolean;

  // Layout
  layout?: Array<{
    id: string;
    type: 'kpi' | 'chart' | 'table' | 'breakdown';
    width: number; // 1-12 grid units
    height: number;
    config?: Record<string, any>;
  }>;
}

/**
 * Input for creating a saved view
 */
export interface CreateSavedViewInput {
  name: string;
  description?: string;
  viewType: 'dashboard' | 'report' | 'analysis';
  configuration: SavedViewConfiguration;
  isDefault?: boolean;
  isShared?: boolean;
}

/**
 * Input for updating a saved view
 */
export interface UpdateSavedViewInput {
  name?: string;
  description?: string;
  configuration?: Partial<SavedViewConfiguration>;
  isDefault?: boolean;
  isShared?: boolean;
}

// ==========================================
// Query Input Types
// ==========================================

/**
 * Input for fetching dashboard data
 */
export interface DashboardQueryInput {
  periodId?: string;
  timeRange?: TimeRange;
  filters?: DimensionFilters;
  compareWithPrevious?: boolean;
  metrics?: string[];
}

/**
 * Input for segment analysis
 */
export interface SegmentAnalysisInput {
  periodId: string;
  dimensionType: 'class' | 'department' | 'location';
  metric: 'revenue' | 'expenses' | 'netIncome' | 'margin';
  filters?: DimensionFilters;
  topN?: number;
}

/**
 * Input for trend analysis
 */
export interface TrendAnalysisInput {
  metricId: string;
  periodIds?: string[];
  timeRange?: TimeRange;
  granularity: TimeGranularity;
  filters?: DimensionFilters;
}

/**
 * Input for metric comparison
 */
export interface MetricComparisonInput {
  metricIds: string[];
  currentPeriodId: string;
  comparePeriodId?: string;
  filters?: DimensionFilters;
}

// ==========================================
// Response Types
// ==========================================

/**
 * Dashboard response with all components
 */
export interface DashboardResponse {
  summary: DashboardSummary;
  kpiCards: KpiCard[];
  trends?: TrendData[];
  segmentBreakdowns?: SegmentPerformance[];
  generatedAt: string;
  period: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  appliedFilters: DimensionFilters;
}

/**
 * Segment analysis response
 */
export interface SegmentAnalysisResponse {
  dimensionType: 'class' | 'department' | 'location';
  segments: DimensionBreakdown[];
  total: number;
  period: {
    id: string;
    name: string;
  };
  generatedAt: string;
}

/**
 * Comparison response
 */
export interface MetricComparisonResponse {
  metrics: Array<{
    metricId: string;
    metricName: string;
    current: MetricValue;
    previous?: MetricValue;
    variance?: number;
    variancePercent?: number;
  }>;
  currentPeriod: { id: string; name: string };
  comparePeriod?: { id: string; name: string };
  generatedAt: string;
}
