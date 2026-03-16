'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@clerk/nextjs';
import { DashboardWidgetConfig } from '../types';

interface UnfulfilledOrdersWidgetProps {
  config: DashboardWidgetConfig;
}

export function UnfulfilledOrdersWidget({ config }: UnfulfilledOrdersWidgetProps) {
  const { orgId, isLoaded } = useAuth();
  const canQuery = isLoaded && Boolean(orgId);

  const { data: unfulfilledData, isLoading: unfulfilledLoading } = trpc.projectAnalytics.getUnfulfilledSalesOrdersByCustomer.useQuery(
    undefined,
    { enabled: canQuery }
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              {config.title || 'Unfulfilled Sales Orders'}
            </CardTitle>
            <CardDescription>
              Open sales orders pending invoicing
            </CardDescription>
          </div>
          <Link href="/transactions/sales/sales-orders">
            <Button variant="outline" size="sm">
              View Sales Orders
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {unfulfilledLoading ? (
          <div className="text-center py-4 text-muted-foreground italic">Loading...</div>
        ) : unfulfilledData?.data && unfulfilledData.data.length > 0 ? (
          <div className="space-y-3">
            {unfulfilledData.data.slice(0, 5).map((item) => (
              <div key={item.customerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{item.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.orderCount} order{item.orderCount !== 1 ? 's' : ''} • {formatCurrency(item.totalInvoiced)} invoiced
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-orange-600">{formatCurrency(item.unfulfilledAmount)}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border-t-2 border-orange-200">
              <p className="font-bold">Total Unfulfilled</p>
              <p className="text-xl font-bold text-orange-600">{formatCurrency(unfulfilledData.total)}</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">No unfulfilled sales orders</div>
        )}
      </CardContent>
    </Card>
  );
}
