'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { BarChart3, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { DashboardWidgetConfig } from '../types';

interface FinancialReportsWidgetProps {
  config: DashboardWidgetConfig;
}

export function FinancialReportsWidget({ config }: FinancialReportsWidgetProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {config.title || 'Financial Reports'}
        </CardTitle>
        <CardDescription>
          View key financial statements and analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Link href="/reports/financial/balance-sheet">
          <Button variant="outline" className="w-full justify-between">
            Balance Sheet
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/reports/financial/income-statement">
          <Button variant="outline" className="w-full justify-between">
            Income Statement
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/reports/financial/cash-flow-statement">
          <Button variant="outline" className="w-full justify-between">
            Cash Flow Statement
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/reports">
          <Button className="w-full mt-2">
            View All Reports
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
