'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Download, Printer, RefreshCw, Settings, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
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
import { Input } from "@/components/ui/input";
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

interface IncomeStatementResponse {
  reportName: string;
  periodName: string;
  subsidiaryName: string;
  asOfDate: string;
  revenueSection: FinancialStatementSection;
  totalRevenue: number;
  cogsSection: FinancialStatementSection;
  totalCogs: number;
  grossProfit: number;
  grossProfitMargin: number;
  operatingExpensesSection: FinancialStatementSection;
  totalOperatingExpenses: number;
  operatingIncome: number;
  operatingMargin: number;
  netIncome: number;
  netProfitMargin: number;
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
const incomeStatementFormSchema = z.object({
  periodId: z.string().min(1, "Period is required"),
  subsidiaryId: z.string().optional(),
  includeInactive: z.boolean().optional(),
  classId: z.string().optional(),
  departmentId: z.string().optional(),
  locationId: z.string().optional(),
});

type IncomeStatementFormValues = z.infer<typeof incomeStatementFormSchema>;

// API fetch functions
async function fetchIncomeStatement(params: {
  periodId: string;
  subsidiaryId?: string;
  includeInactive?: boolean;
  classId?: string;
  departmentId?: string;
  locationId?: string;
}): Promise<IncomeStatementResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('periodId', params.periodId);
  if (params.subsidiaryId) searchParams.set('subsidiaryId', params.subsidiaryId);
  if (params.includeInactive) searchParams.set('includeInactive', 'true');
  if (params.classId) searchParams.set('classId', params.classId);
  if (params.departmentId) searchParams.set('departmentId', params.departmentId);
  if (params.locationId) searchParams.set('locationId', params.locationId);

  const response = await fetch(`/api/gl/reports/income-statement?${searchParams.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch income statement');
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

export default function IncomeStatementPage() {
  const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false);
  const [reportParams, setReportParams] = useState<IncomeStatementFormValues | null>(null);
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

  // Fetch income statement when params are set
  const {
    data: incomeStatementData,
    isLoading: reportLoading,
    error: reportError,
    refetch: refetchReport,
  } = useQuery({
    queryKey: ['income-statement', reportParams],
    queryFn: () => fetchIncomeStatement(reportParams!),
    enabled: !!reportParams && !!reportParams.periodId,
  });

  const form = useForm<IncomeStatementFormValues>({
    resolver: zodResolver(incomeStatementFormSchema),
    defaultValues: {
      periodId: "",
      subsidiaryId: "",
      includeInactive: false,
    },
  });

  // Handle generate report
  const handleGenerateReport = async (values: IncomeStatementFormValues) => {
    setReportParams(values);
    setIsOptionsDialogOpen(false);
    toast.success('Generating income statement...');
  };

  // Show error toast when report fetch fails
  if (reportError) {
    toast.error(`Failed to generate income statement: ${reportError.message}`);
  }

  // Handle export
  const handleExport = (format: 'PDF' | 'EXCEL' | 'CSV') => {
    try {
      // TODO: Implement export functionality
      toast.success(`Income statement exported as ${format}`);
    } catch (error) {
      toast.error('Failed to export income statement');
    }
  };

  // Handle print
  const handlePrint = () => {
    try {
      window.print();
    } catch (error) {
      toast.error('Failed to print income statement');
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Format percentage
  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(1)}%`;
  };

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view reports.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Income Statement</h1>
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
          <Button variant="outline" onClick={() => handleExport('PDF')}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {reportLoading && (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Generating income statement...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {incomeStatementData && !reportLoading ? (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{incomeStatementData.reportName}</CardTitle>
            <CardDescription>
              {incomeStatementData.periodName} | {incomeStatementData.subsidiaryName}
              <br />
              As of {incomeStatementData.asOfDate}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {/* Revenue Section */}
              <div>
                <h2 className="text-xl font-bold mb-4">{incomeStatementData.revenueSection.name}</h2>
                <Table>
                  <TableBody>
                    {incomeStatementData.revenueSection.lineItems.map((item) => (
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
                <div className="border-t-2 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold">TOTAL REVENUE</span>
                    <span className="text-lg font-bold">{formatCurrency(incomeStatementData.totalRevenue)}</span>
                  </div>
                </div>
              </div>

              {/* Cost of Goods Sold Section */}
              <div>
                <h2 className="text-xl font-bold mb-4">{incomeStatementData.cogsSection.name}</h2>
                <Table>
                  <TableBody>
                    {incomeStatementData.cogsSection.lineItems.map((item) => (
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
                <div className="border-t-2 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold">TOTAL COST OF GOODS SOLD</span>
                    <span className="text-lg font-bold">{formatCurrency(incomeStatementData.totalCogs)}</span>
                  </div>
                </div>
              </div>

              {/* Gross Profit */}
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border-2 border-green-200 dark:border-green-800">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span className="text-lg font-bold">GROSS PROFIT</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold">{formatCurrency(incomeStatementData.grossProfit)}</span>
                    <p className="text-sm text-green-600">
                      Margin: {formatPercentage(incomeStatementData.grossProfitMargin)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Operating Expenses Section */}
              <div>
                <h2 className="text-xl font-bold mb-4">{incomeStatementData.operatingExpensesSection.name}</h2>
                <Table>
                  <TableBody>
                    {incomeStatementData.operatingExpensesSection.lineItems.map((item) => (
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
                <div className="border-t-2 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold">TOTAL OPERATING EXPENSES</span>
                    <span className="text-lg font-bold">{formatCurrency(incomeStatementData.totalOperatingExpenses)}</span>
                  </div>
                </div>
              </div>

              {/* Operating Income */}
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    <span className="text-lg font-bold">OPERATING INCOME</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold">{formatCurrency(incomeStatementData.operatingIncome)}</span>
                    <p className="text-sm text-blue-600">
                      Margin: {formatPercentage(incomeStatementData.operatingMargin)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Net Income */}
              <div className="bg-muted p-6 rounded-lg border-4 border-double border-muted-foreground/30">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {incomeStatementData.netIncome >= 0 ? (
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    ) : (
                      <TrendingDown className="h-6 w-6 text-red-600" />
                    )}
                    <span className="text-xl font-bold">NET INCOME</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-xl font-bold ${incomeStatementData.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(incomeStatementData.netIncome)}
                    </span>
                    <p className={`text-sm ${incomeStatementData.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Margin: {formatPercentage(incomeStatementData.netProfitMargin)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg text-center">
                  <h4 className="font-semibold text-green-700 dark:text-green-300">Gross Profit Margin</h4>
                  <p className="text-2xl font-bold text-green-600">
                    {formatPercentage(incomeStatementData.grossProfitMargin)}
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg text-center">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-300">Operating Margin</h4>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatPercentage(incomeStatementData.operatingMargin)}
                  </p>
                </div>
                <div className="bg-muted p-4 rounded-lg text-center">
                  <h4 className="font-semibold text-muted-foreground">Net Margin</h4>
                  <p className={`text-2xl font-bold ${incomeStatementData.netProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(incomeStatementData.netProfitMargin)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Income Statement</CardTitle>
            <CardDescription>
              Click "Options" to configure and generate the income statement report.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No report data available.</p>
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
            <DialogTitle>Income Statement Options</DialogTitle>
            <DialogDescription>
              Configure the income statement report parameters.
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