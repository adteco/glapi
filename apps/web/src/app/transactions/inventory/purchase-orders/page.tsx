'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Eye, Send, Package, FileText } from 'lucide-react';
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

// Define interfaces for the Purchase Order data
interface PurchaseOrder {
  id: string;
  transactionNumber: string;
  vendorId: string;
  vendorName: string;
  warehouseId: string;
  warehouseName: string;
  transactionDate: string;
  dueDate: string;
  expectedDeliveryDate: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: 'DRAFT' | 'SENT' | 'CONFIRMED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED' | 'CANCELLED';
  paymentTerms: string;
  shippingMethod: string;
  notes: string;
  lines: PurchaseOrderLine[];
}

interface PurchaseOrderLine {
  id: string;
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
  quantityReceived: number;
  quantityBilled: number;
  expectedDeliveryDate: string;
  notes?: string;
}

// Form schemas
const purchaseOrderLineSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  discountPercent: z.number().min(0).max(100, "Discount must be between 0 and 100").optional(),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
});

const purchaseOrderFormSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  transactionDate: z.string().min(1, "Transaction date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  expectedDeliveryDate: z.string().min(1, "Expected delivery date is required"),
  paymentTerms: z.string().min(1, "Payment terms are required"),
  shippingMethod: z.string().min(1, "Shipping method is required"),
  notes: z.string().max(1000, "Notes too long").optional(),
  lines: z.array(purchaseOrderLineSchema).min(1, "At least one line item is required"),
});

type PurchaseOrderFormValues = z.infer<typeof purchaseOrderFormSchema>;

