'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

interface KpiCardProps {
  id: string;
  title: string;
  value: number;
  formattedValue: string;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  changeDirection?: 'up' | 'down' | 'flat';
  status?: 'good' | 'warning' | 'critical' | 'neutral';
  unit?: string;
  sparklineData?: number[];
  isLoading?: boolean;
  className?: string;
}

const statusIcons = {
  good: CheckCircle,
  warning: AlertTriangle,
  critical: AlertCircle,
  neutral: null,
};

const statusColors = {
  good: 'text-green-600',
  warning: 'text-amber-600',
  critical: 'text-red-600',
  neutral: 'text-muted-foreground',
};

const statusBgColors = {
  good: 'bg-green-50 dark:bg-green-950',
  warning: 'bg-amber-50 dark:bg-amber-950',
  critical: 'bg-red-50 dark:bg-red-950',
  neutral: 'bg-muted',
};

export function KpiCard({
  title,
  value,
  formattedValue,
  previousValue,
  change,
  changePercent,
  changeDirection,
  status = 'neutral',
  unit,
  isLoading,
  className,
}: KpiCardProps) {
  const StatusIcon = statusIcons[status];
  const TrendIcon =
    changeDirection === 'up'
      ? TrendingUp
      : changeDirection === 'down'
        ? TrendingDown
        : Minus;

  const trendColorClass =
    changeDirection === 'up'
      ? 'text-green-600'
      : changeDirection === 'down'
        ? 'text-red-600'
        : 'text-muted-foreground';

  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="h-4 w-24 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-8 w-32 bg-muted rounded mb-2" />
          <div className="h-4 w-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(statusBgColors[status], className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {StatusIcon && (
          <StatusIcon className={cn('h-4 w-4', statusColors[status])} />
        )}
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold', statusColors[status])}>
          {formattedValue}
        </div>
        {changePercent !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            <TrendIcon className={cn('h-4 w-4', trendColorClass)} />
            <span className={cn('text-xs font-medium', trendColorClass)}>
              {changePercent >= 0 ? '+' : ''}
              {changePercent.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">
              {previousValue !== undefined
                ? `from ${formatCompactValue(previousValue, unit)}`
                : 'vs prior period'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatCompactValue(value: number, unit?: string): string {
  if (unit === 'USD' || unit === '$') {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  }
  if (unit === '%') {
    return `${value.toFixed(1)}%`;
  }
  return value.toFixed(2);
}

interface KpiGridProps {
  cards: KpiCardProps[];
  isLoading?: boolean;
  columns?: 2 | 3 | 4 | 5;
}

export function KpiGrid({ cards, isLoading, columns = 4 }: KpiGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  };

  if (isLoading) {
    return (
      <div className={cn('grid gap-4', gridCols[columns])}>
        {Array.from({ length: columns }).map((_, i) => (
          <KpiCard
            key={i}
            id={`loading-${i}`}
            title=""
            value={0}
            formattedValue=""
            isLoading
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid gap-4', gridCols[columns])}>
      {cards.map((card) => (
        <KpiCard key={card.id} {...card} />
      ))}
    </div>
  );
}
