'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Eye, TrendingUp, TrendingDown } from 'lucide-react';
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

// Define interfaces for the Inventory Adjustment data
interface InventoryAdjustment {
  id: string;
  transactionNumber: string;
  warehouseId: string;
  warehouseName: string;
  transactionDate: string;
  adjustmentType: 'INCREASE' | 'DECREASE' | 'RECOUNT';
  reason: string;
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  totalAdjustmentValue: number;
  lines: InventoryAdjustmentLine[];
}

interface InventoryAdjustmentLine {
  id: string;
  itemId: string;
  itemName: string;
  itemSku: string;
  currentQuantity: number;
  newQuantity: number;
  adjustmentQuantity: number;
  unitCost: number;
  adjustmentValue: number;
  reason: string;
  binLocation?: string;
  serialNumbers?: string[];
  lotNumbers?: string[];
}

// Form schemas
const inventoryAdjustmentLineSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  newQuantity: z.number().min(0, "New quantity must be positive"),
  reason: z.string().min(1, "Reason is required"),
  binLocation: z.string().optional(),
  serialNumbers: z.array(z.string()).optional(),
  lotNumbers: z.array(z.string()).optional(),
});

const inventoryAdjustmentFormSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse is required"),
  transactionDate: z.string().min(1, "Transaction date is required"),
  adjustmentType: z.enum(['INCREASE', 'DECREASE', 'RECOUNT']),
  reason: z.string().min(1, "Reason is required"),
  memo: z.string().max(1000, "Memo too long").optional(),
  lines: z.array(inventoryAdjustmentLineSchema).min(1, "At least one line item is required"),
});

type InventoryAdjustmentFormValues = z.infer<typeof inventoryAdjustmentFormSchema>;

