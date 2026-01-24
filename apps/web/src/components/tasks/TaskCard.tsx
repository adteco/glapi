'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TaskStatusBadge, type TaskStatus } from './TaskStatusBadge';
import { TaskPriorityBadge, type TaskPriority } from './TaskPriorityBadge';
import { cn } from '@/lib/utils';
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar,
  User,
  ListTree,
} from 'lucide-react';
import type { RouterOutputs } from '@glapi/trpc';

type EntityTask = RouterOutputs['entityTasks']['get'];

interface TaskCardProps {
  task: EntityTask;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  onEdit?: (task: EntityTask) => void;
  onDelete?: (taskId: string) => void;
  onClick?: (task: EntityTask) => void;
  className?: string;
}

export function TaskCard({
  task,
  onStatusChange,
  onEdit,
  onDelete,
  onClick,
  className,
}: TaskCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Calculate subtask progress
  const subtaskCount = task.childTasks?.length ?? 0;
  const completedSubtasks =
    task.childTasks?.filter((t) => t.status === 'completed').length ?? 0;
  const subtaskProgress =
    subtaskCount > 0 ? (completedSubtasks / subtaskCount) * 100 : 0;

  const handleCheckboxChange = (checked: boolean | 'indeterminate') => {
    if (onStatusChange && checked === true) {
      onStatusChange(task.id, 'completed');
    } else if (onStatusChange && checked === false) {
      onStatusChange(task.id, 'not_started');
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const isOverdue = () => {
    if (!task.estimatedEndDate || task.status === 'completed' || task.status === 'cancelled') {
      return false;
    }
    return new Date(task.estimatedEndDate) < new Date();
  };

  return (
    <Card
      className={cn(
        'transition-all cursor-pointer hover:shadow-md',
        isHovered && 'ring-1 ring-ring',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick?.(task)}
    >
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={task.status === 'completed'}
            onCheckedChange={handleCheckboxChange}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4
                className={cn(
                  'font-medium text-sm leading-tight',
                  task.status === 'completed' && 'line-through text-muted-foreground'
                )}
              >
                {task.title}
              </h4>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(task)}>
                      <Pencil className="size-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {onStatusChange && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onStatusChange(task.id, 'not_started')}>
                        Mark as Not Started
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onStatusChange(task.id, 'in_progress')}>
                        Mark as In Progress
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onStatusChange(task.id, 'pending_review')}>
                        Mark as Pending Review
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onStatusChange(task.id, 'completed')}>
                        Mark as Completed
                      </DropdownMenuItem>
                    </>
                  )}
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(task.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {task.description}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="flex flex-wrap items-center gap-2 ml-7">
          <TaskStatusBadge status={task.status as TaskStatus} showIcon={false} />
          <TaskPriorityBadge priority={task.priority as TaskPriority} showIcon={false} />

          {task.estimatedEndDate && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs text-muted-foreground',
                isOverdue() && 'text-destructive'
              )}
            >
              <Calendar className="size-3" />
              {formatDate(task.estimatedEndDate)}
            </div>
          )}

          {task.assignee && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="size-3" />
              <span className="truncate max-w-[100px]">
                {task.assignee.name || 'Assigned'}
              </span>
            </div>
          )}

          {subtaskCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ListTree className="size-3" />
              <span>
                {completedSubtasks}/{subtaskCount}
              </span>
            </div>
          )}
        </div>

        {subtaskCount > 0 && (
          <div className="ml-7 mt-2">
            <Progress value={subtaskProgress} className="h-1" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
