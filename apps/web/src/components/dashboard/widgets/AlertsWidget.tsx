'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from 'lucide-react';
import { DashboardWidgetConfig } from '../types';

interface AlertsWidgetProps {
  config: DashboardWidgetConfig;
}

export function AlertsWidget({ config }: AlertsWidgetProps) {
  // Mock data - same as in DashboardPage
  const dashboardStats = {
    openInvoices: 15,
    pendingOrders: 8,
    lowStockItems: 5,
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          {config.title || 'Alerts & Tasks'}
        </CardTitle>
        <CardDescription>
          Important items requiring attention
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
          <div>
            <p className="text-sm font-medium">Open Invoices</p>
            <p className="text-xs text-gray-600">{dashboardStats.openInvoices} invoices pending</p>
          </div>
          <div className="text-lg font-bold text-yellow-600">
            {dashboardStats.openInvoices}
          </div>
        </div>
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
          <div>
            <p className="text-sm font-medium">Pending Orders</p>
            <p className="text-xs text-gray-600">{dashboardStats.pendingOrders} orders to fulfill</p>
          </div>
          <div className="text-lg font-bold text-blue-600">
            {dashboardStats.pendingOrders}
          </div>
        </div>
        <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
          <div>
            <p className="text-sm font-medium">Low Stock Items</p>
            <p className="text-xs text-gray-600">{dashboardStats.lowStockItems} items need reorder</p>
          </div>
          <div className="text-lg font-bold text-red-600">
            {dashboardStats.lowStockItems}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
