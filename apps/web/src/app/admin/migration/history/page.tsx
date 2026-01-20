'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

// =============================================================================
// Types
// =============================================================================

type BatchStatus = 'pending' | 'validating' | 'validated' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'rolled_back';

const statusColors: Record<BatchStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  validating: 'bg-blue-100 text-blue-700',
  validated: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-700',
  rolled_back: 'bg-orange-100 text-orange-700',
};

// =============================================================================
// Import History Page
// =============================================================================

export default function ImportHistoryPage() {
  const { orgId } = useAuth();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<BatchStatus | 'all'>('all');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');

  const { data: batches, isLoading, refetch } = trpc.imports.listBatches.useQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
    limit: 50,
  });

  const { data: selectedBatch } = trpc.imports.getBatch.useQuery(selectedBatchId ?? '', {
    enabled: !!selectedBatchId,
  });

  const { data: auditTrail } = trpc.imports.getAuditTrail.useQuery(selectedBatchId ?? '', {
    enabled: !!selectedBatchId,
  });

  const { data: rollbackValidation } = trpc.imports.validateRollback.useQuery(selectedBatchId ?? '', {
    enabled: !!selectedBatchId && selectedBatch?.status === 'completed',
  });

  const cancelBatchMutation = trpc.imports.cancelBatch.useMutation({
    onSuccess: () => {
      toast.success('Batch cancelled');
      refetch();
    },
    onError: () => toast.error('Failed to cancel batch'),
  });

  const rollbackBatchMutation = trpc.imports.rollbackBatch.useMutation({
    onSuccess: () => {
      toast.success('Batch rolled back successfully');
      setShowRollbackDialog(false);
      refetch();
    },
    onError: () => toast.error('Failed to rollback batch'),
  });

  const handleCancel = (batchId: string) => {
    cancelBatchMutation.mutate(batchId);
  };

  const handleRollback = () => {
    if (!selectedBatchId) return;
    rollbackBatchMutation.mutate({
      batchId: selectedBatchId,
      reason: rollbackReason,
    });
  };

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              Please select an organization to view import history.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Import History</h1>
          <p className="text-muted-foreground">View and manage your data import batches</p>
        </div>
        <Button onClick={() => router.push('/admin/migration')}>
          New Import
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Batch List */}
        <div className="col-span-2">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Import Batches</CardTitle>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as BatchStatus | 'all')}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="validating">Validating</SelectItem>
                    <SelectItem value="validated">Validated</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="rolled_back">Rolled Back</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center py-8 text-muted-foreground">Loading...</p>
              ) : batches?.items.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No import batches found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch #</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches?.items.map((batch) => (
                      <TableRow
                        key={batch.batchId}
                        className={`cursor-pointer ${
                          selectedBatchId === batch.batchId ? 'bg-muted' : ''
                        }`}
                        onClick={() => setSelectedBatchId(batch.batchId)}
                      >
                        <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[batch.status as BatchStatus]}>
                            {batch.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{batch.totalRecords}</TableCell>
                        <TableCell>
                          {new Date(batch.startedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {['pending', 'validating', 'validated'].includes(batch.status) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancel(batch.batchId);
                              }}
                            >
                              Cancel
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Batch Details */}
        <div>
          {selectedBatch ? (
            <Card>
              <CardHeader>
                <CardTitle>Batch Details</CardTitle>
                <CardDescription>{selectedBatch.batchNumber}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge className={statusColors[selectedBatch.status as BatchStatus]}>
                      {selectedBatch.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Records</span>
                    <span>{selectedBatch.totalRecords}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valid</span>
                    <span className="text-green-600">{selectedBatch.validRecords}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Invalid</span>
                    <span className="text-red-600">{selectedBatch.invalidRecords}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Imported</span>
                    <span className="text-green-600">{selectedBatch.importedRecords}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Skipped</span>
                    <span className="text-yellow-600">{selectedBatch.skippedRecords}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Failed</span>
                    <span className="text-red-600">{selectedBatch.failedRecords}</span>
                  </div>
                  {selectedBatch.durationMs && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Duration</span>
                      <span>{(selectedBatch.durationMs / 1000).toFixed(1)}s</span>
                    </div>
                  )}
                </div>

                {selectedBatch.status === 'completed' && rollbackValidation?.canRollback && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setShowRollbackDialog(true)}
                  >
                    Rollback Import
                  </Button>
                )}

                {auditTrail && auditTrail.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Audit Trail</h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {auditTrail.map((entry: any, index: number) => (
                        <div key={index} className="text-xs flex justify-between">
                          <span className="text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                          <span>{entry.action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground">
                  Select a batch to view details
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Rollback Dialog */}
      <Dialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rollback Import</DialogTitle>
            <DialogDescription>
              This will reverse all imported records from this batch. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for rollback</label>
              <textarea
                className="w-full p-2 border rounded-md"
                rows={3}
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                placeholder="Enter the reason for rolling back this import..."
              />
            </div>
            {rollbackValidation && (
              <div className="text-sm text-muted-foreground">
                {rollbackValidation.recordCount} records will be rolled back.
                {rollbackValidation.warnings && rollbackValidation.warnings.length > 0 && (
                  <div className="mt-2 text-yellow-600">
                    Warnings:
                    <ul className="list-disc list-inside">
                      {rollbackValidation.warnings.map((warning: string, i: number) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRollbackDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRollback}
              disabled={rollbackBatchMutation.isPending}
            >
              {rollbackBatchMutation.isPending ? 'Rolling back...' : 'Confirm Rollback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
