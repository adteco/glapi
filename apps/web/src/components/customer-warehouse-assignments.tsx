'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
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
  const fetchAssignments = async () => {
    if (!orgId || !customerId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication token not available.');
        setIsLoading(false);
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/customers/${customerId}/warehouse-assignments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorResult = await response.json();
        toast.error(errorResult.message || 'Failed to fetch warehouse assignments.');
        throw new Error('Failed to fetch assignments');
      }

      const data = await response.json();
      setAssignments(data);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      if (!(error instanceof Error && error.message === 'Failed to fetch assignments')) {
        toast.error('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [orgId, customerId, getToken]);

  // Fetch items
  useEffect(() => {
    const fetchItems = async () => {
      if (!orgId) return;
      
      try {
        const token = await getToken();
        if (!token) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/items?activeOnly=true&limit=1000`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch items');
          return;
        }

        const data = await response.json();
        setItems(data.data || []);
      } catch (error) {
        console.error('Error fetching items:', error);
      }
    };

    fetchItems();
  }, [orgId, getToken]);

  // Fetch warehouses
  useEffect(() => {
    const fetchWarehouses = async () => {
      if (!orgId) return;
      
      try {
        const token = await getToken();
        if (!token) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/warehouses?activeOnly=true`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch warehouses');
          return;
        }

        const data = await response.json();
        setWarehouses(data.data || []);
      } catch (error) {
        console.error('Error fetching warehouses:', error);
      }
    };

    fetchWarehouses();
  }, [orgId, getToken]);

  // Handle form submission
  const onSubmit = async (values: AssignmentFormValues) => {
    if (!orgId || !customerId) {
      toast.error('Missing required information.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication token not available.');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/customers/${customerId}/warehouse-assignments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: values.itemId,
          warehouseId: values.warehouseId,
          isDefault: values.isDefault,
          effectiveDate: values.effectiveDate || undefined,
          expirationDate: values.expirationDate || undefined,
        }),
      });

      if (!response.ok) {
        const errorResult = await response.json();
        toast.error(errorResult.message || 'Failed to create assignment.');
        throw new Error('Failed to create assignment');
      }

      const result = await response.json();
      
      toast.success('Warehouse assignment created successfully!');
      setIsDialogOpen(false);
      form.reset();
      
      // Refresh the list
      await fetchAssignments();
    } catch (error) {
      console.error('Error creating assignment:', error);
      if (!(error instanceof Error && error.message === 'Failed to create assignment')) {
        toast.error('An unexpected error occurred.');
      }
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
      const token = await getToken();
      if (!token) {
        toast.error('Authentication token not available.');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/warehouse-assignments/${assignmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorResult = await response.json();
        toast.error(errorResult.message || 'Failed to remove assignment.');
        throw new Error('Failed to remove assignment');
      }

      toast.success('Assignment removed successfully!');
      await fetchAssignments();
    } catch (error) {
      console.error('Error removing assignment:', error);
      toast.error('An unexpected error occurred.');
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