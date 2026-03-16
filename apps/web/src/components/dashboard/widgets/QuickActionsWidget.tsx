'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { FileText, Plus, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { DashboardWidgetConfig } from '../types';

interface QuickActionsWidgetProps {
  config: DashboardWidgetConfig;
}

export function QuickActionsWidget({ config }: QuickActionsWidgetProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {config.title || 'Quick Actions'}
        </CardTitle>
        <CardDescription>
          Create new transactions and entries
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Link href="/transactions/sales/invoices">
          <Button variant="outline" className="w-full justify-between">
            New Invoice
            <Plus className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/transactions/sales/sales-orders">
          <Button variant="outline" className="w-full justify-between">
            New Sales Order
            <Plus className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/transactions/inventory/purchase-orders">
          <Button variant="outline" className="w-full justify-between">
            New Purchase Order
            <Plus className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/transactions/management/journal">
          <Button variant="outline" className="w-full justify-between">
            Journal Entry
            <Plus className="h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
