'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { portalGet } from '@/lib/customer-portal-client';

type EstimateRow = {
  id: string;
  estimateNumber: string;
  transactionDate: string;
  estimateValidUntil: string | null;
  status: string;
  totalAmount: string;
  memo: string | null;
};

type EstimateListResponse = {
  data: EstimateRow[];
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

export default function CustomerPortalEstimatesPage() {
  const [rows, setRows] = useState<EstimateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await portalGet<EstimateListResponse>('/workspace/estimates');
      setRows(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load estimates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
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
        <p className="text-sm text-slate-400">Loading estimates...</p>
      ) : (
        <div className="rounded-lg border border-slate-800">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead>Estimate #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Memo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="border-slate-800">
                  <TableCell>{row.estimateNumber}</TableCell>
                  <TableCell>{dateValue(row.transactionDate)}</TableCell>
                  <TableCell>{dateValue(row.estimateValidUntil)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-slate-700 text-slate-200">
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{money(row.totalAmount)}</TableCell>
                  <TableCell className="max-w-[280px] truncate">{row.memo || '—'}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow className="border-slate-800">
                  <TableCell colSpan={6} className="text-center text-slate-400">
                    No estimates available.
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
