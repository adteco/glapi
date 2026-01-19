'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Download, Printer, RefreshCw, Settings, Loader2, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// API response interfaces (matching backend types)
interface TrialBalanceAccount {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountCategory: string;
  accountSubcategory: string | null;
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
  isActive: boolean;
}

interface TrialBalanceTotals {
  totalDebits: number;
  totalCredits: number;
  difference: number;
}

interface TrialBalanceResponse {
  reportName: string;
  periodName: string;
  subsidiaryName: string;
  asOfDate: string;
  assetAccounts: TrialBalanceAccount[];
  liabilityAccounts: TrialBalanceAccount[];
  equityAccounts: TrialBalanceAccount[];
  revenueAccounts: TrialBalanceAccount[];
  cogsAccounts: TrialBalanceAccount[];
  expenseAccounts: TrialBalanceAccount[];
  totals: TrialBalanceTotals;
}

interface AccountingPeriod {
  id: string;
  periodName: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface Subsidiary {
  id: string;
  name: string;
}

// Form schema for report parameters
const trialBalanceFormSchema = z.object({
  periodId: z.string().min(1, "Period is required"),
  subsidiaryId: z.string().optional(),
  includeInactive: z.boolean().optional(),
  classId: z.string().optional(),
  departmentId: z.string().optional(),
  locationId: z.string().optional(),
});

type TrialBalanceFormValues = z.infer<typeof trialBalanceFormSchema>;

// API fetch functions
async function fetchTrialBalance(params: {
  periodId: string;
  subsidiaryId?: string;
  includeInactive?: boolean;
  classId?: string;
  departmentId?: string;
  locationId?: string;
}): Promise<TrialBalanceResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('periodId', params.periodId);
  if (params.subsidiaryId) searchParams.set('subsidiaryId', params.subsidiaryId);
  if (params.includeInactive) searchParams.set('includeInactive', 'true');
  if (params.classId) searchParams.set('classId', params.classId);
  if (params.departmentId) searchParams.set('departmentId', params.departmentId);
  if (params.locationId) searchParams.set('locationId', params.locationId);

