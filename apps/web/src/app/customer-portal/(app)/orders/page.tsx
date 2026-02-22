'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { portalGet } from '@/lib/customer-portal-client';

type OrderRow = {
  id: string;
  orderNumber: string;
  orderDate: string;
  status: string;
  subtotal: string;
  totalAmount: string;
  invoicedAmount: string;
  remainingAmount: string;
};

type OrderListResponse = {
  data: OrderRow[];
};

function money(value: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number(value || 0)
  );
}

function dateValue(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export default function CustomerPortalOrdersPage() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await portalGet<OrderListResponse>('/workspace/orders');
      setRows(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" className="border-slate-700 bg-transparent text-slate-100" onClick={load}>
          Refresh
        </Button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-400">Loading orders...</p>
      ) : (
        <div className="rounded-lg border border-slate-800">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead>Order #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Invoiced</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="border-slate-800">
                  <TableCell>{row.orderNumber}</TableCell>
                  <TableCell>{dateValue(row.orderDate)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-slate-700 text-slate-200">
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{money(row.totalAmount)}</TableCell>
                  <TableCell className="text-right">{money(row.invoicedAmount)}</TableCell>
                  <TableCell className="text-right">{money(row.remainingAmount)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow className="border-slate-800">
                  <TableCell colSpan={6} className="text-center text-slate-400">
                    No orders available.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
