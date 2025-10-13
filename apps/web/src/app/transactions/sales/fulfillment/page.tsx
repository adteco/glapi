'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Eye, Package, Truck } from 'lucide-react';
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

// Define interfaces for the Fulfillment data
interface Fulfillment {
  id: string;
  transactionNumber: string;
  salesOrderNumber: string;
  entityId: string;
  customerName: string;
  transactionDate: string;
  shipDate: string;
  shippedVia: string;
  trackingNumber: string;
  shippingAddress: string;
  status: 'DRAFT' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  lines: FulfillmentLine[];
}

interface FulfillmentLine {
  id: string;
  salesOrderLineId: string;
  itemId: string;
  itemName: string;
  description: string;
  quantityOrdered: number;
  quantityShipped: number;
  quantityRemaining: number;
  serialNumbers?: string[];
  lotNumbers?: string[];
  warehouseLocation?: string;
}

// Form schemas
const fulfillmentLineSchema = z.object({
  salesOrderLineId: z.string().min(1, "Sales order line is required"),
  quantityShipped: z.number().min(0.01, "Quantity shipped must be greater than 0"),
  serialNumbers: z.array(z.string()).optional(),
  lotNumbers: z.array(z.string()).optional(),
  warehouseLocation: z.string().optional(),
});

const fulfillmentFormSchema = z.object({
  salesOrderId: z.string().min(1, "Sales order is required"),
  transactionDate: z.string().min(1, "Transaction date is required"),
  shipDate: z.string().min(1, "Ship date is required"),
  shippedVia: z.string().min(1, "Shipped via is required"),
  trackingNumber: z.string().optional(),
  memo: z.string().max(1000, "Memo too long").optional(),
  lines: z.array(fulfillmentLineSchema).min(1, "At least one line item is required"),
});

type FulfillmentFormValues = z.infer<typeof fulfillmentFormSchema>;

