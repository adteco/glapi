/**
 * Metrics & KPI Types - re-exported from @glapi/types for backward compatibility
 *
 * This file re-exports metrics and dashboard types from the centralized @glapi/types package.
 * New code should import directly from '@glapi/types' when possible.
 */

export {
  // Base Types
  type TimeGranularity,
  type AggregationType,
  type MetricCategory,
  type DimensionFilters,
  type TimeRange,
  type PeriodFilter,

  // Metric Types
  type MetricDefinition,
  type MetricThresholds,
  type MetricValue,
  type TimeSeriesDataPoint,
  type DimensionBreakdown,

  // Dashboard Types
  type KpiCard,
  type DashboardSummary,
  type SegmentPerformance,
  type TrendData,

  // Saved Views Types
  type SavedView,
  type SavedViewConfiguration,
  type CreateSavedViewInput,
  type UpdateSavedViewInput,

  // Query Input Types
  type DashboardQueryInput,
  type SegmentAnalysisInput,
  type TrendAnalysisInput,
  type MetricComparisonInput,

  // Response Types
  type DashboardResponse,
  type SegmentAnalysisResponse,
  type MetricComparisonResponse,
} from '@glapi/types';
