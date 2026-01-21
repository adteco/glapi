'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Building2,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
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
  percentComplete: '#ef4444',
};

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

const PercentCompleteTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload?.length) {
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="font-medium mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <span style={{ color: entry.color }}>{entry.name}:</span>
            <span className="font-medium">
              {entry.name.includes('%') ? `${entry.value.toFixed(1)}%` : currencyFormatter.format(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const BudgetComparisonTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload?.length) {
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg min-w-48">
        <p className="font-medium mb-2 truncate max-w-xs">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <span style={{ color: entry.color }}>{entry.name}:</span>
            <span className="font-medium">{currencyFormatter.format(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

interface SummaryTotals {
  totalBudget: number;
  totalActual: number;
  totalCommitted: number;
  avgPercentComplete: number;
}

export default function JobCostReportPage() {
  const { orgId } = useAuth();
  const [search, setSearch] = useState('');
  const [thresholdInput, setThresholdInput] = useState('85');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { data, isLoading } = trpc.projectReporting.jobCostSummary.useQuery(
    { search: search.trim() || undefined },
    { enabled: Boolean(orgId) }
  );

  const totals: SummaryTotals = useMemo(() => {
    if (!data?.length) {
      return { totalBudget: 0, totalActual: 0, totalCommitted: 0, avgPercentComplete: 0 };
    }

    const aggregate = data.reduce(
      (acc, row) => {
        const toNumber = (value?: string | null) => parseFloat(value || '0') || 0;
        acc.totalBudget += toNumber(row.totalBudgetAmount);
        acc.totalActual += toNumber(row.totalActualCost);
        acc.totalCommitted += toNumber(row.totalCommittedAmount);
        acc.percentSum += toNumber(row.percentComplete);
        return acc;
      },
      { totalBudget: 0, totalActual: 0, totalCommitted: 0, percentSum: 0 }
    );

    return {
      totalBudget: aggregate.totalBudget,
      totalActual: aggregate.totalActual,
      totalCommitted: aggregate.totalCommitted,
      avgPercentComplete: aggregate.percentSum / data.length,
    };
  }, [data]);

  const normalizedRows = useMemo(() => {
    const toNumber = (value?: string | null) => parseFloat(value || '0') || 0;
    return (data || []).map((row) => ({
      ...row,
      budget: toNumber(row.totalBudgetAmount),
      committed: toNumber(row.totalCommittedAmount),
      actual: toNumber(row.totalActualCost),
      wip: toNumber(row.totalWipClearing),
      percent: toNumber(row.percentComplete),
    }));
  }, [data]);

  useEffect(() => {
    if (normalizedRows.length && !selectedProjectId) {
      setSelectedProjectId(normalizedRows[0].projectId);
    }
  }, [normalizedRows, selectedProjectId]);

  const percentThreshold = (() => {
    const parsed = Number(thresholdInput);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      return parsed;
    }
    return 85;
  })();

  const atRiskProjects = useMemo(
    () => normalizedRows.filter((row) => row.percent >= percentThreshold),
    [normalizedRows, percentThreshold]
  );
  const onTrackProjects = normalizedRows.length - atRiskProjects.length;
  const topPercentProjects = useMemo(
    () =>
      [...normalizedRows]
        .sort((a, b) => b.percent - a.percent)
        .slice(0, 5),
    [normalizedRows]
  );
  const percentBuckets = useMemo(
    () => [
      { label: '0-25%', count: normalizedRows.filter((p) => p.percent < 25).length },
      { label: '25-50%', count: normalizedRows.filter((p) => p.percent >= 25 && p.percent < 50).length },
      { label: '50-75%', count: normalizedRows.filter((p) => p.percent >= 50 && p.percent < 75).length },
      { label: '75-90%', count: normalizedRows.filter((p) => p.percent >= 75 && p.percent < 90).length },
      { label: '90%+', count: normalizedRows.filter((p) => p.percent >= 90).length },
    ],
    [normalizedRows]
  );

  const historyQuery = trpc.projectReporting.progressHistory.useQuery(
    { projectId: selectedProjectId!, limit: 12 },
    { enabled: Boolean(orgId && selectedProjectId) }
  );

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view reports.</p>
      </div>
    );
  }

  const rows = normalizedRows;

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Job Cost Summary</h1>
        <p className="text-muted-foreground mt-2">
          Monitor project budgets, WIP, and percent-complete metrics across construction jobs.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencyFormatter.format(totals.totalBudget)}</div>
            <p className="text-xs text-muted-foreground">Aggregated across current projects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actual Costs</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencyFormatter.format(totals.totalActual)}</div>
            <p className="text-xs text-muted-foreground">Posted to project cost accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average % Complete</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.avgPercentComplete.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Weighted average of open jobs</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium">At-Risk Threshold</CardTitle>
              <CardDescription>Projects above this percent complete are flagged.</CardDescription>
            </div>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="number"
              min={0}
              max={100}
              step={5}
              value={thresholdInput}
              onChange={(event) => setThresholdInput(event.target.value)}
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>At risk</span>
              <span>{percentThreshold.toFixed(0)}% +</span>
            </div>
            <div className="text-sm">
              <span className="font-semibold">{atRiskProjects.length}</span> of{' '}
              <span className="font-semibold">{rows.length}</span> projects at risk,{' '}
              <span className="font-semibold">{onTrackProjects}</span> on track.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Percent Complete Buckets</CardTitle>
            <CardDescription>Distribution of projects by percent-complete range.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {percentBuckets.map((bucket) => (
                <div key={bucket.label} className="flex items-center justify-between text-sm">
                  <span>{bucket.label}</span>
                  <Badge variant="secondary">{bucket.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Progressing Projects</CardTitle>
          <CardDescription>Most advanced jobs based on percent complete.</CardDescription>
        </CardHeader>
        <CardContent>
          {topPercentProjects.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active projects to display.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {topPercentProjects.map((project) => (
                <Card key={project.projectId} className="border-muted/40">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{project.projectName}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {project.projectCode || project.projectId.slice(0, 8)}
                        </p>
                      </div>
                      <Badge
                        variant={project.percent >= percentThreshold ? 'destructive' : 'secondary'}
                      >
                        {project.percent.toFixed(1)}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Budget</span>
                      <span>{currencyFormatter.format(project.budget)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Actual</span>
                      <span>{currencyFormatter.format(project.actual)}</span>
                    </div>
                    <Link href={`/construction/projects?projectId=${project.projectId}`} passHref>
                      <Button variant="ghost" size="sm" className="w-full mt-2">
                        View project
                        <ArrowUpRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedProjectId && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Percent Complete Trend</CardTitle>
                <CardDescription>
                  Historical progress for {normalizedRows.find(p => p.projectId === selectedProjectId)?.projectName || selectedProjectId.slice(0, 8)}
                </CardDescription>
              </div>
              <div className="text-sm text-muted-foreground">
                {historyQuery.isLoading
                  ? 'Loading…'
                  : historyQuery.data?.length
                  ? `${historyQuery.data.length} snapshots`
                  : 'No data'}
              </div>
            </CardHeader>
            <CardContent>
              {historyQuery.isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading history…
                </div>
              ) : historyQuery.data && historyQuery.data.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart
                    data={[...historyQuery.data].reverse().map((snapshot) => ({
                      date: new Date(snapshot.snapshotDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                      percentComplete: parseFloat(snapshot.percentComplete || '0'),
                      actual: parseFloat(snapshot.totalActualCost || '0'),
                      budget: parseFloat(snapshot.totalBudgetAmount || '0'),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis
                      yAxisId="percent"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11 }}
                      orientation="left"
                    />
                    <YAxis
                      yAxisId="currency"
                      tickFormatter={formatCurrencyShort}
                      tick={{ fontSize: 11 }}
                      orientation="right"
                    />
                    <Tooltip content={<PercentCompleteTooltip />} />
                    <Legend />
                    <Line
                      yAxisId="percent"
                      type="monotone"
                      dataKey="percentComplete"
                      stroke={CHART_COLORS.percentComplete}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="% Complete"
                    />
                    <Line
                      yAxisId="currency"
                      type="monotone"
                      dataKey="actual"
                      stroke={CHART_COLORS.actual}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Actual Cost"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground text-sm">No history captured yet for this project.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Budget vs Actual Comparison</CardTitle>
              <CardDescription>Top projects by budget with actual spend overlay</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={topPercentProjects.slice(0, 5).map((p) => ({
                    name: p.projectName.length > 15 ? `${p.projectName.slice(0, 15)}…` : p.projectName,
                    fullName: p.projectName,
                    budget: p.budget,
                    actual: p.actual,
                    committed: p.committed,
                  }))}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={formatCurrencyShort} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip content={<BudgetComparisonTooltip />} />
                  <Legend />
                  <Bar dataKey="budget" fill={CHART_COLORS.budget} name="Budget" />
                  <Bar dataKey="actual" fill={CHART_COLORS.actual} name="Actual" />
                  <Bar dataKey="committed" fill={CHART_COLORS.committed} name="Committed" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedProjectId && historyQuery.data && historyQuery.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Snapshot History Details</CardTitle>
            <CardDescription>Raw snapshot data for {normalizedRows.find(p => p.projectId === selectedProjectId)?.projectName}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Actual</TableHead>
                    <TableHead>WIP Clearing</TableHead>
                    <TableHead className="text-right">% Complete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyQuery.data.map((snapshot) => (
                    <TableRow key={snapshot.id}>
                      <TableCell>{new Date(snapshot.snapshotDate).toLocaleDateString()}</TableCell>
                      <TableCell>{currencyFormatter.format(parseFloat(snapshot.totalBudgetAmount || '0'))}</TableCell>
                      <TableCell>{currencyFormatter.format(parseFloat(snapshot.totalActualCost || '0'))}</TableCell>
                      <TableCell>{currencyFormatter.format(parseFloat(snapshot.totalWipClearing || '0'))}</TableCell>
                      <TableCell className="text-right">{parseFloat(snapshot.percentComplete || '0').toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Project Detail</CardTitle>
            <CardDescription>Budget vs actual, commitments, and WIP balances by project.</CardDescription>
          </div>
          <Input
            placeholder="Search by project name or code…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full md:w-64"
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading job cost data…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No job cost data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Committed</TableHead>
                    <TableHead>Actual Costs</TableHead>
                    <TableHead>WIP Clearing</TableHead>
                    <TableHead className="text-right">% Complete</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((project) => (
                    <TableRow
                      key={project.projectId}
                      onClick={() => setSelectedProjectId(project.projectId)}
                      className={project.projectId === selectedProjectId ? 'bg-muted/40' : undefined}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{project.projectName}</p>
                          <p className="text-xs text-muted-foreground">
                            {project.projectCode || project.projectId.slice(0, 8)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{currencyFormatter.format(project.budget)}</TableCell>
                      <TableCell>{currencyFormatter.format(project.committed)}</TableCell>
                      <TableCell>{currencyFormatter.format(project.actual)}</TableCell>
                      <TableCell>{currencyFormatter.format(project.wip)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={project.percent >= 90 ? 'destructive' : project.percent >= 70 ? 'default' : 'secondary'}>
                          {project.percent.toFixed(1)}%
                        </Badge>
                        {project.lastPostedAt && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Last posted {new Date(project.lastPostedAt).toLocaleDateString()}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/construction/projects?projectId=${project.projectId}`} passHref>
                          <Button variant="outline" size="sm">
                            Open
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
