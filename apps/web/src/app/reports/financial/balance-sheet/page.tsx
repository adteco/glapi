'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Download, Printer, RefreshCw, Settings } from 'lucide-react';
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

// Define interfaces for Balance Sheet data
interface BalanceSheetAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  balance: number;
  parentAccountId?: string;
  accountCategory: 'Asset' | 'Liability' | 'Equity';
  accountSubcategory?: string;
  isDetailAccount: boolean;
}

interface BalanceSheetSection {
  title: string;
  accounts: BalanceSheetAccount[];
  total: number;
  subsections?: BalanceSheetSubsection[];
}

interface BalanceSheetSubsection {
  title: string;
  accounts: BalanceSheetAccount[];
  total: number;
}

interface BalanceSheetData {
  asOfDate: string;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

// Form schema for report parameters
const balanceSheetFormSchema = z.object({
  asOfDate: z.string().min(1, "As of date is required"),
  subsidiaryId: z.string().optional(),
  includeZeroBalances: z.boolean().optional(),
  reportBasis: z.enum(['ACCRUAL', 'CASH']).optional(),
});

type BalanceSheetFormValues = z.infer<typeof balanceSheetFormSchema>;

export default function BalanceSheetPage() {
  const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [balanceSheetData, setBalanceSheetData] = useState<BalanceSheetData | null>(null);
  const { orgId } = useAuth();
  
  // Mock data for now - replace with TRPC when available
  const subsidiaries = [
    { id: '1', name: 'Main Company' },
    { id: '2', name: 'Subsidiary A' },
    { id: '3', name: 'Subsidiary B' },
  ];

  const form = useForm<BalanceSheetFormValues>({
    resolver: zodResolver(balanceSheetFormSchema),
    defaultValues: {
      asOfDate: new Date().toISOString().split('T')[0],
      subsidiaryId: "",
      includeZeroBalances: false,
      reportBasis: "ACCRUAL",
    },
  });

  // Mock balance sheet data
  const mockBalanceSheetData: BalanceSheetData = {
    asOfDate: form.watch("asOfDate"),
    assets: {
      title: "ASSETS",
      accounts: [],
      total: 125000,
      subsections: [
        {
          title: "Current Assets",
          accounts: [
            { id: '1', accountNumber: '1010', accountName: 'Cash - Checking', balance: 25000, accountCategory: 'Asset', isDetailAccount: true },
            { id: '2', accountNumber: '1020', accountName: 'Cash - Savings', balance: 15000, accountCategory: 'Asset', isDetailAccount: true },
            { id: '3', accountNumber: '1100', accountName: 'Accounts Receivable', balance: 35000, accountCategory: 'Asset', isDetailAccount: true },
            { id: '4', accountNumber: '1200', accountName: 'Inventory', balance: 20000, accountCategory: 'Asset', isDetailAccount: true },
          ],
          total: 95000,
        },
        {
          title: "Fixed Assets",
          accounts: [
            { id: '5', accountNumber: '1500', accountName: 'Equipment', balance: 50000, accountCategory: 'Asset', isDetailAccount: true },
            { id: '6', accountNumber: '1510', accountName: 'Accumulated Depreciation - Equipment', balance: -20000, accountCategory: 'Asset', isDetailAccount: true },
          ],
          total: 30000,
        },
      ],
    },
    liabilities: {
      title: "LIABILITIES",
      accounts: [],
      total: 45000,
      subsections: [
        {
          title: "Current Liabilities",
          accounts: [
            { id: '7', accountNumber: '2010', accountName: 'Accounts Payable', balance: 25000, accountCategory: 'Liability', isDetailAccount: true },
            { id: '8', accountNumber: '2020', accountName: 'Accrued Expenses', balance: 10000, accountCategory: 'Liability', isDetailAccount: true },
          ],
          total: 35000,
        },
        {
          title: "Long-term Liabilities",
          accounts: [
            { id: '9', accountNumber: '2500', accountName: 'Bank Loan', balance: 10000, accountCategory: 'Liability', isDetailAccount: true },
          ],
          total: 10000,
        },
      ],
    },
    equity: {
      title: "EQUITY",
      accounts: [],
      total: 80000,
      subsections: [
        {
          title: "Owner's Equity",
          accounts: [
            { id: '10', accountNumber: '3000', accountName: 'Owner Capital', balance: 50000, accountCategory: 'Equity', isDetailAccount: true },
            { id: '11', accountNumber: '3900', accountName: 'Retained Earnings', balance: 30000, accountCategory: 'Equity', isDetailAccount: true },
          ],
          total: 80000,
        },
      ],
    },
    totalAssets: 125000,
    totalLiabilitiesAndEquity: 125000,
    isBalanced: true,
  };

  // Handle generate report
  const handleGenerateReport = async (values: BalanceSheetFormValues) => {
    setIsLoading(true);
    try {
      // TODO: Implement TRPC query
      await new Promise(resolve => setTimeout(resolve, 1000)); // Mock delay
      setBalanceSheetData(mockBalanceSheetData);
      setIsOptionsDialogOpen(false);
      toast.success('Balance sheet generated successfully');
    } catch (error) {
      toast.error('Failed to generate balance sheet');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle export
  const handleExport = (format: 'PDF' | 'EXCEL' | 'CSV') => {
    try {
      // TODO: Implement export functionality
      toast.success(`Balance sheet exported as ${format}`);
    } catch (error) {
      toast.error('Failed to export balance sheet');
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
          <Button variant="outline" onClick={() => handleExport('PDF')}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {balanceSheetData ? (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Balance Sheet</CardTitle>
            <CardDescription>
              As of {new Date(balanceSheetData.asOfDate).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {/* Assets Section */}
              <div>
                <h2 className="text-xl font-bold mb-4">{balanceSheetData.assets.title}</h2>
                {balanceSheetData.assets.subsections?.map((subsection, index) => (
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
                    <span className="text-lg font-bold">TOTAL ASSETS</span>
                    <span className="text-lg font-bold">{formatCurrency(balanceSheetData.totalAssets)}</span>
                  </div>
                </div>
              </div>

              {/* Liabilities Section */}
              <div>
                <h2 className="text-xl font-bold mb-4">{balanceSheetData.liabilities.title}</h2>
                {balanceSheetData.liabilities.subsections?.map((subsection, index) => (
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
                    <span className="text-lg font-bold">TOTAL LIABILITIES</span>
                    <span className="text-lg font-bold">{formatCurrency(balanceSheetData.liabilities.total)}</span>
                  </div>
                </div>
              </div>

              {/* Equity Section */}
              <div>
                <h2 className="text-xl font-bold mb-4">{balanceSheetData.equity.title}</h2>
                {balanceSheetData.equity.subsections?.map((subsection, index) => (
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
                    <span className="text-lg font-bold">TOTAL EQUITY</span>
                    <span className="text-lg font-bold">{formatCurrency(balanceSheetData.equity.total)}</span>
                  </div>
                </div>
              </div>

              {/* Total Liabilities and Equity */}
              <div className="border-t-4 border-double pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">TOTAL LIABILITIES AND EQUITY</span>
                  <span className="text-lg font-bold">{formatCurrency(balanceSheetData.totalLiabilitiesAndEquity)}</span>
                </div>
              </div>

              {/* Balance Check */}
              <div className="text-center">
                <Badge variant={balanceSheetData.isBalanced ? "default" : "destructive"}>
                  {balanceSheetData.isBalanced ? "Balance Sheet is Balanced" : "Balance Sheet is NOT Balanced"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Balance Sheet</CardTitle>
            <CardDescription>
              Click "Options" to configure and generate the balance sheet report.
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
            <DialogTitle>Balance Sheet Options</DialogTitle>
            <DialogDescription>
              Configure the balance sheet report parameters.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleGenerateReport)} className="space-y-4">
              <FormField
                control={form.control}
                name="asOfDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>As of Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
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