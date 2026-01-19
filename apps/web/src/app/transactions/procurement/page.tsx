'use client';

import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart,
  Package,
  FileText,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

// Mock data for the dashboard - in production this would come from API
const dashboardStats = {
  purchaseOrders: {
    total: 47,
    draft: 5,
    pendingApproval: 8,
    approved: 12,
    partiallyReceived: 15,
    fullyReceived: 7,
    totalValue: 284500,
  },
  receipts: {
    pending: 12,
    posted: 89,
    thisMonth: 23,
    totalValue: 156200,
  },
  vendorBills: {
    total: 35,
    unpaid: 18,
    overdue: 3,
    dueThisWeek: 5,
    totalOutstanding: 127800,
    averageDaysToProcess: 4.2,
  },
  payments: {
    thisMonth: 45600,
    pending: 2,
    scheduled: 5,
    totalPaid: 892400,
  },
  variance: {
    priceVariances: 3,
    quantityVariances: 2,
    totalVarianceAmount: 1250,
  }
};

export default function ProcurementDashboard() {
  const { orgId } = useAuth();

  if (!orgId) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Please select an organization to view procurement data.</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Procure-to-Pay</h1>
          <p className="text-muted-foreground mt-1">
            Manage purchase orders, receipts, vendor bills, and payments
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/transactions/inventory/purchase-orders">
              <ShoppingCart className="w-4 h-4 mr-2" />
              New Purchase Order
            </Link>
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open POs</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.purchaseOrders.pendingApproval + dashboardStats.purchaseOrders.approved}</div>
            <p className="text-xs text-muted-foreground">
              ${dashboardStats.purchaseOrders.totalValue.toLocaleString()} committed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Receipts</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.receipts.pending}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardStats.receipts.thisMonth} received this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Payables</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${dashboardStats.vendorBills.totalOutstanding.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardStats.vendorBills.unpaid} unpaid bills
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payments This Month</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${dashboardStats.payments.thisMonth.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardStats.payments.scheduled} scheduled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts and Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Overdue Bills Alert */}
        {dashboardStats.vendorBills.overdue > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-800">Overdue Bills</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-800">{dashboardStats.vendorBills.overdue}</div>
              <p className="text-xs text-red-600">
                Require immediate attention
              </p>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <Link href="/transactions/procurement/vendor-bills?status=overdue">
                  View Overdue <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Pending Approvals */}
        {dashboardStats.purchaseOrders.pendingApproval > 0 && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-yellow-800">Pending Approvals</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-800">{dashboardStats.purchaseOrders.pendingApproval}</div>
              <p className="text-xs text-yellow-600">
                Purchase orders awaiting approval
              </p>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <Link href="/transactions/inventory/purchase-orders?status=PENDING_APPROVAL">
                  Review <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Match Variances */}
        {(dashboardStats.variance.priceVariances > 0 || dashboardStats.variance.quantityVariances > 0) && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-800">Match Variances</CardTitle>
              <TrendingDown className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-800">
                {dashboardStats.variance.priceVariances + dashboardStats.variance.quantityVariances}
              </div>
              <p className="text-xs text-orange-600">
                ${dashboardStats.variance.totalVarianceAmount.toLocaleString()} total variance
              </p>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <Link href="/transactions/procurement/vendor-bills?hasVariance=true">
                  Review Variances <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <Link href="/transactions/inventory/purchase-orders">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Purchase Orders
              </CardTitle>
              <CardDescription>Create and manage purchase orders</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Open</span>
                <Badge variant="secondary">{dashboardStats.purchaseOrders.approved + dashboardStats.purchaseOrders.pendingApproval}</Badge>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">Draft</span>
                <Badge variant="outline">{dashboardStats.purchaseOrders.draft}</Badge>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <Link href="/transactions/inventory/receipts">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                PO Receipts
              </CardTitle>
              <CardDescription>Receive goods against purchase orders</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending</span>
                <Badge variant="secondary">{dashboardStats.receipts.pending}</Badge>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">This Month</span>
                <Badge variant="outline">{dashboardStats.receipts.thisMonth}</Badge>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <Link href="/transactions/procurement/vendor-bills">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Vendor Bills
              </CardTitle>
              <CardDescription>Process and match vendor invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Unpaid</span>
                <Badge variant="secondary">{dashboardStats.vendorBills.unpaid}</Badge>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">Due This Week</span>
                <Badge variant={dashboardStats.vendorBills.dueThisWeek > 0 ? "destructive" : "outline"}>
                  {dashboardStats.vendorBills.dueThisWeek}
                </Badge>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <Link href="/transactions/procurement/bill-payments">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Bill Payments
              </CardTitle>
              <CardDescription>Pay vendor bills and track payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending</span>
                <Badge variant="secondary">{dashboardStats.payments.pending}</Badge>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">Scheduled</span>
                <Badge variant="outline">{dashboardStats.payments.scheduled}</Badge>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Processing Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Metrics</CardTitle>
          <CardDescription>Key performance indicators for the P2P cycle</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg. Days to Process</p>
                <p className="text-2xl font-bold">{dashboardStats.vendorBills.averageDaysToProcess}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">3-Way Match Rate</p>
                <p className="text-2xl font-bold">94.2%</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <CreditCard className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Paid (YTD)</p>
                <p className="text-2xl font-bold">${dashboardStats.payments.totalPaid.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
