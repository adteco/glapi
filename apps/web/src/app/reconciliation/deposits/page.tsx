'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { trpc } from '@/lib/trpc';
import {
  RefreshCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Eye,
} from 'lucide-react';

type DepositStatus = 'OPEN' | 'SUBMITTED' | 'RECONCILED' | 'CANCELLED' | undefined;
type ReconciliationStatus = 'PENDING' | 'MATCHED' | 'EXCEPTION' | undefined;

export default function DepositsListPage() {
  const { orgId } = useAuth();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<DepositStatus>(undefined);
  const [reconciliationFilter, setReconciliationFilter] = useState<ReconciliationStatus>(undefined);
  const limit = 20;

  // Fetch deposits with filters
  const {
    data: deposits,
    isLoading,
    refetch,
  } = trpc.bankDeposits.list.useQuery(
    {
      page,
      limit,
      status: statusFilter,
      reconciliationStatus: reconciliationFilter,
    },
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
    };
    const config = variants[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getReconciliationBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      PENDING: { variant: 'secondary', label: 'Pending' },
      MATCHED: { variant: 'outline', label: 'Matched' },
      EXCEPTION: { variant: 'destructive', label: 'Exception' },
    };
    const config = variants[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleClearFilters = () => {
    setStatusFilter(undefined);
    setReconciliationFilter(undefined);
    setPage(1);
  };

  const totalPages = deposits ? Math.ceil(deposits.total / limit) : 0;

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/reconciliation">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bank Deposits</h1>
            <p className="text-muted-foreground">
              View and manage all deposit batches
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Select
                value={statusFilter || 'all'}
                onValueChange={(v) => {
                  setStatusFilter(v === 'all' ? undefined : (v as DepositStatus));
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Deposit Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="RECONCILED">Reconciled</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select
                value={reconciliationFilter || 'all'}
                onValueChange={(v) => {
                  setReconciliationFilter(v === 'all' ? undefined : (v as ReconciliationStatus));
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Reconciliation Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reconciliation</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="MATCHED">Matched</SelectItem>
                  <SelectItem value="EXCEPTION">Exception</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(statusFilter || reconciliationFilter) && (
              <Button variant="ghost" onClick={handleClearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Deposits Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Deposits {deposits && `(${deposits.total})`}
          </CardTitle>
          <CardDescription>
            Click on a deposit to view details and reconcile
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : deposits?.data?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-lg font-medium">No deposits found</p>
              <p className="text-muted-foreground">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deposit #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Bank Account</TableHead>
                    <TableHead className="text-center">Payments</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reconciliation</TableHead>
                    <TableHead>GL Posted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deposits?.data?.map((deposit) => (
                    <TableRow key={deposit.id}>
                      <TableCell className="font-medium">{deposit.depositNumber}</TableCell>
                      <TableCell>{formatDate(deposit.depositDate)}</TableCell>
                      <TableCell>{deposit.bankAccountName || '-'}</TableCell>
                      <TableCell className="text-center">{deposit.paymentCount}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(deposit.totalAmount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(deposit.status)}</TableCell>
                      <TableCell>{getReconciliationBadge(deposit.reconciliationStatus || 'PENDING')}</TableCell>
                      <TableCell>
                        {deposit.glTransactionId ? (
                          <Badge variant="outline" className="text-green-600">
                            Posted
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Not Posted</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/reconciliation/deposits/${deposit.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * limit + 1} to{' '}
                    {Math.min(page * limit, deposits?.total ?? 0)} of {deposits?.total ?? 0}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
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
