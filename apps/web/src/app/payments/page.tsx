'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, DollarSign, CreditCard, RefreshCcw, Search, FileText, Check, Clock, XCircle, AlertCircle } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RouterOutputs } from '@glapi/trpc';

// Use TRPC inferred types to prevent type drift
type Payment = RouterOutputs['payments']['list']['data'][number];
type Invoice = RouterOutputs['invoices']['list']['data'][number];

// Form schemas
const paymentFormSchema = z.object({
  invoiceId: z.string().min(1, "Invoice is required"),
  paymentDate: z.string().min(1, "Payment date is required"),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Amount must be a positive number",
  }),
  paymentMethod: z.string().optional(),
  transactionReference: z.string().optional(),
});

const refundFormSchema = z.object({
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Amount must be a positive number",
  }),
  reason: z.string().min(1, "Reason is required"),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;
type RefundFormValues = z.infer<typeof refundFormSchema>;

const paymentMethods = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'check', label: 'Check' },
  { value: 'cash', label: 'Cash' },
  { value: 'ach', label: 'ACH' },
  { value: 'wire', label: 'Wire Transfer' },
  { value: 'other', label: 'Other' },
];

export default function PaymentsPage() {
  const { orgId } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // TRPC queries
  const { data: paymentsData, isLoading, refetch } = trpc.payments.list.useQuery(
    {
      page: 1,
      limit: 50,
      status: statusFilter !== 'all' ? statusFilter as 'pending' | 'completed' | 'failed' | 'refunded' : undefined,
    },
    { enabled: !!orgId }
  );

  const { data: invoicesData } = trpc.invoices.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: !!orgId }
  );

  const { data: statisticsData } = trpc.payments.statistics.useQuery(
    {},
    { enabled: !!orgId }
  );

  // TRPC mutations
  const createMutation = trpc.payments.create.useMutation({
    onSuccess: () => {
      toast.success('Payment recorded successfully');
      setIsCreateOpen(false);
      createForm.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to record payment');
    },
  });

  const refundMutation = trpc.payments.refund.useMutation({
    onSuccess: () => {
      toast.success('Refund processed successfully');
      setIsRefundOpen(false);
      setSelectedPayment(null);
      refundForm.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to process refund');
    },
  });

  // Forms
  const createForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      invoiceId: '',
      paymentDate: new Date().toISOString().split('T')[0],
      amount: '',
      paymentMethod: '',
      transactionReference: '',
    },
  });

  const refundForm = useForm<RefundFormValues>({
    resolver: zodResolver(refundFormSchema),
    defaultValues: {
      amount: '',
      reason: '',
    },
  });

  // Data extraction
  const payments = paymentsData?.data || [];
  const invoices = invoicesData?.data || [];
  const statistics = statisticsData;

  // Filter invoices that have balance due (for payment selection)
  const unpaidInvoices = invoices.filter((inv: Invoice) => {
    const balanceDue = Number(inv.balanceDue || 0);
    return balanceDue > 0 && inv.status !== 'VOID' && inv.status !== 'CANCELLED';
  });

  // Handlers
  const handleCreatePayment = (data: PaymentFormValues) => {
    createMutation.mutate({
      invoiceId: data.invoiceId,
      paymentDate: new Date(data.paymentDate),
      amount: data.amount,
      paymentMethod: data.paymentMethod || undefined,
      transactionReference: data.transactionReference || undefined,
      status: 'completed',
    });
  };

  const handleRefund = (data: RefundFormValues) => {
    if (!selectedPayment) return;
    refundMutation.mutate({
      id: selectedPayment.id,
      amount: data.amount,
      reason: data.reason,
    });
  };

  const handleViewPayment = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsViewOpen(true);
  };

  const handleOpenRefund = (payment: Payment) => {
    setSelectedPayment(payment);
    refundForm.reset({
      amount: String(payment.amount),
      reason: '',
    });
    setIsRefundOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'refunded':
        return <Badge className="bg-gray-100 text-gray-800"><RefreshCcw className="h-3 w-3 mr-1" />Refunded</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatCurrency = (amount: string | number) => {
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

  // Update form when invoice is selected
  const handleInvoiceSelect = (invoiceId: string) => {
    createForm.setValue('invoiceId', invoiceId);
    const invoice = unpaidInvoices.find((inv: Invoice) => inv.id === invoiceId);
    if (invoice) {
      const balanceDue = Number(invoice.balanceDue || invoice.totalAmount || 0);
      createForm.setValue('amount', balanceDue.toFixed(2));
    }
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
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">Record and manage customer payments</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Record Payment
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.totalPayments || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics?.totalAmount || 0)}</div>
            <p className="text-xs text-muted-foreground">Collected</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Amount</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics?.netAmount || 0)}</div>
            <p className="text-xs text-muted-foreground">After refunds</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Refunded</CardTitle>
            <RefreshCcw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics?.totalRefunded || 0)}</div>
            <p className="text-xs text-muted-foreground">Total refunds</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search payments..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payments Table */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <Table>
          <TableCaption>List of customer payments</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No payments found. Record your first payment to get started.
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment: Payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                  <TableCell className="font-medium">
                    {payment.invoiceNumber || '-'}
                  </TableCell>
                  <TableCell>{payment.customerName || '-'}</TableCell>
                  <TableCell className="capitalize">
                    {payment.paymentMethod?.replace('_', ' ') || '-'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {payment.transactionReference || '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(payment.amount)}
                  </TableCell>
                  <TableCell>{getStatusBadge(payment.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewPayment(payment)}
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {payment.status === 'completed' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenRefund(payment)}
                          title="Process Refund"
                        >
                          <RefreshCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* Create Payment Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a customer payment against an invoice
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreatePayment)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="invoiceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={handleInvoiceSelect}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an invoice" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {unpaidInvoices.length === 0 ? (
                          <SelectItem value="" disabled>No unpaid invoices</SelectItem>
                        ) : (
                          unpaidInvoices.map((invoice: Invoice) => (
                            <SelectItem key={invoice.id} value={invoice.id}>
                              {invoice.invoiceNumber} - {invoice.customerName || 'Unknown'} ({formatCurrency(invoice.balanceDue || invoice.totalAmount)} due)
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
                control={createForm.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="pl-8"
                          placeholder="0.00"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentMethods.map((method) => (
                          <SelectItem key={method.value} value={method.value}>
                            {method.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="transactionReference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Check #, Transaction ID, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Recording...' : 'Record Payment'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Payment Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{formatDate(selectedPayment.paymentDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p>{getStatusBadge(selectedPayment.status)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Invoice</p>
                  <p className="font-medium">{selectedPayment.invoiceNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedPayment.customerName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-medium text-lg">{formatCurrency(selectedPayment.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Method</p>
                  <p className="font-medium capitalize">{selectedPayment.paymentMethod?.replace('_', ' ') || '-'}</p>
                </div>
                {selectedPayment.transactionReference && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Reference</p>
                    <p className="font-mono">{selectedPayment.transactionReference}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
            {selectedPayment?.status === 'completed' && (
              <Button
                variant="outline"
                onClick={() => {
                  setIsViewOpen(false);
                  handleOpenRefund(selectedPayment);
                }}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Process Refund
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <AlertDialog open={isRefundOpen} onOpenChange={setIsRefundOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Process Refund</AlertDialogTitle>
            <AlertDialogDescription>
              This will process a refund for the payment. This action may trigger revenue adjustments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Form {...refundForm}>
            <form onSubmit={refundForm.handleSubmit(handleRefund)} className="space-y-4">
              {selectedPayment && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm text-muted-foreground">Original Payment</p>
                  <p className="font-medium">{formatCurrency(selectedPayment.amount)}</p>
                </div>
              )}

              <FormField
                control={refundForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Refund Amount *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={selectedPayment ? Number(selectedPayment.amount) : undefined}
                          className="pl-8"
                          placeholder="0.00"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={refundForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Refund *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter reason for this refund..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <AlertDialogFooter>
                <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                <Button type="submit" variant="destructive" disabled={refundMutation.isPending}>
                  {refundMutation.isPending ? 'Processing...' : 'Process Refund'}
                </Button>
              </AlertDialogFooter>
            </form>
          </Form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
