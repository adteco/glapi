# Custom Metrics SDK Guide

This guide provides comprehensive documentation for using the Metrics SDK to build KPI dashboards, create custom metrics, configure dimension filters, and manage saved views.

## Table of Contents

1. [Overview](#overview)
2. [Built-in Metrics](#built-in-metrics)
3. [Dashboard API](#dashboard-api)
4. [Dimension Filtering](#dimension-filtering)
5. [Segment Analysis](#segment-analysis)
6. [Trend Analysis](#trend-analysis)
7. [Custom Metrics](#custom-metrics)
8. [Saved Views](#saved-views)
9. [React Components](#react-components)
10. [Examples](#examples)

---

## Overview

### What is the Metrics SDK?

The Metrics SDK provides a unified API for building financial dashboards and analytics. It includes:

- **Built-in Metrics**: Pre-defined KPIs for revenue, expenses, profitability, liquidity, and efficiency
- **Dimension Filtering**: Filter data by subsidiary, class, department, and location
- **Segment Analysis**: Break down metrics by any accounting dimension
- **Trend Analysis**: Historical trends with direction calculation
- **Custom Metrics**: Define your own metrics with custom formulas
- **Saved Views**: Save and share dashboard configurations

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Components                         │
│   (KpiCard, SegmentBreakdown, TrendChart, DimensionFilter)  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      TRPC Router                             │
│   (metrics.getDashboard, getSegmentPerformance, getTrend)   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    MetricsService                            │
│   (Built-in metrics, Custom metrics, Calculations)          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   MetricsRepository                          │
│   (Period financials, Segment breakdown, Aggregations)      │
└─────────────────────────────────────────────────────────────┘
```

### Key Concepts

| Term | Description |
|------|-------------|
| **Metric** | A quantifiable measure (e.g., revenue, gross margin) |
| **KPI Card** | Visual representation of a metric with comparison to previous period |
| **Dimension** | Accounting classification (subsidiary, class, department, location) |
| **Segment** | A specific value within a dimension (e.g., "Sales Department") |
| **Trend** | Historical data points showing metric values over time |
| **Saved View** | Stored configuration of filters, metrics, and layout |

---

## Built-in Metrics

The SDK provides 12 built-in metrics across 5 categories:

### Revenue Metrics

| ID | Name | Formula | Unit |
|----|------|---------|------|
| `total_revenue` | Total Revenue | Sum of revenue accounts | currency |
| `revenue_growth` | Revenue Growth | (Current - Previous) / Previous * 100 | percent |

### Expense Metrics

| ID | Name | Formula | Unit |
|----|------|---------|------|
| `total_expenses` | Total Expenses | Sum of expense accounts | currency |
| `expense_ratio` | Expense Ratio | Total Expenses / Total Revenue * 100 | percent |

### Profitability Metrics

| ID | Name | Formula | Unit |
|----|------|---------|------|
| `net_income` | Net Income | Total Revenue - Total Expenses | currency |
| `gross_margin` | Gross Margin | (Revenue - COGS) / Revenue * 100 | percent |
| `operating_margin` | Operating Margin | Operating Income / Revenue * 100 | percent |

### Liquidity Metrics

| ID | Name | Formula | Unit |
|----|------|---------|------|
| `current_ratio` | Current Ratio | Current Assets / Current Liabilities | ratio |
| `quick_ratio` | Quick Ratio | (Current Assets - Inventory) / Current Liabilities | ratio |

### Efficiency Metrics

| ID | Name | Formula | Unit |
|----|------|---------|------|
| `ar_turnover` | AR Turnover | Revenue / Average AR | ratio |
| `ap_turnover` | AP Turnover | Purchases / Average AP | ratio |
| `inventory_turnover` | Inventory Turnover | COGS / Average Inventory | ratio |

### Listing Available Metrics

```typescript
// Get all built-in metrics
const metrics = await trpc.metrics.listMetricDefinitions.query({});

// Filter by category
const profitabilityMetrics = await trpc.metrics.listMetricDefinitions.query({
  category: 'profitability',
});

console.log(metrics);
// [
//   { id: 'total_revenue', name: 'Total Revenue', category: 'revenue', ... },
//   { id: 'net_income', name: 'Net Income', category: 'profitability', ... },
//   ...
// ]
```

---

## Dashboard API

### Getting Dashboard Data

The main dashboard endpoint returns KPI cards, summary data, and period information:

```typescript
const dashboard = await trpc.metrics.getDashboard.query({
  periodId: 'period-uuid', // Optional - uses current open period if not specified
  filters: {
    subsidiaryIds: ['subsidiary-1'],
    classIds: ['class-1', 'class-2'],
    departmentIds: [],
    locationIds: [],
  },
  compareWithPrevious: true, // Include period-over-period comparison
});

console.log(dashboard);
// {
//   period: { id: '...', name: 'January 2026', ... },
//   previousPeriod: { id: '...', name: 'December 2025', ... },
//   kpiCards: [...],
//   summary: {
//     totalRevenue: { value: 150000, change: 12000, changePercent: 8.7 },
//     totalExpenses: { value: 120000, change: 5000, changePercent: 4.3 },
//     netIncome: { value: 30000, change: 7000, changePercent: 30.4 },
//     grossMargin: { value: 35.5, change: 2.1, changePercent: 6.3 },
//     operatingMargin: { value: 20.0, change: 1.5, changePercent: 8.1 },
//   },
//   generatedAt: '2026-01-19T10:30:00Z',
// }
```

### Getting KPI Cards

For more control over which metrics to display:

```typescript
const kpiCards = await trpc.metrics.getKpiCards.query({
  periodId: 'period-uuid',
  metricIds: ['total_revenue', 'net_income', 'gross_margin'], // Optional filter
  filters: {
    departmentIds: ['sales-dept-uuid'],
  },
});

console.log(kpiCards);
// [
//   {
//     id: 'total_revenue',
//     title: 'Total Revenue',
//     value: 150000,
//     formattedValue: '$150,000',
//     previousValue: 138000,
//     change: 12000,
//     changePercent: 8.7,
//     changeDirection: 'up',
//     status: 'good',
//     unit: 'currency',
//   },
//   ...
// ]
```

### KPI Card Status

Cards automatically calculate status based on metric thresholds:

| Status | Description | Visual |
|--------|-------------|--------|
| `good` | Above target threshold | Green indicator |
| `warning` | Between warning and target | Yellow indicator |
| `critical` | Below warning threshold | Red indicator |
| `neutral` | No thresholds defined | Gray indicator |

---

## Dimension Filtering

### Available Dimensions

| Dimension | Filter Key | Description |
|-----------|-----------|-------------|
| **Subsidiary** | `subsidiaryIds` | Legal entities/companies |
| **Class** | `classIds` | Product/service categories |
| **Department** | `departmentIds` | Organizational departments |
| **Location** | `locationIds` | Physical or logical locations |

### Applying Filters

```typescript
// Filter by multiple dimensions
const filters: DimensionFilters = {
  subsidiaryIds: ['sub-1', 'sub-2'],
  classIds: ['product-class'],
  departmentIds: ['sales', 'marketing'],
  locationIds: ['east-coast'],
};

// Use in any metrics query
const dashboard = await trpc.metrics.getDashboard.query({
  periodId: 'period-uuid',
  filters,
});

// Filters are applied to all calculations
// - Only journal entries matching ALL specified dimensions are included
// - Empty array = no filter for that dimension
// - Undefined = no filter for that dimension
```

### Filter Behavior

Filters use **AND** logic across dimensions and **OR** logic within dimensions:

```
Example: subsidiaryIds: ['A', 'B'], departmentIds: ['Sales']

Results include entries where:
  (subsidiaryId = 'A' OR subsidiaryId = 'B')
  AND
  (departmentId = 'Sales')
```

---

## Segment Analysis

### Getting Segment Performance

Break down metrics by any dimension:

```typescript
const segmentData = await trpc.metrics.getSegmentPerformance.query({
  periodId: 'period-uuid',
  dimensionType: 'class', // 'subsidiary' | 'class' | 'department' | 'location'
  metric: 'revenue', // 'revenue' | 'expenses' | 'netIncome'
  filters: {}, // Optional additional filters
  topN: 5, // Limit to top N segments
});

console.log(segmentData);
// {
//   dimensionType: 'class',
//   metric: 'revenue',
//   segments: [
//     {
//       id: 'class-1-uuid',
//       name: 'Professional Services',
//       code: 'PROF-SVC',
//       revenue: 75000,
//       expenses: 45000,
//       netIncome: 30000,
//       percentOfTotal: 50.0,
//     },
//     {
//       id: 'class-2-uuid',
//       name: 'Product Sales',
//       code: 'PROD',
//       revenue: 50000,
//       expenses: 35000,
//       netIncome: 15000,
//       percentOfTotal: 33.3,
//     },
//     // ... more segments
//   ],
//   total: {
//     revenue: 150000,
//     expenses: 120000,
//     netIncome: 30000,
//   },
// }
```

### Segment Comparison (Period-over-Period)

Compare segments across periods:

```typescript
const comparison = await trpc.metrics.getSegmentComparison.query({
  currentPeriodId: 'jan-2026-uuid',
  previousPeriodId: 'dec-2025-uuid',
  dimensionType: 'department',
  metric: 'expenses',
});

console.log(comparison);
// {
//   segments: [
//     {
//       id: 'dept-uuid',
//       name: 'Engineering',
//       currentValue: 50000,
//       previousValue: 45000,
//       change: 5000,
//       changePercent: 11.1,
//     },
//     // ...
//   ],
// }
```

---

## Trend Analysis

### Single Metric Trend

Get historical values for a metric:

```typescript
const trend = await trpc.metrics.getTrend.query({
  metricId: 'total_revenue',
  periodCount: 6, // Number of periods to include
  endPeriodId: 'period-uuid', // Optional - defaults to current period
  filters: {},
});

console.log(trend);
// {
//   metricId: 'total_revenue',
//   metricName: 'Total Revenue',
//   dataPoints: [
//     { date: 'Aug 2025', value: 120000, periodId: 'aug-uuid' },
//     { date: 'Sep 2025', value: 125000, periodId: 'sep-uuid' },
//     { date: 'Oct 2025', value: 130000, periodId: 'oct-uuid' },
//     { date: 'Nov 2025', value: 135000, periodId: 'nov-uuid' },
//     { date: 'Dec 2025', value: 138000, periodId: 'dec-uuid' },
//     { date: 'Jan 2026', value: 150000, periodId: 'jan-uuid' },
//   ],
//   trend: 'increasing', // 'increasing' | 'decreasing' | 'stable'
//   trendStrength: 0.85, // R-squared of linear regression
// }
```

### Multiple Metrics Comparison

Compare multiple metrics over time:

```typescript
const trends = await trpc.metrics.getMultipleTrends.query({
  metricIds: ['total_revenue', 'total_expenses', 'net_income'],
  periodCount: 6,
  filters: {},
});

console.log(trends);
// {
//   series: [
//     {
//       id: 'total_revenue',
//       name: 'Total Revenue',
//       dataPoints: [...],
//       color: '#3b82f6',
//     },
//     {
//       id: 'total_expenses',
//       name: 'Total Expenses',
//       dataPoints: [...],
//       color: '#ef4444',
//     },
//     {
//       id: 'net_income',
//       name: 'Net Income',
//       dataPoints: [...],
//       color: '#10b981',
//     },
//   ],
// }
```

### Trend Direction Calculation

The trend direction is calculated using linear regression:

| Direction | Slope | R-squared |
|-----------|-------|-----------|
| `increasing` | > 0 | >= 0.3 |
| `decreasing` | < 0 | >= 0.3 |
| `stable` | any | < 0.3 |

---

## Custom Metrics

### Creating a Custom Metric

Define your own metrics with custom formulas:

```typescript
const customMetric = await trpc.metrics.createCustomMetric.mutate({
  name: 'EBITDA',
  category: 'profitability',
  formula: 'netIncome + depreciation + amortization + interestExpense + taxes',
  unit: 'currency',
  aggregation: 'sum',
  description: 'Earnings Before Interest, Taxes, Depreciation, and Amortization',
  thresholds: {
    target: 50000,
    warning: 25000,
    critical: 10000,
  },
});

console.log(customMetric);
// {
//   id: 'custom-metric-uuid',
//   name: 'EBITDA',
//   category: 'profitability',
//   ...
// }
```

### Formula Syntax

Custom metric formulas support:

| Element | Example | Description |
|---------|---------|-------------|
| **Built-in metrics** | `totalRevenue`, `netIncome` | Reference built-in values |
| **Account references** | `account:4000` | Reference specific account |
| **Arithmetic** | `+`, `-`, `*`, `/` | Basic operations |
| **Parentheses** | `(a + b) * c` | Grouping |
| **Percentages** | `/ 100` | Convert to percentage |

### Example Formulas

```typescript
// Contribution Margin
formula: '(totalRevenue - variableCosts) / totalRevenue * 100'

// Working Capital
formula: 'currentAssets - currentLiabilities'

// Debt to Equity
formula: 'totalLiabilities / totalEquity'

// Custom Revenue Metric (specific accounts)
formula: 'account:4000 + account:4100 - account:4200'
```

### Updating a Custom Metric

```typescript
await trpc.metrics.updateCustomMetric.mutate({
  metricId: 'custom-metric-uuid',
  name: 'EBITDA (Adjusted)',
  thresholds: {
    target: 75000,
    warning: 50000,
    critical: 25000,
  },
});
```

### Deleting a Custom Metric

```typescript
await trpc.metrics.deleteCustomMetric.mutate({
  metricId: 'custom-metric-uuid',
});
```

---

## Saved Views

### Creating a Saved View

Save dashboard configurations for quick access:

```typescript
const savedView = await trpc.metrics.createSavedView.mutate({
  name: 'Executive Dashboard',
  description: 'High-level KPIs for leadership review',
  viewType: 'dashboard',
  configuration: {
    metrics: ['total_revenue', 'net_income', 'gross_margin', 'current_ratio'],
    filters: {
      subsidiaryIds: ['main-company-uuid'],
      classIds: [],
      departmentIds: [],
      locationIds: [],
    },
    layout: {
      columns: 4,
      showTrends: true,
      showSegments: true,
    },
  },
  isDefault: false,
  isShared: true, // Share with organization
});

console.log(savedView);
// {
//   id: 'view-uuid',
//   name: 'Executive Dashboard',
//   viewType: 'dashboard',
//   ...
// }
```

### Listing Saved Views

```typescript
// Get all saved views
const views = await trpc.metrics.listSavedViews.query({});

// Filter by type
const dashboardViews = await trpc.metrics.listSavedViews.query({
  viewType: 'dashboard',
});

console.log(views);
// [
//   { id: '...', name: 'Executive Dashboard', viewType: 'dashboard', ... },
//   { id: '...', name: 'Sales Analysis', viewType: 'segment', ... },
// ]
```

### Getting a Saved View

```typescript
const view = await trpc.metrics.getSavedView.query({
  viewId: 'view-uuid',
});

// Apply the saved configuration
const dashboard = await trpc.metrics.getDashboard.query({
  periodId: 'period-uuid',
  filters: view.configuration.filters,
});
```

### Updating a Saved View

```typescript
await trpc.metrics.updateSavedView.mutate({
  viewId: 'view-uuid',
  name: 'Executive Dashboard (Updated)',
  configuration: {
    ...existingConfig,
    metrics: ['total_revenue', 'net_income', 'operating_margin', 'quick_ratio'],
  },
});
```

### Deleting a Saved View

```typescript
await trpc.metrics.deleteSavedView.mutate({
  viewId: 'view-uuid',
});
```

---

## React Components

### KpiCard

Display a single KPI metric:

```tsx
import { KpiCard } from '@/components/metrics';

<KpiCard
  title="Total Revenue"
  value={150000}
  formattedValue="$150,000"
  previousValue={138000}
  change={12000}
  changePercent={8.7}
  changeDirection="up"
  status="good"
  unit="currency"
/>
```

### KpiGrid

Display multiple KPI cards in a grid:

```tsx
import { KpiGrid } from '@/components/metrics';

<KpiGrid
  cards={kpiCards}
  isLoading={isLoading}
  columns={4} // Number of columns (default: 4)
/>
```

### SegmentBreakdown

Visualize segment data with bar or pie charts:

```tsx
import { SegmentBreakdown } from '@/components/metrics';

// Bar chart (default)
<SegmentBreakdown
  title="Revenue by Class"
  description="Top 5 product categories"
  segments={segments}
  total={150000}
  displayMode="bar"
  valueFormatter={(v) => `$${v.toLocaleString()}`}
  isLoading={isLoading}
/>

// Pie chart
<SegmentBreakdown
  title="Expenses by Department"
  segments={segments}
  total={120000}
  displayMode="pie"
  valueFormatter={(v) => `$${v.toLocaleString()}`}
/>
```

### TrendChart

Display metric trends over time:

```tsx
import { TrendChart } from '@/components/metrics';

<TrendChart
  title="Revenue Trend"
  description="Monthly revenue over time"
  dataPoints={dataPoints}
  trend="increasing"
  trendStrength={0.85}
  chartType="area" // 'line' | 'area' | 'bar'
  color="#3b82f6"
  showTrendBadge={true}
  valueFormatter={(v) => `$${v.toLocaleString()}`}
/>
```

### MultiTrendChart

Compare multiple metrics:

```tsx
import { MultiTrendChart } from '@/components/metrics';

<MultiTrendChart
  title="Key Metrics Comparison"
  description="Revenue, expenses, and net income"
  series={[
    { id: 'revenue', name: 'Revenue', dataPoints: [...], color: '#3b82f6' },
    { id: 'expenses', name: 'Expenses', dataPoints: [...], color: '#ef4444' },
    { id: 'netIncome', name: 'Net Income', dataPoints: [...], color: '#10b981' },
  ]}
  valueFormatter={(v) => `$${v.toLocaleString()}`}
/>
```

### DimensionFilter

Multi-select filter for dimensions:

```tsx
import { DimensionFilter, ActiveFilters, type DimensionFilters } from '@/components/metrics';

const [filters, setFilters] = useState<DimensionFilters>({});

<DimensionFilter
  value={filters}
  onChange={setFilters}
/>

<ActiveFilters
  filters={filters}
  onRemove={(key, id) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key]?.filter(i => i !== id),
    }));
  }}
  onClearAll={() => setFilters({})}
/>
```

---

## Examples

### Complete Dashboard Page

```tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  KpiGrid,
  SegmentBreakdown,
  TrendChart,
  DimensionFilter,
  ActiveFilters,
  type DimensionFilters,
} from '@/components/metrics';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';

export default function DashboardPage() {
  const { orgId } = useAuth();
  const [periodId, setPeriodId] = useState<string>('');
  const [filters, setFilters] = useState<DimensionFilters>({});

  // Fetch periods
  const { data: periods } = trpc.accountingPeriods.list.useQuery(
    { status: 'all' },
    { enabled: Boolean(orgId) }
  );

  // Fetch dashboard data
  const { data: dashboard, isLoading } = trpc.metrics.getDashboard.useQuery(
    { periodId: periodId || undefined, filters, compareWithPrevious: true },
    { enabled: Boolean(orgId) }
  );

  // Fetch segment data
  const { data: classSegments } = trpc.metrics.getSegmentPerformance.useQuery(
    { periodId, dimensionType: 'class', metric: 'revenue', filters, topN: 5 },
    { enabled: Boolean(periodId) }
  );

  return (
    <div className="container py-6 space-y-6">
      <h1 className="text-2xl font-bold">Financial Dashboard</h1>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={periodId} onValueChange={setPeriodId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {periods?.data?.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.periodName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DimensionFilter value={filters} onChange={setFilters} />
      </div>

      <ActiveFilters
        filters={filters}
        onRemove={(key, id) => setFilters(prev => ({
          ...prev,
          [key]: prev[key]?.filter(i => i !== id),
        }))}
        onClearAll={() => setFilters({})}
      />

      {/* KPI Cards */}
      <KpiGrid cards={dashboard?.kpiCards ?? []} isLoading={isLoading} />

      {/* Segment Breakdown */}
      <SegmentBreakdown
        title="Revenue by Class"
        segments={classSegments?.segments ?? []}
        total={classSegments?.total?.revenue ?? 0}
        displayMode="bar"
      />
    </div>
  );
}
```

### Custom Metric Dashboard

```tsx
'use client';

import { useState, useEffect } from 'react';
import { KpiCard } from '@/components/metrics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';

export default function CustomMetricsPage() {
  const [newMetric, setNewMetric] = useState({
    name: '',
    formula: '',
    category: 'profitability',
  });

  // List custom metrics
  const { data: customMetrics, refetch } = trpc.metrics.listMetricDefinitions.useQuery({
    includeCustom: true,
  });

  // Create mutation
  const createMutation = trpc.metrics.createCustomMetric.useMutation({
    onSuccess: () => {
      refetch();
      setNewMetric({ name: '', formula: '', category: 'profitability' });
    },
  });

  return (
    <div className="container py-6 space-y-6">
      <h1 className="text-2xl font-bold">Custom Metrics</h1>

      {/* Create new metric */}
      <div className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Create Custom Metric</h2>
        <Input
          placeholder="Metric name"
          value={newMetric.name}
          onChange={(e) => setNewMetric(prev => ({ ...prev, name: e.target.value }))}
        />
        <Input
          placeholder="Formula (e.g., netIncome + depreciation)"
          value={newMetric.formula}
          onChange={(e) => setNewMetric(prev => ({ ...prev, formula: e.target.value }))}
        />
        <Button
          onClick={() => createMutation.mutate({
            name: newMetric.name,
            formula: newMetric.formula,
            category: newMetric.category,
            unit: 'currency',
            aggregation: 'sum',
          })}
          disabled={createMutation.isPending}
        >
          Create Metric
        </Button>
      </div>

      {/* List metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        {customMetrics?.filter(m => m.isCustom).map((metric) => (
          <div key={metric.id} className="border rounded-lg p-4">
            <h3 className="font-medium">{metric.name}</h3>
            <p className="text-sm text-muted-foreground">{metric.formula}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## API Reference

### TRPC Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `metrics.getDashboard` | query | Get full dashboard data |
| `metrics.getKpiCards` | query | Get KPI cards for specific metrics |
| `metrics.getSegmentPerformance` | query | Get segment breakdown |
| `metrics.getSegmentComparison` | query | Compare segments across periods |
| `metrics.getTrend` | query | Get single metric trend |
| `metrics.getMultipleTrends` | query | Get multiple metric trends |
| `metrics.listMetricDefinitions` | query | List available metrics |
| `metrics.createCustomMetric` | mutation | Create custom metric |
| `metrics.updateCustomMetric` | mutation | Update custom metric |
| `metrics.deleteCustomMetric` | mutation | Delete custom metric |
| `metrics.listSavedViews` | query | List saved views |
| `metrics.getSavedView` | query | Get single saved view |
| `metrics.createSavedView` | mutation | Create saved view |
| `metrics.updateSavedView` | mutation | Update saved view |
| `metrics.deleteSavedView` | mutation | Delete saved view |

### Type Definitions

```typescript
// Dimension filters
interface DimensionFilters {
  subsidiaryIds?: string[];
  classIds?: string[];
  departmentIds?: string[];
  locationIds?: string[];
}

// KPI Card
interface KpiCard {
  id: string;
  title: string;
  value: number;
  formattedValue: string;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  changeDirection?: 'up' | 'down' | 'unchanged';
  status: 'good' | 'warning' | 'critical' | 'neutral';
  unit: string;
}

// Metric definition
interface MetricDefinition {
  id: string;
  name: string;
  category: 'revenue' | 'expense' | 'profitability' | 'liquidity' | 'efficiency';
  formula: string;
  unit: 'currency' | 'percent' | 'ratio' | 'number';
  aggregation: 'sum' | 'average' | 'min' | 'max' | 'count';
  description?: string;
  thresholds?: MetricThresholds;
  isCustom?: boolean;
}

// Trend data point
interface DataPoint {
  date: string;
  value: number;
  periodId?: string;
}

// Segment data
interface SegmentData {
  id: string;
  name: string;
  code?: string;
  revenue: number;
  expenses: number;
  netIncome: number;
  percentOfTotal: number;
}
```

---

## Related Documentation

- [Management Dashboard](/apps/web/src/app/reports/management)
- [GL Posting Engine](/docs/tasks/event-processing/POSTING_ENGINE_GUIDE.md)
- [Financial Statements](/docs/api/revenue-recognition.md)
- [Consolidation Guide](/docs/consolidation/consolidation-guide.md)

## Support

For questions about the Metrics SDK:
1. Review this documentation and the examples
2. Check the TRPC router for detailed input/output schemas
3. Review the MetricsService for calculation logic
