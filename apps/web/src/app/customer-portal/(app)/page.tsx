'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { portalGet } from '@/lib/customer-portal-client';

type OverviewResponse = {
  invoices: {
    totalInvoices: number;
    openInvoices: number;
    totalAmount: string;
  };
  orders: {
    totalOrders: number;
    activeOrders: number;
    totalOrderAmount: string;
  };
  projects: {
    totalProjects: number;
    activeProjects: number;
  };
  timeEntries: {
    submittedEntries: number;
    approvedEntries: number;
    totalHours: string;
  };
};

function money(value: string): string {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numeric);
}

export default function CustomerPortalOverviewPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await portalGet<OverviewResponse>('/workspace/overview');
        if (mounted) setData(result);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load overview');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-400">Loading overview...</p>;
  }

  if (error || !data) {
    return (
      <p className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
        {error || 'Unable to load overview'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Open Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">{data.invoices.openInvoices}</p>
            <p className="text-xs text-slate-400">Total invoices: {data.invoices.totalInvoices}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Invoice Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">{money(data.invoices.totalAmount)}</p>
            <p className="text-xs text-slate-400">Across customer memberships</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Active Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">{data.orders.activeOrders}</p>
            <p className="text-xs text-slate-400">Total orders: {data.orders.totalOrders}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Submitted Time</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">{Number(data.timeEntries.totalHours).toFixed(2)}h</p>
            <p className="text-xs text-slate-400">
              Submitted: {data.timeEntries.submittedEntries} • Approved: {data.timeEntries.approvedEntries}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader>
            <CardTitle className="text-base text-white">Billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link href="/customer-portal/invoices" className="block rounded-md border border-slate-800 px-3 py-2 hover:bg-slate-900">
              Review invoices and pay online
            </Link>
            <Link href="/customer-portal/estimates" className="block rounded-md border border-slate-800 px-3 py-2 hover:bg-slate-900">
              Review estimates
            </Link>
            <Link href="/customer-portal/orders" className="block rounded-md border border-slate-800 px-3 py-2 hover:bg-slate-900">
              View sales orders
            </Link>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader>
            <CardTitle className="text-base text-white">Delivery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link href="/customer-portal/projects" className="block rounded-md border border-slate-800 px-3 py-2 hover:bg-slate-900">
              Track project progress and status
            </Link>
            <Link href="/customer-portal/time-entries" className="block rounded-md border border-slate-800 px-3 py-2 hover:bg-slate-900">
              Review submitted and approved time
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
