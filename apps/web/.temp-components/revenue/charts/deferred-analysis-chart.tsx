"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  PieChart, 
  Pie, 
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/trpc';

export function DeferredRevenueAnalysis() {
  const { data: deferredData } = api.revenue.reports.getDeferredAnalysis.useQuery();

  const pieData = deferredData?.byCategory?.map(item => ({
    name: item.category,
    value: item.amount,
    percentage: item.percentage
  })) || [];

  const scheduleData = deferredData?.recognitionSchedule?.map(item => ({
    period: item.period,
    amount: item.amount
  })) || [];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-sm">{formatCurrency(payload[0].value)}</p>
          <p className="text-sm text-muted-foreground">
            {(payload[0].payload.percentage * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomizedLabel = ({
    cx, cy, midAngle, innerRadius, outerRadius, percentage
  }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percentage < 0.05) return null; // Don't show label for small slices

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percentage * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Deferred</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(deferredData?.totalDeferred || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Unrecognized revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Current Quarter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(deferredData?.currentQuarter || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              To be recognized in Q{Math.floor((new Date().getMonth() / 3) + 1)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Next 12 Months</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(deferredData?.next12Months || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Scheduled recognition
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Deferred by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Deferred Revenue by Category</CardTitle>
          <CardDescription>Breakdown of unrecognized revenue</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recognition Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Recognition Schedule</CardTitle>
          <CardDescription>Projected revenue recognition over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={scheduleData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="period" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tickFormatter={(value) => formatCurrency(value, true)}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                formatter={(value) => formatCurrency(Number(value))}
              />
              <Bar 
                dataKey="amount" 
                fill="#3b82f6" 
                radius={[4, 4, 0, 0]}
                name="Recognition Amount"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Aging Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Deferred Revenue Aging</CardTitle>
          <CardDescription>Age distribution of deferred balances</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {deferredData?.aging?.map((bucket) => (
              <div key={bucket.range} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{bucket.range}</span>
                  <span className="font-medium">{formatCurrency(bucket.amount)}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ 
                      width: `${(bucket.amount / (deferredData?.totalDeferred || 1)) * 100}%` 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}