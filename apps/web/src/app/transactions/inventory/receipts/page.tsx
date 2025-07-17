'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Eye, Package, CheckCircle } from 'lucide-react';
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

// Define interfaces for the Inventory Receipt data
interface InventoryReceipt {
  id: string;
  transactionNumber: string;
  purchaseOrderNumber?: string;
  vendorId: string;
  vendorName: string;
  warehouseId: string;
  warehouseName: string;
  transactionDate: string;
  receivedDate: string;
  deliveryMethod: string;
  referenceNumber?: string;
  status: 'PENDING' | 'RECEIVED' | 'INSPECTED' | 'ACCEPTED' | 'REJECTED';
  totalValue: number;
  lines: InventoryReceiptLine[];
}

interface InventoryReceiptLine {
  id: string;
  purchaseOrderLineId?: string;
  itemId: string;
  itemName: string;
  itemSku: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityAccepted: number;
  quantityRejected: number;
  unitCost: number;
  totalCost: number;
  binLocation?: string;
  serialNumbers?: string[];
  lotNumbers?: string[];
  expirationDate?: string;
  notes?: string;
}

// Form schemas
const inventoryReceiptLineSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  quantityReceived: z.number().min(0, "Quantity must be positive"),
  quantityAccepted: z.number().min(0, "Quantity must be positive"),
  quantityRejected: z.number().min(0, "Quantity must be positive"),
  unitCost: z.number().min(0, "Unit cost must be positive"),
  binLocation: z.string().optional(),
  serialNumbers: z.array(z.string()).optional(),
  lotNumbers: z.array(z.string()).optional(),
  expirationDate: z.string().optional(),
  notes: z.string().optional(),
});

