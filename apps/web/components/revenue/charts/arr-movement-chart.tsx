"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/trpc';

export function ARRMovementChart() {
  const { data: arrData } = api.revenue.reports.getARRMovement.useQuery({
    months: 12
  });

  const chartData = arrData?.map(item => ({
    month: item.month,
    newARR: item.newARR,
    expansionARR: item.expansionARR,
    churnedARR: item.churnedARR,
    netARR: item.netARR,
    totalARR: item.totalARR
  })) || [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-sm">
              <span style={{ color: entry.color }}>{entry.name}:</span>
              <span className="font-medium">{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>ARR Movement</CardTitle>
        <CardDescription>Annual recurring revenue growth trends</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              tickFormatter={(value) => formatCurrency(value, true)}
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area
              type="monotone"
              dataKey="newARR"
              stackId="1"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.6}
              name="New ARR"
            />
            <Area
              type="monotone"
              dataKey="expansionARR"
              stackId="1"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.6}
              name="Expansion ARR"
            />
            <Area
              type="monotone"
              dataKey="churnedARR"
              stackId="2"
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.6}
              name="Churned ARR"
            />
            <Line
              type="monotone"
              dataKey="totalARR"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
              name="Total ARR"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}