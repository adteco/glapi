'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/lib/trpc';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  ArrowRight,
  Loader2,
} from 'lucide-react';

export default function ReconciliationDashboardPage() {
  const { orgId } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch dashboard stats
  const {
    data: stats,
    isLoading: isStatsLoading,
    refetch: refetchStats,
  } = trpc.bankDeposits.dashboardStats.useQuery({}, { enabled: Boolean(orgId) });

  // Fetch pending deposits
  const { data: pendingDeposits, isLoading: isDepositsLoading } =
    trpc.bankDeposits.pendingReconciliation.useQuery({}, { enabled: Boolean(orgId) });

  // Fetch open exceptions
  const { data: exceptions, isLoading: isExceptionsLoading } =
    trpc.bankDeposits.listExceptions.useQuery(
      { status: 'EXCEPTION', limit: 10 },
      { enabled: Boolean(orgId) }
    );

  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      OPEN: { variant: 'secondary', label: 'Open' },
      SUBMITTED: { variant: 'default', label: 'Submitted' },
      RECONCILED: { variant: 'outline', label: 'Reconciled' },
      CANCELLED: { variant: 'destructive', label: 'Cancelled' },
      PENDING: { variant: 'secondary', label: 'Pending' },
      MATCHED: { variant: 'outline', label: 'Matched' },
      EXCEPTION: { variant: 'destructive', label: 'Exception' },
    };
    const config = variants[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const isLoading = isStatsLoading || isDepositsLoading || isExceptionsLoading;

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bank Reconciliation</h1>
          <p className="text-muted-foreground">
            Manage deposit reconciliation and resolve exceptions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetchStats()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Link href="/reconciliation/deposits">
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              All Deposits
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reconciliation</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isStatsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                stats?.pendingReconciliationCount ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isStatsLoading ? '...' : formatCurrency(stats?.pendingReconciliationAmount ?? 0)} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Exceptions</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {isStatsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                stats?.openExceptionsCount ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">Requiring attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reconciled This Month</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isStatsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                stats?.reconciledDeposits ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isStatsLoading ? '...' : formatCurrency(stats?.reconciledAmount ?? 0)} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isStatsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                stats?.totalDeposits ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isStatsLoading ? '...' : formatCurrency(stats?.totalAmount ?? 0)} total value
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({stats?.pendingReconciliationCount ?? 0})
          </TabsTrigger>
          <TabsTrigger value="exceptions">
            Exceptions ({stats?.openExceptionsCount ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Pending Reconciliation Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Deposits Awaiting Reconciliation</CardTitle>
                <CardDescription>
                  Submitted deposits that need bank statement matching
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isDepositsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : pendingDeposits?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle className="h-12 w-12 text-green-600 mb-2" />
                    <p className="text-muted-foreground">All deposits reconciled</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingDeposits?.slice(0, 5).map((deposit) => (
                      <div
                        key={deposit.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{deposit.depositNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(deposit.depositDate)} &middot; {deposit.paymentCount} payments
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(deposit.totalAmount)}</p>
                          {getStatusBadge(deposit.reconciliationStatus || 'PENDING')}
                        </div>
                      </div>
                    ))}
                    {(pendingDeposits?.length ?? 0) > 5 && (
                      <Link href="/reconciliation/deposits?status=SUBMITTED">
                        <Button variant="ghost" className="w-full">
                          View all {pendingDeposits?.length} deposits
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Exceptions Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Open Exceptions</CardTitle>
                <CardDescription>
                  Reconciliation issues requiring resolution
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isExceptionsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : exceptions?.data?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle className="h-12 w-12 text-green-600 mb-2" />
                    <p className="text-muted-foreground">No open exceptions</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {exceptions?.data?.slice(0, 5).map((exception) => (
                      <div
                        key={exception.id}
                        className="flex items-center justify-between p-3 border rounded-lg border-destructive/50 bg-destructive/5"
                      >
                        <div>
                          <p className="font-medium">{exception.exceptionType}</p>
                          <p className="text-sm text-muted-foreground">
                            {exception.exceptionDescription?.slice(0, 50)}...
                          </p>
                        </div>
                        <div className="text-right">
                          {exception.varianceAmount && (
                            <p className="font-medium text-destructive">
                              {formatCurrency(exception.varianceAmount)}
                            </p>
                          )}
                          {getStatusBadge(exception.status)}
                        </div>
                      </div>
                    ))}
                    {(exceptions?.total ?? 0) > 5 && (
                      <Link href="/reconciliation/exceptions">
                        <Button variant="ghost" className="w-full">
                          View all {exceptions?.total} exceptions
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Pending Tab */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Deposits Pending Reconciliation</CardTitle>
              <CardDescription>
                Review and reconcile submitted deposits against bank statements
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isDepositsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : pendingDeposits?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-600 mb-2" />
                  <p className="text-lg font-medium">All caught up!</p>
                  <p className="text-muted-foreground">No deposits pending reconciliation</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deposit #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Payments</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingDeposits?.map((deposit) => (
                      <TableRow key={deposit.id}>
                        <TableCell className="font-medium">{deposit.depositNumber}</TableCell>
                        <TableCell>{formatDate(deposit.depositDate)}</TableCell>
                        <TableCell>{deposit.paymentCount}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(deposit.totalAmount)}
                        </TableCell>
                        <TableCell>{getStatusBadge(deposit.reconciliationStatus || 'PENDING')}</TableCell>
                        <TableCell className="text-right">
                          <Link href={`/reconciliation/deposits/${deposit.id}`}>
                            <Button variant="outline" size="sm">
                              Reconcile
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exceptions Tab */}
        <TabsContent value="exceptions">
          <Card>
            <CardHeader>
              <CardTitle>Reconciliation Exceptions</CardTitle>
              <CardDescription>
                Resolve discrepancies between deposits and bank statements
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isExceptionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : exceptions?.data?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-600 mb-2" />
                  <p className="text-lg font-medium">No exceptions</p>
                  <p className="text-muted-foreground">All reconciliations are clean</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptions?.data?.map((exception) => (
                      <TableRow key={exception.id}>
                        <TableCell className="font-medium">{exception.exceptionType}</TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {exception.exceptionDescription}
                        </TableCell>
                        <TableCell className="text-right">
                          {exception.varianceAmount ? (
                            <span className="text-destructive font-medium">
                              {formatCurrency(exception.varianceAmount)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(exception.status)}</TableCell>
                        <TableCell className="text-right">
                          <Link href={`/reconciliation/exceptions/${exception.id}`}>
                            <Button variant="outline" size="sm">
                              Resolve
                            </Button>
                          </Link>
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
