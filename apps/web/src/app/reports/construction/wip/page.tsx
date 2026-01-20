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
};

const COST_TYPE_COLORS: Record<string, string> = {
  LABOR: '#3b82f6',
  MATERIAL: '#10b981',
  EQUIPMENT: '#f59e0b',
  SUBCONTRACT: '#8b5cf6',
  OTHER: '#6b7280',
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

export default function WipDashboardPage() {
  const { orgId } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedSubsidiary, setSelectedSubsidiary] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { data: jobCostData, isLoading } = trpc.projectReporting.jobCostSummary.useQuery(
    { search: search.trim() || undefined },
    { enabled: Boolean(orgId) }
  );

  const budgetVarianceQuery = trpc.projectReporting.budgetVariance.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(orgId && selectedProjectId) }
  );

  // Normalize data for calculations
  const normalizedData = useMemo(() => {
    const toNumber = (value?: string | null) => parseFloat(value || '0') || 0;
    return (jobCostData || []).map((row) => ({
      ...row,
      budget: toNumber(row.totalBudgetAmount),
      committed: toNumber(row.totalCommittedAmount),
      actual: toNumber(row.totalActualCost),
      wip: toNumber(row.totalWipClearing),
      percent: toNumber(row.percentComplete),
    }));
  }, [jobCostData]);

  // Filter by subsidiary
  const filteredData = useMemo(() => {
    if (selectedSubsidiary === 'all') return normalizedData;
    return normalizedData.filter((p) => p.subsidiaryId === selectedSubsidiary);
  }, [normalizedData, selectedSubsidiary]);

  // Get unique subsidiaries for filter
  const subsidiaries = useMemo(() => {
    const subs = new Set(normalizedData.map((p) => p.subsidiaryId).filter(Boolean));
    return Array.from(subs) as string[];
  }, [normalizedData]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, row) => {
        acc.budget += row.budget;
        acc.actual += row.actual;
        acc.committed += row.committed;
        acc.wip += row.wip;
        return acc;
      },
      { budget: 0, actual: 0, committed: 0, wip: 0 }
    );
  }, [filteredData]);

  // WIP Analysis
  const wipAnalysis = useMemo(() => {
    const wipDifference = totals.wip - totals.actual;
    const underBilled = filteredData.filter((p) => p.wip < p.actual).length;
    const overBilled = filteredData.filter((p) => p.wip > p.actual).length;
    return {
      wipDifference,
      underBilled,
      overBilled,
      balanced: filteredData.length - underBilled - overBilled,
    };
  }, [filteredData, totals]);

  // Commitment analysis
  const commitmentAnalysis = useMemo(() => {
    const overCommitted = filteredData.filter((p) => p.committed > p.budget);
    const totalOverCommitment = overCommitted.reduce(
      (sum, p) => sum + (p.committed - p.budget),
      0
    );
    return {
      overCommittedCount: overCommitted.length,
      totalOverCommitment,
      utilizationRate: totals.budget > 0 ? (totals.committed / totals.budget) * 100 : 0,
    };
  }, [filteredData, totals]);

  // Chart data for WIP vs Actual
  const wipVsActualChartData = useMemo(() => {
    return filteredData
      .slice(0, 10)
      .sort((a, b) => Math.abs(b.wip - b.actual) - Math.abs(a.wip - a.actual))
      .map((p) => ({
        name: p.projectName.length > 20 ? `${p.projectName.slice(0, 20)}…` : p.projectName,
        fullName: p.projectName,
        wip: p.wip,
        actual: p.actual,
        difference: p.wip - p.actual,
      }));
  }, [filteredData]);

  // Chart data for Budget vs Committed
  const budgetVsCommittedData = useMemo(() => {
    return filteredData
      .slice(0, 10)
      .sort((a, b) => b.budget - a.budget)
      .map((p) => ({
        name: p.projectName.length > 20 ? `${p.projectName.slice(0, 20)}…` : p.projectName,
        fullName: p.projectName,
        budget: p.budget,
        committed: p.committed,
        actual: p.actual,
        remaining: Math.max(0, p.budget - p.committed),
      }));
  }, [filteredData]);

  // Status distribution for pie chart
  const statusDistribution = useMemo(() => {
    const healthy = filteredData.filter((p) => p.committed <= p.budget * 0.9 && p.actual <= p.budget * 0.9).length;
    const warning = filteredData.filter((p) =>
      (p.committed > p.budget * 0.9 && p.committed <= p.budget) ||
      (p.actual > p.budget * 0.9 && p.actual <= p.budget)
    ).length;
    const critical = filteredData.filter((p) => p.committed > p.budget || p.actual > p.budget).length;

    return [
      { name: 'Healthy', value: healthy, fill: '#22c55e' },
      { name: 'Warning', value: warning, fill: '#f59e0b' },
      { name: 'Critical', value: critical, fill: '#ef4444' },
    ].filter((item) => item.value > 0);
  }, [filteredData]);

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
            Work-in-progress clearing, commitments, and budget utilization dashboards.
          </p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total WIP Clearing</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencyFormatter.format(totals.wip)}</div>
            <p className="text-xs text-muted-foreground">
              {wipAnalysis.wipDifference >= 0 ? (
                <span className="text-green-600">+{currencyFormatter.format(wipAnalysis.wipDifference)} vs actual</span>
              ) : (
                <span className="text-red-600">{currencyFormatter.format(wipAnalysis.wipDifference)} vs actual</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Committed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencyFormatter.format(totals.committed)}</div>
            <p className="text-xs text-muted-foreground">
              {commitmentAnalysis.utilizationRate.toFixed(1)}% of budget utilized
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget Remaining</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currencyFormatter.format(Math.max(0, totals.budget - totals.committed))}
            </div>
            <p className="text-xs text-muted-foreground">
              {((1 - totals.committed / totals.budget) * 100).toFixed(1)}% available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects Over Budget</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {commitmentAnalysis.overCommittedCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {currencyFormatter.format(commitmentAnalysis.totalOverCommitment)} over-committed
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="wip" className="space-y-4">
        <TabsList>
          <TabsTrigger value="wip">WIP Analysis</TabsTrigger>
          <TabsTrigger value="budget">Budget vs Actual</TabsTrigger>
          <TabsTrigger value="detail">Project Detail</TabsTrigger>
        </TabsList>

        <TabsContent value="wip" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>WIP vs Actual Cost</CardTitle>
                <CardDescription>Compare WIP clearing balances against actual posted costs</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={wipVsActualChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tickFormatter={formatCurrencyShort} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip content={<WipTooltip />} />
                      <Legend />
                      <Bar dataKey="wip" fill={CHART_COLORS.wip} name="WIP Clearing" />
                      <Bar dataKey="actual" fill={CHART_COLORS.actual} name="Actual Cost" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>WIP Status Distribution</CardTitle>
                <CardDescription>Projects by billing status relative to actual costs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
                    <div className="text-2xl font-bold text-green-600">{wipAnalysis.overBilled}</div>
                    <p className="text-xs text-muted-foreground">Over-billed</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                    <div className="text-2xl font-bold">{wipAnalysis.balanced}</div>
                    <p className="text-xs text-muted-foreground">Balanced</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950">
                    <div className="text-2xl font-bold text-red-600">{wipAnalysis.underBilled}</div>
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

        <TabsContent value="budget" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Budget vs Commitments</CardTitle>
                <CardDescription>Compare original budgets against committed and actual amounts</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={budgetVsCommittedData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                      <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 11 }} />
                      <Tooltip content={<WipTooltip />} />
                      <Legend />
                      <Bar dataKey="budget" fill={CHART_COLORS.budget} name="Budget" />
                      <Bar dataKey="committed" fill={CHART_COLORS.committed} name="Committed" />
                      <Line type="monotone" dataKey="actual" stroke={CHART_COLORS.actual} strokeWidth={2} name="Actual" dot />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost Type Breakdown</CardTitle>
                <CardDescription>
                  {selectedProjectId
                    ? `Variance by cost type for selected project`
                    : 'Select a project to see cost type breakdown'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedProjectId ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <p className="text-sm">Select a project from the detail tab</p>
                  </div>
                ) : budgetVarianceQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : budgetVarianceQuery.data?.byCostType.length ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      data={budgetVarianceQuery.data.byCostType.map((ct) => ({
                        costType: ct.costType,
                        budget: parseFloat(ct.totalBudget),
                        actual: parseFloat(ct.totalActual),
                        variance: parseFloat(ct.totalVariance),
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="costType" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 11 }} />
                      <Tooltip content={<WipTooltip />} />
                      <Legend />
                      <Bar dataKey="budget" name="Budget">
                        {budgetVarianceQuery.data.byCostType.map((entry) => (
                          <Cell key={entry.costType} fill={COST_TYPE_COLORS[entry.costType] || COST_TYPE_COLORS.OTHER} />
                        ))}
                      </Bar>
                      <Bar dataKey="actual" fill={CHART_COLORS.actual} name="Actual" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <p className="text-sm">No cost type data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="detail" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Detail</CardTitle>
              <CardDescription>
                Click a row to select a project and view cost type breakdown
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading data…
                </div>
              ) : filteredData.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No projects available.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead className="text-right">Budget</TableHead>
                        <TableHead className="text-right">Committed</TableHead>
                        <TableHead className="text-right">Actual</TableHead>
                        <TableHead className="text-right">WIP</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((project) => {
                        const variance = project.budget - project.actual;
                        const variancePercent = project.budget > 0
                          ? ((variance / project.budget) * 100).toFixed(1)
                          : '0';
                        const isOverBudget = project.actual > project.budget;
                        const isOverCommitted = project.committed > project.budget;

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
                              {currencyFormatter.format(project.budget)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              <span className={isOverCommitted ? 'text-red-600 font-medium' : ''}>
                                {currencyFormatter.format(project.committed)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              <span className={isOverBudget ? 'text-red-600 font-medium' : ''}>
                                {currencyFormatter.format(project.actual)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {currencyFormatter.format(project.wip)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {variance >= 0 ? '+' : ''}{currencyFormatter.format(variance)}
                              </span>
                              <p className="text-xs text-muted-foreground">{variancePercent}%</p>
                            </TableCell>
                            <TableCell>
                              {isOverBudget || isOverCommitted ? (
                                <Badge variant="destructive" className="gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  {isOverBudget ? 'Over Budget' : 'Over Committed'}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  On Track
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