export default function InventoryAdjustmentsPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAdjustment, setSelectedAdjustment] = useState<InventoryAdjustment | null>(null);
  const { orgId } = useAuth();
  
  // Mock data for now - replace with TRPC when available
  const adjustments: InventoryAdjustment[] = [];
  const warehouses = [
    { id: '1', name: 'Main Warehouse', location: 'Building A' },
    { id: '2', name: 'Distribution Center', location: 'Building B' },
    { id: '3', name: 'Retail Store', location: 'Downtown' },
  ];
  const items = [
    { id: '1', name: 'Product A', sku: 'PROD-A-001', currentQuantity: 100, unitCost: 25.00 },
    { id: '2', name: 'Product B', sku: 'PROD-B-002', currentQuantity: 50, unitCost: 15.00 },
    { id: '3', name: 'Product C', sku: 'PROD-C-003', currentQuantity: 75, unitCost: 35.00 },
  ];
  const adjustmentReasons = [
    'Physical Count Discrepancy',
    'Damaged Goods',
    'Theft/Loss',
    'Expiration',
    'Quality Control',
    'Supplier Return',
    'Manufacturing Defect',
    'System Error Correction',
    'Obsolete Inventory',
    'Cycle Count Adjustment',
  ];

  const form = useForm<InventoryAdjustmentFormValues>({
    resolver: zodResolver(inventoryAdjustmentFormSchema),
    defaultValues: {
      warehouseId: "",
      transactionDate: new Date().toISOString().split('T')[0],
      adjustmentType: "RECOUNT",
      reason: "",
      memo: "",
      lines: [
        { itemId: "", newQuantity: 0, reason: "", binLocation: "", serialNumbers: [], lotNumbers: [] },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  // Handle add adjustment
  const handleAddAdjustment = async (values: InventoryAdjustmentFormValues) => {
    try {
      // TODO: Implement TRPC mutation
      toast.success('Inventory adjustment created successfully');
      setIsAddDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error('Failed to create inventory adjustment');
    }
  };

  // Handle post adjustment
  const handlePostAdjustment = async (adjustment: InventoryAdjustment) => {
    try {
      // TODO: Implement TRPC mutation to post adjustment
      toast.success('Inventory adjustment posted successfully');
    } catch (error) {
      toast.error('Failed to post adjustment');
    }
  };

  // Handle delete adjustment
  const handleDeleteAdjustment = async () => {
    try {
      // TODO: Implement TRPC mutation
      toast.success('Inventory adjustment deleted successfully');
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast.error('Failed to delete adjustment');
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'outline';
      case 'POSTED': return 'default';
      case 'CANCELLED': return 'destructive';
      default: return 'outline';
    }
  };

  const getAdjustmentTypeIcon = (type: string) => {
    switch (type) {
      case 'INCREASE': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'DECREASE': return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'RECOUNT': return <Eye className="h-4 w-4 text-blue-600" />;
      default: return null;
    }
  };

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view inventory adjustments.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Inventory Adjustments</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Adjustment
        </Button>
      </div>

      <Table>
        <TableCaption>A list of inventory adjustments.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Adjustment #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Warehouse</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {adjustments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                No inventory adjustments found. Create your first adjustment to get started.
              </TableCell>
            </TableRow>
          ) : (
            adjustments.map((adjustment) => (
              <TableRow key={adjustment.id}>
                <TableCell className="font-medium">{adjustment.transactionNumber}</TableCell>
                <TableCell>{new Date(adjustment.transactionDate).toLocaleDateString()}</TableCell>
                <TableCell>{adjustment.warehouseName}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getAdjustmentTypeIcon(adjustment.adjustmentType)}
                    {adjustment.adjustmentType}
                  </div>
                </TableCell>
                <TableCell className="max-w-xs truncate">{adjustment.reason}</TableCell>
                <TableCell className="text-right">${Math.abs(adjustment.totalAdjustmentValue).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(adjustment.status)}>
                    {adjustment.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedAdjustment(adjustment);
                        setIsViewDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {adjustment.status === 'DRAFT' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePostAdjustment(adjustment)}
                        title="Post Adjustment"
                      >
                        <TrendingUp className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedAdjustment(adjustment);
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

      {/* Add Adjustment Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Inventory Adjustment</DialogTitle>
            <DialogDescription>
              Create a new inventory adjustment to correct stock levels.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddAdjustment)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                <FormField
                  control={form.control}
                  name="transactionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adjustment Date</FormLabel>
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
                  name="adjustmentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adjustment Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="INCREASE">Increase</SelectItem>
                          <SelectItem value="DECREASE">Decrease</SelectItem>
                          <SelectItem value="RECOUNT">Recount</SelectItem>
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
                          {adjustmentReasons.map((reason) => (
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
                  <h3 className="text-lg font-semibold">Items to Adjust</h3>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ itemId: "", newQuantity: 0, reason: "", binLocation: "", serialNumbers: [], lotNumbers: [] })}
                  >
                    Add Item
                  </Button>
                </div>

                {fields.map((field, index) => {
                  const selectedItem = items.find(item => item.id === field.itemId);
                  const adjustmentQuantity = field.newQuantity - (selectedItem?.currentQuantity || 0);
                  const adjustmentValue = adjustmentQuantity * (selectedItem?.unitCost || 0);
                  
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
                          name={`lines.${index}.newQuantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>New Quantity</FormLabel>
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
                          name={`lines.${index}.reason`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Line Reason</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select reason" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {adjustmentReasons.map((reason) => (
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
                      </div>
                      
                      {selectedItem && (
                        <div className="bg-gray-50 p-3 rounded-md">
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Current Qty:</span>
                              <p>{selectedItem.currentQuantity}</p>
                            </div>
                            <div>
                              <span className="font-medium">Adjustment:</span>
                              <p className={adjustmentQuantity >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {adjustmentQuantity > 0 ? '+' : ''}{adjustmentQuantity}
                              </p>
                            </div>
                            <div>
                              <span className="font-medium">Unit Cost:</span>
                              <p>${selectedItem.unitCost.toFixed(2)}</p>
                            </div>
                            <div>
                              <span className="font-medium">Value Impact:</span>
                              <p className={adjustmentValue >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {adjustmentValue > 0 ? '+' : ''}${adjustmentValue.toFixed(2)}
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
                  Create Adjustment
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Adjustment Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Adjustment Details</DialogTitle>
            <DialogDescription>
              View inventory adjustment {selectedAdjustment?.transactionNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedAdjustment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Adjustment Number</label>
                  <p className="text-sm">{selectedAdjustment.transactionNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <p className="text-sm">{new Date(selectedAdjustment.transactionDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Warehouse</label>
                  <p className="text-sm">{selectedAdjustment.warehouseName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <p className="text-sm flex items-center gap-2">
                    {getAdjustmentTypeIcon(selectedAdjustment.adjustmentType)}
                    {selectedAdjustment.adjustmentType}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Reason</label>
                  <p className="text-sm">{selectedAdjustment.reason}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <p className="text-sm">
                    <Badge variant={getStatusBadgeVariant(selectedAdjustment.status)}>
                      {selectedAdjustment.status}
                    </Badge>
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Adjustments</label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Current</TableHead>
                      <TableHead>New</TableHead>
                      <TableHead>Adj</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedAdjustment.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.itemName}</TableCell>
                        <TableCell>{line.currentQuantity}</TableCell>
                        <TableCell>{line.newQuantity}</TableCell>
                        <TableCell className={line.adjustmentQuantity >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {line.adjustmentQuantity > 0 ? '+' : ''}{line.adjustmentQuantity}
                        </TableCell>
                        <TableCell>{line.reason}</TableCell>
                        <TableCell className={`text-right ${line.adjustmentValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {line.adjustmentValue > 0 ? '+' : ''}${line.adjustmentValue.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
                <span className="text-lg font-semibold">Total Value Impact</span>
                <span className={`text-lg font-bold ${selectedAdjustment.totalAdjustmentValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedAdjustment.totalAdjustmentValue > 0 ? '+' : ''}${selectedAdjustment.totalAdjustmentValue.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Adjustment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete adjustment {selectedAdjustment?.transactionNumber}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAdjustment}
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