const inventoryReceiptFormSchema = z.object({
  purchaseOrderId: z.string().optional(),
  vendorId: z.string().min(1, "Vendor is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  transactionDate: z.string().min(1, "Transaction date is required"),
  receivedDate: z.string().min(1, "Received date is required"),
  deliveryMethod: z.string().min(1, "Delivery method is required"),
  referenceNumber: z.string().optional(),
  memo: z.string().max(1000, "Memo too long").optional(),
  lines: z.array(inventoryReceiptLineSchema).min(1, "At least one line item is required"),
});

type InventoryReceiptFormValues = z.infer<typeof inventoryReceiptFormSchema>;

export default function InventoryReceiptsPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<InventoryReceipt | null>(null);
  const { orgId } = useAuth();
  
  // Mock data for now - replace with TRPC when available
  const receipts: InventoryReceipt[] = [];
  const vendors = [
    { id: '1', name: 'ABC Supplies', contact: 'John Doe' },
    { id: '2', name: 'XYZ Manufacturing', contact: 'Jane Smith' },
    { id: '3', name: 'Global Distributors', contact: 'Mike Johnson' },
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
  const deliveryMethods = [
    'Truck Delivery',
    'Freight',
    'Courier',
    'Mail',
    'Customer Pickup',
    'Drop Ship',
    'Express Delivery',
    'Standard Shipping',
  ];

  const form = useForm<InventoryReceiptFormValues>({
    resolver: zodResolver(inventoryReceiptFormSchema),
    defaultValues: {
      purchaseOrderId: "",
      vendorId: "",
      warehouseId: "",
      transactionDate: new Date().toISOString().split('T')[0],
      receivedDate: new Date().toISOString().split('T')[0],
      deliveryMethod: "",
      referenceNumber: "",
      memo: "",
      lines: [
        { itemId: "", quantityReceived: 0, quantityAccepted: 0, quantityRejected: 0, unitCost: 0, binLocation: "", serialNumbers: [], lotNumbers: [], expirationDate: "", notes: "" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  // Handle add receipt
  const handleAddReceipt = async (values: InventoryReceiptFormValues) => {
    try {
      // TODO: Implement TRPC mutation
      toast.success('Inventory receipt created successfully');
      setIsAddDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error('Failed to create inventory receipt');
    }
  };

  // Handle inspect receipt
  const handleInspectReceipt = async (receipt: InventoryReceipt) => {
    try {
      // TODO: Implement TRPC mutation to mark as inspected
      toast.success('Receipt marked as inspected');
    } catch (error) {
      toast.error('Failed to inspect receipt');
    }
  };

  // Handle accept receipt
  const handleAcceptReceipt = async (receipt: InventoryReceipt) => {
    try {
      // TODO: Implement TRPC mutation to accept receipt
      toast.success('Receipt accepted successfully');
    } catch (error) {
      toast.error('Failed to accept receipt');
    }
  };

  // Handle delete receipt
  const handleDeleteReceipt = async () => {
    try {
      // TODO: Implement TRPC mutation
      toast.success('Receipt deleted successfully');
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast.error('Failed to delete receipt');
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'PENDING': return 'outline';
      case 'RECEIVED': return 'secondary';
      case 'INSPECTED': return 'default';
      case 'ACCEPTED': return 'default';
      case 'REJECTED': return 'destructive';
      default: return 'outline';
    }
  };

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view inventory receipts.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Inventory Receipts</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Receipt
        </Button>
      </div>

      <Table>
        <TableCaption>A list of inventory receipts.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Receipt #</TableHead>
            <TableHead>PO #</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Warehouse</TableHead>
            <TableHead>Received Date</TableHead>
            <TableHead>Delivery Method</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {receipts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                No inventory receipts found. Create your first receipt to get started.
              </TableCell>
            </TableRow>
          ) : (
            receipts.map((receipt) => (
              <TableRow key={receipt.id}>
                <TableCell className="font-medium">{receipt.transactionNumber}</TableCell>
                <TableCell>{receipt.purchaseOrderNumber || '-'}</TableCell>
                <TableCell>{receipt.vendorName}</TableCell>
                <TableCell>{receipt.warehouseName}</TableCell>
                <TableCell>{new Date(receipt.receivedDate).toLocaleDateString()}</TableCell>
                <TableCell>{receipt.deliveryMethod}</TableCell>
                <TableCell className="text-right">${receipt.totalValue.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(receipt.status)}>
                    {receipt.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedReceipt(receipt);
                        setIsViewDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {receipt.status === 'RECEIVED' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleInspectReceipt(receipt)}
                        title="Mark as Inspected"
                      >
                        <Package className="h-4 w-4" />
                      </Button>
                    )}
                    {receipt.status === 'INSPECTED' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleAcceptReceipt(receipt)}
                        title="Accept Receipt"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedReceipt(receipt);
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

      {/* Add Receipt Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Inventory Receipt</DialogTitle>
            <DialogDescription>
              Create a new inventory receipt for items received.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddReceipt)} className="space-y-4">
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

              <div className="grid grid-cols-2 gap-4">
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
                <FormField
                  control={form.control}
                  name="receivedDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Received Date</FormLabel>
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
                  name="deliveryMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select delivery method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {deliveryMethods.map((method) => (
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
                <FormField
                  control={form.control}
                  name="referenceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Delivery receipt, invoice #..." {...field} />
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
                      <Textarea placeholder="Additional notes..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Items Received</h3>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ itemId: "", quantityReceived: 0, quantityAccepted: 0, quantityRejected: 0, unitCost: 0, binLocation: "", serialNumbers: [], lotNumbers: [], expirationDate: "", notes: "" })}
                  >
                    Add Item
                  </Button>
                </div>

                {fields.map((field, index) => {
                  const selectedItem = items.find(item => item.id === field.itemId);
                  const totalCost = field.quantityReceived * field.unitCost;
                  
                  return (
                    <div key={field.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Item {index + 1}</span>
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
                          name={`lines.${index}.quantityReceived`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Qty Received</FormLabel>
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
                          name={`lines.${index}.quantityAccepted`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Qty Accepted</FormLabel>
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
                          name={`lines.${index}.quantityRejected`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Qty Rejected</FormLabel>
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
                          name={`lines.${index}.unitCost`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unit Cost</FormLabel>
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
                          name={`lines.${index}.binLocation`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bin Location</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., A-1-B" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`lines.${index}.expirationDate`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Expiration Date</FormLabel>
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
                                <Input placeholder="Quality notes..." {...field} />
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
                              <p>${totalCost.toFixed(2)}</p>
                            </div>
                            <div>
                              <span className="font-medium">Variance:</span>
                              <p className={field.unitCost > selectedItem.standardCost ? 'text-red-600' : 'text-green-600'}>
                                ${(field.unitCost - selectedItem.standardCost).toFixed(2)}
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
                  Create Receipt
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Receipt Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Receipt Details</DialogTitle>
            <DialogDescription>
              View inventory receipt {selectedReceipt?.transactionNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Receipt Number</label>
                  <p className="text-sm">{selectedReceipt.transactionNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">PO Number</label>
                  <p className="text-sm">{selectedReceipt.purchaseOrderNumber || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Vendor</label>
                  <p className="text-sm">{selectedReceipt.vendorName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Warehouse</label>
                  <p className="text-sm">{selectedReceipt.warehouseName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Received Date</label>
                  <p className="text-sm">{new Date(selectedReceipt.receivedDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Delivery Method</label>
                  <p className="text-sm">{selectedReceipt.deliveryMethod}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Reference Number</label>
                  <p className="text-sm">{selectedReceipt.referenceNumber || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <p className="text-sm">
                    <Badge variant={getStatusBadgeVariant(selectedReceipt.status)}>
                      {selectedReceipt.status}
                    </Badge>
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Items Received</label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Accepted</TableHead>
                      <TableHead>Rejected</TableHead>
                      <TableHead>Unit Cost</TableHead>
                      <TableHead>Bin</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedReceipt.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.itemName}</TableCell>
                        <TableCell>{line.quantityReceived}</TableCell>
                        <TableCell>{line.quantityAccepted}</TableCell>
                        <TableCell>{line.quantityRejected}</TableCell>
                        <TableCell>${line.unitCost.toFixed(2)}</TableCell>
                        <TableCell>{line.binLocation || '-'}</TableCell>
                        <TableCell className="text-right">${line.totalCost.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
                <span className="text-lg font-semibold">Total Value</span>
                <span className="text-lg font-bold">${selectedReceipt.totalValue.toFixed(2)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Receipt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete receipt {selectedReceipt?.transactionNumber}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteReceipt}
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