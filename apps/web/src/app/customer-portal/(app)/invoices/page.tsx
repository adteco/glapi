'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { portalGet, portalPost } from '@/lib/customer-portal-client';

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
  status: string;
  paymentLinkUrl?: string | null;
};

type InvoiceListResponse = {
  data: InvoiceRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

function money(value: string): string {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numeric);
}

function dateValue(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export default function CustomerPortalInvoicesPage() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await portalGet<InvoiceListResponse>('/workspace/invoices');
      setRows(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const totalOutstanding = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.balanceDue || 0), 0),
    [rows]
  );

  const handlePayNow = async (invoiceId: string) => {
    setPayingId(invoiceId);
    setError(null);
    try {
      const result = await portalPost<{
        paymentLinkUrl: string;
      }>(`/payments/invoices/${invoiceId}/pay-link`);
      window.open(result.paymentLinkUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate payment link');
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-300">
          Outstanding balance: <span className="font-semibold text-white">{money(totalOutstanding.toFixed(2))}</span>
        </p>
        <Button variant="outline" className="border-slate-700 bg-transparent text-slate-100" onClick={loadInvoices}>
          Refresh
        </Button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-400">Loading invoices...</p>
      ) : (
        <div className="rounded-lg border border-slate-800">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="border-slate-800">
                  <TableCell>
                    <Link href={`/customer-portal/invoices/${row.id}`} className="font-medium text-slate-100 hover:underline">
                      {row.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{dateValue(row.invoiceDate)}</TableCell>
                  <TableCell>{dateValue(row.dueDate)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-slate-700 text-slate-200">
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{money(row.totalAmount)}</TableCell>
                  <TableCell className="text-right">{money(row.balanceDue)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={() => handlePayNow(row.id)}
                      disabled={payingId === row.id || Number(row.balanceDue) <= 0}
                    >
                      {payingId === row.id ? 'Opening...' : 'Pay now'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow className="border-slate-800">
                  <TableCell colSpan={7} className="text-center text-slate-400">
                    No invoices available.
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
