'use client';

import React from 'react';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  TrendingUp,
  Activity,
  DollarSign,
  FileText,
  Calendar,
  Plus,
  ArrowRight,
  Target,
  Users,
  Package,
  ShoppingCart,
  Clock,
  Briefcase
} from 'lucide-react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';

const DashboardPage = () => {
  const { orgId, userId, isLoaded } = useAuth();
  const canQueryAnalytics = isLoaded && Boolean(orgId) && Boolean(userId);

  // Fetch project analytics
  const { data: backlogData, isLoading: backlogLoading } = trpc.projectAnalytics.getBacklogByCustomer.useQuery(
    undefined,
    { enabled: canQueryAnalytics }
  );
  const { data: unbilledData, isLoading: unbilledLoading } = trpc.projectAnalytics.getUnbilledTimeByCustomer.useQuery(
    undefined,
    { enabled: canQueryAnalytics }
  );
  const { data: unfulfilledData, isLoading: unfulfilledLoading } = trpc.projectAnalytics.getUnfulfilledSalesOrdersByCustomer.useQuery(
    undefined,
    { enabled: canQueryAnalytics }
  );

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view your dashboard.</p>
      </div>
    );
  }

  // Mock data - replace with real data from TRPC
  const dashboardStats = {
    totalRevenue: 125000,
    totalExpenses: 85000,
    netIncome: 40000,
    cashBalance: 48500,
    openInvoices: 15,
    pendingOrders: 8,
    activeCustomers: 142,
    lowStockItems: 5,
  };

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
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's what's happening with your business.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/transactions/sales/invoices">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(dashboardStats.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              +12.5% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Income</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(dashboardStats.netIncome)}
            </div>
            <p className="text-xs text-muted-foreground">
              +8.2% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Balance</CardTitle>
            <Activity className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(dashboardStats.cashBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              +18.3% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <Users className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {dashboardStats.activeCustomers}
            </div>
            <p className="text-xs text-muted-foreground">
              +5 new this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Financial Reports
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

        {/* Quick Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Quick Actions
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

        {/* Alerts & Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Alerts & Tasks
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
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>
                Latest business transactions and activities
              </CardDescription>
            </div>
            <Link href="/transactions">
              <Button variant="outline">
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
                    <p className="font-medium">{transaction.type}</p>
                    <p className="text-sm text-gray-600">{transaction.number}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(Math.abs(transaction.amount))}
                  </p>
                  <p className="text-sm text-gray-600">
                    {new Date(transaction.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Budget Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Budget Overview
              </CardTitle>
              <CardDescription>
                Current period budget performance
              </CardDescription>
            </div>
            <Link href="/transactions/management/budgets">
              <Button variant="outline">
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

      {/* Project Analytics by Customer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backlog by Customer */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Backlog by Customer
                </CardTitle>
                <CardDescription>
                  Remaining budget to complete (Budget - Pending - Billed)
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
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
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

        {/* Unbilled Time by Customer */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Unbilled Time by Customer
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
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
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
      </div>

      {/* Unfulfilled Sales Orders by Customer */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Unfulfilled Sales Orders by Customer
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
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
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
    </div>
  );
};

export default DashboardPage; 
