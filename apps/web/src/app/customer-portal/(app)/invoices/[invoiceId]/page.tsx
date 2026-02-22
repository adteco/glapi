'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { portalGet, portalPost } from '@/lib/customer-portal-client';

type InvoiceDetailResponse = {
  invoice: {
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string | null;
    totalAmount: string;
    paidAmount: string;
    balanceDue: string;
    status: string;
    lineItems?: Array<{
      id: string;
      description: string;
      quantity: string;
      unitPrice: string;
      amount: string;
    }>;
    paymentLinkUrl?: string | null;
  };
  payments: Array<{
    id: string;
    paymentDate: string;
    amount: string;
    status: string;
    paymentMethod: string | null;
    transactionReference: string | null;
  }>;
};

function money(value: string): string {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numeric);
}

function dateValue(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export default function CustomerPortalInvoiceDetailPage() {
  const params = useParams<{ invoiceId: string }>();
  const invoiceId = params.invoiceId;
  const [data, setData] = useState<InvoiceDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInvoice = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await portalGet<InvoiceDetailResponse>(`/workspace/invoices/${invoiceId}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    if (!invoiceId) return;
    void loadInvoice();
  }, [invoiceId, loadInvoice]);

  const canPay = useMemo(() => {
    if (!data?.invoice) return false;
    return Number(data.invoice.balanceDue || 0) > 0 && !['paid', 'void', 'cancelled'].includes(data.invoice.status);
  }, [data]);

  const handlePayNow = async () => {
    if (!invoiceId) return;
    setPaying(true);
    setError(null);
    try {
      const result = await portalPost<{ paymentLinkUrl: string }>(
        `/payments/invoices/${invoiceId}/pay-link`
      );
      window.open(result.paymentLinkUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment link');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-400">Loading invoice...</p>;
  }

  if (error || !data) {
    return (
      <p className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
        {error || 'Unable to load invoice'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Invoice</p>
          <h2 className="text-2xl font-semibold text-white">{data.invoice.invoiceNumber}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-slate-700 text-slate-200">
            {data.invoice.status}
          </Badge>
          <Button onClick={handlePayNow} disabled={!canPay || paying}>
            {paying ? 'Opening...' : 'Pay now'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">Invoice Date</CardTitle></CardHeader>
          <CardContent className="text-sm text-white">{dateValue(data.invoice.invoiceDate)}</CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">Due Date</CardTitle></CardHeader>
          <CardContent className="text-sm text-white">{dateValue(data.invoice.dueDate)}</CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">Total</CardTitle></CardHeader>
          <CardContent className="text-sm text-white">{money(data.invoice.totalAmount)}</CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">Balance Due</CardTitle></CardHeader>
          <CardContent className="text-sm font-semibold text-white">{money(data.invoice.balanceDue)}</CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-950/60">
        <CardHeader>
          <CardTitle className="text-base text-white">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.invoice.lineItems || []).map((line) => (
                <TableRow key={line.id} className="border-slate-800">
                  <TableCell>{line.description}</TableCell>
                  <TableCell className="text-right">{line.quantity}</TableCell>
                  <TableCell className="text-right">{money(line.unitPrice)}</TableCell>
                  <TableCell className="text-right">{money(line.amount)}</TableCell>
                </TableRow>
              ))}
              {(data.invoice.lineItems || []).length === 0 ? (
                <TableRow className="border-slate-800">
                  <TableCell colSpan={4} className="text-center text-slate-400">
                    No line items available.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-950/60">
        <CardHeader>
          <CardTitle className="text-base text-white">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.payments.map((payment) => (
                <TableRow key={payment.id} className="border-slate-800">
                  <TableCell>{dateValue(payment.paymentDate)}</TableCell>
                  <TableCell>{payment.status}</TableCell>
                  <TableCell>{payment.paymentMethod || '—'}</TableCell>
                  <TableCell>{payment.transactionReference || '—'}</TableCell>
                  <TableCell className="text-right">{money(payment.amount)}</TableCell>
                </TableRow>
              ))}
              {data.payments.length === 0 ? (
                <TableRow className="border-slate-800">
                  <TableCell colSpan={5} className="text-center text-slate-400">
                    No payments recorded yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Link href="/customer-portal/invoices" className="inline-block text-sm text-slate-300 hover:text-white">
        ← Back to invoices
      </Link>
    </div>
  );
}
