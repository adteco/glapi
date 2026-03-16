'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { FileText, ShoppingCart, Activity, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { DashboardWidgetConfig } from '../types';

interface RecentTransactionsWidgetProps {
  config: DashboardWidgetConfig;
}

export function RecentTransactionsWidget({ config }: RecentTransactionsWidgetProps) {
  // Mock data - same as in DashboardPage
  const recentTransactions = [
    { id: '1', type: 'Sales Invoice', number: 'INV-2024-001', amount: 2500, date: '2024-01-15' },
    { id: '2', type: 'Purchase Order', number: 'PO-2024-008', amount: -1200, date: '2024-01-14' },
    { id: '3', type: 'Journal Entry', number: 'JE-2024-012', amount: 500, date: '2024-01-13' },
    { id: '4', type: 'Sales Order', number: 'SO-2024-015', amount: 3200, date: '2024-01-12' },
  ];

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
            <CardTitle>{config.title || 'Recent Transactions'}</CardTitle>
            <CardDescription>
              Latest business transactions and activities
            </CardDescription>
          </div>
          <Link href="/transactions">
            <Button variant="outline" size="sm">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentTransactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-gray-100 rounded-lg">
                  {transaction.type.includes('Invoice') && <FileText className="h-4 w-4" />}
                  {transaction.type.includes('Order') && <ShoppingCart className="h-4 w-4" />}
                  {transaction.type.includes('Journal') && <Activity className="h-4 w-4" />}
                </div>
                <div>
                  <p className="font-medium text-sm">{transaction.type}</p>
                  <p className="text-xs text-gray-600">{transaction.number}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-medium text-sm ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(Math.abs(transaction.amount))}
                </p>
                <p className="text-xs text-gray-600">
                  {new Date(transaction.date).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
