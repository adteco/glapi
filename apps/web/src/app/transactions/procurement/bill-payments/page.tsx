'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Plus,
  Eye,
  Search,
  Download,
  Filter,
  CreditCard,
  Building2,
  Calendar,
  DollarSign,
  CheckCircle
} from 'lucide-react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from 'sonner';

// Types for Bill Payments
interface BillPayment {
  id: string;
  paymentNumber: string;
  vendorId: string;
  vendorName: string;
  paymentDate: string;
  paymentMethod: 'CHECK' | 'ACH' | 'WIRE' | 'CREDIT_CARD';
  bankAccountId: string;
  bankAccountName: string;
  checkNumber?: string;
  totalAmount: number;
  status: 'DRAFT' | 'PENDING' | 'POSTED' | 'CLEARED' | 'VOID';
  appliedBills: AppliedBill[];
}

interface AppliedBill {
  billId: string;
  billNumber: string;
  billTotal: number;
  amountApplied: number;
}

// Mock data
const mockPayments: BillPayment[] = [
  {
    id: '1',
    paymentNumber: 'PMT-2026-001',
    vendorId: 'v1',
    vendorName: 'Acme Supplies Inc.',
    paymentDate: '2026-01-15',
    paymentMethod: 'CHECK',
    bankAccountId: 'ba1',
    bankAccountName: 'Operating Account',
    checkNumber: '10245',
    totalAmount: 15000.00,
    status: 'CLEARED',
    appliedBills: [
      { billId: 'b1', billNumber: 'BILL-2026-001', billTotal: 12500.00, amountApplied: 12500.00 },
      { billId: 'b2', billNumber: 'BILL-2026-002', billTotal: 5000.00, amountApplied: 2500.00 },
    ],
  },
  {
    id: '2',
    paymentNumber: 'PMT-2026-002',
    vendorId: 'v2',
    vendorName: 'Global Parts Ltd.',
    paymentDate: '2026-01-16',
    paymentMethod: 'ACH',
    bankAccountId: 'ba1',
    bankAccountName: 'Operating Account',
    totalAmount: 8750.00,
    status: 'POSTED',
    appliedBills: [
      { billId: 'b3', billNumber: 'BILL-2026-003', billTotal: 8750.00, amountApplied: 8750.00 },
    ],
  },
  {
    id: '3',
    paymentNumber: 'PMT-2026-003',
    vendorId: 'v3',
    vendorName: 'Tech Components',
    paymentDate: '2026-01-17',
    paymentMethod: 'WIRE',
    bankAccountId: 'ba2',
    bankAccountName: 'Payables Account',
    totalAmount: 25000.00,
    status: 'PENDING',
    appliedBills: [
      { billId: 'b4', billNumber: 'BILL-2026-004', billTotal: 15000.00, amountApplied: 15000.00 },
      { billId: 'b5', billNumber: 'BILL-2026-005', billTotal: 10000.00, amountApplied: 10000.00 },
    ],
  },
  {
    id: '4',
    paymentNumber: 'PMT-2026-004',
    vendorId: 'v1',
    vendorName: 'Acme Supplies Inc.',
    paymentDate: '2026-01-18',
    paymentMethod: 'CHECK',
    bankAccountId: 'ba1',
    bankAccountName: 'Operating Account',
    checkNumber: '10246',
    totalAmount: 5200.00,
    status: 'DRAFT',
    appliedBills: [
      { billId: 'b6', billNumber: 'BILL-2026-006', billTotal: 5200.00, amountApplied: 5200.00 },
    ],
  },
];

// Mock unpaid bills for the create dialog
const mockUnpaidBills = [
  { id: 'ub1', billNumber: 'BILL-2026-010', vendorName: 'Acme Supplies Inc.', vendorId: 'v1', balanceDue: 3400.00, dueDate: '2026-01-25' },
  { id: 'ub2', billNumber: 'BILL-2026-011', vendorName: 'Acme Supplies Inc.', vendorId: 'v1', balanceDue: 7800.00, dueDate: '2026-01-28' },
  { id: 'ub3', billNumber: 'BILL-2026-012', vendorName: 'Global Parts Ltd.', vendorId: 'v2', balanceDue: 12500.00, dueDate: '2026-02-01' },
];

const statusColors: Record<string, string> = {
  DRAFT: 'secondary',
  PENDING: 'outline',
  POSTED: 'default',
  CLEARED: 'default',
  VOID: 'destructive',
};

const methodIcons: Record<string, string> = {
  CHECK: 'Check',
  ACH: 'Bank Transfer',
  WIRE: 'Wire',
  CREDIT_CARD: 'Credit Card',
};

// Create payment form schema
const createPaymentSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  paymentDate: z.string().min(1, "Payment date is required"),
  paymentMethod: z.enum(['CHECK', 'ACH', 'WIRE', 'CREDIT_CARD']),
  bankAccountId: z.string().min(1, "Bank account is required"),
  checkNumber: z.string().optional(),
  memo: z.string().optional(),
});

