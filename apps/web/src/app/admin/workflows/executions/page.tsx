'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Search,
  Eye,
  XCircle,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Pause,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';

type ExecutionStatus = 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled' | 'timed_out';

interface WorkflowExecution {
  id: string;
  workflowDefinitionId: string;
  status: ExecutionStatus;
  triggeredBy: string;
  triggerUserId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  errorDetails: Record<string, unknown> | null;
  retryCount: number;
  relatedDocumentType: string | null;
  relatedDocumentId: string | null;
  createdAt: string;
  definition?: {
    id: string;
    name: string;
    workflowCode: string;
  };
  stepExecutions: Array<{
    id: string;
    stepCode: string;
    stepOrder: number;
    actionType: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    durationMs: number | null;
    errorMessage: string | null;
  }>;
}

export default function ExecutionsPage() {
  const searchParams = useSearchParams();
  const initialWorkflowId = searchParams.get('workflowId') || '';

  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [workflowIdFilter, setWorkflowIdFilter] = useState(initialWorkflowId);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { orgId } = useAuth();

  // TRPC queries
  const {
    data: executionsData,
    isLoading,
    refetch,
  } = trpc.workflows.listExecutions.useQuery(
    {
      page: currentPage,
      limit: 20,
      workflowDefinitionId: workflowIdFilter || undefined,
      status: selectedStatus !== 'all' ? (selectedStatus as ExecutionStatus) : undefined,
    },
    {
      enabled: !!orgId,
      refetchInterval: 10000, // Refresh every 10 seconds to see running status changes
    }
  );

  const { data: workflowsData } = trpc.workflows.list.useQuery(
    { limit: 100 },
    { enabled: !!orgId }
  );

  const cancelMutation = trpc.workflows.cancel.useMutation({
    onSuccess: () => {
      toast.success('Workflow execution cancelled');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to cancel execution');
    },
  });

  const executions = executionsData?.data || [];
  const workflows = workflowsData?.data || [];
  const totalPages = executionsData ? Math.ceil(executionsData.total / executionsData.limit) : 0;

  const getStatusIcon = (status: ExecutionStatus) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'waiting':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case 'timed_out':
        return <Clock className="h-4 w-4 text-orange-500" />;
      default:
        return null;
    }
  };

  const getStatusBadgeVariant = (status: ExecutionStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'running':
      case 'waiting':
        return 'secondary';
      case 'failed':
      case 'timed_out':
        return 'destructive';
      case 'pending':
      case 'cancelled':
      default:
        return 'outline';
    }
  };

  const formatTriggerType = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const formatDuration = (startedAt: string | null, completedAt: string | null): string => {
    if (!startedAt) return '-';
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const durationMs = end.getTime() - start.getTime();

    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    if (durationMs < 3600000) return `${(durationMs / 60000).toFixed(1)}m`;
    return `${(durationMs / 3600000).toFixed(1)}h`;
  };

  const handleViewDetails = (execution: WorkflowExecution) => {
    setSelectedExecution(execution);
    setDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <p>Loading executions...</p>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view executions.</p>
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
          <h1 className="text-3xl font-bold">Workflow Executions</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage workflow execution history
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <Select value={workflowIdFilter} onValueChange={setWorkflowIdFilter}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="All Workflows" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Workflows</SelectItem>
            {workflows.map((workflow) => (
              <SelectItem key={workflow.id} value={workflow.id}>
                {workflow.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="timed_out">Timed Out</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results summary */}
      <div className="mb-4 text-sm text-muted-foreground">
        Showing {executions.length} of {executionsData?.total || 0} executions
      </div>

      <Table>
        <TableCaption>Workflow execution history</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Workflow</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Steps</TableHead>
            <TableHead>Retries</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {executions.map((execution: WorkflowExecution) => {
            const completedSteps = execution.stepExecutions?.filter(
              (s) => s.status === 'completed'
            ).length || 0;
            const totalSteps = execution.stepExecutions?.length || 0;

            return (
              <TableRow key={execution.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {execution.definition?.name || 'Unknown'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {execution.id.slice(0, 8)}...
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(execution.status)}
                    <Badge variant={getStatusBadgeVariant(execution.status)}>
                      {execution.status.charAt(0).toUpperCase() + execution.status.slice(1).replace('_', ' ')}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>{formatTriggerType(execution.triggeredBy)}</TableCell>
                <TableCell>
                  {execution.startedAt
                    ? formatDistanceToNow(new Date(execution.startedAt), { addSuffix: true })
                    : 'Not started'}
                </TableCell>
                <TableCell>
                  {formatDuration(execution.startedAt, execution.completedAt)}
                </TableCell>
                <TableCell>
                  <span className={completedSteps === totalSteps && totalSteps > 0 ? 'text-green-600' : ''}>
                    {completedSteps}/{totalSteps}
                  </span>
                </TableCell>
                <TableCell>{execution.retryCount}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleViewDetails(execution)}
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {(execution.status === 'running' || execution.status === 'pending') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          cancelMutation.mutate({
                            instanceId: execution.id,
                            reason: 'Cancelled by user',
                          })
                        }
                        title="Cancel"
                      >
                        <XCircle className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {executions.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                No executions found.
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

      {/* Execution Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Execution Details</DialogTitle>
            <DialogDescription>
              {selectedExecution?.definition?.name || 'Workflow'} - {selectedExecution?.id}
            </DialogDescription>
          </DialogHeader>

          {selectedExecution && (
            <div className="space-y-6">
              {/* Status Overview */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusIcon(selectedExecution.status)}
                    <Badge variant={getStatusBadgeVariant(selectedExecution.status)}>
                      {selectedExecution.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Trigger</div>
                  <div className="mt-1">{formatTriggerType(selectedExecution.triggeredBy)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Started</div>
                  <div className="mt-1">
                    {selectedExecution.startedAt
                      ? format(new Date(selectedExecution.startedAt), 'PPpp')
                      : 'Not started'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                  <div className="mt-1">
                    {selectedExecution.completedAt
                      ? format(new Date(selectedExecution.completedAt), 'PPpp')
                      : '-'}
                  </div>
                </div>
              </div>

              {/* Error Details */}
              {selectedExecution.errorMessage && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="font-medium text-red-800 mb-2">Error</div>
                  <div className="text-red-700">{selectedExecution.errorMessage}</div>
                  {selectedExecution.errorDetails && (
                    <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-x-auto">
                      {JSON.stringify(selectedExecution.errorDetails, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {/* Step Executions */}
              <div>
                <h4 className="font-medium mb-3">Step Executions</h4>
                <div className="space-y-2">
                  {selectedExecution.stepExecutions?.map((step, index) => (
                    <div
                      key={step.id}
                      className="flex items-center gap-4 p-3 border rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {step.stepOrder}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{step.stepCode}</span>
                          <Badge variant="outline" className="text-xs">
                            {step.actionType}
                          </Badge>
                        </div>
                        {step.errorMessage && (
                          <div className="text-sm text-red-600 mt-1">{step.errorMessage}</div>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {step.durationMs ? `${step.durationMs}ms` : '-'}
                      </div>
                      <Badge
                        variant={
                          step.status === 'completed'
                            ? 'default'
                            : step.status === 'failed'
                            ? 'destructive'
                            : 'outline'
                        }
                      >
                        {step.status}
                      </Badge>
                    </div>
                  ))}
                  {(!selectedExecution.stepExecutions ||
                    selectedExecution.stepExecutions.length === 0) && (
                    <div className="text-muted-foreground text-center py-4">
                      No step executions recorded
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
