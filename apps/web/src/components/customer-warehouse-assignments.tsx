'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useApiClient } from '@/lib/api-client.client';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Define interfaces
interface CustomerWarehouseAssignment {
  id: string;
  organizationId: string;
  customerId: string;
  itemId: string;
  warehouseId: string;
  isDefault: boolean;
  effectiveDate?: string;
  expirationDate?: string;
  createdAt: string;
  updatedAt: string;
  warehouse?: {
    id: string;
    warehouseId: string;
    name: string;
  };
  item?: {
    id: string;
    itemCode: string;
    name: string;
  };
}

interface Item {
  id: string;
  itemCode: string;
  name: string;
}

interface Warehouse {
  id: string;
  warehouseId: string;
  name: string;
  isActive: boolean;
}

interface CustomerWarehouseAssignmentsProps {
  customerId: string;
  customerName?: string;
}

// Form schema
const assignmentFormSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  isDefault: z.boolean().default(false),
  effectiveDate: z.string().optional(),
  expirationDate: z.string().optional(),
});

type AssignmentFormValues = z.infer<typeof assignmentFormSchema>;

export function CustomerWarehouseAssignments({ customerId, customerName }: CustomerWarehouseAssignmentsProps) {
  const [assignments, setAssignments] = useState<CustomerWarehouseAssignment[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { getToken, orgId } = useAuth();
  const { apiGet, apiPost, apiDelete } = useApiClient();
  const previousOrgIdRef = useRef<string | null>(null);

  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentFormSchema),
    defaultValues: {
      itemId: "",
      warehouseId: "",
      isDefault: false,
      effectiveDate: "",
      expirationDate: "",
    },
  });

  // Fetch customer warehouse assignments
  const fetchAssignments = useCallback(async () => {
    if (!orgId || !customerId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const data = await apiGet<CustomerWarehouseAssignment[]>(`/api/customers/${customerId}/warehouse-assignments`);
      setAssignments(data);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast.error('Failed to fetch warehouse assignments.');
    } finally {
      setIsLoading(false);
    }
  }, [apiGet, orgId, customerId]);

  // Detect organization changes and clear data
  useEffect(() => {
    const currentOrgId = orgId || null;
    
    if (previousOrgIdRef.current && previousOrgIdRef.current !== currentOrgId) {
      // Organization changed, clear data
      setAssignments([]);
      setItems([]);
      setWarehouses([]);
      setIsLoading(true);
    }
    
    previousOrgIdRef.current = currentOrgId;
  }, [orgId]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Fetch items
  const fetchItems = useCallback(async () => {
    if (!orgId) return;
    
    try {
      const data = await apiGet<{ data: Item[] }>('/api/items?activeOnly=true&limit=1000');
      setItems(data.data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  }, [apiGet, orgId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Fetch warehouses
  const fetchWarehouses = useCallback(async () => {
    if (!orgId) return;
    
    try {
      const data = await apiGet<{ data: Warehouse[] }>('/api/warehouses?activeOnly=true');
      setWarehouses(data.data || []);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  }, [apiGet, orgId]);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  // Handle form submission
  const onSubmit = async (values: AssignmentFormValues) => {
    if (!orgId || !customerId) {
      toast.error('Missing required information.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost(`/api/customers/${customerId}/warehouse-assignments`, {
        itemId: values.itemId,
        warehouseId: values.warehouseId,
        isDefault: values.isDefault,
        effectiveDate: values.effectiveDate || undefined,
        expirationDate: values.expirationDate || undefined,
      });
      
      toast.success('Warehouse assignment created successfully!');
      setIsDialogOpen(false);
      form.reset();
      
      // Refresh the list
      await fetchAssignments();
    } catch (error) {
      console.error('Error creating assignment:', error);
      toast.error('Failed to create assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to remove this warehouse assignment?')) {
      return;
    }

    try {
      await apiDelete(`/api/warehouse-assignments/${assignmentId}`);
      toast.success('Assignment removed successfully!');
      await fetchAssignments();
    } catch (error) {
      console.error('Error removing assignment:', error);
      toast.error('Failed to remove assignment.');
    }
  };

  // Filter out already assigned items
  const getAvailableItems = () => {
    const assignedItemIds = assignments.map(a => a.itemId);
    return items.filter(item => !assignedItemIds.includes(item.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Warehouse Assignments</h2>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={getAvailableItems().length === 0 || warehouses.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Add Assignment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Item to Warehouse</DialogTitle>
              <DialogDescription>
                Specify which warehouse {customerName || 'this customer'} should get pricing from for an item.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="itemId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an item" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {getAvailableItems().map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.itemCode} - {item.name}
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a warehouse" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {warehouses.map((warehouse) => (
                            <SelectItem key={warehouse.id} value={warehouse.id}>
                              {warehouse.warehouseId} - {warehouse.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The warehouse to use for pricing this item.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="isDefault"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Default Assignment</FormLabel>
                        <FormDescription>
                          Use this warehouse as the default for this customer.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="effectiveDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Effective Date (Optional)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="expirationDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiration Date (Optional)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Assignment'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-10">Loading assignments...</div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground">
            No warehouse assignments found. Add assignments to specify which warehouse prices to use for each item.
          </p>
        </div>
      ) : (
        <Table>
          <TableCaption>Item-specific warehouse assignments for this customer.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Item Code</TableHead>
              <TableHead>Item Name</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Effective Date</TableHead>
              <TableHead>Expiration Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((assignment) => (
              <TableRow key={assignment.id}>
                <TableCell className="font-medium">{assignment.item?.itemCode || '-'}</TableCell>
                <TableCell>{assignment.item?.name || '-'}</TableCell>
                <TableCell>
                  {assignment.warehouse?.warehouseId} - {assignment.warehouse?.name || '-'}
                </TableCell>
                <TableCell>
                  <Badge variant={assignment.isDefault ? 'default' : 'outline'}>
                    {assignment.isDefault ? 'Default' : 'Specific'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {assignment.effectiveDate ? new Date(assignment.effectiveDate).toLocaleDateString() : '-'}
                </TableCell>
                <TableCell>
                  {assignment.expirationDate ? new Date(assignment.expirationDate).toLocaleDateString() : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(assignment.id)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}