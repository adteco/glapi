'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Eye, Truck, FileText, Send, CheckCircle, XCircle, Loader2 } from 'lucide-react';
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

// Form schemas
const salesOrderLineSchema = z.object({
  itemId: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  discountPercent: z.number().min(0).max(100, "Discount must be between 0 and 100").optional(),
});

const salesOrderFormSchema = z.object({
  subsidiaryId: z.string().min(1, "Subsidiary is required"),
  entityId: z.string().min(1, "Customer is required"),
  orderDate: z.string().min(1, "Order date is required"),
  requestedDeliveryDate: z.string().optional(),
  memo: z.string().max(1000, "Memo too long").optional(),
  shippingMethod: z.string().optional(),
  paymentTerms: z.string().optional(),
  lines: z.array(salesOrderLineSchema).min(1, "At least one line item is required"),
});

type SalesOrderFormValues = z.infer<typeof salesOrderFormSchema>;

export default function SalesOrdersPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const { orgId } = useAuth();

  // TRPC queries
  const { data: salesOrdersData, isLoading, refetch } = trpc.salesOrders.list.useQuery(
    { page: 1, limit: 50 },
    { enabled: !!orgId }
  );

  const { data: customersData } = trpc.customers.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: !!orgId }
  );

  const { data: subsidiariesData } = trpc.subsidiaries.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: !!orgId }
  );

  const { data: selectedOrder, isLoading: isLoadingOrder } = trpc.salesOrders.get.useQuery(
    { id: selectedOrderId! },
    { enabled: !!selectedOrderId && isViewDialogOpen }
  );

  // TRPC mutations
  const createMutation = trpc.salesOrders.create.useMutation({
    onSuccess: () => {
      toast.success('Sales order created successfully');
      setIsAddDialogOpen(false);
      form.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to create sales order: ${error.message}`);
    },
  });

  const submitMutation = trpc.salesOrders.submit.useMutation({
    onSuccess: () => {
      toast.success('Sales order submitted for approval');
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to submit: ${error.message}`);
    },
  });

  const approveMutation = trpc.salesOrders.approve.useMutation({
    onSuccess: () => {
      toast.success('Sales order approved');
      setIsApproveDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });

  const rejectMutation = trpc.salesOrders.reject.useMutation({
    onSuccess: () => {
      toast.success('Sales order rejected');
      setIsRejectDialogOpen(false);
      setRejectReason('');
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to reject: ${error.message}`);
    },
  });

  const cancelMutation = trpc.salesOrders.cancel.useMutation({
    onSuccess: () => {
      toast.success('Sales order cancelled');
      setIsCancelDialogOpen(false);
      setCancelReason('');
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to cancel: ${error.message}`);
    },
  });

  const createInvoiceMutation = trpc.salesOrders.createInvoice.useMutation({
    onSuccess: () => {
      toast.success('Invoice created from sales order');
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to create invoice: ${error.message}`);
    },
  });

  const form = useForm<SalesOrderFormValues>({
    resolver: zodResolver(salesOrderFormSchema),
    defaultValues: {
      subsidiaryId: "",
      entityId: "",
      orderDate: new Date().toISOString().split('T')[0],
      requestedDeliveryDate: "",
      memo: "",
      shippingMethod: "",
      paymentTerms: "",
      lines: [
        { itemId: "", description: "", quantity: 1, unitPrice: 0, discountPercent: 0 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const handleAddSalesOrder = async (values: SalesOrderFormValues) => {
    createMutation.mutate({
      subsidiaryId: values.subsidiaryId,
      entityId: values.entityId,
      orderDate: new Date(values.orderDate),
      requestedDeliveryDate: values.requestedDeliveryDate ? new Date(values.requestedDeliveryDate) : undefined,
      memo: values.memo,
      shippingMethod: values.shippingMethod,
      paymentTerms: values.paymentTerms,
      lines: values.lines.map(line => ({
        itemId: line.itemId || undefined,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
      })),
    });
  };

  const handleSubmitOrder = (orderId: string) => {
    submitMutation.mutate({ id: orderId });
  };

  const handleApproveOrder = () => {
    if (selectedOrderId) {
      approveMutation.mutate({ id: selectedOrderId });
    }
  };

  const handleRejectOrder = () => {
    if (selectedOrderId && rejectReason) {
      rejectMutation.mutate({ id: selectedOrderId, reason: rejectReason });
    }
  };

  const handleCancelOrder = () => {
    if (selectedOrderId && cancelReason) {
      cancelMutation.mutate({ id: selectedOrderId, reason: cancelReason });
    }
  };

  const handleCreateInvoice = (orderId: string) => {
    createInvoiceMutation.mutate({ salesOrderId: orderId });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'outline';
      case 'SUBMITTED': return 'secondary';
      case 'APPROVED': return 'default';
      case 'PARTIALLY_FULFILLED': return 'secondary';
      case 'FULFILLED': return 'default';
      case 'CLOSED': return 'secondary';
      case 'CANCELLED': return 'destructive';
      case 'REJECTED': return 'destructive';
      case 'ON_HOLD': return 'secondary';
      default: return 'outline';
    }
  };

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view sales orders.</p></div>;
  }

  const salesOrders = salesOrdersData?.data || [];
  const customers = customersData || [];
  const subsidiaries = subsidiariesData || [];

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Sales Orders</h1>
        <Button onClick={() => setIsAddDialogOpen(true)} data-testid="new-sales-order-btn">
          <Plus className="mr-2 h-4 w-4" />
          New Sales Order
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <Table>
          <TableCaption>A list of sales orders.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salesOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No sales orders found. Create your first sales order to get started.
                </TableCell>
              </TableRow>
            ) : (
              salesOrders.map((order: any) => (
                <TableRow key={order.id} data-testid={`sales-order-row-${order.orderNumber}`}>
                  <TableCell className="font-medium">{order.orderNumber}</TableCell>
                  <TableCell>{order.customerName || order.entityId}</TableCell>
                  <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    ${parseFloat(order.totalAmount || '0').toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(order.status)} data-testid={`status-${order.orderNumber}`}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          setIsViewDialogOpen(true);
                        }}
                        title="View Details"
                        data-testid={`view-btn-${order.orderNumber}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {order.status === 'DRAFT' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSubmitOrder(order.id)}
                          title="Submit for Approval"
                          disabled={submitMutation.isPending}
                          data-testid={`submit-btn-${order.orderNumber}`}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}

                      {order.status === 'SUBMITTED' && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedOrderId(order.id);
                              setIsApproveDialogOpen(true);
                            }}
                            title="Approve"
                            data-testid={`approve-btn-${order.orderNumber}`}
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedOrderId(order.id);
                              setIsRejectDialogOpen(true);
                            }}
                            title="Reject"
                            data-testid={`reject-btn-${order.orderNumber}`}
                          >
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        </>
                      )}

                      {(order.status === 'APPROVED' || order.status === 'PARTIALLY_FULFILLED') && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCreateInvoice(order.id)}
                            title="Create Invoice"
                            disabled={createInvoiceMutation.isPending}
                            data-testid={`invoice-btn-${order.orderNumber}`}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Create Fulfillment"
                            data-testid={`fulfill-btn-${order.orderNumber}`}
                          >
                            <Truck className="h-4 w-4" />
                          </Button>
                        </>
                      )}

                      {order.status !== 'CANCELLED' && order.status !== 'CLOSED' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedOrderId(order.id);
                            setIsCancelDialogOpen(true);
                          }}
                          title="Cancel Order"
                          data-testid={`cancel-btn-${order.orderNumber}`}
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Add Sales Order Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Sales Order</DialogTitle>
            <DialogDescription>
              Create a new sales order for a customer.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddSalesOrder)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="subsidiaryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subsidiary</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="subsidiary-select">
                            <SelectValue placeholder="Select subsidiary" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {subsidiaries.map((sub: any) => (
                            <SelectItem key={sub.id} value={sub.id}>
                              {sub.name}
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
                  name="entityId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="customer-select">
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((customer: any) => (
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="orderDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="order-date-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="requestedDeliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requested Delivery Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="delivery-date-input" />
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
                          <SelectItem value="Net 30">Net 30</SelectItem>
                          <SelectItem value="Net 15">Net 15</SelectItem>
                          <SelectItem value="Net 10">Net 10</SelectItem>
                          <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                          <SelectItem value="2/10 Net 30">2/10 Net 30</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="shippingMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shipping Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select shipping method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="UPS Ground">UPS Ground</SelectItem>
                          <SelectItem value="FedEx Ground">FedEx Ground</SelectItem>
                          <SelectItem value="USPS Priority">USPS Priority</SelectItem>
                          <SelectItem value="Local Delivery">Local Delivery</SelectItem>
                          <SelectItem value="Customer Pickup">Customer Pickup</SelectItem>
                        </SelectContent>
                      </Select>
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
                      <Textarea placeholder="Additional notes..." {...field} data-testid="memo-input" />
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
                    data-testid="add-line-btn"
                  >
                    Add Line Item
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <div key={field.id} className="border rounded-lg p-4 space-y-4" data-testid={`line-item-${index}`}>
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

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.description`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Item description..."
                                {...field}
                                data-testid={`line-description-${index}`}
                              />
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
                                data-testid={`line-quantity-${index}`}
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
                                data-testid={`line-price-${index}`}
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
                <Button type="submit" disabled={createMutation.isPending} data-testid="create-order-btn">
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Sales Order
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Sales Order Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Sales Order Details</DialogTitle>
            <DialogDescription>
              View sales order {selectedOrder?.orderNumber}
            </DialogDescription>
          </DialogHeader>
          {isLoadingOrder ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Order Number</label>
                  <p className="text-sm">{selectedOrder.orderNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Customer</label>
                  <p className="text-sm">{selectedOrder.customerName || selectedOrder.entityId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Order Date</label>
                  <p className="text-sm">{new Date(selectedOrder.orderDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <p className="text-sm">
                    <Badge variant={getStatusBadgeVariant(selectedOrder.status)}>
                      {selectedOrder.status}
                    </Badge>
                  </p>
                </div>
              </div>
              {selectedOrder.lines && selectedOrder.lines.length > 0 && (
                <div>
                  <label className="text-sm font-medium">Line Items</label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.lines.map((line: any) => (
                        <TableRow key={line.id}>
                          <TableCell>{line.description}</TableCell>
                          <TableCell>{parseFloat(line.quantity)}</TableCell>
                          <TableCell>${parseFloat(line.unitPrice).toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            ${parseFloat(line.lineAmount || '0').toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
                <span className="text-lg font-semibold">Total Amount</span>
                <span className="text-lg font-bold">
                  ${parseFloat(selectedOrder.totalAmount || '0').toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Sales Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this sales order? This will allow fulfillment and invoicing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApproveOrder}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
              data-testid="confirm-approve-btn"
            >
              {approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Sales Order</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this sales order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              data-testid="reject-reason-input"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectOrder}
              disabled={rejectMutation.isPending || !rejectReason}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-reject-btn"
            >
              {rejectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Sales Order</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for cancelling this sales order. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              data-testid="cancel-reason-input"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              disabled={cancelMutation.isPending || !cancelReason}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-cancel-btn"
            >
              {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
