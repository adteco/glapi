'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@clerk/nextjs';
import { DashboardWidgetConfig } from '../types';

interface UnbilledTimeWidgetProps {
  config: DashboardWidgetConfig;
}

export function UnbilledTimeWidget({ config }: UnbilledTimeWidgetProps) {
  const { orgId, isLoaded } = useAuth();
  const canQuery = isLoaded && Boolean(orgId);

  const { data: unbilledData, isLoading: unbilledLoading } = trpc.projectAnalytics.getUnbilledTimeByCustomer.useQuery(
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
              <Clock className="h-5 w-5" />
              {config.title || 'Unbilled Time by Customer'}
            </CardTitle>
            <CardDescription>
              Approved time entries pending billing
            </CardDescription>
          </div>
          <Link href="/projects/time">
            <Button variant="outline" size="sm">
              View Time
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {unbilledLoading ? (
          <div className="text-center py-4 text-muted-foreground italic">Loading...</div>
        ) : unbilledData?.data && unbilledData.data.length > 0 ? (
          <div className="space-y-3">
            {unbilledData.data.slice(0, 5).map((item) => (
              <div key={item.customerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{item.customerName}</p>
                  <p className="text-xs text-muted-foreground">{item.unbilledHours.toFixed(1)} hours</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">{formatCurrency(item.unbilledAmount)}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border-t-2 border-green-200">
              <div>
                <p className="font-bold">Total Unbilled</p>
                <p className="text-xs text-muted-foreground">{unbilledData.totalHours.toFixed(1)} hours</p>
              </div>
              <p className="text-xl font-bold text-green-600">{formatCurrency(unbilledData.total)}</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">No unbilled time available</div>
        )}
      </CardContent>
    </Card>
  );
}
