'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  RefreshCw,
  RotateCcw,
  Archive,
  AlertTriangle,
  Eye,
  Clock,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';

interface DLQEntry {
  instance: {
    id: string;
    workflowDefinitionId: string;
    status: string;
    triggeredBy: string;
    startedAt: string | null;
    completedAt: string | null;
    retryCount: number;
    createdAt: string;
  };
  definition: {
    id: string;
    name: string;
    workflowCode: string;
  } | null;
  failureDetails: {
    errorMessage: string | null;
    errorDetails: Record<string, unknown> | null;
    failedAt: string | null;
    retryCount: number;
    lastRetryAt: string | null;
  };
}

export default function FailedWorkflowsPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<DLQEntry | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [bulkRetryOpen, setBulkRetryOpen] = useState(false);
  const { orgId } = useAuth();

  // TRPC queries
  const {
    data: dlqData,
    isLoading,
    refetch,
  } = trpc.workflows.listFailed.useQuery(
    {
      page: currentPage,
      limit: 20,
    },
    {
      enabled: !!orgId,
    }
  );

  const { data: statsData, refetch: refetchStats } = trpc.workflows.getDlqStats.useQuery(undefined, {
    enabled: !!orgId,
  });

  // Mutations
  const retryMutation = trpc.workflows.retry.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Workflow retry started');
      } else {
        toast.error(result.error || 'Retry failed');
      }
      refetch();
      refetchStats();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to retry workflow');
    },
  });

  const replayMutation = trpc.workflows.replay.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Workflow replay started');
      } else {
        toast.error(result.error || 'Replay failed');
      }
      refetch();
      refetchStats();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to replay workflow');
    },
  });

  const archiveMutation = trpc.workflows.archiveFailed.useMutation({
    onSuccess: () => {
      toast.success('Workflow archived');
      refetch();
      refetchStats();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to archive workflow');
    },
  });

  const bulkRetryMutation = trpc.workflows.bulkRetry.useMutation({
    onSuccess: (results) => {
      const successCount = Object.values(results).filter((r) => r.success).length;
      const failCount = Object.values(results).filter((r) => !r.success).length;

      if (successCount > 0) {
        toast.success(`${successCount} workflow(s) retry started`);
      }
      if (failCount > 0) {
        toast.error(`${failCount} workflow(s) failed to retry`);
      }

      setSelectedIds([]);
      setBulkRetryOpen(false);
      refetch();
      refetchStats();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to bulk retry');
    },
  });

  const entries = dlqData?.data || [];
  const totalPages = dlqData ? Math.ceil(dlqData.total / dlqData.limit) : 0;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === entries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(entries.map((e) => e.instance.id));
    }
  };

  const handleViewDetails = (entry: DLQEntry) => {
    setSelectedEntry(entry);
    setDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <p>Loading failed workflows...</p>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view failed workflows.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <Link href="/admin/workflows">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workflows
          </Button>
        </Link>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            Failed Workflows
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and retry failed workflow executions
          </p>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button onClick={() => setBulkRetryOpen(true)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry Selected ({selectedIds.length})
            </Button>
          )}
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {statsData && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {statsData.totalFailed}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Last 24 Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.recentFailures24h}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Oldest Failure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg">
                {statsData.oldestFailure
                  ? formatDistanceToNow(new Date(statsData.oldestFailure), { addSuffix: true })
                  : '-'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Top Failing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg truncate">
                {statsData.failedByWorkflow[0]?.workflowName || '-'}
              </div>
              {statsData.failedByWorkflow[0] && (
                <div className="text-sm text-muted-foreground">
                  {statsData.failedByWorkflow[0].count} failures
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Table>
        <TableCaption>Failed workflow executions</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectedIds.length === entries.length && entries.length > 0}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead>Workflow</TableHead>
            <TableHead>Error</TableHead>
            <TableHead>Failed At</TableHead>
            <TableHead>Retries</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry: DLQEntry) => (
            <TableRow key={entry.instance.id}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.includes(entry.instance.id)}
                  onCheckedChange={() => toggleSelect(entry.instance.id)}
                />
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">
                    {entry.definition?.name || 'Unknown Workflow'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {entry.instance.id.slice(0, 8)}...
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="max-w-[300px] truncate text-destructive">
                  {entry.failureDetails.errorMessage || 'Unknown error'}
                </div>
              </TableCell>
              <TableCell>
                {entry.failureDetails.failedAt
                  ? formatDistanceToNow(new Date(entry.failureDetails.failedAt), {
                      addSuffix: true,
                    })
                  : '-'}
              </TableCell>
              <TableCell>{entry.failureDetails.retryCount}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleViewDetails(entry)}
                    title="View Details"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => retryMutation.mutate({ instanceId: entry.instance.id })}
                    title="Retry"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => replayMutation.mutate({ instanceId: entry.instance.id })}
                    title="Replay (Fresh Start)"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => archiveMutation.mutate({ instanceId: entry.instance.id })}
                    title="Archive"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No failed workflows. All systems operational.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <div className="flex items-center gap-2">
            Page {currentPage} of {totalPages}
          </div>
          <Button
            variant="outline"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Failure Details</DialogTitle>
            <DialogDescription>
              {selectedEntry?.definition?.name || 'Workflow'} - {selectedEntry?.instance.id}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Workflow</div>
                  <div className="font-medium">
                    {selectedEntry.definition?.name || 'Unknown'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Code</div>
                  <code className="text-sm bg-muted px-1 py-0.5 rounded">
                    {selectedEntry.definition?.workflowCode || '-'}
                  </code>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Failed At</div>
                  <div>
                    {selectedEntry.failureDetails.failedAt
                      ? format(new Date(selectedEntry.failureDetails.failedAt), 'PPpp')
                      : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Retry Count</div>
                  <div>{selectedEntry.failureDetails.retryCount}</div>
                </div>
              </div>

              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="font-medium text-red-800 mb-2">Error Message</div>
                <div className="text-red-700">
                  {selectedEntry.failureDetails.errorMessage || 'No error message available'}
                </div>
              </div>

              {selectedEntry.failureDetails.errorDetails && (
                <div>
                  <div className="font-medium mb-2">Error Details</div>
                  <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
                    {JSON.stringify(selectedEntry.failureDetails.errorDetails, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    retryMutation.mutate({ instanceId: selectedEntry.instance.id });
                    setDetailsOpen(false);
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
                <Button
                  onClick={() => {
                    replayMutation.mutate({ instanceId: selectedEntry.instance.id });
                    setDetailsOpen(false);
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Replay (Fresh Start)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Retry Confirmation */}
      <AlertDialog open={bulkRetryOpen} onOpenChange={setBulkRetryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk Retry Workflows</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to retry {selectedIds.length} failed workflow(s)? This will
              attempt to re-execute them from where they failed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkRetryMutation.mutate({ instanceIds: selectedIds })}
            >
              Retry All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
