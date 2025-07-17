'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Download, Printer, RefreshCw, Settings, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
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

// Define interfaces for Cash Flow Statement data
interface CashFlowItem {
  id: string;
  description: string;
  amount: number;
  isInflow: boolean;
}

interface CashFlowSection {
  title: string;
  items: CashFlowItem[];
  netCashFlow: number;
}

interface CashFlowStatementData {
  reportPeriod: string;
  startDate: string;
  endDate: string;
  beginningCash: number;
  operatingActivities: CashFlowSection;
  investingActivities: CashFlowSection;
  financingActivities: CashFlowSection;
  netCashFlowForPeriod: number;
  endingCash: number;
  cashFlowTrend: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

// Form schema for report parameters
const cashFlowStatementFormSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  subsidiaryId: z.string().optional(),
  reportBasis: z.enum(['ACCRUAL', 'CASH']).optional(),
  reportPeriod: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM']).optional(),
  method: z.enum(['DIRECT', 'INDIRECT']).optional(),
});

type CashFlowStatementFormValues = z.infer<typeof cashFlowStatementFormSchema>;

export default function CashFlowStatementPage() {
  const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cashFlowData, setCashFlowData] = useState<CashFlowStatementData | null>(null);
  const { orgId } = useAuth();
  
  // Mock data for now - replace with TRPC when available
  const subsidiaries = [
    { id: '1', name: 'Main Company' },
    { id: '2', name: 'Subsidiary A' },
    { id: '3', name: 'Subsidiary B' },
  ];

  const form = useForm<CashFlowStatementFormValues>({
    resolver: zodResolver(cashFlowStatementFormSchema),
    defaultValues: {
      startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Jan 1st of current year
      endDate: new Date().toISOString().split('T')[0],
      subsidiaryId: "",
      reportBasis: "ACCRUAL",
      reportPeriod: "YEARLY",
      method: "INDIRECT",
    },
  });

  // Mock cash flow statement data
  const mockCashFlowData: CashFlowStatementData = {
    reportPeriod: `${form.watch("startDate")} to ${form.watch("endDate")}`,
    startDate: form.watch("startDate"),
    endDate: form.watch("endDate"),
    beginningCash: 25000,
    operatingActivities: {
      title: "CASH FLOWS FROM OPERATING ACTIVITIES",
      items: [
        { id: '1', description: 'Net Income', amount: 45000, isInflow: true },
        { id: '2', description: 'Depreciation and Amortization', amount: 8000, isInflow: true },
        { id: '3', description: 'Increase in Accounts Receivable', amount: -12000, isInflow: false },
        { id: '4', description: 'Increase in Inventory', amount: -8000, isInflow: false },
        { id: '5', description: 'Increase in Accounts Payable', amount: 5000, isInflow: true },
        { id: '6', description: 'Decrease in Prepaid Expenses', amount: 2000, isInflow: true },
      ],
      netCashFlow: 40000,
    },
    investingActivities: {
      title: "CASH FLOWS FROM INVESTING ACTIVITIES",
      items: [
        { id: '7', description: 'Purchase of Equipment', amount: -15000, isInflow: false },
        { id: '8', description: 'Sale of Old Equipment', amount: 3000, isInflow: true },
        { id: '9', description: 'Investment in Securities', amount: -5000, isInflow: false },
      ],
      netCashFlow: -17000,
    },
    financingActivities: {
      title: "CASH FLOWS FROM FINANCING ACTIVITIES",
      items: [
        { id: '10', description: 'Proceeds from Bank Loan', amount: 20000, isInflow: true },
        { id: '11', description: 'Loan Principal Payments', amount: -8000, isInflow: false },
        { id: '12', description: 'Owner Distributions', amount: -10000, isInflow: false },
        { id: '13', description: 'Interest Payments', amount: -1500, isInflow: false },
      ],
      netCashFlow: 500,
    },
    netCashFlowForPeriod: 23500, // Sum of all three activities
    endingCash: 48500, // Beginning cash + net cash flow
    cashFlowTrend: 'POSITIVE',
  };

  // Handle generate report
  const handleGenerateReport = async (values: CashFlowStatementFormValues) => {
    setIsLoading(true);
    try {
      // TODO: Implement TRPC query
      await new Promise(resolve => setTimeout(resolve, 1000)); // Mock delay
      setCashFlowData(mockCashFlowData);
      setIsOptionsDialogOpen(false);
      toast.success('Cash flow statement generated successfully');
    } catch (error) {
      toast.error('Failed to generate cash flow statement');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle export
  const handleExport = (format: 'PDF' | 'EXCEL' | 'CSV') => {
    try {
      // TODO: Implement export functionality
      toast.success(`Cash flow statement exported as ${format}`);
    } catch (error) {
      toast.error('Failed to export cash flow statement');
    }
  };

  // Handle print
  const handlePrint = () => {
    try {
      window.print();
    } catch (error) {
      toast.error('Failed to print cash flow statement');
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const renderCashFlowSection = (section: CashFlowSection) => (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4">{section.title}</h3>
      <Table>
        <TableBody>
          {section.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium pl-8 flex items-center gap-2">
                {item.isInflow ? (
                  <ArrowUp className="h-4 w-4 text-green-600" />
                ) : (
                  <ArrowDown className="h-4 w-4 text-red-600" />
                )}
                {item.description}
              </TableCell>
              <TableCell className={`text-right ${item.isInflow ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(Math.abs(item.amount))}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="border-t-2 bg-gray-50">
            <TableCell className="font-bold">
              Net Cash Flow from {section.title.split(' ').pop()}
            </TableCell>
            <TableCell className={`text-right font-bold ${section.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(section.netCashFlow)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view reports.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Cash Flow Statement</h1>
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

      {cashFlowData ? (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Cash Flow Statement</CardTitle>
            <CardDescription>
              For the period {new Date(cashFlowData.startDate).toLocaleDateString()} to {new Date(cashFlowData.endDate).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Beginning Cash Balance */}
              <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Beginning Cash Balance</span>
                  <span className="text-lg font-bold text-blue-600">
                    {formatCurrency(cashFlowData.beginningCash)}
                  </span>
                </div>
              </div>

              {/* Operating Activities */}
              {renderCashFlowSection(cashFlowData.operatingActivities)}

              {/* Investing Activities */}
              {renderCashFlowSection(cashFlowData.investingActivities)}

              {/* Financing Activities */}
              {renderCashFlowSection(cashFlowData.financingActivities)}

              {/* Net Cash Flow for Period */}
              <div className="bg-gray-100 p-4 rounded-lg border-2 border-gray-300">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {cashFlowData.netCashFlowForPeriod >= 0 ? (
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    )}
                    <span className="text-lg font-bold">Net Cash Flow for Period</span>
                  </div>
                  <span className={`text-lg font-bold ${cashFlowData.netCashFlowForPeriod >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(cashFlowData.netCashFlowForPeriod)}
                  </span>
                </div>
              </div>

              {/* Ending Cash Balance */}
              <div className="bg-green-50 p-6 rounded-lg border-4 border-double border-green-300">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold">Ending Cash Balance</span>
                  <span className="text-xl font-bold text-green-600">
                    {formatCurrency(cashFlowData.endingCash)}
                  </span>
                </div>
              </div>

              {/* Cash Flow Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded-lg text-center ${cashFlowData.operatingActivities.netCashFlow >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <h4 className={`font-semibold ${cashFlowData.operatingActivities.netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    Operating Cash Flow
                  </h4>
                  <p className={`text-2xl font-bold ${cashFlowData.operatingActivities.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(cashFlowData.operatingActivities.netCashFlow)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {cashFlowData.operatingActivities.netCashFlow >= 0 ? 'Positive operations' : 'Negative operations'}
                  </p>
                </div>
                <div className={`p-4 rounded-lg text-center ${cashFlowData.investingActivities.netCashFlow >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <h4 className={`font-semibold ${cashFlowData.investingActivities.netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    Investing Cash Flow
                  </h4>
                  <p className={`text-2xl font-bold ${cashFlowData.investingActivities.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(cashFlowData.investingActivities.netCashFlow)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {cashFlowData.investingActivities.netCashFlow >= 0 ? 'Asset sales' : 'Asset purchases'}
                  </p>
                </div>
                <div className={`p-4 rounded-lg text-center ${cashFlowData.financingActivities.netCashFlow >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <h4 className={`font-semibold ${cashFlowData.financingActivities.netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    Financing Cash Flow
                  </h4>
                  <p className={`text-2xl font-bold ${cashFlowData.financingActivities.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(cashFlowData.financingActivities.netCashFlow)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {cashFlowData.financingActivities.netCashFlow >= 0 ? 'Capital raised' : 'Capital returned'}
                  </p>
                </div>
              </div>

              {/* Cash Flow Trend Indicator */}
              <div className="text-center">
                <Badge 
                  variant={cashFlowData.cashFlowTrend === 'POSITIVE' ? "default" : 
                          cashFlowData.cashFlowTrend === 'NEGATIVE' ? "destructive" : "secondary"}
                  className="text-lg px-4 py-2"
                >
                  {cashFlowData.cashFlowTrend === 'POSITIVE' ? '📈 Positive Cash Flow Trend' :
                   cashFlowData.cashFlowTrend === 'NEGATIVE' ? '📉 Negative Cash Flow Trend' :
                   '📊 Neutral Cash Flow Trend'}
                </Badge>
              </div>

              {/* Summary Box */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h4 className="font-semibold mb-2">Cash Flow Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Cash Increase:</span>
                    <p>{formatCurrency(cashFlowData.endingCash - cashFlowData.beginningCash)}</p>
                  </div>
                  <div>
                    <span className="font-medium">Cash Growth Rate:</span>
                    <p>{((cashFlowData.endingCash - cashFlowData.beginningCash) / cashFlowData.beginningCash * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Cash Flow Statement</CardTitle>
            <CardDescription>
              Click "Options" to configure and generate the cash flow statement report.
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
            <DialogTitle>Cash Flow Statement Options</DialogTitle>
            <DialogDescription>
              Configure the cash flow statement report parameters.
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
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="INDIRECT">Indirect Method</SelectItem>
                        <SelectItem value="DIRECT">Direct Method</SelectItem>
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