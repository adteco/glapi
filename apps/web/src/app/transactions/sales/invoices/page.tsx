'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Eye, Send, DollarSign, Check, Clock } from 'lucide-react';
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

// Define interfaces for the Sales Invoice data
interface SalesInvoice {
  id: string;
  transactionNumber: string;
  salesOrderNumber?: string;
  entityId: string;
  customerName: string;
  transactionDate: string;
  dueDate: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paymentTerms: string;
  billingAddress: string;
  shippingAddress: string;
  notes: string;
  lines: SalesInvoiceLine[];
}

interface SalesInvoiceLine {
  id: string;
  salesOrderLineId?: string;
  itemId: string;
  itemName: string;
  itemSku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  lineAmount: number;
  taxAmount: number;
  totalLineAmount: number;
}

// Form schemas
const salesInvoiceLineSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  discountPercent: z.number().min(0).max(100, "Discount must be between 0 and 100").optional(),
});

const salesInvoiceFormSchema = z.object({
  salesOrderId: z.string().optional(),
  entityId: z.string().min(1, "Customer is required"),
  transactionDate: z.string().min(1, "Transaction date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  paymentTerms: z.string().min(1, "Payment terms are required"),
  billingAddressId: z.string().optional(),
  shippingAddressId: z.string().optional(),
  notes: z.string().max(1000, "Notes too long").optional(),
  requiresApproval: z.boolean().optional(),
  lines: z.array(salesInvoiceLineSchema).min(1, "At least one line item is required"),
});

type SalesInvoiceFormValues = z.infer<typeof salesInvoiceFormSchema>;

export default function SalesInvoicesPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const { orgId } = useAuth();
  
  // Mock data for now - replace with TRPC when available
  const invoices: SalesInvoice[] = [];
  const customers = [
    { id: '1', name: 'Acme Corp', email: 'contact@acme.com' },
    { id: '2', name: 'Tech Solutions Inc', email: 'info@techsolutions.com' },
    { id: '3', name: 'Global Industries', email: 'business@global.com' },
  ];
  const salesOrders = [
    { id: '1', number: 'SO-2024-001', customerName: 'Acme Corp' },
    { id: '2', number: 'SO-2024-002', customerName: 'Tech Solutions Inc' },
  ];
  const items = [
    { id: '1', name: 'Product A', sku: 'PROD-A-001', price: 99.99 },
    { id: '2', name: 'Product B', sku: 'PROD-B-002', price: 149.99 },
    { id: '3', name: 'Service Package', sku: 'SERV-001', price: 299.99 },
  ];
  const paymentTermsOptions = [
    'Net 30',
    'Net 15',
    'Net 10',
    '2/10 Net 30',
    '1/10 Net 30',
    'Due on Receipt',
    'COD',
  ];

  const form = useForm<SalesInvoiceFormValues>({
    resolver: zodResolver(salesInvoiceFormSchema),
    defaultValues: {
      salesOrderId: "",
      entityId: "",
      transactionDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      paymentTerms: "",
      billingAddressId: "",
      shippingAddressId: "",
      notes: "",
      requiresApproval: false,
      lines: [
        { itemId: "", description: "", quantity: 1, unitPrice: 0, discountPercent: 0 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  // Handle add invoice
  const handleAddInvoice = async (values: SalesInvoiceFormValues) => {
    try {
      // TODO: Implement TRPC mutation
      const status = values.requiresApproval ? 'PENDING_APPROVAL' : 'DRAFT';
      toast.success(`Invoice created with status: ${status}`);
      setIsAddDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error('Failed to create invoice');
    }
  };

  // Handle approve invoice
  const handleApproveInvoice = async (invoice: SalesInvoice) => {
    try {
      // TODO: Implement TRPC mutation to approve invoice
      toast.success('Invoice approved successfully');
    } catch (error) {
      toast.error('Failed to approve invoice');
    }
  };

  // Handle send invoice
  const handleSendInvoice = async (invoice: SalesInvoice) => {
    try {
      // TODO: Implement TRPC mutation to send invoice to customer
      toast.success('Invoice sent to customer');
    } catch (error) {
      toast.error('Failed to send invoice');
    }
  };

  // Handle record payment
  const handleRecordPayment = async (invoice: SalesInvoice) => {
    try {
      // TODO: Implement TRPC mutation to record payment
      toast.success('Payment recorded for invoice');
    } catch (error) {
      toast.error('Failed to record payment');
    }
  };

  // Handle delete invoice
  const handleDeleteInvoice = async () => {
    try {
      // TODO: Implement TRPC mutation
      toast.success('Invoice deleted successfully');
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast.error('Failed to delete invoice');
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'outline';
      case 'PENDING_APPROVAL': return 'secondary';
      case 'APPROVED': return 'default';
      case 'SENT': return 'default';
      case 'PARTIALLY_PAID': return 'secondary';
      case 'PAID': return 'default';
      case 'OVERDUE': return 'destructive';
      case 'CANCELLED': return 'destructive';
      default: return 'outline';
    }
  };

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view invoices.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Sales Invoices</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Invoice
        </Button>
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
            <TableHead className="text-right">Balance Due</TableHead>
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
            invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.transactionNumber}</TableCell>
                <TableCell>{invoice.customerName}</TableCell>
                <TableCell>{new Date(invoice.transactionDate).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">${invoice.totalAmount.toFixed(2)}</TableCell>
                <TableCell className="text-right">${invoice.balanceDue.toFixed(2)}</TableCell>
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
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {invoice.status === 'PENDING_APPROVAL' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleApproveInvoice(invoice)}
                        title="Approve Invoice"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    {(invoice.status === 'APPROVED' || invoice.status === 'DRAFT') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSendInvoice(invoice)}
                        title="Send to Customer"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    {(invoice.status === 'SENT' || invoice.status === 'PARTIALLY_PAID' || invoice.status === 'OVERDUE') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRecordPayment(invoice)}
                        title="Record Payment"
                      >
                        <DollarSign className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedInvoice(invoice);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Add Invoice Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Sales Invoice</DialogTitle>
            <DialogDescription>
              Create a new sales invoice for a customer.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddInvoice)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="entityId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
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
                  name="salesOrderId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Order (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sales order" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {salesOrders.map((order) => (
                            <SelectItem key={order.id} value={order.id}>
                              {order.number} - {order.customerName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="transactionDate"
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
                  control={form.control}
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Terms</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment terms" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {paymentTermsOptions.map((terms) => (
                            <SelectItem key={terms} value={terms}>
                              {terms}
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
                  name="requiresApproval"
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
                        <FormLabel>Requires Approval</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Invoice will be created with "Pending Approval" status
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Additional notes..." {...field} />
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
                    onClick={() => append({ itemId: "", description: "", quantity: 1, unitPrice: 0, discountPercent: 0 })}
                  >
                    Add Line Item
                  </Button>
                </div>

                {fields.map((field, index) => {
                  const selectedItem = items.find(item => item.id === field.itemId);
                  const lineAmount = field.quantity * field.unitPrice * (1 - (field.discountPercent || 0) / 100);
                  
                  return (
                    <div key={field.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Line {index + 1}</span>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <FormField
                          control={form.control}
                          name={`lines.${index}.itemId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Item</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select item" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {items.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                      {item.name} ({item.sku})
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
                          name={`lines.${index}.description`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Input placeholder="Line description..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`lines.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantity</FormLabel>
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
                          name={`lines.${index}.unitPrice`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unit Price</FormLabel>
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
                          name={`lines.${index}.discountPercent`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Discount %</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      {selectedItem && (
                        <div className="bg-gray-50 p-3 rounded-md">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Standard Price:</span>
                              <p>${selectedItem.price.toFixed(2)}</p>
                            </div>
                            <div>
                              <span className="font-medium">Line Total:</span>
                              <p>${lineAmount.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Create Invoice
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
            <DialogDescription>
              View invoice {selectedInvoice?.transactionNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Invoice Number</label>
                  <p className="text-sm">{selectedInvoice.transactionNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Customer</label>
                  <p className="text-sm">{selectedInvoice.customerName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Invoice Date</label>
                  <p className="text-sm">{new Date(selectedInvoice.transactionDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Due Date</label>
                  <p className="text-sm">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Payment Terms</label>
                  <p className="text-sm">{selectedInvoice.paymentTerms}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <p className="text-sm">
                    <Badge variant={getStatusBadgeVariant(selectedInvoice.status)}>
                      {selectedInvoice.status}
                    </Badge>
                  </p>
                </div>
              </div>
              {selectedInvoice.notes && (
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <p className="text-sm">{selectedInvoice.notes}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Line Items</label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.itemName}</TableCell>
                        <TableCell>{line.description}</TableCell>
                        <TableCell>{line.quantity}</TableCell>
                        <TableCell>${line.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${line.totalLineAmount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Subtotal:</span>
                  <span className="text-sm">${selectedInvoice.subtotalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Tax:</span>
                  <span className="text-sm">${selectedInvoice.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
                  <span className="text-lg font-semibold">Total:</span>
                  <span className="text-lg font-bold">${selectedInvoice.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Amount Paid:</span>
                  <span className="text-sm">${selectedInvoice.amountPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Balance Due:</span>
                  <span className="text-sm font-bold">${selectedInvoice.balanceDue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice {selectedInvoice?.transactionNumber}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInvoice}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}