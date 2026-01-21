'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { FileText, Printer, Mail, Eye, DollarSign, Users, AlertCircle, Calendar, ArrowUpRight, ArrowDownRight, Building2 } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// Type definitions
interface Customer {
  id: string;
  companyName: string;
  contactEmail?: string;
  contactPhone?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  entityId: string;
  invoiceDate: string | Date;
  dueDate: string | Date | null;
  totalAmount: number | string;
  paidAmount?: number | string;
  balanceDue?: number | string;
  status: string;
}

interface Payment {
  id: string;
  invoiceId: string;
  invoiceNumber?: string;
  paymentDate: string | Date;
  amount: string | number;
  paymentMethod?: string;
  transactionReference?: string;
  status: string;
}

interface StatementLine {
  date: Date;
  type: 'invoice' | 'payment';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export default function StatementsPage() {
  const { orgId } = useAuth();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [statementDateFrom, setStatementDateFrom] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split('T')[0];
  });
  const [statementDateTo, setStatementDateTo] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const printRef = useRef<HTMLDivElement>(null);

  // TRPC queries
  const { data: customersData, isLoading: customersLoading } = trpc.customers.list.useQuery(
    {},
    { enabled: !!orgId }
  );

  const { data: agingData } = trpc.invoices.aging.useQuery(
    {},
    { enabled: !!orgId }
  );

  const { data: invoicesData } = trpc.invoices.list.useQuery(
    {
      entityId: selectedCustomerId || undefined,
      dateFrom: statementDateFrom ? new Date(statementDateFrom) : undefined,
      dateTo: statementDateTo ? new Date(statementDateTo) : undefined,
      page: 1,
      limit: 500,
    },
    { enabled: !!orgId && !!selectedCustomerId }
  );

  const { data: paymentsData } = trpc.payments.list.useQuery(
    {
      entityId: selectedCustomerId || undefined,
      dateFrom: statementDateFrom ? new Date(statementDateFrom) : undefined,
      dateTo: statementDateTo ? new Date(statementDateTo) : undefined,
      page: 1,
      limit: 500,
    },
    { enabled: !!orgId && !!selectedCustomerId }
  );

  // Data extraction
  const customers = customersData || [];
  const invoices = invoicesData?.data || [];
  const payments = paymentsData?.data || [];
  const selectedCustomer = customers.find((c: Customer) => c.id === selectedCustomerId);

  // Calculate statement lines
  const generateStatementLines = (): StatementLine[] => {
    const lines: StatementLine[] = [];

    // Add invoices
    invoices.forEach((inv: Invoice) => {
      lines.push({
        date: new Date(inv.invoiceDate),
        type: 'invoice',
        reference: inv.invoiceNumber,
        description: `Invoice ${inv.invoiceNumber}`,
        debit: Number(inv.totalAmount) || 0,
        credit: 0,
        balance: 0, // Will be calculated
      });
    });

    // Add payments
    payments.forEach((pmt: Payment) => {
      if (pmt.status === 'completed') {
        lines.push({
          date: new Date(pmt.paymentDate),
          type: 'payment',
          reference: pmt.transactionReference || `Payment - ${pmt.invoiceNumber}`,
          description: `Payment received${pmt.paymentMethod ? ` (${pmt.paymentMethod.replace('_', ' ')})` : ''}`,
          debit: 0,
          credit: Number(pmt.amount) || 0,
          balance: 0, // Will be calculated
        });
      }
    });

    // Sort by date
    lines.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate running balance
    let runningBalance = 0;
    lines.forEach((line) => {
      runningBalance += line.debit - line.credit;
      line.balance = runningBalance;
    });

    return lines;
  };

  const statementLines = selectedCustomerId ? generateStatementLines() : [];
  const totalDebit = statementLines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = statementLines.reduce((sum, line) => sum + line.credit, 0);
  const closingBalance = totalDebit - totalCredit;

  // Calculate customer summaries for the list
  const customerSummaries = customers.map((customer: Customer) => {
    const customerInvoices = (invoicesData?.data || []).filter(
      (inv: Invoice) => inv.entityId === customer.id
    );
    const totalOutstanding = customerInvoices.reduce(
      (sum: number, inv: Invoice) => sum + (Number(inv.balanceDue) || 0),
      0
    );
    return {
      ...customer,
      totalOutstanding,
    };
  });

  // Handlers
  const handleViewStatement = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setIsStatementOpen(true);
  };

  const handlePrint = () => {
    if (printRef.current) {
      const printContents = printRef.current.innerHTML;
      const originalContents = document.body.innerHTML;

      document.body.innerHTML = `
        <html>
          <head>
            <title>Statement of Account - ${selectedCustomer?.companyName}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
              th { background-color: #f5f5f5; font-weight: bold; }
              .text-right { text-align: right; }
              .font-bold { font-weight: bold; }
              .text-green-600 { color: #16a34a; }
              .text-red-600 { color: #dc2626; }
              .header { margin-bottom: 20px; }
              .totals { margin-top: 20px; padding: 10px; background-color: #f5f5f5; }
            </style>
          </head>
          <body>
            ${printContents}
          </body>
        </html>
      `;

      window.print();
      document.body.innerHTML = originalContents;
      window.location.reload();
    }
  };

  const handleSendEmail = () => {
    toast.info('Email delivery feature coming soon');
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select an organization</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Statements of Account</h1>
          <p className="text-muted-foreground">Generate and view client account statements</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
            <p className="text-xs text-muted-foreground">Active customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(agingData?.totalOutstanding || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all clients</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Amount</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(
                (agingData?.bucket30 || 0) +
                (agingData?.bucket60 || 0) +
                (agingData?.bucket90 || 0) +
                (agingData?.bucketOver90 || 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground">Past due 30+ days</p>
          </CardContent>
        </Card>
      </div>

      {/* Client Selection for Quick Statement */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Statement</CardTitle>
          <CardDescription>Select a client and date range to generate a statement of account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label>Client</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer: Customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>From Date</Label>
              <Input
                type="date"
                value={statementDateFrom}
                onChange={(e) => setStatementDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label>To Date</Label>
              <Input
                type="date"
                value={statementDateTo}
                onChange={(e) => setStatementDateTo(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => setIsStatementOpen(true)}
                disabled={!selectedCustomerId}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Statement
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client List */}
      {customersLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <Table>
          <TableCaption>List of clients with account balances</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Contact Email</TableHead>
              <TableHead>Contact Phone</TableHead>
              <TableHead className="text-right">Outstanding Balance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No clients found.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer: Customer) => {
                const summary = customerSummaries.find((s: any) => s.id === customer.id);
                return (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{customer.companyName}</span>
                      </div>
                    </TableCell>
                    <TableCell>{customer.contactEmail || '-'}</TableCell>
                    <TableCell>{customer.contactPhone || '-'}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(summary?.totalOutstanding || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewStatement(customer.id)}
                          title="View Statement"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      )}

      {/* Statement Dialog */}
      <Dialog open={isStatementOpen} onOpenChange={setIsStatementOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Statement of Account</DialogTitle>
            <DialogDescription>
              {selectedCustomer?.companyName} - {formatDate(statementDateFrom)} to {formatDate(statementDateTo)}
            </DialogDescription>
          </DialogHeader>

          <div ref={printRef} className="space-y-4">
            {/* Statement Header */}
            <div className="header border-b pb-4">
              <h2 className="text-xl font-bold">Statement of Account</h2>
              <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Bill To:</p>
                  <p className="font-medium">{selectedCustomer?.companyName}</p>
                  {selectedCustomer?.contactEmail && (
                    <p>{selectedCustomer.contactEmail}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Statement Period:</p>
                  <p>{formatDate(statementDateFrom)} - {formatDate(statementDateTo)}</p>
                  <p className="text-muted-foreground mt-2">Statement Date:</p>
                  <p>{formatDate(new Date())}</p>
                </div>
              </div>
            </div>

            {/* Transaction Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statementLines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No transactions found for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  statementLines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatDate(line.date)}</TableCell>
                      <TableCell className="font-mono text-sm">{line.reference}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {line.type === 'invoice' ? (
                            <ArrowUpRight className="h-4 w-4 text-red-500" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-green-500" />
                          )}
                          {line.description}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(line.balance)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Totals */}
            <div className="totals bg-muted rounded-lg p-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Invoiced</p>
                  <p className="text-lg font-bold">{formatCurrency(totalDebit)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Paid</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(totalCredit)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Balance Due</p>
                  <p className={`text-lg font-bold ${closingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(closingBalance)}
                  </p>
                </div>
              </div>
            </div>

            {/* Aging Summary if balance due */}
            {closingBalance > 0 && (
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-2">Aging Summary:</p>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-green-50 rounded">
                    <p>Current</p>
                    <p className="font-medium">{formatCurrency(agingData?.bucketCurrent || 0)}</p>
                  </div>
                  <div className="p-2 bg-yellow-50 rounded">
                    <p>1-30 Days</p>
                    <p className="font-medium">{formatCurrency(agingData?.bucket30 || 0)}</p>
                  </div>
                  <div className="p-2 bg-orange-50 rounded">
                    <p>31-60 Days</p>
                    <p className="font-medium">{formatCurrency(agingData?.bucket60 || 0)}</p>
                  </div>
                  <div className="p-2 bg-red-50 rounded">
                    <p>60+ Days</p>
                    <p className="font-medium">{formatCurrency((agingData?.bucket90 || 0) + (agingData?.bucketOver90 || 0))}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsStatementOpen(false)}>
              Close
            </Button>
            <Button variant="outline" onClick={handleSendEmail}>
              <Mail className="mr-2 h-4 w-4" />
              Email Statement
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print / PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
