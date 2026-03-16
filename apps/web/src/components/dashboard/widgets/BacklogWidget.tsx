'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Briefcase, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@clerk/nextjs';
import { DashboardWidgetConfig } from '../types';

interface BacklogWidgetProps {
  config: DashboardWidgetConfig;
}

export function BacklogWidget({ config }: BacklogWidgetProps) {
  const { orgId, isLoaded } = useAuth();
  const canQuery = isLoaded && Boolean(orgId);

  const { data: backlogData, isLoading: backlogLoading } = trpc.projectAnalytics.getBacklogByCustomer.useQuery(
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
              <Briefcase className="h-5 w-5" />
              {config.title || 'Backlog by Customer'}
            </CardTitle>
            <CardDescription>
              Remaining budget to complete
            </CardDescription>
          </div>
          <Link href="/projects">
            <Button variant="outline" size="sm">
              View Projects
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {backlogLoading ? (
          <div className="text-center py-4 text-muted-foreground italic">Loading...</div>
        ) : backlogData?.data && backlogData.data.length > 0 ? (
          <div className="space-y-3">
            {backlogData.data.slice(0, 5).map((item) => (
              <div key={item.customerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{item.customerName}</p>
                  <p className="text-xs text-muted-foreground">{item.projectCount} project{item.projectCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-600">{formatCurrency(item.backlogValue)}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border-t-2 border-blue-200">
              <p className="font-bold">Total Backlog</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(backlogData.total)}</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">No backlog data available</div>
        )}
      </CardContent>
    </Card>
  );
}
