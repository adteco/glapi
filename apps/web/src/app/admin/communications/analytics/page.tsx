'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import {
  Send,
  CheckCircle,
  XCircle,
  Eye,
  MousePointerClick,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const PERIOD_OPTIONS = [
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
];

type Period =
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'this_month'
  | 'last_month'
  | 'this_year';

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: number;
  loading?: boolean;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  loading,
}: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-4 w-32" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {subtitle}
              {trend !== undefined && (
                <span
                  className={`flex items-center gap-1 ${
                    trend > 0
                      ? 'text-green-600'
                      : trend < 0
                        ? 'text-red-600'
                        : 'text-muted-foreground'
                  }`}
                >
                  {trend > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : trend < 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                  {Math.abs(trend).toFixed(1)}%
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface BreakdownItemProps {
  label: string;
  value: number;
  total: number;
  color: string;
}

function BreakdownItem({ label, value, total, color }: BreakdownItemProps) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="capitalize">{label.replace('_', ' ')}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
    </div>
  );
}

export default function CommunicationAnalyticsPage() {
  const [period, setPeriod] = useState<Period>('last_30_days');

  const { data: stats, isLoading: loadingStats } =
    trpc.communicationEvents.getStats.useQuery({
      period,
    });

  const { data: analytics, isLoading: loadingAnalytics } =
    trpc.communicationEvents.getAnalytics.useQuery({
      period,
    });

  const isLoading = loadingStats || loadingAnalytics;

  // Calculate rates
  const deliveryRate =
    stats && stats.totalSent > 0
      ? ((stats.totalDelivered / stats.totalSent) * 100).toFixed(1)
      : '0';

  const bounceRate =
    stats && stats.totalSent > 0
      ? ((stats.totalBounced / stats.totalSent) * 100).toFixed(1)
      : '0';

  const openRate =
    stats && stats.totalDelivered > 0
      ? ((stats.totalOpened / stats.totalDelivered) * 100).toFixed(1)
      : '0';

  const clickRate =
    stats && stats.totalOpened > 0
      ? ((stats.totalClicked / stats.totalOpened) * 100).toFixed(1)
      : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Communication Analytics</h1>
          <p className="text-muted-foreground">
            Track email delivery performance and engagement metrics
          </p>
        </div>
        <Select
          value={period}
          onValueChange={(value) => setPeriod(value as Period)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Overview Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Sent"
          value={stats?.totalSent ?? 0}
          subtitle="Emails sent"
          icon={<Send className="h-4 w-4 text-muted-foreground" />}
          loading={isLoading}
        />
        <MetricCard
          title="Delivered"
          value={stats?.totalDelivered ?? 0}
          subtitle={`${deliveryRate}% delivery rate`}
          icon={<CheckCircle className="h-4 w-4 text-green-500" />}
          loading={isLoading}
        />
        <MetricCard
          title="Opened"
          value={stats?.totalOpened ?? 0}
          subtitle={`${openRate}% open rate`}
          icon={<Eye className="h-4 w-4 text-blue-500" />}
          loading={isLoading}
        />
        <MetricCard
          title="Clicked"
          value={stats?.totalClicked ?? 0}
          subtitle={`${clickRate}% click rate`}
          icon={<MousePointerClick className="h-4 w-4 text-purple-500" />}
          loading={isLoading}
        />
      </div>

      {/* Delivery Issues */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Bounced"
          value={stats?.totalBounced ?? 0}
          subtitle={`${bounceRate}% bounce rate`}
          icon={<XCircle className="h-4 w-4 text-red-500" />}
          loading={isLoading}
        />
        <MetricCard
          title="Complaints"
          value={stats?.totalComplaints ?? 0}
          subtitle="Spam reports"
          icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
          loading={isLoading}
        />
        <MetricCard
          title="Failed"
          value={stats?.totalFailed ?? 0}
          subtitle="Delivery failures"
          icon={<XCircle className="h-4 w-4 text-red-500" />}
          loading={isLoading}
        />
      </div>

      {/* Detailed Analytics */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Status Breakdown</CardTitle>
            <CardDescription>
              Distribution of email delivery statuses
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-6">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : analytics?.byStatus ? (
              <div className="space-y-6">
                <BreakdownItem
                  label="Delivered"
                  value={analytics.byStatus.delivered ?? 0}
                  total={stats?.totalSent ?? 0}
                  color="bg-green-500"
                />
                <BreakdownItem
                  label="Sent"
                  value={analytics.byStatus.sent ?? 0}
                  total={stats?.totalSent ?? 0}
                  color="bg-blue-500"
                />
                <BreakdownItem
                  label="Pending"
                  value={analytics.byStatus.pending ?? 0}
                  total={stats?.totalSent ?? 0}
                  color="bg-gray-400"
                />
                <BreakdownItem
                  label="Bounced"
                  value={analytics.byStatus.bounced ?? 0}
                  total={stats?.totalSent ?? 0}
                  color="bg-red-500"
                />
                <BreakdownItem
                  label="Failed"
                  value={analytics.byStatus.failed ?? 0}
                  total={stats?.totalSent ?? 0}
                  color="bg-red-700"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No data available for this period
              </p>
            )}
          </CardContent>
        </Card>

        {/* Event Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Event Type Breakdown</CardTitle>
            <CardDescription>
              Distribution by communication type
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : analytics?.byEventType ? (
              <div className="space-y-6">
                <BreakdownItem
                  label="Transactional"
                  value={analytics.byEventType.transactional ?? 0}
                  total={stats?.totalSent ?? 0}
                  color="bg-blue-500"
                />
                <BreakdownItem
                  label="Workflow"
                  value={analytics.byEventType.workflow ?? 0}
                  total={stats?.totalSent ?? 0}
                  color="bg-purple-500"
                />
                <BreakdownItem
                  label="Notification"
                  value={analytics.byEventType.notification ?? 0}
                  total={stats?.totalSent ?? 0}
                  color="bg-yellow-500"
                />
                <BreakdownItem
                  label="Ad Hoc"
                  value={analytics.byEventType.ad_hoc ?? 0}
                  total={stats?.totalSent ?? 0}
                  color="bg-gray-500"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No data available for this period
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Templates</CardTitle>
          <CardDescription>
            Templates with the highest engagement rates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-48" />
                  <div className="flex gap-8">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : analytics?.topTemplates && analytics.topTemplates.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center text-sm text-muted-foreground border-b pb-2">
                <span className="flex-1">Template</span>
                <span className="w-24 text-right">Sent</span>
                <span className="w-24 text-right">Open Rate</span>
                <span className="w-24 text-right">Click Rate</span>
              </div>
              {analytics.topTemplates.map((template) => (
                <div
                  key={template.templateId}
                  className="flex items-center text-sm"
                >
                  <span className="flex-1 font-medium">
                    {template.templateName}
                  </span>
                  <span className="w-24 text-right text-muted-foreground">
                    {template.sent}
                  </span>
                  <span className="w-24 text-right">
                    {template.openRate.toFixed(1)}%
                  </span>
                  <span className="w-24 text-right">
                    {template.clickRate.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No template data available for this period
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
