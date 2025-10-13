'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Download, Printer, RefreshCw, Settings, TrendingUp, TrendingDown } from 'lucide-react';
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

// Define interfaces for Income Statement data
interface IncomeStatementAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  balance: number;
  parentAccountId?: string;
  accountCategory: 'Revenue' | 'Expense' | 'COGS';
  accountSubcategory?: string;
  isDetailAccount: boolean;
}

interface IncomeStatementSection {
  title: string;
  accounts: IncomeStatementAccount[];
  total: number;
  subsections?: IncomeStatementSubsection[];
}

interface IncomeStatementSubsection {
  title: string;
  accounts: IncomeStatementAccount[];
  total: number;
}

interface IncomeStatementData {
  reportPeriod: string;
  startDate: string;
  endDate: string;
  revenue: IncomeStatementSection;
  costOfGoodsSold: IncomeStatementSection;
  expenses: IncomeStatementSection;
  grossProfit: number;
  operatingIncome: number;
  netIncome: number;
  grossProfitMargin: number;
  operatingMargin: number;
  netMargin: number;
}

// Form schema for report parameters
const incomeStatementFormSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  subsidiaryId: z.string().optional(),
  includeZeroBalances: z.boolean().optional(),
  reportBasis: z.enum(['ACCRUAL', 'CASH']).optional(),
  reportPeriod: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM']).optional(),
});

type IncomeStatementFormValues = z.infer<typeof incomeStatementFormSchema>;