export default function BillPaymentsPage() {
  const { orgId } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<BillPayment | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);

  const form = useForm({
    resolver: zodResolver(createPaymentSchema),
    defaultValues: {
      vendorId: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'CHECK' as const,
      bankAccountId: '',
      checkNumber: '',
      memo: '',
    },
  });

  if (!orgId) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Please select an organization to view bill payments.</p>
      </div>
    );
  }

  // Filter payments
  const filteredPayments = mockPayments.filter(payment => {
    const matchesSearch =
      payment.paymentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (payment.checkNumber?.includes(searchTerm) ?? false);

    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate summary stats
  const stats = {
    totalPayments: filteredPayments.length,
    totalAmount: filteredPayments.reduce((sum, p) => sum + p.totalAmount, 0),
    pendingCount: filteredPayments.filter(p => p.status === 'PENDING').length,
    clearedCount: filteredPayments.filter(p => p.status === 'CLEARED').length,
  };

  const handleViewPayment = (payment: BillPayment) => {
    setSelectedPayment(payment);
    setViewDialogOpen(true);
  };

  const exportToCsv = () => {
    const headers = ['Payment Number', 'Vendor', 'Date', 'Method', 'Check #', 'Amount', 'Status', 'Bills'];
    const rows = filteredPayments.map(p => [
      p.paymentNumber,
      p.vendorName,
      p.paymentDate,
      p.paymentMethod,
      p.checkNumber || '',
      p.totalAmount.toFixed(2),
      p.status,
      p.appliedBills.map(b => b.billNumber).join('; '),
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill-payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreatePayment = (data: z.infer<typeof createPaymentSchema>) => {
    // In production, this would call the API
    console.log('Creating payment:', data, 'for bills:', selectedBillIds);
    toast.success('Payment created successfully');
    setCreateDialogOpen(false);
    form.reset();
    setSelectedBillIds([]);
  };

  const toggleBillSelection = (billId: string) => {
    setSelectedBillIds(prev =>
      prev.includes(billId)
        ? prev.filter(id => id !== billId)
        : [...prev, billId]
    );
  };

  const selectedBillsTotal = mockUnpaidBills
    .filter(b => selectedBillIds.includes(b.id))
    .reduce((sum, b) => sum + b.balanceDue, 0);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Bill Payments</h1>
          <p className="text-muted-foreground mt-1">
            Pay vendor bills and track payment status
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCsv}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Payment
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPayments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalAmount.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cleared</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.clearedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search payments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="POSTED">Posted</SelectItem>
            <SelectItem value="CLEARED">Cleared</SelectItem>
            <SelectItem value="VOID">Void</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payments Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment Number</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Check #</TableHead>
              <TableHead>Bank Account</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Bills</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No bill payments found
                </TableCell>
              </TableRow>
            ) : (
              filteredPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">{payment.paymentNumber}</TableCell>
                  <TableCell>{payment.vendorName}</TableCell>
                  <TableCell>{new Date(payment.paymentDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{methodIcons[payment.paymentMethod]}</Badge>
                  </TableCell>
                  <TableCell>{payment.checkNumber || '-'}</TableCell>
                  <TableCell>{payment.bankAccountName}</TableCell>
                  <TableCell className="text-right font-medium">
                    ${payment.totalAmount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColors[payment.status] as any}>
                      {payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{payment.appliedBills.length} bill(s)</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleViewPayment(payment)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* View Payment Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment Details - {selectedPayment?.paymentNumber}</DialogTitle>
            <DialogDescription>
              View payment information and applied bills
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Vendor</p>
                    <p className="font-medium">{selectedPayment.vendorName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Date</p>
                    <p className="font-medium">{new Date(selectedPayment.paymentDate).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Method</p>
                    <p className="font-medium">{methodIcons[selectedPayment.paymentMethod]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="font-medium">${selectedPayment.totalAmount.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Applied Bills</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill Number</TableHead>
                      <TableHead className="text-right">Bill Total</TableHead>
                      <TableHead className="text-right">Amount Applied</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPayment.appliedBills.map((bill) => (
                      <TableRow key={bill.billId}>
                        <TableCell>{bill.billNumber}</TableCell>
                        <TableCell className="text-right">${bill.billTotal.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${bill.amountApplied.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Payment Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Bill Payment</DialogTitle>
            <DialogDescription>
              Select bills to pay and enter payment details
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreatePayment)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vendorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vendor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="v1">Acme Supplies Inc.</SelectItem>
                          <SelectItem value="v2">Global Parts Ltd.</SelectItem>
                          <SelectItem value="v3">Tech Components</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CHECK">Check</SelectItem>
                          <SelectItem value="ACH">ACH Transfer</SelectItem>
                          <SelectItem value="WIRE">Wire Transfer</SelectItem>
                          <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ba1">Operating Account</SelectItem>
                          <SelectItem value="ba2">Payables Account</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {form.watch('paymentMethod') === 'CHECK' && (
                <FormField
                  control={form.control}
                  name="checkNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Check Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter check number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Bills to Pay */}
              <div>
                <h4 className="font-medium mb-2">Select Bills to Pay</h4>
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Bill Number</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Balance Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockUnpaidBills.map((bill) => (
                        <TableRow
                          key={bill.id}
                          className={selectedBillIds.includes(bill.id) ? 'bg-muted/50' : ''}
                          onClick={() => toggleBillSelection(bill.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <TableCell>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedBillIds.includes(bill.id) ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                              {selectedBillIds.includes(bill.id) && (
                                <CheckCircle className="h-4 w-4 text-primary-foreground" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{bill.billNumber}</TableCell>
                          <TableCell>{bill.vendorName}</TableCell>
                          <TableCell>{new Date(bill.dueDate).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">${bill.balanceDue.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
                {selectedBillIds.length > 0 && (
                  <div className="mt-2 text-right">
                    <span className="text-muted-foreground">Total: </span>
                    <span className="font-bold">${selectedBillsTotal.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={selectedBillIds.length === 0}>
                  Create Payment
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
