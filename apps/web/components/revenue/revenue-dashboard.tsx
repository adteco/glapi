"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer 
} from 'recharts';
import { 
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText
} from 'lucide-react';
import { api } from '@/lib/trpc';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { RevenueWaterfallChart } from './charts/revenue-waterfall-chart';
import { ARRMovementChart } from './charts/arr-movement-chart';
import { DeferredRevenueAnalysis } from './charts/deferred-analysis-chart';
import { PerformanceObligationsView } from './performance-obligations-view';
import { ExceptionManager } from './exception-manager';

interface MetricCard {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon: React.ComponentType<any>;
  description?: string;
}

export function RevenueDashboard() {
  const [dateRange, setDateRange] = useState({ 
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    end: new Date()
  });
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  // Fetch data using tRPC
  const { data: dashboardData } = api.revenue.dashboard.getSummary.useQuery({
    startDate: dateRange.start.toISOString(),
    endDate: dateRange.end.toISOString()
  });

  const { data: recognitionHistory } = api.revenue.reports.getRecognitionHistory.useQuery({
    startDate: dateRange.start.toISOString(),
    endDate: dateRange.end.toISOString()
  });

  // Key metrics
  const metrics: MetricCard[] = [
    {
      title: 'ARR',
      value: formatCurrency(dashboardData?.arr || 0),
      change: dashboardData?.arrGrowth,
      changeType: (dashboardData?.arrGrowth || 0) > 0 ? 'increase' : 'decrease',
      icon: TrendingUp,
      description: 'Annual Recurring Revenue'
    },
    {
      title: 'MRR',
      value: formatCurrency(dashboardData?.mrr || 0),
      change: dashboardData?.mrrGrowth,
      changeType: (dashboardData?.mrrGrowth || 0) > 0 ? 'increase' : 'decrease',
      icon: DollarSign,
      description: 'Monthly Recurring Revenue'
    },
    {
      title: 'Deferred Revenue',
      value: formatCurrency(dashboardData?.deferredRevenue || 0),
      icon: Clock,
      description: 'Total unrecognized revenue'
    },
    {
      title: 'Recognition Rate',
      value: formatPercentage(dashboardData?.recognitionRate || 0),
      changeType: 'neutral',
      icon: CheckCircle,
      description: 'On-time recognition percentage'
    }
  ];

  const handleRunRecognition = async () => {
    try {
      await api.revenue.recognition.runScheduled.mutate({
        date: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to run recognition:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Revenue Recognition</h1>
          <p className="text-muted-foreground">ASC 606 compliant revenue management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            {selectedPeriod === 'month' ? 'This Month' : 
             selectedPeriod === 'quarter' ? 'This Quarter' : 'This Year'}
          </Button>
          <Button onClick={handleRunRecognition}>Run Recognition</Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              {metric.change !== undefined && (
                <div className="flex items-center text-xs">
                  {metric.changeType === 'increase' ? (
                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                  )}
                  <span className={
                    metric.changeType === 'increase' ? 'text-green-500' : 'text-red-500'
                  }>
                    {formatCurrency(Math.abs(metric.change))}
                  </span>
                </div>
              )}
              {metric.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {metric.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts and Analytics */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue Trends</TabsTrigger>
          <TabsTrigger value="obligations">Performance Obligations</TabsTrigger>
          <TabsTrigger value="deferred">Deferred Analysis</TabsTrigger>
          <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Recognition Trend</CardTitle>
              <CardDescription>Monthly recognized vs deferred revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={recognitionHistory || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="recognized" 
                    stackId="1"
                    stroke="#8884d8" 
                    fill="#8884d8"
                    name="Recognized Revenue"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="deferred" 
                    stackId="1"
                    stroke="#82ca9d" 
                    fill="#82ca9d"
                    name="Deferred Revenue"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RevenueWaterfallChart />
            <ARRMovementChart />
          </div>
        </TabsContent>

        <TabsContent value="obligations">
          <PerformanceObligationsView />
        </TabsContent>

        <TabsContent value="deferred">
          <DeferredRevenueAnalysis />
        </TabsContent>

        <TabsContent value="exceptions">
          <ExceptionManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}