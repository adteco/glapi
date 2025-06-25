'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Building2, Edit, Trash, DollarSign } from 'lucide-react';
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Define interfaces
interface Warehouse {
  id: string;
  organizationId: string;
  warehouseId: string;
  name: string;
  locationId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  location?: {
    id: string;
    name: string;
    addressLine1?: string;
    city?: string;
    stateProvince?: string;
  };
}

interface Location {
  id: string;
  name: string;
  addressLine1?: string;
  city?: string;
  stateProvince?: string;
}

// Form schema
const warehouseFormSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse ID is required").max(50),
  name: z.string().min(1, "Name is required").max(255),
  locationId: z.string().optional(),
  isActive: z.boolean().default(true),
});

type WarehouseFormValues = z.infer<typeof warehouseFormSchema>;

export default function WarehousesPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const { getToken, orgId } = useAuth();

  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: {
      warehouseId: "",
      name: "",
      locationId: "",
      isActive: true,
    },
  });

  const editForm = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: {
      warehouseId: "",
      name: "",
      locationId: "",
      isActive: true,
    },
  });

  // Fetch warehouses
  const fetchWarehouses = async () => {
    if (!orgId) {
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
      const response = await fetch(`${apiUrl}/api/warehouses`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorResult = await response.json();
        toast.error(errorResult.message || errorResult.error || 'Failed to fetch warehouses.');
        throw new Error('Failed to fetch warehouses');
      }

      const data = await response.json();
      setWarehouses(data.data || []);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      if (!(error instanceof Error && error.message === 'Failed to fetch warehouses')) {
        toast.error('An unexpected error occurred while fetching warehouses.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, [orgId, getToken]);

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      if (!orgId) return;
      
      try {
        const token = await getToken();
        if (!token) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/locations`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch locations');
          return;
        }

        const data = await response.json();
        setLocations(data.data || []);
      } catch (error) {
        console.error('Error fetching locations:', error);
      }
    };

    fetchLocations();
  }, [orgId, getToken]);

  // Handle form submission
  const onSubmit = async (values: WarehouseFormValues) => {
    if (!orgId) {
      toast.error('Organization not selected.');
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
      const response = await fetch(`${apiUrl}/api/warehouses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          warehouseId: values.warehouseId,
          name: values.name,
          locationId: values.locationId === 'no-location' ? undefined : values.locationId,
          isActive: values.isActive,
        }),
      });

      if (!response.ok) {
        const errorResult = await response.json();
        toast.error(errorResult.message || 'Failed to create warehouse.');
        throw new Error('Failed to create warehouse');
      }

      const result = await response.json();
      
      toast.success('Warehouse created successfully!');
      setIsDialogOpen(false);
      form.reset();
      
      // Refresh the warehouses list
      await fetchWarehouses();
    } catch (error) {
      console.error('Error creating warehouse:', error);
      if (!(error instanceof Error && error.message === 'Failed to create warehouse')) {
        toast.error('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit form submission
  const onEditSubmit = async (values: WarehouseFormValues) => {
    if (!orgId || !editingWarehouse) {
      toast.error('Organization not selected.');
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
      const response = await fetch(`${apiUrl}/api/warehouses/${editingWarehouse.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          warehouseId: values.warehouseId,
          name: values.name,
          locationId: values.locationId === 'no-location' ? undefined : values.locationId,
          isActive: values.isActive,
        }),
      });

      if (!response.ok) {
        const errorResult = await response.json();
        toast.error(errorResult.message || 'Failed to update warehouse.');
        throw new Error('Failed to update warehouse');
      }

      const result = await response.json();
      
      toast.success('Warehouse updated successfully!');
      setIsEditDialogOpen(false);
      setEditingWarehouse(null);
      editForm.reset();
      
      // Refresh the warehouses list
      await fetchWarehouses();
    } catch (error) {
      console.error('Error updating warehouse:', error);
      if (!(error instanceof Error && error.message === 'Failed to update warehouse')) {
        toast.error('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (warehouse: Warehouse) => {
    if (!confirm(`Are you sure you want to delete the warehouse "${warehouse.name}"?`)) {
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication token not available.');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/warehouses/${warehouse.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorResult = await response.json();
        toast.error(errorResult.message || 'Failed to delete warehouse.');
        throw new Error('Failed to delete warehouse');
      }

      toast.success('Warehouse deleted successfully!');
      await fetchWarehouses();
    } catch (error) {
      console.error('Error deleting warehouse:', error);
      toast.error('An unexpected error occurred.');
    }
  };

  // Open edit dialog
  const openEditDialog = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    editForm.reset({
      warehouseId: warehouse.warehouseId,
      name: warehouse.name,
      locationId: warehouse.locationId || "no-location",
      isActive: warehouse.isActive,
    });
    setIsEditDialogOpen(true);
  };

  // Format location for display
  const formatLocation = (location?: Warehouse['location']) => {
    if (!location) return '-';
    const parts = [
      location.name,
      location.addressLine1,
      location.city,
      location.stateProvince,
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(', ') : '-';
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Warehouses</h1>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Warehouse
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[625px]">
            <DialogHeader>
              <DialogTitle>Create New Warehouse</DialogTitle>
              <DialogDescription>
                Add a new warehouse to manage inventory and pricing across different locations.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="warehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Warehouse ID</FormLabel>
                      <FormControl>
                        <Input placeholder="WH-001" {...field} />
                      </FormControl>
                      <FormDescription>
                        Unique identifier for the warehouse
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Main Warehouse" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="no-location">No location</SelectItem>
                          {locations.map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Associate this warehouse with a physical location.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active</FormLabel>
                        <FormDescription>
                          Active warehouses can be used for pricing and inventory.
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
                    {isSubmitting ? 'Creating...' : 'Create Warehouse'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Edit Warehouse</DialogTitle>
            <DialogDescription>
              Update warehouse information.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="warehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Warehouse ID</FormLabel>
                    <FormControl>
                      <Input placeholder="WH-001" {...field} />
                    </FormControl>
                    <FormDescription>
                      Unique identifier for the warehouse
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Main Warehouse" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="no-location">No location</SelectItem>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Associate this warehouse with a physical location.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Active warehouses can be used for pricing and inventory.
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
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingWarehouse(null);
                    editForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Updating...' : 'Update Warehouse'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-10">Loading warehouses...</div>
      ) : warehouses.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground mb-4">No warehouses found. Create your first warehouse to get started.</p>
        </div>
      ) : (
        <Table>
          <TableCaption>A list of all warehouses in your organization.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Warehouse ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {warehouses.map((warehouse) => (
              <TableRow key={warehouse.id}>
                <TableCell className="font-medium">{warehouse.warehouseId}</TableCell>
                <TableCell>{warehouse.name}</TableCell>
                <TableCell className="max-w-xs truncate">{formatLocation(warehouse.location)}</TableCell>
                <TableCell>
                  <Badge variant={warehouse.isActive ? 'default' : 'secondary'}>
                    {warehouse.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(warehouse.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/lists/warehouses/${warehouse.id}/pricing`)}
                      title="Manage Pricing"
                    >
                      <DollarSign className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(warehouse)}
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(warehouse)}
                      title="Delete"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}