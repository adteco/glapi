'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TaskStatusBadge, type TaskStatus } from './TaskStatusBadge';
import { TaskPriorityBadge, type TaskPriority } from './TaskPriorityBadge';
import { TaskForm } from './TaskForm';
import { TaskDetail } from './TaskDetail';
import { cn } from '@/lib/utils';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
  ListChecks,
  AlertTriangle,
  Calendar,
  User,
} from 'lucide-react';
import type { RouterOutputs } from '@glapi/trpc';

type EntityTask = RouterOutputs['entityTasks']['list']['data'][number];
type EntityType = 'project' | 'customer' | 'employee' | 'vendor' | 'lead' | 'prospect' | 'contact';

interface TaskListProps {
  entityType: EntityType;
  entityId: string;
  showFilters?: boolean;
  allowCreate?: boolean;
}

export function TaskList({
  entityType,
  entityId,
  showFilters = true,
  allowCreate = true,
}: TaskListProps) {
  const utils = trpc.useUtils();

  // State
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string | 'all'>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTask, setEditingTask] = useState<EntityTask | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  const limit = 20;

  // Fetch tasks
  const { data, isLoading, error } = trpc.entityTasks.list.useQuery({
    entityType,
    entityId,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    priority: priorityFilter !== 'all' ? priorityFilter : undefined,
    assigneeId: assigneeFilter !== 'all' ? assigneeFilter : undefined,
    page,
    limit,
  });

  // Fetch employees for filter
  const { data: employeesData } = trpc.employees.list.useQuery({});
  const employees = employeesData?.data ?? [];

  // Delete mutation
  const deleteMutation = trpc.entityTasks.delete.useMutation({
    onSuccess: () => {
      utils.entityTasks.list.invalidate();
    },
  });

  // Status update mutation
  const updateStatusMutation = trpc.entityTasks.updateStatus.useMutation({
    onSuccess: () => {
      utils.entityTasks.list.invalidate();
    },
  });

  // Bulk status update mutation
  const bulkUpdateMutation = trpc.entityTasks.bulkUpdateStatus.useMutation({
    onSuccess: () => {
      utils.entityTasks.list.invalidate();
      setSelectedTasks(new Set());
    },
  });

  const tasks = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const isOverdue = (task: EntityTask) => {
    if (!task.estimatedEndDate || task.status === 'completed' || task.status === 'cancelled') {
      return false;
    }
    return new Date(task.estimatedEndDate) < new Date();
  };

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    updateStatusMutation.mutate({ id: taskId, status });
  };

  const handleDelete = (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      deleteMutation.mutate({ id: taskId });
    }
  };

  const handleBulkStatusChange = (status: TaskStatus) => {
    if (selectedTasks.size === 0) return;
    bulkUpdateMutation.mutate({
      ids: Array.from(selectedTasks),
      status,
    });
  };

  const toggleTaskSelection = (taskId: string) => {
    const newSelection = new Set(selectedTasks);
    if (newSelection.has(taskId)) {
      newSelection.delete(taskId);
    } else {
      newSelection.add(taskId);
    }
    setSelectedTasks(newSelection);
  };

  const toggleAllTasks = () => {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map((t) => t.id)));
    }
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setAssigneeFilter('all');
    setPage(1);
  };

  const hasActiveFilters =
    statusFilter !== 'all' || priorityFilter !== 'all' || assigneeFilter !== 'all';

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-destructive bg-destructive/10 rounded-lg">
        <AlertTriangle className="size-5" />
        <span>Failed to load tasks</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filters and actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val as TaskStatus | 'all');
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={priorityFilter}
              onValueChange={(val) => {
                setPriorityFilter(val as TaskPriority | 'all');
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={assigneeFilter}
              onValueChange={(val) => {
                setAssigneeFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {selectedTasks.size > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ListChecks className="size-4 mr-2" />
                  Bulk Actions ({selectedTasks.size})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleBulkStatusChange('in_progress')}>
                  Mark In Progress
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkStatusChange('completed')}>
                  Mark Completed
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleBulkStatusChange('cancelled')}>
                  Mark Cancelled
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {allowCreate && (
            <Button onClick={() => setIsCreating(true)} className="gap-2">
              <Plus className="size-4" />
              Add Task
            </Button>
          )}
        </div>
      </div>

      {/* Tasks Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 border rounded-lg border-dashed">
          <ListChecks className="size-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No tasks found</h3>
          <p className="text-muted-foreground text-sm mb-4">
            {hasActiveFilters
              ? 'Try adjusting your filters'
              : 'Create your first task to get started'}
          </p>
          {allowCreate && !hasActiveFilters && (
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="size-4 mr-2" />
              Add Task
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedTasks.size === tasks.length && tasks.length > 0}
                      onCheckedChange={toggleAllTasks}
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="w-[100px]">Priority</TableHead>
                  <TableHead className="w-[150px]">Assignee</TableHead>
                  <TableHead className="w-[100px]">Due Date</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow
                    key={task.id}
                    className={cn(
                      'cursor-pointer',
                      selectedTasks.has(task.id) && 'bg-muted/50'
                    )}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedTasks.has(task.id)}
                        onCheckedChange={() => toggleTaskSelection(task.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div
                        className={cn(
                          'font-medium',
                          task.status === 'completed' && 'line-through text-muted-foreground'
                        )}
                      >
                        {task.title}
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {task.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <TaskStatusBadge status={task.status as TaskStatus} showIcon={false} />
                    </TableCell>
                    <TableCell>
                      <TaskPriorityBadge priority={task.priority as TaskPriority} showIcon={false} />
                    </TableCell>
                    <TableCell>
                      {task.assignee ? (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="size-3 text-muted-foreground" />
                          <span className="truncate max-w-[120px]">
                            {task.assignee.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div
                        className={cn(
                          'flex items-center gap-1 text-sm',
                          isOverdue(task) && 'text-destructive'
                        )}
                      >
                        {task.estimatedEndDate && (
                          <>
                            <Calendar className="size-3" />
                            {formatDate(task.estimatedEndDate)}
                          </>
                        )}
                        {!task.estimatedEndDate && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedTaskId(task.id)}>
                            <Eye className="size-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingTask(task)}>
                            <Pencil className="size-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'in_progress')}>
                            Mark In Progress
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'completed')}>
                            Mark Completed
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(task.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} tasks
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Task Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>Add a new task to this {entityType}</DialogDescription>
          </DialogHeader>
          <TaskForm
            entityType={entityType}
            entityId={entityId}
            onSuccess={() => {
              setIsCreating(false);
              utils.entityTasks.list.invalidate();
            }}
            onCancel={() => setIsCreating(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Update task details</DialogDescription>
          </DialogHeader>
          {editingTask && (
            <TaskForm
              entityType={entityType}
              entityId={entityId}
              task={editingTask as RouterOutputs['entityTasks']['get']}
              onSuccess={() => {
                setEditingTask(null);
                utils.entityTasks.list.invalidate();
              }}
              onCancel={() => setEditingTask(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Task Detail Sheet */}
      <Sheet open={!!selectedTaskId} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
        <SheetContent className="w-full sm:max-w-xl p-0 overflow-y-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>Task Details</SheetTitle>
          </SheetHeader>
          {selectedTaskId && (
            <TaskDetail
              taskId={selectedTaskId}
              onClose={() => setSelectedTaskId(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
