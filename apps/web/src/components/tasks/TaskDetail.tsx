'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
import { TaskStatusBadge, type TaskStatus } from './TaskStatusBadge';
import { TaskPriorityBadge, type TaskPriority } from './TaskPriorityBadge';
import { TaskForm } from './TaskForm';
import { TaskCard } from './TaskCard';
import { cn } from '@/lib/utils';
import {
  X,
  Pencil,
  Trash2,
  Plus,
  Calendar,
  Clock,
  DollarSign,
  User,
  Users,
  AlertTriangle,
  ListTree,
} from 'lucide-react';
import type { RouterOutputs } from '@glapi/trpc';

type EntityTask = RouterOutputs['entityTasks']['get'];

interface TaskDetailProps {
  taskId: string;
  onClose?: () => void;
}

export function TaskDetail({ taskId, onClose }: TaskDetailProps) {
  const utils = trpc.useUtils();
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch task details
  const { data: task, isLoading, error } = trpc.entityTasks.get.useQuery({ id: taskId });

  // Delete mutation
  const deleteMutation = trpc.entityTasks.delete.useMutation({
    onSuccess: () => {
      utils.entityTasks.list.invalidate();
      utils.entityTasks.getByEntity.invalidate();
      onClose?.();
    },
  });

  // Status update mutation
  const updateStatusMutation = trpc.entityTasks.updateStatus.useMutation({
    onSuccess: () => {
      utils.entityTasks.get.invalidate({ id: taskId });
      utils.entityTasks.list.invalidate();
    },
  });

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string | Date | null | undefined) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleStatusChange = (newTaskId: string, status: TaskStatus) => {
    updateStatusMutation.mutate({ id: newTaskId, status });
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id: taskId, deleteSubtasks: true });
    setShowDeleteDialog(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-8" />
        </div>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-5" />
          <span>Failed to load task details</span>
        </div>
        <Button variant="outline" onClick={onClose} className="mt-4">
          Close
        </Button>
      </div>
    );
  }

  // Calculate subtask stats
  const subtaskCount = task.childTasks?.length ?? 0;
  const completedSubtasks =
    task.childTasks?.filter((t) => t.status === 'completed').length ?? 0;

  if (isEditing) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Edit Task</h2>
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
            <X className="size-4" />
          </Button>
        </div>
        <TaskForm
          entityType={task.entityType as 'project' | 'customer' | 'employee' | 'vendor' | 'lead' | 'prospect' | 'contact'}
          entityId={task.entityId}
          task={task}
          onSuccess={() => setIsEditing(false)}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b">
        <div className="flex-1 min-w-0 pr-4">
          <h2
            className={cn(
              'text-lg font-semibold',
              task.status === 'completed' && 'line-through text-muted-foreground'
            )}
          >
            {task.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <TaskStatusBadge status={task.status as TaskStatus} />
            <TaskPriorityBadge priority={task.priority as TaskPriority} />
            {task.parentTask && (
              <Badge variant="outline" className="gap-1">
                <ListTree className="size-3" />
                Subtask
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Description */}
        {task.description && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
            <p className="text-sm whitespace-pre-wrap">{task.description}</p>
          </div>
        )}

        {/* Blocking Reason */}
        {task.status === 'blocked' && task.blockingReason && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium mb-1">
              <AlertTriangle className="size-4" />
              Blocked
            </div>
            <p className="text-sm text-muted-foreground">{task.blockingReason}</p>
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Assignment */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <div>
                <span className="text-xs text-muted-foreground">Assignee</span>
                <p className="text-sm">
                  {task.assignee?.name || 'Unassigned'}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Reviewer</span>
                <p className="text-sm">
                  {task.reviewer?.name || 'No reviewer'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <div>
                <span className="text-xs text-muted-foreground">Start Date</span>
                <p className="text-sm">{formatDate(task.estimatedStartDate) ?? 'Not set'}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Due Date</span>
                <p className="text-sm">{formatDate(task.estimatedEndDate) ?? 'Not set'}</p>
              </div>
              {task.completedAt && (
                <div>
                  <span className="text-xs text-muted-foreground">Completed</span>
                  <p className="text-sm">{formatDateTime(task.completedAt)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Time & Budget */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                Time
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-muted-foreground">Estimated</span>
                  <p className="text-sm">{task.estimatedHours ? `${task.estimatedHours}h` : 'Not set'}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Actual</span>
                  <p className="text-sm">{task.actualHours ? `${task.actualHours}h` : '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Billing */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="size-4 text-muted-foreground" />
                Billing
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <div>
                <span className="text-xs text-muted-foreground">Billable</span>
                <p className="text-sm">{task.isBillable ? 'Yes' : 'No'}</p>
              </div>
              {task.isBillable && (
                <>
                  <div>
                    <span className="text-xs text-muted-foreground">Rate</span>
                    <p className="text-sm">
                      {task.billingRate ? `$${task.billingRate}/hr` : 'Default rate'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-muted-foreground">Budget</span>
                      <p className="text-sm">
                        {task.estimatedBudget ? `$${task.estimatedBudget}` : 'Not set'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Actual</span>
                      <p className="text-sm">{task.actualCost ? `$${task.actualCost}` : '-'}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Custom Fields */}
        {task.customFieldValues && Object.keys(task.customFieldValues).length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium">Custom Fields</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(task.customFieldValues as Record<string, unknown>).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-xs text-muted-foreground capitalize">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <p className="text-sm">{String(value ?? '-')}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subtasks */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <ListTree className="size-4 text-muted-foreground" />
              Subtasks
              {subtaskCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {completedSubtasks}/{subtaskCount}
                </Badge>
              )}
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddingSubtask(true)}
              className="gap-1"
            >
              <Plus className="size-4" />
              Add Subtask
            </Button>
          </div>

          {subtaskCount > 0 ? (
            <div className="space-y-2">
              {task.childTasks?.map((subtask) => (
                <TaskCard
                  key={subtask.id}
                  task={subtask as EntityTask}
                  onStatusChange={handleStatusChange}
                  className="border-l-4 border-l-muted"
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg border-dashed">
              No subtasks yet
            </div>
          )}
        </div>

        {/* Activity/History Placeholder */}
        <div>
          <h3 className="text-sm font-medium mb-3">Activity</h3>
          <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg border-dashed">
            Activity history coming soon
          </div>
        </div>

        {/* Metadata */}
        <div className="pt-4 border-t text-xs text-muted-foreground space-y-1">
          <p>Created: {formatDateTime(task.createdAt)}</p>
          <p>Updated: {formatDateTime(task.updatedAt)}</p>
        </div>
      </div>

      {/* Add Subtask Dialog */}
      <Dialog open={isAddingSubtask} onOpenChange={setIsAddingSubtask}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Subtask</DialogTitle>
            <DialogDescription>
              Create a subtask for "{task.title}"
            </DialogDescription>
          </DialogHeader>
          <TaskForm
            entityType={task.entityType as 'project' | 'customer' | 'employee' | 'vendor' | 'lead' | 'prospect' | 'contact'}
            entityId={task.entityId}
            parentTaskId={task.id}
            onSuccess={() => {
              setIsAddingSubtask(false);
              utils.entityTasks.get.invalidate({ id: taskId });
            }}
            onCancel={() => setIsAddingSubtask(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
              {subtaskCount > 0 && (
                <span className="block mt-2 font-medium text-foreground">
                  This will also delete {subtaskCount} subtask{subtaskCount > 1 ? 's' : ''}.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
