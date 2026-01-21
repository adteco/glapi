'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

type ExceptionStatus = 'EXCEPTION' | 'RESOLVED' | undefined;

export default function ExceptionsListPage() {
  const { orgId } = useAuth();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ExceptionStatus>(undefined);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedExceptionId, setSelectedExceptionId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const limit = 20;

  // Fetch exceptions with filters
  const {
    data: exceptions,
    isLoading,
    refetch,
  } = trpc.bankDeposits.listExceptions.useQuery(
    {
      page,
      limit,
      status: statusFilter,
    },
    { enabled: Boolean(orgId) }
  );

  // Resolve exception mutation
  const resolveException = trpc.bankDeposits.resolveException.useMutation({
    onSuccess: () => {
      toast.success('Exception resolved successfully');
      setResolveDialogOpen(false);
      setSelectedExceptionId(null);
      setResolutionNotes('');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to resolve exception');
    },
  });

  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      EXCEPTION: { variant: 'destructive', label: 'Open' },
      RESOLVED: { variant: 'outline', label: 'Resolved' },
    };
    const config = variants[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getExceptionTypeBadge = (type: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      AMOUNT_VARIANCE: { variant: 'destructive', label: 'Amount Variance' },
      MISSING_PAYMENT: { variant: 'default', label: 'Missing Payment' },
      DUPLICATE_DEPOSIT: { variant: 'secondary', label: 'Duplicate' },
      DATE_MISMATCH: { variant: 'outline', label: 'Date Mismatch' },
      OTHER: { variant: 'secondary', label: 'Other' },
    };
    const config = variants[type] || { variant: 'secondary' as const, label: type };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleClearFilters = () => {
    setStatusFilter(undefined);
    setPage(1);
  };

  const handleResolveClick = (exceptionId: string) => {
    setSelectedExceptionId(exceptionId);
    setResolutionNotes('');
    setResolveDialogOpen(true);
  };

  const handleResolveSubmit = () => {
    if (!selectedExceptionId || !resolutionNotes.trim()) {
      toast.error('Please provide resolution notes');
      return;
    }
    resolveException.mutate({
      exceptionId: selectedExceptionId,
      resolutionNotes: resolutionNotes.trim(),
    });
  };

  const totalPages = exceptions ? Math.ceil(exceptions.total / limit) : 0;

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
            <h1 className="text-2xl font-bold tracking-tight">Reconciliation Exceptions</h1>
            <p className="text-muted-foreground">
              Review and resolve reconciliation discrepancies
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
                  setStatusFilter(v === 'all' ? undefined : (v as ExceptionStatus));
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="EXCEPTION">Open</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {statusFilter && (
              <Button variant="ghost" onClick={handleClearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Exceptions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Exceptions {exceptions && `(${exceptions.total})`}
          </CardTitle>
          <CardDescription>
            Click Resolve to document how an exception was addressed
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : exceptions?.data?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mb-2" />
              <p className="text-lg font-medium">No exceptions found</p>
              <p className="text-muted-foreground">
                {statusFilter === 'EXCEPTION'
                  ? 'All reconciliation exceptions have been resolved'
                  : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Bank Statement</TableHead>
                    <TableHead className="text-right">System Amount</TableHead>
                    <TableHead className="text-right">Bank Amount</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exceptions?.data?.map((exception) => (
                    <TableRow key={exception.id}>
                      <TableCell>{getExceptionTypeBadge(exception.exceptionType)}</TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="truncate" title={exception.exceptionDescription}>
                          {exception.exceptionDescription}
                        </p>
                      </TableCell>
                      <TableCell>
                        {exception.bankStatementRef && (
                          <div>
                            <p className="font-medium">{exception.bankStatementRef}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(exception.bankStatementDate)}
                            </p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {exception.systemAmount ? formatCurrency(exception.systemAmount) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {exception.bankStatementAmount
                          ? formatCurrency(exception.bankStatementAmount)
                          : '-'}
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
                        {exception.status === 'EXCEPTION' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResolveClick(exception.id)}
                          >
                            Resolve
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" disabled>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
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
                    {Math.min(page * limit, exceptions?.total ?? 0)} of {exceptions?.total ?? 0}
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

      {/* Resolve Exception Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Exception</DialogTitle>
            <DialogDescription>
              Document how this reconciliation exception was resolved. This creates an audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Resolution Notes</label>
            <Textarea
              placeholder="Describe how this exception was resolved..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              className="mt-2"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleResolveSubmit}
              disabled={!resolutionNotes.trim() || resolveException.isPending}
            >
              {resolveException.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Resolve Exception
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
