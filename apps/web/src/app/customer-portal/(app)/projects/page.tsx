'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { portalGet } from '@/lib/customer-portal-client';

type ProjectRow = {
  id: string;
  projectCode: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  budgetRevenue: string | null;
  budgetCost: string | null;
  percentComplete: string | null;
};

type ProjectListResponse = {
  data: ProjectRow[];
};

function money(value: string | null): string {
  if (!value) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
}

function dateValue(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export default function CustomerPortalProjectsPage() {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await portalGet<ProjectListResponse>('/workspace/projects');
      setRows(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
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
        <p className="text-sm text-slate-400">Loading projects...</p>
      ) : (
        <div className="rounded-lg border border-slate-800">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead className="text-right">Budget Revenue</TableHead>
                <TableHead className="text-right">Budget Cost</TableHead>
                <TableHead className="w-[180px]">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const progress = Number(row.percentComplete || 0);
                return (
                  <TableRow key={row.id} className="border-slate-800">
                    <TableCell>
                      <div className="font-medium text-slate-100">{row.name}</div>
                      <div className="text-xs text-slate-400">{row.projectCode}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-slate-700 text-slate-200">
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{dateValue(row.startDate)}</TableCell>
                    <TableCell>{dateValue(row.endDate)}</TableCell>
                    <TableCell className="text-right">{money(row.budgetRevenue)}</TableCell>
                    <TableCell className="text-right">{money(row.budgetCost)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Progress value={Math.max(0, Math.min(100, progress))} />
                        <p className="text-xs text-slate-400">{progress.toFixed(1)}%</p>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 ? (
                <TableRow className="border-slate-800">
                  <TableCell colSpan={7} className="text-center text-slate-400">
                    No projects available.
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
