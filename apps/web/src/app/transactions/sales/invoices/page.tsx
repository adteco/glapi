'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Eye, Send, DollarSign, Check, Clock, FileText, XCircle } from 'lucide-react';
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
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import type { RouterOutputs } from '@glapi/trpc';

// Use TRPC inferred types to prevent type drift
type Invoice = RouterOutputs['invoices']['list']['data'][number];
type InvoiceLineItem = RouterOutputs['invoices']['get']['lineItems'][number];
type SalesOrder = RouterOutputs['salesOrders']['list']['data'][number];

// Form schemas
const invoiceLineSchema = z.object({
  itemId: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
});

const invoiceFormSchema = z.object({
  entityId: z.string().min(1, "Customer is required"),
  invoiceDate: z.string().min(1, "Invoice date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  memo: z.string().max(1000, "Memo too long").optional(),
  lineItems: z.array(invoiceLineSchema).min(1, "At least one line item is required"),
});

const createFromSalesOrderSchema = z.object({
  salesOrderId: z.string().min(1, "Sales order is required"),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  memo: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;
type CreateFromSOFormValues = z.infer<typeof createFromSalesOrderSchema>;

export default function SalesInvoicesPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCreateFromSODialogOpen, setIsCreateFromSODialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const { orgId } = useAuth();

  // TRPC Queries
  const { data: invoicesData, isLoading, refetch } = trpc.invoices.list.useQuery(
    { page: 1, limit: 50 },
    { enabled: !!orgId }
  );

  const { data: customersData } = trpc.customers.list.useQuery(
    {},
    { enabled: !!orgId }
  );

  const { data: salesOrdersData } = trpc.salesOrders.list.useQuery(
    { filters: { status: 'APPROVED' } },
    { enabled: !!orgId }
  );

  const { data: itemsData } = trpc.items.list.useQuery(
    {},
    { enabled: !!orgId }
  );

  const { data: selectedInvoiceDetail } = trpc.invoices.get.useQuery(
    { id: selectedInvoice?.id || '' },
    { enabled: !!selectedInvoice?.id && isViewDialogOpen }
  );

  // TRPC Mutations
  const createMutation = trpc.invoices.create.useMutation({
    onSuccess: () => {
      toast.success('Invoice created successfully');
      setIsAddDialogOpen(false);
      form.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create invoice');
    },
  });

  const createFromSOMutation = trpc.salesOrders.createInvoice.useMutation({
    onSuccess: (data) => {
      toast.success(`Invoice ${data.invoiceNumber} created from sales order`);
      setIsCreateFromSODialogOpen(false);
      soForm.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create invoice from sales order');
    },
  });

  const sendMutation = trpc.invoices.send.useMutation({
    onSuccess: () => {
      toast.success('Invoice sent to customer');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send invoice');
    },
  });

  const voidMutation = trpc.invoices.void.useMutation({
    onSuccess: () => {
      toast.success('Invoice voided');
      setIsVoidDialogOpen(false);
      setVoidReason('');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to void invoice');
    },
  });

  // Data extraction
  const invoices = invoicesData?.data || [];
  const customers = customersData || [];
  const salesOrders = salesOrdersData?.data || [];
  const items = itemsData || [];

  // Forms
  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      entityId: "",
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      memo: "",
      lineItems: [{ itemId: "", description: "", quantity: 1, unitPrice: 0 }],
    },
  });

  const soForm = useForm<CreateFromSOFormValues>({
    resolver: zodResolver(createFromSalesOrderSchema),
    defaultValues: {
      salesOrderId: "",
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      memo: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  // Handlers
  const handleCreateInvoice = async (values: InvoiceFormValues) => {
    const lineItems = values.lineItems.map(line => ({
      itemId: line.itemId || undefined,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: line.quantity * line.unitPrice,
    }));

    const subtotal = lineItems.reduce((sum, line) => sum + line.amount, 0);

    createMutation.mutate({
      entityId: values.entityId,
      invoiceDate: new Date(values.invoiceDate),
      dueDate: new Date(values.dueDate),
      subtotal,
      totalAmount: subtotal, // Add tax calculation if needed
      lineItems,
      metadata: values.memo ? { memo: values.memo } : undefined,
    });
  };

  const handleCreateFromSalesOrder = async (values: CreateFromSOFormValues) => {
    createFromSOMutation.mutate({
      salesOrderId: values.salesOrderId,
      invoiceDate: values.invoiceDate ? new Date(values.invoiceDate) : undefined,
      dueDate: values.dueDate ? new Date(values.dueDate) : undefined,
      memo: values.memo,
    });
  };

  const handleSendInvoice = (invoice: Invoice) => {
    sendMutation.mutate({ id: invoice.id });
  };

  const handleVoidInvoice = () => {
    if (selectedInvoice && voidReason) {
      voidMutation.mutate({ id: selectedInvoice.id, reason: voidReason });
    }
  };

  // Helpers
  const formatCurrency = (value: number | string | null | undefined) => {
    const num = typeof value === 'string' ? parseFloat(value) : (value || 0);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'draft': return 'outline';
      case 'sent': return 'default';
      case 'paid': return 'default';
      case 'overdue': return 'destructive';
      case 'void': return 'secondary';
      default: return 'outline';
    }
  };

  const getCustomerName = (entityId: string) => {
    const customer = customers.find((c: { id?: string; companyName: string }) => c.id === entityId);
    return customer?.companyName || 'Unknown';
  };

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view invoices.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Sales Invoices</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsCreateFromSODialogOpen(true)}>
            <FileText className="mr-2 h-4 w-4" />
            From Sales Order
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        </div>
      </div>

      <Table>
        <TableCaption>A list of sales invoices.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                No invoices found. Create your first invoice to get started.
              </TableCell>
            </TableRow>
          ) : (
            invoices.map((invoice: Invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                <TableCell>{getCustomerName(invoice.entityId)}</TableCell>
                <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                <TableCell className="text-right">{formatCurrency(invoice.totalAmount)}</TableCell>
                <TableCell className="text-right">{formatCurrency(invoice.balanceDue || invoice.totalAmount)}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(invoice.status)}>
                    {invoice.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedInvoice(invoice);
                        setIsViewDialogOpen(true);
                      }}
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {invoice.status?.toLowerCase() === 'draft' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSendInvoice(invoice)}
                        title="Send Invoice"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    {['draft', 'sent'].includes(invoice.status?.toLowerCase() || '') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setIsVoidDialogOpen(true);
                        }}
                        title="Void Invoice"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Create Invoice Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Sales Invoice</DialogTitle>
            <DialogDescription>Create a new invoice for a customer.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateInvoice)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="entityId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((customer: { id?: string; companyName: string }) => (
                            <SelectItem key={customer.id} value={customer.id || ''}>
                              {customer.companyName}
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
                  name="invoiceDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date *</FormLabel>
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
                name="memo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Memo</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Notes for this invoice..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Line Items</h3>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ itemId: "", description: "", quantity: 1, unitPrice: 0 })}
                  >
                    Add Line
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <div key={field.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Line {index + 1}</span>
                      {fields.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.itemId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Item</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select item" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">Custom</SelectItem>
                                {items.map((item: { id: string; name: string }) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.name}
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
                        name={`lineItems.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Description" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Qty</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Price</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Invoice'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Create from Sales Order Dialog */}
      <Dialog open={isCreateFromSODialogOpen} onOpenChange={setIsCreateFromSODialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Invoice from Sales Order</DialogTitle>
            <DialogDescription>
              Select an approved sales order to create an invoice.
            </DialogDescription>
          </DialogHeader>
          <Form {...soForm}>
            <form onSubmit={soForm.handleSubmit(handleCreateFromSalesOrder)} className="space-y-4">
              <FormField
                control={soForm.control}
                name="salesOrderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sales Order *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sales order" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {salesOrders.map((order: SalesOrder) => (
                          <SelectItem key={order.id} value={order.id}>
                            {order.orderNumber} - {order.customerName || 'Customer'} ({formatCurrency(order.totalAmount)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={soForm.control}
                name="invoiceDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={soForm.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={soForm.control}
                name="memo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Memo</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Notes..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateFromSODialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createFromSOMutation.isPending}>
                  {createFromSOMutation.isPending ? 'Creating...' : 'Create Invoice'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>Invoice {selectedInvoice?.invoiceNumber}</DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{getCustomerName(selectedInvoice.entityId)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={getStatusBadgeVariant(selectedInvoice.status)}>
                    {selectedInvoice.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Date</p>
                  <p className="font-medium">{formatDate(selectedInvoice.invoiceDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">{formatDate(selectedInvoice.dueDate)}</p>
                </div>
              </div>

              {selectedInvoiceDetail?.lineItems && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Line Items</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoiceDetail.lineItems.map((line: InvoiceLineItem) => (
                        <TableRow key={line.id}>
                          <TableCell>{line.description}</TableCell>
                          <TableCell className="text-right">{line.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(line.unitPrice)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(line.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
                <span className="font-semibold">Total Amount</span>
                <span className="text-xl font-bold">{formatCurrency(selectedInvoice.totalAmount)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Void Invoice Dialog */}
      <AlertDialog open={isVoidDialogOpen} onOpenChange={setIsVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to void invoice {selectedInvoice?.invoiceNumber}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Reason for voiding *</label>
            <Textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Enter reason..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsVoidDialogOpen(false);
              setVoidReason('');
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoidInvoice}
              disabled={!voidReason || voidMutation.isPending}
            >
              {voidMutation.isPending ? 'Voiding...' : 'Void Invoice'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