export default function PurchaseOrdersPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const { orgId } = useAuth();
  
  // Mock data for now - replace with TRPC when available
  const purchaseOrders: PurchaseOrder[] = [];
  const vendors = [
    { id: '1', name: 'ABC Supplies', contact: 'John Doe', email: 'john@abcsupplies.com' },
    { id: '2', name: 'XYZ Manufacturing', contact: 'Jane Smith', email: 'jane@xyzmanufacturing.com' },
    { id: '3', name: 'Global Distributors', contact: 'Mike Johnson', email: 'mike@globaldist.com' },
  ];
  const warehouses = [
    { id: '1', name: 'Main Warehouse', location: 'Building A' },
    { id: '2', name: 'Distribution Center', location: 'Building B' },
    { id: '3', name: 'Retail Store', location: 'Downtown' },
  ];
  const items = [
    { id: '1', name: 'Product A', sku: 'PROD-A-001', standardCost: 25.00 },
    { id: '2', name: 'Product B', sku: 'PROD-B-002', standardCost: 15.00 },
    { id: '3', name: 'Product C', sku: 'PROD-C-003', standardCost: 35.00 },
  ];
  const paymentTermsOptions = [
    'Net 30',
    'Net 15',
    'Net 10',
    '2/10 Net 30',
    '1/10 Net 30',
    'Due on Receipt',
    'COD',
    'Prepaid',
  ];
  const shippingMethods = [
    'Standard Shipping',
    'Express Delivery',
    'Overnight',
    'Ground',
    'Freight',
    'Vendor Delivery',
    'Customer Pickup',
  ];

  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: {
      vendorId: "",
      warehouseId: "",
      transactionDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 days from now
      paymentTerms: "",
      shippingMethod: "",
      notes: "",
      lines: [
        { itemId: "", description: "", quantity: 1, unitPrice: 0, discountPercent: 0, expectedDeliveryDate: "", notes: "" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  // Handle add purchase order
  const handleAddPurchaseOrder = async (values: PurchaseOrderFormValues) => {
    try {
      // TODO: Implement TRPC mutation
      toast.success('Purchase order created successfully');
      setIsAddDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error('Failed to create purchase order');
    }
  };

  // Handle send purchase order
  const handleSendPurchaseOrder = async (purchaseOrder: PurchaseOrder) => {
    try {
      // TODO: Implement TRPC mutation to send PO to vendor
      toast.success('Purchase order sent to vendor');
    } catch (error) {
      toast.error('Failed to send purchase order');
    }
  };

  // Handle create receipt
  const handleCreateReceipt = async (purchaseOrder: PurchaseOrder) => {
    try {
      // TODO: Implement TRPC mutation to create receipt from PO
      toast.success('Receipt created for purchase order');
    } catch (error) {
      toast.error('Failed to create receipt');
    }
  };

  // Handle create bill
  const handleCreateBill = async (purchaseOrder: PurchaseOrder) => {
    try {
      // TODO: Implement TRPC mutation to create bill from PO
      toast.success('Bill created for purchase order');
    } catch (error) {
      toast.error('Failed to create bill');
    }
  };

  // Handle delete purchase order
  const handleDeletePurchaseOrder = async () => {
    try {
      // TODO: Implement TRPC mutation
      toast.success('Purchase order deleted successfully');
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast.error('Failed to delete purchase order');
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'outline';
      case 'SENT': return 'secondary';
      case 'CONFIRMED': return 'default';
      case 'PARTIALLY_RECEIVED': return 'secondary';
      case 'RECEIVED': return 'default';
      case 'CLOSED': return 'secondary';
      case 'CANCELLED': return 'destructive';
      default: return 'outline';
    }
  };

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view purchase orders.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Purchase Orders</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Purchase Order
        </Button>
      </div>

      <Table>
        <TableCaption>A list of purchase orders.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>PO #</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Warehouse</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchaseOrders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                No purchase orders found. Create your first purchase order to get started.
              </TableCell>
            </TableRow>
          ) : (
            purchaseOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.transactionNumber}</TableCell>
                <TableCell>{order.vendorName}</TableCell>
                <TableCell>{order.warehouseName}</TableCell>
                <TableCell>{new Date(order.transactionDate).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(order.dueDate).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">${order.totalAmount.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(order.status)}>
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedPurchaseOrder(order);
                        setIsViewDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {order.status === 'DRAFT' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSendPurchaseOrder(order)}
                        title="Send to Vendor"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    {(order.status === 'CONFIRMED' || order.status === 'PARTIALLY_RECEIVED') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCreateReceipt(order)}
                        title="Create Receipt"
                      >
                        <Package className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCreateBill(order)}
                      title="Create Bill"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedPurchaseOrder(order);
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

      {/* Add Purchase Order Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
            <DialogDescription>
              Create a new purchase order for a vendor.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddPurchaseOrder)} className="space-y-4">
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
                          {vendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.name}
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
                  name="warehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Warehouse</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select warehouse" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {warehouses.map((warehouse) => (
                            <SelectItem key={warehouse.id} value={warehouse.id}>
                              {warehouse.name} - {warehouse.location}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="transactionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Date</FormLabel>
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
                <FormField
                  control={form.control}
                  name="expectedDeliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Delivery</FormLabel>
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
                    onClick={() => append({ itemId: "", description: "", quantity: 1, unitPrice: 0, discountPercent: 0, expectedDeliveryDate: "", notes: "" })}
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
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                        <FormField
                          control={form.control}
                          name={`lines.${index}.expectedDeliveryDate`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Expected Delivery</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`lines.${index}.notes`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notes</FormLabel>
                              <FormControl>
                                <Input placeholder="Line notes..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      {selectedItem && (
                        <div className="bg-gray-50 p-3 rounded-md">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Standard Cost:</span>
                              <p>${selectedItem.standardCost.toFixed(2)}</p>
                            </div>
                            <div>
                              <span className="font-medium">Line Total:</span>
                              <p>${lineAmount.toFixed(2)}</p>
                            </div>
                            <div>
                              <span className="font-medium">Variance:</span>
                              <p className={field.unitPrice > selectedItem.standardCost ? 'text-red-600' : 'text-green-600'}>
                                ${(field.unitPrice - selectedItem.standardCost).toFixed(2)}
                              </p>
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
                  Create Purchase Order
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Purchase Order Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Purchase Order Details</DialogTitle>
            <DialogDescription>
              View purchase order {selectedPurchaseOrder?.transactionNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedPurchaseOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">PO Number</label>
                  <p className="text-sm">{selectedPurchaseOrder.transactionNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Vendor</label>
                  <p className="text-sm">{selectedPurchaseOrder.vendorName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Warehouse</label>
                  <p className="text-sm">{selectedPurchaseOrder.warehouseName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Order Date</label>
                  <p className="text-sm">{new Date(selectedPurchaseOrder.transactionDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Due Date</label>
                  <p className="text-sm">{new Date(selectedPurchaseOrder.dueDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Expected Delivery</label>
                  <p className="text-sm">{new Date(selectedPurchaseOrder.expectedDeliveryDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Payment Terms</label>
                  <p className="text-sm">{selectedPurchaseOrder.paymentTerms}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <p className="text-sm">
                    <Badge variant={getStatusBadgeVariant(selectedPurchaseOrder.status)}>
                      {selectedPurchaseOrder.status}
                    </Badge>
                  </p>
                </div>
              </div>
              {selectedPurchaseOrder.notes && (
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <p className="text-sm">{selectedPurchaseOrder.notes}</p>
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
                      <TableHead>Received</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPurchaseOrder.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.itemName}</TableCell>
                        <TableCell>{line.description}</TableCell>
                        <TableCell>{line.quantity}</TableCell>
                        <TableCell>${line.unitPrice.toFixed(2)}</TableCell>
                        <TableCell>{line.quantityReceived}</TableCell>
                        <TableCell className="text-right">${line.totalLineAmount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
                <span className="text-lg font-semibold">Total Amount</span>
                <span className="text-lg font-bold">${selectedPurchaseOrder.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete purchase order {selectedPurchaseOrder?.transactionNumber}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePurchaseOrder}
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