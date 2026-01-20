'use client';

import * as React from 'react';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  Play,
  Pause,
  RefreshCw,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MailIcon,
  Globe,
  ChevronLeft,
  ChevronRight,
  Activity,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';

// Status badge color mapping
const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-blue-100 text-blue-800',
  error: 'bg-red-100 text-red-800',
};

// Frequency display mapping
const frequencyLabels: Record<string, string> = {
  once: 'One-time',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  cron: 'Custom (Cron)',
};

// Report type labels
const reportTypeLabels: Record<string, string> = {
  income_statement: 'Income Statement',
  balance_sheet: 'Balance Sheet',
  cash_flow_statement: 'Cash Flow Statement',
  trial_balance: 'Trial Balance',
  general_ledger: 'General Ledger',
  account_activity: 'Account Activity',
  job_cost_summary: 'Job Cost Summary',
  wip_summary: 'WIP Summary',
  project_budget_variance: 'Project Budget Variance',
  retainage_aging: 'Retainage Aging',
  revenue_forecast: 'Revenue Forecast',
  deferred_revenue: 'Deferred Revenue',
  subscription_metrics: 'Subscription Metrics',
  custom: 'Custom Report',
};

export default function ScheduledReportsPage() {
  const { orgId } = useAuth();
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [reportTypeFilter, setReportTypeFilter] = React.useState<string>('all');
  const [selectedSchedule, setSelectedSchedule] = React.useState<string | null>(null);
  const limit = 20;

  // Fetch schedules
  const schedulesQuery = trpc.reportSchedules.list.useQuery({
    status: statusFilter !== 'all' ? statusFilter as any : undefined,
    reportType: reportTypeFilter !== 'all' ? reportTypeFilter as any : undefined,
    page,
    limit,
  }, {
    enabled: !!orgId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch stats
  const statsQuery = trpc.reportSchedules.getStats.useQuery(undefined, {
    enabled: !!orgId,
  });

  // Mutations
  const activateMutation = trpc.reportSchedules.activate.useMutation({
    onSuccess: () => schedulesQuery.refetch(),
  });
  const pauseMutation = trpc.reportSchedules.pause.useMutation({
    onSuccess: () => schedulesQuery.refetch(),
  });
  const resumeMutation = trpc.reportSchedules.resume.useMutation({
    onSuccess: () => schedulesQuery.refetch(),
  });
  const triggerMutation = trpc.reportSchedules.triggerExecution.useMutation({
    onSuccess: () => schedulesQuery.refetch(),
  });

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view scheduled reports.</p>
      </div>
    );
  }

  const schedules = schedulesQuery.data?.schedules ?? [];
  const totalPages = Math.ceil((schedulesQuery.data?.total ?? 0) / limit);
  const stats = statsQuery.data;

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/reports" className="hover:text-gray-700">Reports</Link>
            <span>/</span>
            <span>Scheduled Reports</span>
          </div>
          <h1 className="text-3xl font-bold">Scheduled Reports</h1>
          <p className="text-gray-600 mt-2">Manage automated report generation and delivery</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/reports/schedules/monitoring">
              <Activity className="mr-2 h-4 w-4" />
              Monitoring
            </Link>
          </Button>
          <Button asChild>
            <Link href="/reports/schedules/new">
              <Plus className="mr-2 h-4 w-4" />
              New Schedule
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Schedules</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Calendar className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Active</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Paused</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.paused}</p>
                </div>
                <Pause className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">With Errors</p>
                  <p className="text-2xl font-bold text-red-600">{stats.error}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Runs</p>
                  <p className="text-2xl font-bold">{stats.totalExecutions}</p>
                </div>
                <RefreshCw className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 block mb-1">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 block mb-1">Report Type</label>
              <Select value={reportTypeFilter} onValueChange={setReportTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="income_statement">Income Statement</SelectItem>
                  <SelectItem value="balance_sheet">Balance Sheet</SelectItem>
                  <SelectItem value="cash_flow_statement">Cash Flow Statement</SelectItem>
                  <SelectItem value="job_cost_summary">Job Cost Summary</SelectItem>
                  <SelectItem value="wip_summary">WIP Summary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => schedulesQuery.refetch()}
                disabled={schedulesQuery.isFetching}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${schedulesQuery.isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Report Schedules</CardTitle>
          <CardDescription>
            {schedulesQuery.data?.total ?? 0} schedule{(schedulesQuery.data?.total ?? 0) !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schedulesQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No scheduled reports found.</p>
              <p className="text-sm">Create a new schedule to automate report generation.</p>
              <Button className="mt-4" asChild>
                <Link href="/reports/schedules/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Schedule
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Report Type</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead>Success Rate</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell>
                        <div className="font-medium">{schedule.name}</div>
                        {schedule.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {schedule.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {reportTypeLabels[schedule.reportType] ?? schedule.reportType}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          {frequencyLabels[schedule.frequency] ?? schedule.frequency}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[schedule.status]}>
                          {schedule.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {schedule.nextRunAt ? (
                          <div className="text-sm">
                            {formatDistanceToNow(new Date(schedule.nextRunAt), { addSuffix: true })}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {schedule.lastRunAt ? (
                          <div className="text-sm">
                            {formatDistanceToNow(new Date(schedule.lastRunAt), { addSuffix: true })}
                            {schedule.lastErrorMessage && (
                              <div className="text-xs text-red-500 truncate max-w-xs" title={schedule.lastErrorMessage}>
                                {schedule.lastErrorMessage}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {schedule.totalRuns > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{
                                  width: `${(schedule.successfulRuns / schedule.totalRuns) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">
                              {Math.round((schedule.successfulRuns / schedule.totalRuns) * 100)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {schedule.status === 'draft' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => activateMutation.mutate({ id: schedule.id })}
                              disabled={activateMutation.isPending}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          {schedule.status === 'active' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => pauseMutation.mutate({ id: schedule.id })}
                              disabled={pauseMutation.isPending}
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          )}
                          {schedule.status === 'paused' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resumeMutation.mutate({ id: schedule.id })}
                              disabled={resumeMutation.isPending}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => triggerMutation.mutate({ scheduleId: schedule.id })}
                            disabled={triggerMutation.isPending}
                            title="Run now"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/reports/schedules/${schedule.id}`}>
                              <Settings className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-500">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
