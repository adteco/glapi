'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';

interface SegmentData {
  id: string;
  name: string;
  code?: string;
  value: number;
  percentOfTotal: number;
}

interface SegmentBreakdownProps {
  title: string;
  description?: string;
  segments: SegmentData[];
  total: number;
  displayMode?: 'bar' | 'pie';
  valueFormatter?: (value: number) => string;
  isLoading?: boolean;
  className?: string;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#f97316', // orange
];

const defaultFormatter = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export function SegmentBreakdown({
  title,
  description,
  segments,
  total,
  displayMode = 'bar',
  valueFormatter = defaultFormatter,
  isLoading,
  className,
}: SegmentBreakdownProps) {
  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader>
          <div className="h-5 w-40 bg-muted rounded" />
          <div className="h-4 w-60 bg-muted rounded mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-2 w-full bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (segments.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && (
            <CardDescription>{description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {displayMode === 'pie' ? (
          <PieChartDisplay
            segments={segments}
            valueFormatter={valueFormatter}
          />
        ) : (
          <BarChartDisplay
            segments={segments}
            valueFormatter={valueFormatter}
          />
        )}
        <div className="mt-4 pt-4 border-t">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Total</span>
            <span className="font-bold">{valueFormatter(total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BarChartDisplay({
  segments,
  valueFormatter,
}: {
  segments: SegmentData[];
  valueFormatter: (value: number) => string;
}) {
  return (
    <div className="space-y-4">
      {segments.map((segment, index) => (
        <div key={segment.id} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="font-medium truncate max-w-[60%]">
              {segment.name}
              {segment.code && (
                <span className="text-muted-foreground ml-1">({segment.code})</span>
              )}
            </span>
            <span className="text-muted-foreground">
              {valueFormatter(segment.value)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Progress
              value={segment.percentOfTotal}
              className="h-2 flex-1"
              style={
                {
                  '--progress-foreground': COLORS[index % COLORS.length],
                } as React.CSSProperties
              }
            />
            <span className="text-xs text-muted-foreground w-12 text-right">
              {segment.percentOfTotal.toFixed(1)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PieChartDisplay({
  segments,
  valueFormatter,
}: {
  segments: SegmentData[];
  valueFormatter: (value: number) => string;
}) {
  const data = segments.map((s, i) => ({
    name: s.name,
    value: s.value,
    color: COLORS[i % COLORS.length],
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{item.name}</p>
          <p className="text-muted-foreground">{valueFormatter(item.value)}</p>
          <p className="text-xs text-muted-foreground">
            {((item.value / data.reduce((a, b) => a + b.value, 0)) * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            formatter={(value: string) => (
              <span className="text-sm text-foreground">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface SegmentComparisonProps {
  title: string;
  segments: Array<{
    id: string;
    name: string;
    currentValue: number;
    previousValue: number;
    change: number;
    changePercent: number;
  }>;
  valueFormatter?: (value: number) => string;
  isLoading?: boolean;
  className?: string;
}

export function SegmentComparison({
  title,
  segments,
  valueFormatter = defaultFormatter,
  isLoading,
  className,
}: SegmentComparisonProps) {
  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader>
          <div className="h-5 w-40 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {segments.map((segment) => (
            <div
              key={segment.id}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <span className="font-medium truncate max-w-[40%]">{segment.name}</span>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">
                  {valueFormatter(segment.currentValue)}
                </span>
                <span
                  className={cn(
                    'text-sm font-medium w-16 text-right',
                    segment.changePercent > 0
                      ? 'text-green-600'
                      : segment.changePercent < 0
                        ? 'text-red-600'
                        : 'text-muted-foreground'
                  )}
                >
                  {segment.changePercent > 0 ? '+' : ''}
                  {segment.changePercent.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