export default function IncomeStatementPage() {
  const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [incomeStatementData, setIncomeStatementData] = useState<IncomeStatementData | null>(null);
  const { orgId } = useAuth();
  
  // Mock data for now - replace with TRPC when available
  const subsidiaries = [
    { id: '1', name: 'Main Company' },
    { id: '2', name: 'Subsidiary A' },
    { id: '3', name: 'Subsidiary B' },
  ];

  const form = useForm<IncomeStatementFormValues>({
    resolver: zodResolver(incomeStatementFormSchema),
    defaultValues: {
      startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Jan 1st of current year
      endDate: new Date().toISOString().split('T')[0],
      subsidiaryId: "",
      includeZeroBalances: false,
      reportBasis: "ACCRUAL",
      reportPeriod: "YEARLY",
    },
  });

  // Mock income statement data
  const mockIncomeStatementData: IncomeStatementData = {
    reportPeriod: `${form.watch("startDate")} to ${form.watch("endDate")}`,
    startDate: form.watch("startDate"),
    endDate: form.watch("endDate"),
    revenue: {
      title: "REVENUE",
      accounts: [],
      total: 150000,
      subsections: [
        {
          title: "Sales Revenue",
          accounts: [
            { id: '1', accountNumber: '4000', accountName: 'Product Sales', balance: 120000, accountCategory: 'Revenue', isDetailAccount: true },
            { id: '2', accountNumber: '4010', accountName: 'Service Revenue', balance: 30000, accountCategory: 'Revenue', isDetailAccount: true },
          ],
          total: 150000,
        },
      ],
    },
    costOfGoodsSold: {
      title: "COST OF GOODS SOLD",
      accounts: [],
      total: 60000,
      subsections: [
        {
          title: "Direct Costs",
          accounts: [
            { id: '3', accountNumber: '5000', accountName: 'Cost of Materials', balance: 40000, accountCategory: 'COGS', isDetailAccount: true },
            { id: '4', accountNumber: '5010', accountName: 'Direct Labor', balance: 15000, accountCategory: 'COGS', isDetailAccount: true },
            { id: '5', accountNumber: '5020', accountName: 'Manufacturing Overhead', balance: 5000, accountCategory: 'COGS', isDetailAccount: true },
          ],
          total: 60000,
        },
      ],
    },
    expenses: {
      title: "EXPENSES",
      accounts: [],
      total: 45000,
      subsections: [
        {
          title: "Operating Expenses",
          accounts: [
            { id: '6', accountNumber: '6000', accountName: 'Salaries & Wages', balance: 25000, accountCategory: 'Expense', isDetailAccount: true },
            { id: '7', accountNumber: '6010', accountName: 'Rent Expense', balance: 8000, accountCategory: 'Expense', isDetailAccount: true },
            { id: '8', accountNumber: '6020', accountName: 'Utilities', balance: 3000, accountCategory: 'Expense', isDetailAccount: true },
            { id: '9', accountNumber: '6030', accountName: 'Marketing & Advertising', balance: 5000, accountCategory: 'Expense', isDetailAccount: true },
            { id: '10', accountNumber: '6040', accountName: 'Office Supplies', balance: 2000, accountCategory: 'Expense', isDetailAccount: true },
            { id: '11', accountNumber: '6050', accountName: 'Professional Services', balance: 2000, accountCategory: 'Expense', isDetailAccount: true },
          ],
          total: 45000,
        },
      ],
    },
    grossProfit: 90000, // Revenue - COGS
    operatingIncome: 45000, // Gross Profit - Operating Expenses
    netIncome: 45000, // Operating Income (simplified, no other income/expenses)
    grossProfitMargin: 60.0, // (Gross Profit / Revenue) * 100
    operatingMargin: 30.0, // (Operating Income / Revenue) * 100
    netMargin: 30.0, // (Net Income / Revenue) * 100
  };

  // Handle generate report
  const handleGenerateReport = async (values: IncomeStatementFormValues) => {
    setIsLoading(true);
    try {
      // TODO: Implement TRPC query
      await new Promise(resolve => setTimeout(resolve, 1000)); // Mock delay
      setIncomeStatementData(mockIncomeStatementData);
      setIsOptionsDialogOpen(false);
      toast.success('Income statement generated successfully');
    } catch (error) {
      toast.error('Failed to generate income statement');
    } finally {
      setIsLoading(false);
    }
  };

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

      {incomeStatementData ? (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Income Statement</CardTitle>
            <CardDescription>
              For the period {new Date(incomeStatementData.startDate).toLocaleDateString()} to {new Date(incomeStatementData.endDate).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {/* Revenue Section */}
              <div>
                <h2 className="text-xl font-bold mb-4">{incomeStatementData.revenue.title}</h2>
                {incomeStatementData.revenue.subsections?.map((subsection, index) => (
                  <div key={index} className="mb-6">
                    <h3 className="text-lg font-semibold mb-2">{subsection.title}</h3>
                    <Table>
                      <TableBody>
                        {subsection.accounts.map((account) => (
                          <TableRow key={account.id}>
                            <TableCell className="font-medium pl-8">
                              {account.accountNumber} - {account.accountName}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(account.balance)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2">
                          <TableCell className="font-bold">
                            Total {subsection.title}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(subsection.total)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ))}
                <div className="border-t-2 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold">TOTAL REVENUE</span>
                    <span className="text-lg font-bold">{formatCurrency(incomeStatementData.revenue.total)}</span>
                  </div>
                </div>
              </div>

              {/* Cost of Goods Sold Section */}
              <div>
                <h2 className="text-xl font-bold mb-4">{incomeStatementData.costOfGoodsSold.title}</h2>
                {incomeStatementData.costOfGoodsSold.subsections?.map((subsection, index) => (
                  <div key={index} className="mb-6">
                    <h3 className="text-lg font-semibold mb-2">{subsection.title}</h3>
                    <Table>
                      <TableBody>
                        {subsection.accounts.map((account) => (
                          <TableRow key={account.id}>
                            <TableCell className="font-medium pl-8">
                              {account.accountNumber} - {account.accountName}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(account.balance)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2">
                          <TableCell className="font-bold">
                            Total {subsection.title}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(subsection.total)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ))}
                <div className="border-t-2 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold">TOTAL COST OF GOODS SOLD</span>
                    <span className="text-lg font-bold">{formatCurrency(incomeStatementData.costOfGoodsSold.total)}</span>
                  </div>
                </div>
              </div>

              {/* Gross Profit */}
              <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
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

              {/* Expenses Section */}
              <div>
                <h2 className="text-xl font-bold mb-4">{incomeStatementData.expenses.title}</h2>
                {incomeStatementData.expenses.subsections?.map((subsection, index) => (
                  <div key={index} className="mb-6">
                    <h3 className="text-lg font-semibold mb-2">{subsection.title}</h3>
                    <Table>
                      <TableBody>
                        {subsection.accounts.map((account) => (
                          <TableRow key={account.id}>
                            <TableCell className="font-medium pl-8">
                              {account.accountNumber} - {account.accountName}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(account.balance)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2">
                          <TableCell className="font-bold">
                            Total {subsection.title}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(subsection.total)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ))}
                <div className="border-t-2 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold">TOTAL EXPENSES</span>
                    <span className="text-lg font-bold">{formatCurrency(incomeStatementData.expenses.total)}</span>
                  </div>
                </div>
              </div>

              {/* Operating Income */}
              <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
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
              <div className="bg-gray-100 p-6 rounded-lg border-4 border-double border-gray-400">
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
                      Margin: {formatPercentage(incomeStatementData.netMargin)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <h4 className="font-semibold text-green-700">Gross Profit Margin</h4>
                  <p className="text-2xl font-bold text-green-600">
                    {formatPercentage(incomeStatementData.grossProfitMargin)}
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <h4 className="font-semibold text-blue-700">Operating Margin</h4>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatPercentage(incomeStatementData.operatingMargin)}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <h4 className="font-semibold text-gray-700">Net Margin</h4>
                  <p className={`text-2xl font-bold ${incomeStatementData.netMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(incomeStatementData.netMargin)}
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
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="reportPeriod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Report Period</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                        <SelectItem value="YEARLY">Yearly</SelectItem>
                        <SelectItem value="CUSTOM">Custom Period</SelectItem>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select subsidiary (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">All Subsidiaries</SelectItem>
                        {subsidiaries.map((subsidiary) => (
                          <SelectItem key={subsidiary.id} value={subsidiary.id}>
                            {subsidiary.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reportBasis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Report Basis</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ACCRUAL">Accrual</SelectItem>
                        <SelectItem value="CASH">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="includeZeroBalances"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Include Zero Balances</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Show accounts with zero balances in the report
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOptionsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Generating..." : "Generate Report"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}