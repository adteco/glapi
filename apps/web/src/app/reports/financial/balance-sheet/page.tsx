'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Download, Printer, RefreshCw, Settings, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// API response interfaces (matching backend types)
interface FinancialStatementLineItem {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountCategory: string;
  accountSubcategory: string | null;
  currentPeriodAmount: number;
  ytdAmount: number;
  priorPeriodAmount?: number;
}

interface FinancialStatementSection {
  name: string;
  category: string;
  subcategory?: string;
  lineItems: FinancialStatementLineItem[];
  sectionTotal: number;
  priorPeriodTotal?: number;
}

interface BalanceSheetResponse {
  reportName: string;
  periodName: string;
  subsidiaryName: string;
  asOfDate: string;
  currentAssetsSection: FinancialStatementSection;
  totalCurrentAssets: number;
  nonCurrentAssetsSection: FinancialStatementSection;
  totalNonCurrentAssets: number;
  totalAssets: number;
  currentLiabilitiesSection: FinancialStatementSection;
  totalCurrentLiabilities: number;
  longTermLiabilitiesSection: FinancialStatementSection;
  totalLongTermLiabilities: number;
  totalLiabilities: number;
  equitySection: FinancialStatementSection;
  retainedEarnings: number;
  currentPeriodNetIncome: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  balanceCheck: number;
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
const balanceSheetFormSchema = z.object({
  periodId: z.string().min(1, "Period is required"),
  subsidiaryId: z.string().optional(),
  includeInactive: z.boolean().optional(),
  classId: z.string().optional(),
  departmentId: z.string().optional(),
  locationId: z.string().optional(),
});

type BalanceSheetFormValues = z.infer<typeof balanceSheetFormSchema>;

// API fetch functions
async function fetchBalanceSheet(params: {
  periodId: string;
  subsidiaryId?: string;
  includeInactive?: boolean;
  classId?: string;
  departmentId?: string;
  locationId?: string;
}): Promise<BalanceSheetResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('periodId', params.periodId);
  if (params.subsidiaryId) searchParams.set('subsidiaryId', params.subsidiaryId);
  if (params.includeInactive) searchParams.set('includeInactive', 'true');
  if (params.classId) searchParams.set('classId', params.classId);
  if (params.departmentId) searchParams.set('departmentId', params.departmentId);
  if (params.locationId) searchParams.set('locationId', params.locationId);

