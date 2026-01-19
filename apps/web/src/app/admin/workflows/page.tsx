'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Plus,
  Search,
  MoreHorizontal,
  Play,
  Pause,
  Archive,
  Copy,
  Trash2,
  Edit,
  Clock,
  Webhook,
  Calendar,
  MousePointer,
  Zap,
  History,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';
type TriggerType = 'event' | 'schedule' | 'webhook' | 'manual' | 'api';

interface WorkflowDefinition {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  workflowCode: string;
  version: number;
  status: WorkflowStatus;
  triggerType: TriggerType;
  triggerConfig: Record<string, unknown>;
  category: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  steps: Array<{
    id: string;
    stepCode: string;
    stepName: string;
  }>;
}

export default function WorkflowsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedTriggerType, setSelectedTriggerType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowDefinition | null>(null);
  const { orgId } = useAuth();
  const router = useRouter();

  // TRPC queries
  const {
    data: workflowsData,
    isLoading,
    refetch: refetchWorkflows,
  } = trpc.workflows.list.useQuery(
    {
      search: searchQuery || undefined,
      status: selectedStatus !== 'all' ? (selectedStatus as WorkflowStatus) : undefined,
      triggerType: selectedTriggerType !== 'all' ? (selectedTriggerType as TriggerType) : undefined,
      page: currentPage,
      limit: 20,
    },
    {
      enabled: !!orgId,
    }
  );

  const { data: statsData } = trpc.workflows.getExecutionStats.useQuery(undefined, {
    enabled: !!orgId,
  });

  const { data: dlqStats } = trpc.workflows.getDlqStats.useQuery(undefined, {
    enabled: !!orgId,
  });

  // Mutations
  const publishMutation = trpc.workflows.publish.useMutation({
    onSuccess: () => {
      toast.success('Workflow published successfully');
      refetchWorkflows();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to publish workflow');
    },
  });

  const pauseMutation = trpc.workflows.pause.useMutation({
    onSuccess: () => {
      toast.success('Workflow paused');
      refetchWorkflows();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to pause workflow');
    },
  });

  const resumeMutation = trpc.workflows.resume.useMutation({
    onSuccess: () => {
      toast.success('Workflow resumed');
      refetchWorkflows();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to resume workflow');
    },
  });

  const archiveMutation = trpc.workflows.archive.useMutation({
    onSuccess: () => {
      toast.success('Workflow archived');
      refetchWorkflows();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to archive workflow');
    },
  });

  const deleteMutation = trpc.workflows.delete.useMutation({
    onSuccess: () => {
      toast.success('Workflow deleted');
      setDeleteDialogOpen(false);
      setWorkflowToDelete(null);
      refetchWorkflows();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete workflow');
    },
  });

  const duplicateMutation = trpc.workflows.duplicate.useMutation({
    onSuccess: (data) => {
      toast.success('Workflow duplicated');
      router.push(`/admin/workflows/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to duplicate workflow');
    },
  });

  const workflows = workflowsData?.data || [];
  const totalPages = workflowsData ? Math.ceil(workflowsData.total / workflowsData.limit) : 0;

  const getStatusBadgeVariant = (status: WorkflowStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'active':
        return 'default';
      case 'paused':
        return 'secondary';
      case 'archived':
        return 'outline';
      case 'draft':
      default:
        return 'outline';
    }
  };

  const getTriggerIcon = (triggerType: TriggerType) => {
    switch (triggerType) {
      case 'event':
        return <Zap className="h-4 w-4" />;
      case 'schedule':
        return <Calendar className="h-4 w-4" />;
      case 'webhook':
        return <Webhook className="h-4 w-4" />;
      case 'manual':
        return <MousePointer className="h-4 w-4" />;
      case 'api':
        return <Clock className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const formatTriggerType = (type: TriggerType): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const handleDelete = (workflow: WorkflowDefinition) => {
    setWorkflowToDelete(workflow);
    setDeleteDialogOpen(true);
  };

  const handleDuplicate = (workflow: WorkflowDefinition) => {
    const newCode = `${workflow.workflowCode}_copy_${Date.now()}`;
    duplicateMutation.mutate({ id: workflow.id, newCode });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <p>Loading workflows...</p>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view workflows.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Workflow Automation</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage automated workflows for your organization
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/admin/workflows/executions')}>
            <History className="mr-2 h-4 w-4" />
            Executions
          </Button>
          {dlqStats && dlqStats.totalFailed > 0 && (
            <Button variant="outline" onClick={() => router.push('/admin/workflows/failed')}>
              <AlertTriangle className="mr-2 h-4 w-4 text-destructive" />
              Failed ({dlqStats.totalFailed})
            </Button>
          )}
          <Button onClick={() => router.push('/admin/workflows/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Workflow
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {statsData && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Total Executions</div>
            <div className="text-2xl font-bold">{statsData.total}</div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Completed</div>
            <div className="text-2xl font-bold text-green-600">{statsData.completed}</div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Running</div>
            <div className="text-2xl font-bold text-blue-600">{statsData.running}</div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Failed</div>
            <div className="text-2xl font-bold text-red-600">{statsData.failed}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedTriggerType} onValueChange={setSelectedTriggerType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Triggers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Triggers</SelectItem>
            <SelectItem value="event">Event</SelectItem>
            <SelectItem value="schedule">Schedule</SelectItem>
            <SelectItem value="webhook">Webhook</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="api">API</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results summary */}
      <div className="mb-4 text-sm text-muted-foreground">
        Showing {workflows.length} of {workflowsData?.total || 0} workflows
      </div>

      <Table>
        <TableCaption>A list of your workflow definitions.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead>Steps</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workflows.map((workflow: WorkflowDefinition) => (
            <TableRow key={workflow.id}>
              <TableCell>
                <Link
                  href={`/admin/workflows/${workflow.id}`}
                  className="font-medium hover:underline"
                >
                  {workflow.name}
                </Link>
                {workflow.description && (
                  <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                    {workflow.description}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <code className="text-sm bg-muted px-1 py-0.5 rounded">{workflow.workflowCode}</code>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getTriggerIcon(workflow.triggerType)}
                  <span>{formatTriggerType(workflow.triggerType)}</span>
                </div>
              </TableCell>
              <TableCell>{workflow.steps?.length || 0}</TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(workflow.status)}>
                  {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
                </Badge>
              </TableCell>
              <TableCell>v{workflow.version}</TableCell>
              <TableCell>
                {formatDistanceToNow(new Date(workflow.updatedAt), { addSuffix: true })}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => router.push(`/admin/workflows/${workflow.id}`)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(workflow)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {workflow.status === 'draft' && (
                      <DropdownMenuItem
                        onClick={() => publishMutation.mutate({ id: workflow.id })}
                        disabled={!workflow.steps || workflow.steps.length === 0}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Publish
                      </DropdownMenuItem>
                    )}
                    {workflow.status === 'active' && (
                      <DropdownMenuItem onClick={() => pauseMutation.mutate({ id: workflow.id })}>
                        <Pause className="mr-2 h-4 w-4" />
                        Pause
                      </DropdownMenuItem>
                    )}
                    {workflow.status === 'paused' && (
                      <DropdownMenuItem onClick={() => resumeMutation.mutate({ id: workflow.id })}>
                        <Play className="mr-2 h-4 w-4" />
                        Resume
                      </DropdownMenuItem>
                    )}
                    {workflow.status !== 'archived' && (
                      <DropdownMenuItem onClick={() => archiveMutation.mutate({ id: workflow.id })}>
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDelete(workflow)}
                      className="text-destructive"
                      disabled={workflow.status === 'active'}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {workflows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                No workflows found. Create your first workflow to get started.
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the workflow &quot;{workflowToDelete?.name}&quot;. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => workflowToDelete && deleteMutation.mutate({ id: workflowToDelete.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
