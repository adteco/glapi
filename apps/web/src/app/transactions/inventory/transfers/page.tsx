'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Eye, ArrowRight, Check, X } from 'lucide-react';
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

// Define interfaces for the Inventory Transfer data
interface InventoryTransfer {
  id: string;
  transactionNumber: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  transactionDate: string;
  requestedDate: string;
  transferType: 'STANDARD' | 'URGENT' | 'REPLENISHMENT';
  status: 'REQUESTED' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
  reason: string;
  lines: InventoryTransferLine[];
}

interface InventoryTransferLine {
  id: string;
  itemId: string;
  itemName: string;
  itemSku: string;
  quantityRequested: number;
  quantityApproved: number;
  quantityShipped: number;
  quantityReceived: number;
  fromBinLocation?: string;
  toBinLocation?: string;
  serialNumbers?: string[];
  lotNumbers?: string[];
  notes?: string;
}

// Form schemas
const inventoryTransferLineSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  quantityRequested: z.number().min(0.01, "Quantity must be greater than 0"),
  fromBinLocation: z.string().optional(),
  toBinLocation: z.string().optional(),
  serialNumbers: z.array(z.string()).optional(),
  lotNumbers: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const inventoryTransferFormSchema = z.object({
  fromWarehouseId: z.string().min(1, "From warehouse is required"),
  toWarehouseId: z.string().min(1, "To warehouse is required"),
  transactionDate: z.string().min(1, "Transaction date is required"),
  requestedDate: z.string().min(1, "Requested date is required"),
  transferType: z.enum(['STANDARD', 'URGENT', 'REPLENISHMENT']),
  reason: z.string().min(1, "Reason is required"),
  memo: z.string().max(1000, "Memo too long").optional(),
  lines: z.array(inventoryTransferLineSchema).min(1, "At least one line item is required"),
}).refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
  message: "From and To warehouses must be different",
  path: ["toWarehouseId"],
});

type InventoryTransferFormValues = z.infer<typeof inventoryTransferFormSchema>;

