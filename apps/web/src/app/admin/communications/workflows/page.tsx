'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Play,
  Pause,
  GitBranch,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import type { RouterOutputs } from '@glapi/trpc';

type CommunicationWorkflow =
  RouterOutputs['communicationWorkflows']['list']['items'][number];

const TRIGGER_TYPE_LABELS: Record<string, string> = {
  manual: 'Manual',
  entity_created: 'Entity Created',
  entity_updated: 'Entity Updated',
  event: 'Event',
  schedule: 'Schedule',
  webhook: 'Webhook',
};

const duplicateFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(1000).optional(),
});

type DuplicateFormValues = z.infer<typeof duplicateFormSchema>;

export default function CommunicationWorkflowsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteWorkflow, setDeleteWorkflow] =
    useState<CommunicationWorkflow | null>(null);
  const [duplicateWorkflow, setDuplicateWorkflow] =
    useState<CommunicationWorkflow | null>(null);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.communicationWorkflows.list.useQuery({
    search: search || undefined,
    page,
    limit: 20,
  });

  const deleteMutation = trpc.communicationWorkflows.delete.useMutation({
    onSuccess: () => {
      toast.success('Workflow deleted');
      utils.communicationWorkflows.list.invalidate();
      setDeleteWorkflow(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete workflow: ${error.message}`);
    },
  });

  const duplicateMutation = trpc.communicationWorkflows.duplicate.useMutation({
    onSuccess: (newWorkflow) => {
      toast.success('Workflow duplicated');
      utils.communicationWorkflows.list.invalidate();
      setDuplicateWorkflow(null);
      router.push(`/admin/communications/workflows/${newWorkflow.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to duplicate workflow: ${error.message}`);
    },
  });

  const activateMutation = trpc.communicationWorkflows.activate.useMutation({
    onSuccess: () => {
      toast.success('Workflow activated');
      utils.communicationWorkflows.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to activate workflow: ${error.message}`);
    },
  });

  const deactivateMutation = trpc.communicationWorkflows.deactivate.useMutation({
    onSuccess: () => {
      toast.success('Workflow deactivated');
      utils.communicationWorkflows.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to deactivate workflow: ${error.message}`);
    },
  });

  const duplicateForm = useForm<DuplicateFormValues>({
    resolver: zodResolver(duplicateFormSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const handleDuplicateOpen = (workflow: CommunicationWorkflow) => {
    setDuplicateWorkflow(workflow);
    duplicateForm.reset({
      name: `${workflow.name} (Copy)`,
      description: workflow.description ?? '',
    });
  };

  const handleDuplicateSubmit = (values: DuplicateFormValues) => {
    if (!duplicateWorkflow) return;
    duplicateMutation.mutate({
      id: duplicateWorkflow.id,
      name: values.name,
      description: values.description,
    });
  };

  const toggleActive = (workflow: CommunicationWorkflow) => {
    if (workflow.isActive) {
      deactivateMutation.mutate({ id: workflow.id });
    } else {
      activateMutation.mutate({ id: workflow.id });
    }
  };

  const getTriggerBadge = (triggerType: string) => {
    const colors: Record<string, string> = {
      manual: 'bg-gray-100 text-gray-800',
      entity_created: 'bg-green-100 text-green-800',
      entity_updated: 'bg-blue-100 text-blue-800',
      event: 'bg-purple-100 text-purple-800',
      schedule: 'bg-yellow-100 text-yellow-800',
      webhook: 'bg-orange-100 text-orange-800',
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${colors[triggerType] || colors.manual}`}
      >
        {TRIGGER_TYPE_LABELS[triggerType] || triggerType}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Communication Workflows</h1>
          <p className="text-muted-foreground">
            Automate multi-step email sequences with triggers and conditions
          </p>
        </div>
        <Link href="/admin/communications/workflows/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Workflow
          </Button>
        </Link>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search workflows..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Workflows Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : data?.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <GitBranch className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No workflows found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {search
                  ? 'Try adjusting your search'
                  : 'Get started by creating your first workflow'}
              </p>
              {!search && (
                <Link href="/admin/communications/workflows/new">
                  <Button className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Workflow
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead>Statistics</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((workflow) => (
                  <TableRow key={workflow.id}>
                    <TableCell>
                      <div>
                        <Link
                          href={`/admin/communications/workflows/${workflow.id}`}
                          className="font-medium hover:underline"
                        >
                          {workflow.name}
                        </Link>
                        {workflow.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {workflow.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getTriggerBadge(workflow.triggerType)}</TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {workflow.stepCount ?? 0} steps
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-4 text-sm">
                        <span
                          className="flex items-center gap-1"
                          title="Total executions"
                        >
                          <Activity className="h-3 w-3" />
                          {workflow.totalExecutions ?? 0}
                        </span>
                        <span
                          className="flex items-center gap-1 text-green-600"
                          title="Successful"
                        >
                          <CheckCircle className="h-3 w-3" />
                          {workflow.successfulExecutions ?? 0}
                        </span>
                        <span
                          className="flex items-center gap-1 text-red-600"
                          title="Failed"
                        >
                          <XCircle className="h-3 w-3" />
                          {workflow.failedExecutions ?? 0}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={workflow.isActive}
                        onCheckedChange={() => toggleActive(workflow)}
                        disabled={
                          activateMutation.isPending ||
                          deactivateMutation.isPending
                        }
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(workflow.updatedAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(
                                `/admin/communications/workflows/${workflow.id}`
                              )
                            }
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDuplicateOpen(workflow)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          {workflow.triggerType === 'manual' && (
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(
                                  `/admin/communications/workflows/${workflow.id}/trigger`
                                )
                              }
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Trigger
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteWorkflow(workflow)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-6 py-4">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * 20 + 1} to{' '}
              {Math.min(page * 20, data.pagination.total)} of{' '}
              {data.pagination.total} workflows
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((p) => Math.min(data.pagination.totalPages, p + 1))
                }
                disabled={page === data.pagination.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteWorkflow}
        onOpenChange={(open) => !open && setDeleteWorkflow(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteWorkflow?.name}&quot;? This
              will also stop any running executions. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteWorkflow && deleteMutation.mutate({ id: deleteWorkflow.id })
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Dialog */}
      <Dialog
        open={!!duplicateWorkflow}
        onOpenChange={(open) => !open && setDuplicateWorkflow(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Workflow</DialogTitle>
            <DialogDescription>
              Create a copy of &quot;{duplicateWorkflow?.name}&quot; with a new name.
            </DialogDescription>
          </DialogHeader>
          <Form {...duplicateForm}>
            <form
              onSubmit={duplicateForm.handleSubmit(handleDuplicateSubmit)}
              className="space-y-4"
            >
              <FormField
                control={duplicateForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={duplicateForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDuplicateWorkflow(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={duplicateMutation.isPending}>
                  {duplicateMutation.isPending ? 'Duplicating...' : 'Duplicate'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
