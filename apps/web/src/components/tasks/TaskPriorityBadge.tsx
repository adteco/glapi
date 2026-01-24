'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  ArrowUp,
  Minus,
  ArrowDown,
} from 'lucide-react';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

interface TaskPriorityBadgeProps {
  priority: TaskPriority;
  className?: string;
  showIcon?: boolean;
}

const priorityConfig: Record<
  TaskPriority,
  { label: string; className: string; icon: typeof AlertCircle }
> = {
  critical: {
    label: 'Critical',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: AlertCircle,
  },
  high: {
    label: 'High',
    className: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
    icon: ArrowUp,
  },
  medium: {
    label: 'Medium',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    icon: Minus,
  },
  low: {
    label: 'Low',
    className: 'bg-muted text-muted-foreground border-muted-foreground/20',
    icon: ArrowDown,
  },
};

export function TaskPriorityBadge({
  priority,
  className,
  showIcon = true,
}: TaskPriorityBadgeProps) {
  const config = priorityConfig[priority];
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