  const response = await fetch(`/api/gl/reports/balance-sheet?${searchParams.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch balance sheet');
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

export default function BalanceSheetPage() {
  const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false);
  const [reportParams, setReportParams] = useState<BalanceSheetFormValues | null>(null);
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

  // Fetch balance sheet when params are set
  const {
    data: balanceSheetData,
    isLoading: reportLoading,
    error: reportError,
    refetch: refetchReport,
  } = useQuery({
    queryKey: ['balance-sheet', reportParams],
    queryFn: () => fetchBalanceSheet(reportParams!),
    enabled: !!reportParams && !!reportParams.periodId,
  });

  const form = useForm<BalanceSheetFormValues>({
    resolver: zodResolver(balanceSheetFormSchema),
    defaultValues: {
      periodId: "",
      subsidiaryId: "",
      includeInactive: false,
    },
  });

  // Handle generate report
  const handleGenerateReport = async (values: BalanceSheetFormValues) => {
    setReportParams(values);
    setIsOptionsDialogOpen(false);
    toast.success('Generating balance sheet...');
  };

  // Show error toast when report fetch fails
  if (reportError) {
    toast.error(`Failed to generate balance sheet: ${reportError.message}`);
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

      const response = await fetch(`/api/gl/reports/balance-sheet/export?${searchParams.toString()}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to export balance sheet');
      }

      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `balance-sheet-${reportParams.periodId}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Balance sheet exported as CSV');
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `balance-sheet-${reportParams.periodId}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Balance sheet exported as JSON');
      }
    } catch (error) {
      toast.error(`Failed to export balance sheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle print
  const handlePrint = () => {
    try {
      window.print();
    } catch (error) {
      toast.error('Failed to print balance sheet');
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Check if balanced (within tolerance)
  const isBalanced = balanceSheetData ? Math.abs(balanceSheetData.balanceCheck) < 0.01 : false;

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view reports.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Balance Sheet</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsOptionsDialogOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Options
          </Button>
          <Button variant="outline" onClick={() => handleGenerateReport(form.getValues())}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!balanceSheetData}>
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
              <p className="text-muted-foreground">Generating balance sheet...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {balanceSheetData && !reportLoading ? (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{balanceSheetData.reportName}</CardTitle>
            <CardDescription>
              {balanceSheetData.periodName} | {balanceSheetData.subsidiaryName}
              <br />
              As of {balanceSheetData.asOfDate}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {/* ASSETS */}
              <div>
                <h2 className="text-xl font-bold mb-4 bg-muted p-2 rounded">ASSETS</h2>

                {/* Current Assets */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">{balanceSheetData.currentAssetsSection.name}</h3>
                  <Table>
                    <TableBody>
                      {balanceSheetData.currentAssetsSection.lineItems.map((item) => (
                        <TableRow key={item.accountId}>
                          <TableCell className="font-medium pl-8">
                            {item.accountNumber} - {item.accountName}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.currentPeriodAmount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(item.ytdAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between items-center pl-4">
                      <span className="font-semibold">Total Current Assets</span>
                      <span className="font-semibold">{formatCurrency(balanceSheetData.totalCurrentAssets)}</span>
                    </div>
                  </div>
                </div>

                {/* Non-Current Assets */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">{balanceSheetData.nonCurrentAssetsSection.name}</h3>
                  <Table>
                    <TableBody>
                      {balanceSheetData.nonCurrentAssetsSection.lineItems.map((item) => (
                        <TableRow key={item.accountId}>
                          <TableCell className="font-medium pl-8">
                            {item.accountNumber} - {item.accountName}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.currentPeriodAmount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(item.ytdAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between items-center pl-4">
                      <span className="font-semibold">Total Non-Current Assets</span>
                      <span className="font-semibold">{formatCurrency(balanceSheetData.totalNonCurrentAssets)}</span>
                    </div>
                  </div>
                </div>

                {/* Total Assets */}
                <div className="border-t-2 border-primary pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold">TOTAL ASSETS</span>
                    <span className="text-lg font-bold">{formatCurrency(balanceSheetData.totalAssets)}</span>
                  </div>
                </div>
              </div>

              {/* LIABILITIES */}
              <div>
                <h2 className="text-xl font-bold mb-4 bg-muted p-2 rounded">LIABILITIES</h2>

                {/* Current Liabilities */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">{balanceSheetData.currentLiabilitiesSection.name}</h3>
                  <Table>
                    <TableBody>
                      {balanceSheetData.currentLiabilitiesSection.lineItems.map((item) => (
                        <TableRow key={item.accountId}>
                          <TableCell className="font-medium pl-8">
                            {item.accountNumber} - {item.accountName}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.currentPeriodAmount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(item.ytdAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between items-center pl-4">
                      <span className="font-semibold">Total Current Liabilities</span>
                      <span className="font-semibold">{formatCurrency(balanceSheetData.totalCurrentLiabilities)}</span>
                    </div>
                  </div>
                </div>

                {/* Long-Term Liabilities */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">{balanceSheetData.longTermLiabilitiesSection.name}</h3>
                  <Table>
                    <TableBody>
                      {balanceSheetData.longTermLiabilitiesSection.lineItems.map((item) => (
                        <TableRow key={item.accountId}>
                          <TableCell className="font-medium pl-8">
                            {item.accountNumber} - {item.accountName}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.currentPeriodAmount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(item.ytdAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between items-center pl-4">
                      <span className="font-semibold">Total Long-Term Liabilities</span>
                      <span className="font-semibold">{formatCurrency(balanceSheetData.totalLongTermLiabilities)}</span>
                    </div>
                  </div>
                </div>

                {/* Total Liabilities */}
                <div className="border-t-2 border-primary pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold">TOTAL LIABILITIES</span>
                    <span className="text-lg font-bold">{formatCurrency(balanceSheetData.totalLiabilities)}</span>
                  </div>
                </div>
              </div>

              {/* EQUITY */}
              <div>
                <h2 className="text-xl font-bold mb-4 bg-muted p-2 rounded">EQUITY</h2>

                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">{balanceSheetData.equitySection.name}</h3>
                  <Table>
                    <TableBody>
                      {balanceSheetData.equitySection.lineItems.map((item) => (
                        <TableRow key={item.accountId}>
                          <TableCell className="font-medium pl-8">
                            {item.accountNumber} - {item.accountName}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.currentPeriodAmount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(item.ytdAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Retained Earnings */}
                      <TableRow>
                        <TableCell className="font-medium pl-8">
                          Retained Earnings
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(balanceSheetData.retainedEarnings)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(balanceSheetData.retainedEarnings)}
                        </TableCell>
                      </TableRow>
                      {/* Current Period Net Income */}
                      <TableRow>
                        <TableCell className="font-medium pl-8">
                          Current Period Net Income
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(balanceSheetData.currentPeriodNetIncome)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(balanceSheetData.currentPeriodNetIncome)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Total Equity */}
                <div className="border-t-2 border-primary pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold">TOTAL EQUITY</span>
                    <span className="text-lg font-bold">{formatCurrency(balanceSheetData.totalEquity)}</span>
                  </div>
                </div>
              </div>

              {/* Total Liabilities and Equity */}
              <div className="bg-muted p-4 rounded-lg border-4 border-double border-muted-foreground/30">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold">TOTAL LIABILITIES AND EQUITY</span>
                  <span className="text-xl font-bold">{formatCurrency(balanceSheetData.totalLiabilitiesAndEquity)}</span>
                </div>
              </div>

              {/* Balance Check */}
              <div className="text-center">
                {isBalanced ? (
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white gap-2 px-4 py-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Balance Sheet is Balanced
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-2 px-4 py-2">
                    <AlertTriangle className="h-4 w-4" />
                    Balance Sheet is NOT Balanced (Difference: {formatCurrency(balanceSheetData.balanceCheck)})
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : !reportLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Balance Sheet</CardTitle>
            <CardDescription>
              Click "Options" to configure and generate the balance sheet report.
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
            <DialogTitle>Balance Sheet Options</DialogTitle>
            <DialogDescription>
              Configure the balance sheet report parameters.
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
