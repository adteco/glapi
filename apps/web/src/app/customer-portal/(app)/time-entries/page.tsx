'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { portalGet } from '@/lib/customer-portal-client';

type TimeEntryRow = {
  id: string;
  projectCode: string | null;
  projectName: string | null;
  employeeName: string | null;
  entryDate: string;
  hours: string;
  status: string;
  description: string | null;
  isBillable: boolean;
  submittedAt: string | null;
  approvedAt: string | null;
};

type TimeEntryListResponse = {
  data: TimeEntryRow[];
};

function dateValue(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export default function CustomerPortalTimeEntriesPage() {
  const [rows, setRows] = useState<TimeEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await portalGet<TimeEntryListResponse>('/workspace/time-entries');
      setRows(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load time entries');
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
        <p className="text-sm text-slate-400">Loading time entries...</p>
      ) : (
        <div className="rounded-lg border border-slate-800">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead>Date</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead>Billable</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="border-slate-800">
                  <TableCell>{dateValue(row.entryDate)}</TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-100">{row.projectName || '—'}</div>
                    <div className="text-xs text-slate-400">{row.projectCode || '—'}</div>
                  </TableCell>
                  <TableCell>{row.employeeName || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-slate-700 text-slate-200">
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{Number(row.hours || 0).toFixed(2)}</TableCell>
                  <TableCell>{row.isBillable ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="max-w-[280px] truncate">{row.description || '—'}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow className="border-slate-800">
                  <TableCell colSpan={7} className="text-center text-slate-400">
                    No time entries available.
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