export default function FulfillmentPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedFulfillment, setSelectedFulfillment] = useState<Fulfillment | null>(null);
  const { orgId } = useAuth();
  
  // Mock data for now - replace with TRPC when available
  const fulfillments: Fulfillment[] = [];
  const salesOrders = [
    { id: '1', number: 'SO-2024-001', customerName: 'Acme Corp', lines: [
      { id: '1', itemName: 'Product A', quantityOrdered: 10, quantityShipped: 5, quantityRemaining: 5 },
      { id: '2', itemName: 'Product B', quantityOrdered: 5, quantityShipped: 0, quantityRemaining: 5 },
    ]},
    { id: '2', number: 'SO-2024-002', customerName: 'Tech Solutions Inc', lines: [
      { id: '3', itemName: 'Service Package', quantityOrdered: 2, quantityShipped: 0, quantityRemaining: 2 },
    ]},
  ];
  const shippingMethods = [
    'UPS Ground',
    'UPS 2-Day Air',
    'UPS Next Day Air',
    'FedEx Ground',
    'FedEx 2-Day',
    'FedEx Overnight',
    'USPS Priority',
    'USPS Express',
    'Local Delivery',
    'Customer Pickup',
  ];

  const form = useForm<FulfillmentFormValues>({
    resolver: zodResolver(fulfillmentFormSchema),
    defaultValues: {
      salesOrderId: "",
      transactionDate: new Date().toISOString().split('T')[0],
      shipDate: new Date().toISOString().split('T')[0],
      shippedVia: "",
      trackingNumber: "",
      memo: "",
      lines: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  // Handle sales order selection
  const handleSalesOrderChange = (salesOrderId: string) => {
    const selectedOrder = salesOrders.find(order => order.id === salesOrderId);
    if (selectedOrder) {
      const availableLines = selectedOrder.lines
        .filter(line => line.quantityRemaining > 0)
        .map(line => ({
          salesOrderLineId: line.id,
          quantityShipped: line.quantityRemaining,
          serialNumbers: [],
          lotNumbers: [],
          warehouseLocation: "",
        }));
      replace(availableLines);
    }
  };

  // Handle add fulfillment
  const handleAddFulfillment = async (values: FulfillmentFormValues) => {
    try {
      // TODO: Implement TRPC mutation
      toast.success('Fulfillment created successfully');
      setIsAddDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error('Failed to create fulfillment');
    }
  };

  // Handle mark as shipped
  const handleMarkAsShipped = async (fulfillment: Fulfillment) => {
    try {
      // TODO: Implement TRPC mutation to update status
      toast.success('Fulfillment marked as shipped');
    } catch (error) {
      toast.error('Failed to mark as shipped');
    }
  };

  // Handle delete fulfillment
  const handleDeleteFulfillment = async () => {
    try {
      // TODO: Implement TRPC mutation
      toast.success('Fulfillment deleted successfully');
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast.error('Failed to delete fulfillment');
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'outline';
      case 'PACKED': return 'secondary';
      case 'SHIPPED': return 'default';
      case 'DELIVERED': return 'default';
      case 'CANCELLED': return 'destructive';
      default: return 'outline';
    }
  };

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view fulfillments.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Fulfillments</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Fulfillment
        </Button>
      </div>

      <Table>
        <TableCaption>A list of order fulfillments.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Fulfillment #</TableHead>
            <TableHead>Sales Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Ship Date</TableHead>
            <TableHead>Shipped Via</TableHead>
            <TableHead>Tracking #</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fulfillments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                No fulfillments found. Create your first fulfillment to get started.
              </TableCell>
            </TableRow>
          ) : (
            fulfillments.map((fulfillment) => (
              <TableRow key={fulfillment.id}>
                <TableCell className="font-medium">{fulfillment.transactionNumber}</TableCell>
                <TableCell>{fulfillment.salesOrderNumber}</TableCell>
                <TableCell>{fulfillment.customerName}</TableCell>
                <TableCell>{new Date(fulfillment.shipDate).toLocaleDateString()}</TableCell>
                <TableCell>{fulfillment.shippedVia}</TableCell>
                <TableCell>{fulfillment.trackingNumber || '-'}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(fulfillment.status)}>
                    {fulfillment.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedFulfillment(fulfillment);
                        setIsViewDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {fulfillment.status === 'PACKED' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMarkAsShipped(fulfillment)}
                        title="Mark as Shipped"
                      >
                        <Truck className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedFulfillment(fulfillment);
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

      {/* Add Fulfillment Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Fulfillment</DialogTitle>
            <DialogDescription>
              Create a new fulfillment for a sales order.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddFulfillment)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="salesOrderId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Order</FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        handleSalesOrderChange(value);
                      }} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sales order" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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
                <FormField
                  control={form.control}
                  name="transactionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction Date</FormLabel>
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
                  name="shipDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ship Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="shippedVia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shipped Via</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select shipping method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {shippingMethods.map((method) => (
                            <SelectItem key={method} value={method}>
                              {method}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="trackingNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tracking Number (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter tracking number..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="memo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Memo</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Additional notes..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {fields.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Items to Ship</h3>
                  {fields.map((field, index) => {
                    const selectedOrder = salesOrders.find(order => order.id === form.watch("salesOrderId"));
                    const orderLine = selectedOrder?.lines.find(line => line.id === field.salesOrderLineId);
                    
                    return (
                      <div key={field.id} className="border rounded-lg p-4 space-y-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-sm font-medium">{orderLine?.itemName}</span>
                            <p className="text-xs text-gray-500">
                              Ordered: {orderLine?.quantityOrdered} | Remaining: {orderLine?.quantityRemaining}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.quantityShipped`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Quantity to Ship</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={orderLine?.quantityRemaining || 0}
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
                            name={`lines.${index}.warehouseLocation`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Warehouse Location</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., A-1-B" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`lines.${index}.serialNumbers`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Serial Numbers</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="SN1, SN2, SN3..."
                                    {...field}
                                    onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                                    value={field.value?.join(', ') || ''}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Create Fulfillment
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Fulfillment Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Fulfillment Details</DialogTitle>
            <DialogDescription>
              View fulfillment {selectedFulfillment?.transactionNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedFulfillment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Fulfillment Number</label>
                  <p className="text-sm">{selectedFulfillment.transactionNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Sales Order</label>
                  <p className="text-sm">{selectedFulfillment.salesOrderNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Customer</label>
                  <p className="text-sm">{selectedFulfillment.customerName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Ship Date</label>
                  <p className="text-sm">{new Date(selectedFulfillment.shipDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Shipped Via</label>
                  <p className="text-sm">{selectedFulfillment.shippedVia}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Tracking Number</label>
                  <p className="text-sm">{selectedFulfillment.trackingNumber || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <p className="text-sm">
                    <Badge variant={getStatusBadgeVariant(selectedFulfillment.status)}>
                      {selectedFulfillment.status}
                    </Badge>
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Shipping Address</label>
                <p className="text-sm">{selectedFulfillment.shippingAddress}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Items Shipped</label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Ordered</TableHead>
                      <TableHead>Shipped</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Serial #</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedFulfillment.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.itemName}</TableCell>
                        <TableCell>{line.quantityOrdered}</TableCell>
                        <TableCell>{line.quantityShipped}</TableCell>
                        <TableCell>{line.warehouseLocation || '-'}</TableCell>
                        <TableCell>{line.serialNumbers?.join(', ') || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fulfillment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete fulfillment {selectedFulfillment?.transactionNumber}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFulfillment}
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