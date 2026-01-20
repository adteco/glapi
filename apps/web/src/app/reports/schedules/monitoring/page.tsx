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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MailIcon,
  Globe,
  ChevronLeft,
  ChevronRight,
  Activity,
  Inbox,
  RotateCw,
  Clock,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';

// Status badge color mapping
const deliveryStatusColors: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-800',
  processing: 'bg-yellow-100 text-yellow-800',
  delivered: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  dead_letter: 'bg-purple-100 text-purple-800',
};

// Delivery type icons
const deliveryTypeIcons: Record<string, React.ReactNode> = {
  email: <MailIcon className="h-4 w-4" />,
  webhook: <Globe className="h-4 w-4" />,
};

export default function DeliveryMonitoringPage() {
  const { orgId } = useAuth();
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [deliveryTypeFilter, setDeliveryTypeFilter] = React.useState<string>('all');
  const [activeTab, setActiveTab] = React.useState('overview');
  const limit = 20;

  // Fetch dashboard stats
  const dashboardQuery = trpc.deliveryQueue.getDashboardStats.useQuery(undefined, {
    enabled: !!orgId,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch deliveries list
  const deliveriesQuery = trpc.deliveryQueue.list.useQuery({
    status: statusFilter !== 'all' ? statusFilter as any : undefined,
    deliveryType: deliveryTypeFilter !== 'all' ? deliveryTypeFilter as any : undefined,
    page,
    limit,
  }, {
    enabled: !!orgId && activeTab === 'deliveries',
    refetchInterval: 15000,
  });

  // Fetch dead letter items
  const deadLetterQuery = trpc.deliveryQueue.getDeadLetterItems.useQuery({
    limit: 100,
  }, {
    enabled: !!orgId && activeTab === 'deadletter',
  });

  // Retry mutation
  const retryMutation = trpc.deliveryQueue.retryDeadLetter.useMutation({
    onSuccess: () => {
      deadLetterQuery.refetch();
      dashboardQuery.refetch();
    },
  });

  const bulkRetryMutation = trpc.deliveryQueue.retryDeadLetterBulk.useMutation({
    onSuccess: () => {
      deadLetterQuery.refetch();
      dashboardQuery.refetch();
    },
  });

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view delivery monitoring.</p>
      </div>
    );
  }

  const dashboard = dashboardQuery.data;
  const deliveries = deliveriesQuery.data?.items ?? [];
  const deadLetterItems = deadLetterQuery.data ?? [];
  const totalPages = Math.ceil((deliveriesQuery.data?.total ?? 0) / limit);

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/reports" className="hover:text-gray-700">Reports</Link>
            <span>/</span>
            <Link href="/reports/schedules" className="hover:text-gray-700">Schedules</Link>
            <span>/</span>
            <span>Monitoring</span>
          </div>
          <h1 className="text-3xl font-bold">Delivery Monitoring</h1>
          <p className="text-gray-600 mt-2">Monitor report delivery status and troubleshoot failures</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/reports/schedules">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Schedules
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              dashboardQuery.refetch();
              deliveriesQuery.refetch();
              deadLetterQuery.refetch();
            }}
            disabled={dashboardQuery.isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${dashboardQuery.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Health Alert */}
      {dashboard?.summary.healthStatus === 'warning' && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Attention Required</AlertTitle>
          <AlertDescription>
            There are {dashboard.deliveries.deadLetter} items in the dead letter queue that require attention.
            Review and retry failed deliveries below.
          </AlertDescription>
        </Alert>
      )}
      {dashboard?.summary.healthStatus === 'attention' && (
        <Alert className="mb-6 border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Items Need Attention</AlertTitle>
          <AlertDescription className="text-yellow-700">
            There are {dashboard.deliveries.deadLetter} items in the dead letter queue.
          </AlertDescription>
        </Alert>
      )}

      {/* Dashboard Stats */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Schedules Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Active Schedules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{dashboard.schedules.active}</span>
                <Activity className="h-8 w-8 text-green-400" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {dashboard.schedules.total} total schedules
              </p>
            </CardContent>
          </Card>

          {/* Pending Deliveries */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Pending Deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-blue-600">
                  {dashboard.deliveries.pending}
                </span>
                <Clock className="h-8 w-8 text-blue-400" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {dashboard.deliveries.processing} currently processing
              </p>
            </CardContent>
          </Card>

          {/* Delivered */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Delivered</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-green-600">
                  {dashboard.deliveries.delivered}
                </span>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Successfully delivered reports
              </p>
            </CardContent>
          </Card>

          {/* Dead Letter */}
          <Card className={dashboard.deliveries.deadLetter > 0 ? 'border-red-200' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Dead Letter Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-bold ${dashboard.deliveries.deadLetter > 0 ? 'text-red-600' : ''}`}>
                  {dashboard.deliveries.deadLetter}
                </span>
                <Inbox className={`h-8 w-8 ${dashboard.deliveries.deadLetter > 0 ? 'text-red-400' : 'text-gray-400'}`} />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {dashboard.deliveries.failed} failed (pending retry)
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deliveries">All Deliveries</TabsTrigger>
          <TabsTrigger value="deadletter">
            Dead Letter Queue
            {dashboard && dashboard.deliveries.deadLetter > 0 && (
              <Badge variant="destructive" className="ml-2">
                {dashboard.deliveries.deadLetter}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Schedule Health */}
            <Card>
              <CardHeader>
                <CardTitle>Schedule Health</CardTitle>
                <CardDescription>Status distribution of all schedules</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Active</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${dashboard.schedules.total > 0 ? (dashboard.schedules.active / dashboard.schedules.total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">{dashboard.schedules.active}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Paused</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-500 rounded-full"
                            style={{ width: `${dashboard.schedules.total > 0 ? (dashboard.schedules.paused / dashboard.schedules.total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">{dashboard.schedules.paused}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Error</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500 rounded-full"
                            style={{ width: `${dashboard.schedules.total > 0 ? (dashboard.schedules.error / dashboard.schedules.total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">{dashboard.schedules.error}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Draft</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gray-400 rounded-full"
                            style={{ width: `${dashboard.schedules.total > 0 ? (dashboard.schedules.draft / dashboard.schedules.total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">{dashboard.schedules.draft}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Delivery Pipeline */}
            <Card>
              <CardHeader>
                <CardTitle>Delivery Pipeline</CardTitle>
                <CardDescription>Current delivery queue status</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 p-3 bg-blue-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-600">{dashboard.deliveries.pending}</p>
                        <p className="text-xs text-blue-600">Pending</p>
                      </div>
                      <div className="text-gray-400">→</div>
                      <div className="flex-1 p-3 bg-yellow-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-yellow-600">{dashboard.deliveries.processing}</p>
                        <p className="text-xs text-yellow-600">Processing</p>
                      </div>
                      <div className="text-gray-400">→</div>
                      <div className="flex-1 p-3 bg-green-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-green-600">{dashboard.deliveries.delivered}</p>
                        <p className="text-xs text-green-600">Delivered</p>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Failed (retrying)</span>
                        <Badge variant="outline" className="text-red-600">
                          {dashboard.deliveries.failed}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-2">
                        <span className="text-gray-500">Dead Letter</span>
                        <Badge variant="destructive">
                          {dashboard.deliveries.deadLetter}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Deliveries Tab */}
        <TabsContent value="deliveries" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>All Deliveries</CardTitle>
                  <CardDescription>
                    {deliveriesQuery.data?.total ?? 0} delivery records
                  </CardDescription>
                </div>
                <div className="flex gap-4">
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="dead_letter">Dead Letter</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={deliveryTypeFilter} onValueChange={(v) => { setDeliveryTypeFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {deliveriesQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : deliveries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Inbox className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No deliveries found.</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Report</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Attempts</TableHead>
                        <TableHead>Scheduled</TableHead>
                        <TableHead>Completed</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deliveries.map((delivery) => (
                        <TableRow key={delivery.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {deliveryTypeIcons[delivery.deliveryType]}
                              <span className="capitalize">{delivery.deliveryType}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{delivery.reportType}</div>
                            <div className="text-xs text-gray-500">{delivery.outputFormat.toUpperCase()}</div>
                          </TableCell>
                          <TableCell>
                            <Badge className={deliveryStatusColors[delivery.status]}>
                              {delivery.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {delivery.attemptCount} / {delivery.maxAttempts}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {format(new Date(delivery.scheduledAt), 'MMM d, HH:mm')}
                            </div>
                          </TableCell>
                          <TableCell>
                            {delivery.completedAt ? (
                              <div className="text-sm">
                                {format(new Date(delivery.completedAt), 'MMM d, HH:mm')}
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {delivery.lastErrorMessage ? (
                              <div className="text-xs text-red-500 truncate max-w-xs" title={delivery.lastErrorMessage}>
                                {delivery.lastErrorMessage}
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-gray-500">Page {page} of {totalPages}</div>
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
        </TabsContent>

        {/* Dead Letter Tab */}
        <TabsContent value="deadletter" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Dead Letter Queue</CardTitle>
                  <CardDescription>
                    Deliveries that failed after maximum retry attempts
                  </CardDescription>
                </div>
                {deadLetterItems.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => bulkRetryMutation.mutate({ ids: deadLetterItems.map(d => d.id) })}
                    disabled={bulkRetryMutation.isPending}
                  >
                    <RotateCw className={`h-4 w-4 mr-2 ${bulkRetryMutation.isPending ? 'animate-spin' : ''}`} />
                    Retry All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {deadLetterQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : deadLetterItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="mx-auto h-12 w-12 mb-4 text-green-400" />
                  <p className="text-green-600">No items in dead letter queue!</p>
                  <p className="text-sm text-gray-500">All deliveries are working as expected.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Report</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Moved to DLQ</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deadLetterItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {deliveryTypeIcons[item.deliveryType]}
                            <span className="capitalize">{item.deliveryType}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{item.reportType}</div>
                          <div className="text-xs text-gray-500">{item.outputFormat.toUpperCase()}</div>
                        </TableCell>
                        <TableCell>{item.attemptCount}</TableCell>
                        <TableCell>
                          {item.movedToDeadLetterAt ? (
                            <div className="text-sm">
                              {formatDistanceToNow(new Date(item.movedToDeadLetterAt), { addSuffix: true })}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-red-500 max-w-xs">
                            <div className="font-medium">{item.deadLetterReason}</div>
                            {item.lastErrorMessage && (
                              <div className="truncate" title={item.lastErrorMessage}>
                                {item.lastErrorMessage}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => retryMutation.mutate({ id: item.id })}
                            disabled={retryMutation.isPending}
                          >
                            <RotateCw className={`h-4 w-4 mr-1 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
                            Retry
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
