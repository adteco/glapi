'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Circle,
  Clock,
  Eye,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

export type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'pending_review'
  | 'completed'
  | 'blocked'
  | 'cancelled';

interface TaskStatusBadgeProps {
  status: TaskStatus;
  className?: string;
  showIcon?: boolean;
}

const statusConfig: Record<
  TaskStatus,
  { label: string; className: string; icon: typeof Circle }
> = {
  not_started: {
    label: 'Not Started',
    className: 'bg-muted text-muted-foreground border-muted-foreground/20',
    icon: Circle,
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    icon: Clock,
  },
  pending_review: {
    label: 'Pending Review',
    className: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    icon: Eye,
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
    icon: CheckCircle,
  },
  blocked: {
    label: 'Blocked',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    icon: AlertTriangle,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: XCircle,
  },
};

export function TaskStatusBadge({
  status,
  className,
  showIcon = true,
}: TaskStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {showIcon && <Icon className="size-3" />}
      {config.label}
    </Badge>
  );
}