export default function InventoryTransfersPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<InventoryTransfer | null>(null);
  const { orgId } = useAuth();
  
  // Mock data for now - replace with TRPC when available
  const transfers: InventoryTransfer[] = [];
  const warehouses = [
    { id: '1', name: 'Main Warehouse', location: 'Building A' },
    { id: '2', name: 'Distribution Center', location: 'Building B' },
    { id: '3', name: 'Retail Store', location: 'Downtown' },
    { id: '4', name: 'Regional Hub', location: 'West Coast' },
  ];
  const items = [
    { id: '1', name: 'Product A', sku: 'PROD-A-001', availableQuantity: 100 },
    { id: '2', name: 'Product B', sku: 'PROD-B-002', availableQuantity: 50 },
    { id: '3', name: 'Product C', sku: 'PROD-C-003', availableQuantity: 75 },
  ];
  const transferReasons = [
    'Stock Replenishment',
    'Excess Inventory',
    'Seasonal Demand',
    'Emergency Stock',
    'Consolidation',
    'Location Closure',
    'Quality Issues',
    'Customer Request',
    'Promotional Campaign',
    'Redistribution',
  ];

  const form = useForm<InventoryTransferFormValues>({
    resolver: zodResolver(inventoryTransferFormSchema),
    defaultValues: {
      fromWarehouseId: "",
      toWarehouseId: "",
      transactionDate: new Date().toISOString().split('T')[0],
      requestedDate: new Date().toISOString().split('T')[0],
      transferType: "STANDARD",
      reason: "",
      memo: "",
      lines: [
        { itemId: "", quantityRequested: 0, fromBinLocation: "", toBinLocation: "", serialNumbers: [], lotNumbers: [], notes: "" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  // Handle add transfer
  const handleAddTransfer = async (values: InventoryTransferFormValues) => {
    try {
      // TODO: Implement TRPC mutation
      toast.success('Inventory transfer created successfully');
      setIsAddDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error('Failed to create inventory transfer');
    }
  };

  // Handle approve transfer
  const handleApproveTransfer = async (transfer: InventoryTransfer) => {
    try {
      // TODO: Implement TRPC mutation to approve transfer
      toast.success('Transfer approved successfully');
    } catch (error) {
      toast.error('Failed to approve transfer');
    }
  };

  // Handle ship transfer
  const handleShipTransfer = async (transfer: InventoryTransfer) => {
    try {
      // TODO: Implement TRPC mutation to ship transfer
      toast.success('Transfer shipped successfully');
    } catch (error) {
      toast.error('Failed to ship transfer');
    }
  };

  // Handle receive transfer
  const handleReceiveTransfer = async (transfer: InventoryTransfer) => {
    try {
      // TODO: Implement TRPC mutation to receive transfer
      toast.success('Transfer received successfully');
    } catch (error) {
      toast.error('Failed to receive transfer');
    }
  };

  // Handle delete transfer
  const handleDeleteTransfer = async () => {
    try {
      // TODO: Implement TRPC mutation
      toast.success('Transfer deleted successfully');
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast.error('Failed to delete transfer');
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'REQUESTED': return 'outline';
      case 'APPROVED': return 'secondary';
      case 'IN_TRANSIT': return 'default';
      case 'RECEIVED': return 'default';
      case 'CANCELLED': return 'destructive';
      default: return 'outline';
    }
  };

  const getTransferTypeColor = (type: string) => {
    switch (type) {
      case 'URGENT': return 'text-red-600';
      case 'REPLENISHMENT': return 'text-blue-600';
      case 'STANDARD': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view inventory transfers.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Inventory Transfers</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Transfer
        </Button>
      </div>

      <Table>
        <TableCaption>A list of inventory transfers between warehouses.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Transfer #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>From</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transfers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                No inventory transfers found. Create your first transfer to get started.
              </TableCell>
            </TableRow>
          ) : (
            transfers.map((transfer) => (
              <TableRow key={transfer.id}>
                <TableCell className="font-medium">{transfer.transactionNumber}</TableCell>
                <TableCell>{new Date(transfer.transactionDate).toLocaleDateString()}</TableCell>
                <TableCell>{transfer.fromWarehouseName}</TableCell>
                <TableCell>{transfer.toWarehouseName}</TableCell>
                <TableCell>
                  <span className={`text-sm font-medium ${getTransferTypeColor(transfer.transferType)}`}>
                    {transfer.transferType}
                  </span>
                </TableCell>
                <TableCell className="max-w-xs truncate">{transfer.reason}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(transfer.status)}>
                    {transfer.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedTransfer(transfer);
                        setIsViewDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {transfer.status === 'REQUESTED' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleApproveTransfer(transfer)}
                        title="Approve Transfer"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    {transfer.status === 'APPROVED' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleShipTransfer(transfer)}
                        title="Ship Transfer"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                    {transfer.status === 'IN_TRANSIT' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleReceiveTransfer(transfer)}
                        title="Receive Transfer"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedTransfer(transfer);
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

      {/* Add Transfer Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Inventory Transfer</DialogTitle>
            <DialogDescription>
              Create a new inventory transfer between warehouses.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddTransfer)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fromWarehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Warehouse</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source warehouse" />
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
                <FormField
                  control={form.control}
                  name="toWarehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To Warehouse</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select destination warehouse" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {warehouses
                            .filter(warehouse => warehouse.id !== form.watch("fromWarehouseId"))
                            .map((warehouse) => (
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
                  name="requestedDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requested Date</FormLabel>
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
                  name="transferType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transfer Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="STANDARD">Standard</SelectItem>
                          <SelectItem value="URGENT">Urgent</SelectItem>
                          <SelectItem value="REPLENISHMENT">Replenishment</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select reason" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {transferReasons.map((reason) => (
                            <SelectItem key={reason} value={reason}>
                              {reason}
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
                  <h3 className="text-lg font-semibold">Items to Transfer</h3>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ itemId: "", quantityRequested: 0, fromBinLocation: "", toBinLocation: "", serialNumbers: [], lotNumbers: [], notes: "" })}
                  >
                    Add Item
                  </Button>
                </div>

                {fields.map((field, index) => {
                  const selectedItem = items.find(item => item.id === field.itemId);
                  
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
                          name={`lines.${index}.quantityRequested`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantity</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={selectedItem?.availableQuantity || 0}
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
                          name={`lines.${index}.fromBinLocation`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>From Bin</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., A-1-B" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`lines.${index}.toBinLocation`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>To Bin</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., B-2-A" {...field} />
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
                                <Input placeholder="Special instructions..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      {selectedItem && (
                        <div className="bg-gray-50 p-3 rounded-md">
                          <div className="text-sm">
                            <span className="font-medium">Available in source warehouse:</span>
                            <span className="ml-2">{selectedItem.availableQuantity} units</span>
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
                  Create Transfer
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Transfer Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Transfer Details</DialogTitle>
            <DialogDescription>
              View inventory transfer {selectedTransfer?.transactionNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedTransfer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Transfer Number</label>
                  <p className="text-sm">{selectedTransfer.transactionNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <p className="text-sm">{new Date(selectedTransfer.transactionDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">From Warehouse</label>
                  <p className="text-sm">{selectedTransfer.fromWarehouseName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">To Warehouse</label>
                  <p className="text-sm">{selectedTransfer.toWarehouseName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <p className={`text-sm font-medium ${getTransferTypeColor(selectedTransfer.transferType)}`}>
                    {selectedTransfer.transferType}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <p className="text-sm">
                    <Badge variant={getStatusBadgeVariant(selectedTransfer.status)}>
                      {selectedTransfer.status}
                    </Badge>
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Reason</label>
                <p className="text-sm">{selectedTransfer.reason}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Items</label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Approved</TableHead>
                      <TableHead>Shipped</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>From Bin</TableHead>
                      <TableHead>To Bin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedTransfer.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.itemName}</TableCell>
                        <TableCell>{line.quantityRequested}</TableCell>
                        <TableCell>{line.quantityApproved}</TableCell>
                        <TableCell>{line.quantityShipped}</TableCell>
                        <TableCell>{line.quantityReceived}</TableCell>
                        <TableCell>{line.fromBinLocation || '-'}</TableCell>
                        <TableCell>{line.toBinLocation || '-'}</TableCell>
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
            <AlertDialogTitle>Delete Transfer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete transfer {selectedTransfer?.transactionNumber}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTransfer}
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