  const response = await fetch(`/api/gl/reports/trial-balance?${searchParams.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch trial balance');
  }
  return response.json();
}

async function fetchAccountingPeriods(): Promise<AccountingPeriod[]> {
  const response = await fetch('/api/accounting-periods?status=OPEN,CLOSED');
  if (!response.ok) {
    throw new Error('Failed to fetch accounting periods');
  }
  const data = await response.json();
  return data.data || [];
}

async function fetchSubsidiaries(): Promise<Subsidiary[]> {
  const response = await fetch('/api/subsidiaries');
  if (!response.ok) {
    throw new Error('Failed to fetch subsidiaries');
  }
  const data = await response.json();
  return data.data || [];
}

export default function TrialBalancePage() {
  const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false);
  const [reportParams, setReportParams] = useState<TrialBalanceFormValues | null>(null);
  const { orgId } = useAuth();

  // Fetch available accounting periods
  const { data: accountingPeriods = [], isLoading: periodsLoading } = useQuery({
    queryKey: ['accounting-periods'],
    queryFn: fetchAccountingPeriods,
    enabled: !!orgId,
  });

  // Fetch available subsidiaries
  const { data: subsidiaries = [], isLoading: subsidiariesLoading } = useQuery({
    queryKey: ['subsidiaries'],
    queryFn: fetchSubsidiaries,
    enabled: !!orgId,
  });

  // Fetch trial balance when params are set
  const {
    data: trialBalanceData,
    isLoading: reportLoading,
    error: reportError,
  } = useQuery({
    queryKey: ['trial-balance', reportParams],
    queryFn: () => fetchTrialBalance(reportParams!),
    enabled: !!reportParams && !!reportParams.periodId,
  });

  const form = useForm<TrialBalanceFormValues>({
    resolver: zodResolver(trialBalanceFormSchema),
    defaultValues: {
      periodId: "",
      subsidiaryId: "",
      includeInactive: false,
    },
  });

  // Handle generate report
  const handleGenerateReport = async (values: TrialBalanceFormValues) => {
    setReportParams(values);
    setIsOptionsDialogOpen(false);
    toast.success('Generating trial balance...');
  };

  // Show error toast when report fetch fails
  if (reportError) {
    toast.error(`Failed to generate trial balance: ${reportError.message}`);
  }

  // Handle export
  const handleExport = async (format: 'csv' | 'json') => {
    if (!reportParams?.periodId) {
      toast.error('Please generate a report first');
      return;
    }

    try {
      const searchParams = new URLSearchParams();
      searchParams.set('periodId', reportParams.periodId);
      searchParams.set('format', format);
      if (reportParams.subsidiaryId) searchParams.set('subsidiaryId', reportParams.subsidiaryId);
      if (reportParams.includeInactive) searchParams.set('includeInactive', 'true');
      if (reportParams.classId) searchParams.set('classId', reportParams.classId);
      if (reportParams.departmentId) searchParams.set('departmentId', reportParams.departmentId);
      if (reportParams.locationId) searchParams.set('locationId', reportParams.locationId);

      const response = await fetch(`/api/gl/reports/trial-balance/export?${searchParams.toString()}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to export trial balance');
      }

      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trial-balance-${reportParams.periodId}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Trial balance exported as CSV');
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trial-balance-${reportParams.periodId}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Trial balance exported as JSON');
      }
    } catch (error) {
      toast.error(`Failed to export trial balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle print
  const handlePrint = () => {
    try {
      window.print();
    } catch (error) {
      toast.error('Failed to print trial balance');
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    if (amount < 0) {
      return `(${new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(Math.abs(amount))})`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Check if balanced (within tolerance)
  const isBalanced = trialBalanceData ? Math.abs(trialBalanceData.totals.difference) < 0.01 : false;

  // Render account section
  const renderAccountSection = (title: string, accounts: TrialBalanceAccount[]) => {
    if (accounts.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2 bg-muted p-2 rounded">{title}</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Account #</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead className="text-right w-[150px]">Debit</TableHead>
              <TableHead className="text-right w-[150px]">Credit</TableHead>
              <TableHead className="text-right w-[150px]">Net Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.accountId} className={!account.isActive ? 'opacity-60' : ''}>
                <TableCell className="font-mono">{account.accountNumber}</TableCell>
                <TableCell>
                  {account.accountName}
                  {!account.isActive && (
                    <Badge variant="secondary" className="ml-2 text-xs">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {account.debitBalance !== 0 ? formatCurrency(account.debitBalance) : '-'}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {account.creditBalance !== 0 ? formatCurrency(account.creditBalance) : '-'}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(account.netBalance)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view reports.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Trial Balance</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsOptionsDialogOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Options
          </Button>
          <Button variant="outline" onClick={() => handleGenerateReport(form.getValues())} disabled={!reportParams?.periodId}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={!trialBalanceData}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!trialBalanceData}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {reportLoading && (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Generating trial balance...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {trialBalanceData && !reportLoading ? (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{trialBalanceData.reportName}</CardTitle>
            <CardDescription>
              {trialBalanceData.periodName} | {trialBalanceData.subsidiaryName}
              <br />
              As of {trialBalanceData.asOfDate}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Account Sections */}
              {renderAccountSection('ASSETS', trialBalanceData.assetAccounts)}
              {renderAccountSection('LIABILITIES', trialBalanceData.liabilityAccounts)}
              {renderAccountSection('EQUITY', trialBalanceData.equityAccounts)}
              {renderAccountSection('REVENUE', trialBalanceData.revenueAccounts)}
              {renderAccountSection('COST OF GOODS SOLD', trialBalanceData.cogsAccounts)}
              {renderAccountSection('EXPENSES', trialBalanceData.expenseAccounts)}

              {/* Totals */}
              <div className="bg-muted p-4 rounded-lg border-4 border-double border-muted-foreground/30">
                <Table>
                  <TableBody>
                    <TableRow className="font-bold text-lg">
                      <TableCell className="w-[100px]"></TableCell>
                      <TableCell>TOTALS</TableCell>
                      <TableCell className="text-right w-[150px] font-mono">
                        {formatCurrency(trialBalanceData.totals.totalDebits)}
                      </TableCell>
                      <TableCell className="text-right w-[150px] font-mono">
                        {formatCurrency(trialBalanceData.totals.totalCredits)}
                      </TableCell>
                      <TableCell className="text-right w-[150px] font-mono">
                        {formatCurrency(trialBalanceData.totals.difference)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Balance Check */}
              <div className="text-center">
                {isBalanced ? (
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white gap-2 px-4 py-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Trial Balance is Balanced
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-2 px-4 py-2">
                    <AlertTriangle className="h-4 w-4" />
                    Trial Balance is NOT Balanced (Difference: {formatCurrency(trialBalanceData.totals.difference)})
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : !reportLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Trial Balance</CardTitle>
            <CardDescription>
              Click "Options" to configure and generate the trial balance report.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No report data available.</p>
              <Button onClick={() => setIsOptionsDialogOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Configure Report
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Options Dialog */}
      <Dialog open={isOptionsDialogOpen} onOpenChange={setIsOptionsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Trial Balance Options</DialogTitle>
            <DialogDescription>
              Configure the trial balance report parameters.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleGenerateReport)} className="space-y-4">
              <FormField
                control={form.control}
                name="periodId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accounting Period</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {periodsLoading ? (
                          <SelectItem value="" disabled>Loading periods...</SelectItem>
                        ) : accountingPeriods.length === 0 ? (
                          <SelectItem value="" disabled>No periods available</SelectItem>
                        ) : (
                          accountingPeriods.map((period) => (
                            <SelectItem key={period.id} value={period.id}>
                              {period.periodName} ({period.status})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subsidiaryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subsidiary</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="All Subsidiaries" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">All Subsidiaries</SelectItem>
                        {subsidiariesLoading ? (
                          <SelectItem value="" disabled>Loading...</SelectItem>
                        ) : (
                          subsidiaries.map((subsidiary) => (
                            <SelectItem key={subsidiary.id} value={subsidiary.id}>
                              {subsidiary.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="includeInactive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value || false}
                        onChange={field.onChange}
                        className="h-4 w-4 rounded border-input"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Include Inactive Accounts</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Show accounts that are currently inactive
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOptionsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={reportLoading || periodsLoading}>
                  {reportLoading ? "Generating..." : "Generate Report"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
