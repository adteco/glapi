'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  KpiGrid,
  SegmentBreakdown,
  TrendChart,
  MultiTrendChart,
  DimensionFilter,
  ActiveFilters,
  type DimensionFilters,
} from '@/components/metrics';
import { trpc } from '@/lib/trpc';
import { RefreshCw, Download, Bookmark, Settings } from 'lucide-react';

export default function ManagementDashboardPage() {
  const { orgId } = useAuth();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [filters, setFilters] = useState<DimensionFilters>({});
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch periods for selector
  const { data: periods } = trpc.accountingPeriods.list.useQuery(
    { status: 'all' },
    { enabled: Boolean(orgId) }
  );

  // Fetch dashboard data
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    refetch: refetchDashboard,
  } = trpc.metrics.getDashboard.useQuery(
    {
      periodId: selectedPeriodId || undefined,
      filters,
      compareWithPrevious: true,
    },
    { enabled: Boolean(orgId) }
  );

  // Fetch segment data for each dimension
  const { data: classSegments, isLoading: isClassLoading } =
    trpc.metrics.getSegmentPerformance.useQuery(
      {
        periodId: selectedPeriodId || '',
        dimensionType: 'class',
        metric: 'revenue',
        filters,
        topN: 5,
      },
      { enabled: Boolean(selectedPeriodId) }
    );

  const { data: deptSegments, isLoading: isDeptLoading } =
    trpc.metrics.getSegmentPerformance.useQuery(
      {
        periodId: selectedPeriodId || '',
        dimensionType: 'department',
        metric: 'expenses',
        filters,
        topN: 5,
      },
      { enabled: Boolean(selectedPeriodId) }
    );

  // Set initial period when data loads
  if (periods?.data?.length && !selectedPeriodId) {
    const currentPeriod = periods.data.find((p: any) => p.status === 'OPEN');
    if (currentPeriod) {
      setSelectedPeriodId(currentPeriod.id);
    } else if (periods.data[0]) {
      setSelectedPeriodId(periods.data[0].id);
    }
  }

  const handleRemoveFilter = (key: keyof DimensionFilters, id: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).filter((i) => i !== id),
    }));
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  // Transform dashboard data to KPI cards
  const kpiCards = dashboardData?.kpiCards?.map((card) => ({
    id: card.id,
    title: card.title,
    value: card.value,
    formattedValue: card.formattedValue,
    previousValue: card.previousValue,
    change: card.change,
    changePercent: card.changePercent,
    changeDirection: card.changeDirection,
    status: card.status,
    unit: card.unit,
  })) ?? [];

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Management Dashboard</h1>
          <p className="text-muted-foreground">
            Financial metrics and segment performance analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetchDashboard()}
            disabled={isDashboardLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${isDashboardLoading ? 'animate-spin' : ''}`}
            />
          </Button>
          <Button variant="outline" size="icon">
            <Bookmark className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {periods?.data?.map((period: any) => (
              <SelectItem key={period.id} value={period.id}>
                {period.periodName}
                {period.status === 'OPEN' && (
                  <span className="ml-2 text-xs text-green-600">(Open)</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DimensionFilter value={filters} onChange={setFilters} />
      </div>

      {/* Active filters */}
      <ActiveFilters
        filters={filters}
        onRemove={handleRemoveFilter}
        onClearAll={handleClearFilters}
      />

      {/* Dashboard tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* KPI Cards */}
          <KpiGrid cards={kpiCards} isLoading={isDashboardLoading} columns={5} />

          {/* Summary cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Revenue by Class */}
            <SegmentBreakdown
              title="Revenue by Class"
              description="Top 5 product/service categories"
              segments={
                classSegments?.segments?.map((s) => ({
                  id: s.id,
                  name: s.name,
                  code: s.code,
                  value: s.revenue,
                  percentOfTotal: s.percentOfTotal,
                })) ?? []
              }
              total={classSegments?.total?.revenue ?? 0}
              isLoading={isClassLoading}
              valueFormatter={formatCurrency}
            />

            {/* Expenses by Department */}
            <SegmentBreakdown
              title="Expenses by Department"
              description="Top 5 departments by spend"
              segments={
                deptSegments?.segments?.map((s) => ({
                  id: s.id,
                  name: s.name,
                  code: s.code,
                  value: s.expenses,
                  percentOfTotal: s.percentOfTotal,
                })) ?? []
              }
              total={deptSegments?.total?.expenses ?? 0}
              isLoading={isDeptLoading}
              valueFormatter={formatCurrency}
            />

            {/* Period Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Period Summary</CardTitle>
                <CardDescription>
                  {dashboardData?.period?.name ?? 'Current period'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Revenue</span>
                    <span className="font-medium">
                      {formatCurrency(dashboardData?.summary?.totalRevenue?.value ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Expenses</span>
                    <span className="font-medium">
                      {formatCurrency(dashboardData?.summary?.totalExpenses?.value ?? 0)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-medium">Net Income</span>
                    <span
                      className={`font-bold ${
                        (dashboardData?.summary?.netIncome?.value ?? 0) >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(dashboardData?.summary?.netIncome?.value ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gross Margin</span>
                    <span>
                      {(dashboardData?.summary?.grossMargin?.value ?? 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Operating Margin</span>
                    <span>
                      {(dashboardData?.summary?.operatingMargin?.value ?? 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Segments Tab */}
        <TabsContent value="segments" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Revenue by Class - Pie Chart */}
            <SegmentBreakdown
              title="Revenue by Class"
              segments={
                classSegments?.segments?.map((s) => ({
                  id: s.id,
                  name: s.name,
                  code: s.code,
                  value: s.revenue,
                  percentOfTotal: s.percentOfTotal,
                })) ?? []
              }
              total={classSegments?.total?.revenue ?? 0}
              displayMode="pie"
              isLoading={isClassLoading}
              valueFormatter={formatCurrency}
            />

            {/* Expenses by Department - Pie Chart */}
            <SegmentBreakdown
              title="Expenses by Department"
              segments={
                deptSegments?.segments?.map((s) => ({
                  id: s.id,
                  name: s.name,
                  code: s.code,
                  value: s.expenses,
                  percentOfTotal: s.percentOfTotal,
                })) ?? []
              }
              total={deptSegments?.total?.expenses ?? 0}
              displayMode="pie"
              isLoading={isDeptLoading}
              valueFormatter={formatCurrency}
            />
          </div>

          {/* Margin Analysis by Segment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Segment Margin Analysis</CardTitle>
              <CardDescription>
                Net income margin by business segment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Select a segment type above to see detailed margin analysis
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Revenue Trend */}
            <TrendChart
              title="Revenue Trend"
              description="Monthly revenue over time"
              dataPoints={[
                { date: 'Oct 25', value: 85000 },
                { date: 'Nov 25', value: 92000 },
                { date: 'Dec 25', value: 105000 },
                { date: 'Jan 26', value: 98000 },
              ]}
              trend="increasing"
              chartType="area"
              color="#3b82f6"
            />

            {/* Net Income Trend */}
            <TrendChart
              title="Net Income Trend"
              description="Monthly net income over time"
              dataPoints={[
                { date: 'Oct 25', value: 15000 },
                { date: 'Nov 25', value: 18000 },
                { date: 'Dec 25', value: 22000 },
                { date: 'Jan 26', value: 20000 },
              ]}
              trend="increasing"
              chartType="line"
              color="#10b981"
            />
          </div>

          {/* Multi-metric comparison */}
          <MultiTrendChart
            title="Key Metrics Comparison"
            description="Revenue, expenses, and net income over time"
            series={[
              {
                id: 'revenue',
                name: 'Revenue',
                dataPoints: [
                  { date: 'Oct 25', value: 85000 },
                  { date: 'Nov 25', value: 92000 },
                  { date: 'Dec 25', value: 105000 },
                  { date: 'Jan 26', value: 98000 },
                ],
                color: '#3b82f6',
              },
              {
                id: 'expenses',
                name: 'Expenses',
                dataPoints: [
                  { date: 'Oct 25', value: 70000 },
                  { date: 'Nov 25', value: 74000 },
                  { date: 'Dec 25', value: 83000 },
                  { date: 'Jan 26', value: 78000 },
                ],
                color: '#ef4444',
              },
              {
                id: 'netIncome',
                name: 'Net Income',
                dataPoints: [
                  { date: 'Oct 25', value: 15000 },
                  { date: 'Nov 25', value: 18000 },
                  { date: 'Dec 25', value: 22000 },
                  { date: 'Jan 26', value: 20000 },
                ],
                color: '#10b981',
              },
            ]}
          />
        </TabsContent>
      </Tabs>

      {/* Footer with generation info */}
      {dashboardData && (
        <p className="text-xs text-muted-foreground text-right">
          Generated at {new Date(dashboardData.generatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
