'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DataPoint {
  date: string;
  value: number;
  periodId?: string;
}

interface TrendChartProps {
  title: string;
  description?: string;
  dataPoints: DataPoint[];
  trend: 'increasing' | 'decreasing' | 'stable';
  trendStrength?: number;
  chartType?: 'line' | 'area' | 'bar';
  valueFormatter?: (value: number) => string;
  color?: string;
  showTrendBadge?: boolean;
  isLoading?: boolean;
  className?: string;
}

const defaultFormatter = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const shortFormatter = (value: number) => {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

const trendIcons = {
  increasing: TrendingUp,
  decreasing: TrendingDown,
  stable: Minus,
};

const trendColors = {
  increasing: 'text-green-600',
  decreasing: 'text-red-600',
  stable: 'text-muted-foreground',
};

const trendBadgeColors = {
  increasing: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  decreasing: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  stable: 'bg-muted text-muted-foreground',
};

export function TrendChart({
  title,
  description,
  dataPoints,
  trend,
  trendStrength,
  chartType = 'line',
  valueFormatter = defaultFormatter,
  color = '#3b82f6',
  showTrendBadge = true,
  isLoading,
  className,
}: TrendChartProps) {
  const TrendIcon = trendIcons[trend];

  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader>
          <div className="h-5 w-40 bg-muted rounded" />
          <div className="h-4 w-60 bg-muted rounded mt-2" />
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-lg font-bold" style={{ color }}>
            {valueFormatter(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    const commonProps = {
      data: dataPoints,
      margin: { top: 5, right: 10, left: 10, bottom: 5 },
    };

    const axisProps = {
      axisLine: false,
      tickLine: false,
      tick: { fontSize: 12 },
    };

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="date" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={shortFormatter} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={color}
              fillOpacity={0.1}
              strokeWidth={2}
            />
          </AreaChart>
        );
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="date" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={shortFormatter} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        );
      default:
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="date" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={shortFormatter} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        );
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {showTrendBadge && (
          <Badge
            variant="secondary"
            className={cn('gap-1', trendBadgeColors[trend])}
          >
            <TrendIcon className="h-3 w-3" />
            {trend.charAt(0).toUpperCase() + trend.slice(1)}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface MultiTrendChartProps {
  title: string;
  description?: string;
  series: Array<{
    id: string;
    name: string;
    dataPoints: DataPoint[];
    color: string;
  }>;
  valueFormatter?: (value: number) => string;
  isLoading?: boolean;
  className?: string;
}

export function MultiTrendChart({
  title,
  description,
  series,
  valueFormatter = defaultFormatter,
  isLoading,
  className,
}: MultiTrendChartProps) {
  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader>
          <div className="h-5 w-40 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  // Merge all data points into a single array with series values
  const allDates = new Set<string>();
  series.forEach((s) => s.dataPoints.forEach((dp) => allDates.add(dp.date)));
  const sortedDates = Array.from(allDates).sort();

  const chartData = sortedDates.map((date) => {
    const point: any = { date };
    series.forEach((s) => {
      const dp = s.dataPoints.find((p) => p.date === date);
      point[s.id] = dp?.value ?? null;
    });
    return point;
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm">{entry.name}:</span>
              <span className="text-sm font-medium">
                {valueFormatter(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={shortFormatter}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value: string) => (
                  <span className="text-sm text-foreground">{value}</span>
                )}
              />
              {series.map((s) => (
                <Line
                  key={s.id}
                  type="monotone"
                  dataKey={s.id}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
