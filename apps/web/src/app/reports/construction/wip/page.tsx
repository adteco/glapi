'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Wallet,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Download,
  RefreshCw,
  Clock,
  DollarSign,
  FileText,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatCurrencyShort = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const CHART_COLORS = {
  budget: '#3b82f6',
  actual: '#10b981',
  committed: '#f59e0b',
  wip: '#8b5cf6',
  variance: '#ef4444',
  positive: '#22c55e',
  negative: '#ef4444',
  billed: '#06b6d4',
};

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string; fill?: string }>;
  label?: string;
}

const WipTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload?.length) {
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg min-w-48">
        <p className="font-medium mb-2 truncate max-w-xs">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <span style={{ color: entry.color || entry.fill }}>{entry.name}:</span>
            <span className="font-medium">{currencyFormatter.format(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// CSV Export helper
const exportToCSV = (
  data: Record<string, unknown>[],
  filename: string,
  columns: { key: string; header: string }[]
) => {
  const headers = columns.map((c) => c.header).join(',');
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const value = row[c.key];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value ?? '';
      })
      .join(',')
  );
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export default function WipDashboardPage() {
  const { orgId } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedSubsidiary, setSelectedSubsidiary] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Use new wipReporting endpoints for materialized view data
  const { data: wipDashboard, isLoading: wipLoading, refetch: refetchWip } =
    trpc.wipReporting.getWipDashboard.useQuery(
      {
        subsidiaryId: selectedSubsidiary !== 'all' ? selectedSubsidiary : undefined,
      },
      { enabled: Boolean(orgId) }
    );

  const { data: percentCompleteDashboard, isLoading: pctLoading } =
    trpc.wipReporting.getPercentCompleteDashboard.useQuery(
      {
        subsidiaryId: selectedSubsidiary !== 'all' ? selectedSubsidiary : undefined,
      },
      { enabled: Boolean(orgId) }
    );

  const { data: retainageData, isLoading: retainageLoading } =
    trpc.wipReporting.getRetainageAging.useQuery(
      {
        subsidiaryId: selectedSubsidiary !== 'all' ? selectedSubsidiary : undefined,
      },
      { enabled: Boolean(orgId) }
    );

  const refreshMutation = trpc.wipReporting.refreshViews.useMutation({
    onSuccess: () => {
      refetchWip();
    },
  });

  // Fallback to original reporting if materialized views not ready
  const { data: jobCostData, isLoading: jobCostLoading } =
    trpc.projectReporting.jobCostSummary.useQuery(
      { search: search.trim() || undefined },
      { enabled: Boolean(orgId) && !wipDashboard }
    );

  const isLoading = wipLoading || jobCostLoading;

  // Extract WIP data from dashboard or fallback
  const wipData = useMemo(() => {
    if (wipDashboard) {
      return [
        ...wipDashboard.projectsWithUnderbillings,
        ...wipDashboard.projectsWithOverbillings.filter(
          (p) =>
            !wipDashboard.projectsWithUnderbillings.find((u) => u.projectId === p.projectId)
        ),
      ];
    }
    // Fallback to old format
    const toNumber = (value?: string | null) => parseFloat(value || '0') || 0;
    return (jobCostData || []).map((row) => ({
      projectId: row.projectId,
      projectCode: row.projectCode || '',
      projectName: row.projectName,
      projectStatus: 'active',
      subsidiaryId: row.subsidiaryId || null,
      totalBudgetAmount: row.totalBudgetAmount || '0',
      budgetByType: { labor: '0', material: '0', equipment: '0', subcontract: '0', other: '0' },
      totalCommittedAmount: row.totalCommittedAmount || '0',
      totalActualCost: row.totalActualCost || '0',
      actualByType: { labor: '0', material: '0', equipment: '0', subcontract: '0', other: '0' },
      totalBilledAmount: '0',
      totalCollectedAmount: '0',
      totalRetainageHeld: '0',
      wipBalance: String(toNumber(row.totalWipClearing)),
      underbillings: String(Math.max(0, toNumber(row.totalActualCost) - toNumber(row.totalWipClearing))),
      overbillings: String(Math.max(0, toNumber(row.totalWipClearing) - toNumber(row.totalActualCost))),
      budgetVariance: String(toNumber(row.totalBudgetAmount) - toNumber(row.totalActualCost)),
      projectStartDate: null,
      projectEndDate: null,
      refreshedAt: new Date().toISOString(),
    }));
  }, [wipDashboard, jobCostData]);

  // Filter by search
  const filteredData = useMemo(() => {
    if (!search.trim()) return wipData;
    const lower = search.toLowerCase();
    return wipData.filter(
      (p) =>
        p.projectName.toLowerCase().includes(lower) ||
        p.projectCode?.toLowerCase().includes(lower)
    );
  }, [wipData, search]);

  // Get unique subsidiaries for filter
  const subsidiaries = useMemo(() => {
    const subs = new Set(wipData.map((p) => p.subsidiaryId).filter(Boolean));
    return Array.from(subs) as string[];
  }, [wipData]);

  // Summary from dashboard or calculate
  const totals = useMemo(() => {
    if (wipDashboard) {
      return wipDashboard.summary;
    }
    return filteredData.reduce(
      (acc, row) => {
        acc.totalBudget += parseFloat(row.totalBudgetAmount);
        acc.totalActualCost += parseFloat(row.totalActualCost);
        acc.totalWipBalance += parseFloat(row.wipBalance);
        acc.totalUnderbillings += parseFloat(row.underbillings);
        acc.totalOverbillings += parseFloat(row.overbillings);
        acc.totalRetainageHeld += parseFloat(row.totalRetainageHeld);
        acc.totalProjects++;
        return acc;
      },
      {
        totalProjects: 0,
        totalBudget: 0,
        totalActualCost: 0,
        totalWipBalance: 0,
        totalUnderbillings: 0,
        totalOverbillings: 0,
        totalRetainageHeld: 0,
      }
    );
  }, [wipDashboard, filteredData]);

  // Chart data for WIP
  const wipChartData = useMemo(() => {
    return filteredData
      .slice(0, 10)
      .sort(
        (a, b) =>
          Math.abs(parseFloat(b.underbillings) + parseFloat(b.overbillings)) -
          Math.abs(parseFloat(a.underbillings) + parseFloat(a.overbillings))
      )
      .map((p) => ({
        name:
          p.projectName.length > 20 ? `${p.projectName.slice(0, 20)}…` : p.projectName,
        fullName: p.projectName,
        actual: parseFloat(p.totalActualCost),
        billed: parseFloat(p.totalBilledAmount),
        underbillings: parseFloat(p.underbillings),
        overbillings: parseFloat(p.overbillings),
      }));
  }, [filteredData]);

  // Status distribution for pie chart
  const statusDistribution = useMemo(() => {
    const underCount = filteredData.filter((p) => parseFloat(p.underbillings) > 0).length;
    const overCount = filteredData.filter((p) => parseFloat(p.overbillings) > 0).length;
    const balanced = filteredData.length - underCount - overCount;

    return [
      { name: 'Over-billed', value: overCount, fill: '#22c55e' },
      { name: 'Balanced', value: balanced, fill: '#6b7280' },
      { name: 'Under-billed', value: underCount, fill: '#ef4444' },
    ].filter((item) => item.value > 0);
  }, [filteredData]);

  // Export handlers
  const handleExportWipSummary = () => {
    exportToCSV(
      filteredData.map((p) => ({
        ...p,
        budget: p.totalBudgetAmount,
        actual: p.totalActualCost,
        committed: p.totalCommittedAmount,
      })),
      'wip_summary',
      [
        { key: 'projectCode', header: 'Project Code' },
        { key: 'projectName', header: 'Project Name' },
        { key: 'budget', header: 'Budget' },
        { key: 'actual', header: 'Actual Cost' },
        { key: 'totalBilledAmount', header: 'Billed' },
        { key: 'underbillings', header: 'Underbillings' },
        { key: 'overbillings', header: 'Overbillings' },
        { key: 'totalRetainageHeld', header: 'Retainage Held' },
      ]
    );
  };

  const handleExportRetainage = () => {
    if (!retainageData) return;
    exportToCSV(retainageData, 'retainage_aging', [
      { key: 'projectCode', header: 'Project Code' },
      { key: 'projectName', header: 'Project Name' },
      { key: 'totalRetainageHeld', header: 'Total Retainage' },
      { key: 'current', header: 'Current' },
      { key: 'days30', header: '30 Days' },
      { key: 'days60', header: '60 Days' },
      { key: 'days90', header: '90 Days' },
      { key: 'over90', header: 'Over 90 Days' },
      { key: 'retainageOutstanding', header: 'Outstanding' },
      { key: 'expectedReleaseDate', header: 'Expected Release' },
    ]);
  };

  const handleExportPercentComplete = () => {
    if (!percentCompleteDashboard) return;
    const allProjects = [
      ...percentCompleteDashboard.projectsBehindSchedule,
      ...percentCompleteDashboard.projectsAtRisk.filter(
        (p) =>
          !percentCompleteDashboard.projectsBehindSchedule.find(
            (b) => b.projectId === p.projectId
          )
      ),
    ];
    exportToCSV(allProjects, 'percent_complete', [
      { key: 'projectCode', header: 'Project Code' },
      { key: 'projectName', header: 'Project Name' },
      { key: 'budgetAtCompletion', header: 'Budget at Completion' },
      { key: 'actualCost', header: 'Actual Cost' },
      { key: 'earnedValue', header: 'Earned Value' },
      { key: 'costPercentComplete', header: '% Complete' },
      { key: 'costPerformanceIndex', header: 'CPI' },
      { key: 'estimateAtCompletion', header: 'EAC' },
      { key: 'varianceAtCompletion', header: 'VAC' },
    ]);
  };

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view reports.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">WIP & Budget Analysis</h1>
          <p className="text-muted-foreground mt-2">
            Work-in-progress, over/under billings, and retainage exposure dashboards.
          </p>
          {wipDashboard?.lastRefreshed && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last refreshed: {new Date(wipDashboard.lastRefreshed).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          {subsidiaries.length > 0 && (
            <Select value={selectedSubsidiary} onValueChange={setSelectedSubsidiary}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All subsidiaries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subsidiaries</SelectItem>
                {subsidiaries.map((sub) => (
                  <SelectItem key={sub} value={sub}>
                    {sub.slice(0, 8)}…
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => refreshMutation.mutate({})}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalProjects}</div>
            <p className="text-xs text-muted-foreground">Active projects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencyFormatter.format(totals.totalBudget)}</div>
            <p className="text-xs text-muted-foreground">
              {currencyFormatter.format(totals.totalActualCost)} spent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Underbillings</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {currencyFormatter.format(totals.totalUnderbillings)}
            </div>
            <p className="text-xs text-muted-foreground">Cost exceeds billings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overbillings</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {currencyFormatter.format(totals.totalOverbillings)}
            </div>
            <p className="text-xs text-muted-foreground">Billings exceed cost</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retainage Held</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currencyFormatter.format(totals.totalRetainageHeld)}
            </div>
            <p className="text-xs text-muted-foreground">Pending release</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="wip" className="space-y-4">
        <TabsList>
          <TabsTrigger value="wip">WIP Analysis</TabsTrigger>
          <TabsTrigger value="percent-complete">% Complete</TabsTrigger>
          <TabsTrigger value="retainage">Retainage Aging</TabsTrigger>
          <TabsTrigger value="detail">Project Detail</TabsTrigger>
        </TabsList>

        <TabsContent value="wip" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportWipSummary}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Over/Under Billings by Project</CardTitle>
                <CardDescription>
                  Top projects by billing variance against actual costs
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={wipChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        type="number"
                        tickFormatter={formatCurrencyShort}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip content={<WipTooltip />} />
                      <Legend />
                      <Bar dataKey="actual" fill={CHART_COLORS.actual} name="Actual Cost" />
                      <Bar dataKey="billed" fill={CHART_COLORS.billed} name="Billed" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Billing Status Distribution</CardTitle>
                <CardDescription>Projects by billing status relative to costs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
                    <div className="text-2xl font-bold text-green-600">
                      {statusDistribution.find((s) => s.name === 'Over-billed')?.value || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">Over-billed</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                    <div className="text-2xl font-bold">
                      {statusDistribution.find((s) => s.name === 'Balanced')?.value || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">Balanced</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950">
                    <div className="text-2xl font-bold text-red-600">
                      {statusDistribution.find((s) => s.name === 'Under-billed')?.value || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">Under-billed</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="percent-complete" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportPercentComplete}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          {pctLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading percent complete data…
            </div>
          ) : percentCompleteDashboard ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Portfolio Summary</CardTitle>
                  <CardDescription>Earned value metrics across all projects</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Average % Complete
                      </span>
                      <span className="text-xl font-bold">
                        {percentCompleteDashboard.summary.averagePercentComplete.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Budget at Completion
                      </span>
                      <span className="font-mono">
                        {currencyFormatter.format(
                          percentCompleteDashboard.summary.totalBudgetAtCompletion
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Actual Cost</span>
                      <span className="font-mono">
                        {currencyFormatter.format(
                          percentCompleteDashboard.summary.totalActualCost
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Estimate at Completion
                      </span>
                      <span className="font-mono">
                        {currencyFormatter.format(
                          percentCompleteDashboard.summary.totalEstimateAtCompletion
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Projected Variance
                      </span>
                      <span
                        className={`font-mono ${
                          percentCompleteDashboard.summary.totalProjectedVariance >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {currencyFormatter.format(
                          percentCompleteDashboard.summary.totalProjectedVariance
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Average CPI</span>
                      <span
                        className={`text-xl font-bold ${
                          percentCompleteDashboard.summary.averageCPI >= 1
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {percentCompleteDashboard.summary.averageCPI.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Projects At Risk</CardTitle>
                  <CardDescription>
                    Projects with CPI &lt; 0.9 or negative projected variance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {percentCompleteDashboard.projectsAtRisk.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                      <p>No projects at risk</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {percentCompleteDashboard.projectsAtRisk.slice(0, 5).map((project) => (
                        <div
                          key={project.projectId}
                          className="flex items-center justify-between p-2 rounded border"
                        >
                          <div>
                            <p className="font-medium text-sm">{project.projectName}</p>
                            <p className="text-xs text-muted-foreground">
                              {project.projectCode}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant="destructive">
                              CPI: {parseFloat(project.costPerformanceIndex).toFixed(2)}
                            </Badge>
                            <p className="text-xs text-red-600 mt-1">
                              VAC: {currencyFormatter.format(parseFloat(project.varianceAtCompletion))}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-12">
              No percent complete data available.
            </p>
          )}
        </TabsContent>

        <TabsContent value="retainage" className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportRetainage}
              disabled={!retainageData?.length}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          {retainageLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading retainage data…
            </div>
          ) : retainageData && retainageData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Retainage Aging Report</CardTitle>
                <CardDescription>
                  Retainage held by project with aging buckets
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead className="text-right">Total Held</TableHead>
                        <TableHead className="text-right">Current</TableHead>
                        <TableHead className="text-right">30 Days</TableHead>
                        <TableHead className="text-right">60 Days</TableHead>
                        <TableHead className="text-right">90 Days</TableHead>
                        <TableHead className="text-right">90+ Days</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead>Expected Release</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {retainageData.map((row) => (
                        <TableRow key={row.projectId}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{row.projectName}</p>
                              <p className="text-xs text-muted-foreground">{row.projectCode}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {currencyFormatter.format(parseFloat(row.totalRetainageHeld))}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {currencyFormatter.format(parseFloat(row.current))}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {currencyFormatter.format(parseFloat(row.days30))}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {currencyFormatter.format(parseFloat(row.days60))}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {currencyFormatter.format(parseFloat(row.days90))}
                          </TableCell>
                          <TableCell className="text-right font-mono text-amber-600">
                            {currencyFormatter.format(parseFloat(row.over90))}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {currencyFormatter.format(parseFloat(row.retainageOutstanding))}
                          </TableCell>
                          <TableCell>
                            {row.expectedReleaseDate || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-center text-muted-foreground py-12">
              No retainage data available.
            </p>
          )}
        </TabsContent>

        <TabsContent value="detail" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportWipSummary}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Project Detail</CardTitle>
              <CardDescription>All projects with WIP and billing details</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading data…
                </div>
              ) : filteredData.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">
                  No projects available.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead className="text-right">Budget</TableHead>
                        <TableHead className="text-right">Actual</TableHead>
                        <TableHead className="text-right">Billed</TableHead>
                        <TableHead className="text-right">Under-billings</TableHead>
                        <TableHead className="text-right">Over-billings</TableHead>
                        <TableHead className="text-right">Retainage</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((project) => {
                        const hasUnder = parseFloat(project.underbillings) > 0;
                        const hasOver = parseFloat(project.overbillings) > 0;

                        return (
                          <TableRow
                            key={project.projectId}
                            onClick={() => setSelectedProjectId(project.projectId)}
                            className={`cursor-pointer ${
                              project.projectId === selectedProjectId ? 'bg-muted/40' : ''
                            }`}
                          >
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium">{project.projectName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {project.projectCode || project.projectId.slice(0, 8)}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {currencyFormatter.format(parseFloat(project.totalBudgetAmount))}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {currencyFormatter.format(parseFloat(project.totalActualCost))}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {currencyFormatter.format(parseFloat(project.totalBilledAmount))}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {hasUnder && (
                                <span className="text-red-600">
                                  {currencyFormatter.format(parseFloat(project.underbillings))}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {hasOver && (
                                <span className="text-green-600">
                                  {currencyFormatter.format(parseFloat(project.overbillings))}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {currencyFormatter.format(parseFloat(project.totalRetainageHeld))}
                            </TableCell>
                            <TableCell>
                              {hasUnder ? (
                                <Badge variant="destructive" className="gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  Under-billed
                                </Badge>
                              ) : hasOver ? (
                                <Badge
                                  variant="secondary"
                                  className="gap-1 bg-green-100 text-green-800"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Over-billed
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Balanced
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
