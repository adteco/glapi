'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Calendar, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { DashboardWidgetConfig } from '../types';

interface BudgetOverviewWidgetProps {
  config: DashboardWidgetConfig;
}

export function BudgetOverviewWidget({ config }: BudgetOverviewWidgetProps) {
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
              <Calendar className="h-5 w-5" />
              {config.title || 'Budget Overview'}
            </CardTitle>
            <CardDescription>
              Current period budget performance
            </CardDescription>
          </div>
          <Link href="/transactions/management/budgets">
            <Button variant="outline" size="sm">
              Manage Budgets
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-blue-700">Total Budgeted</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(500000)}</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm font-medium text-green-700">Actual Spent</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(375000)}</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700">Variance</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(-125000)}</p>
            <p className="text-sm text-red-600">-25.0%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
