'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, DollarSign, Edit, Trash, Package } from 'lucide-react';
import { trpc } from '@/lib/trpc';
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Define interfaces
interface PriceList {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description?: string;
  currencyCode: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Form schema
const priceListFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  code: z.string().min(1, "Code is required").max(20, "Code must be less than 20 characters"),
  description: z.string().optional(),
  currencyCode: z.string().min(3).max(3).default("USD"),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

type PriceListFormValues = z.infer<typeof priceListFormSchema>;

export default function PriceListsPage() {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPriceList, setEditingPriceList] = useState<PriceList | null>(null);
  const { orgId } = useAuth();
  const previousOrgIdRef = useRef<string | null>(null);

  // tRPC queries and mutations
  const { data: priceListsData, isLoading, refetch } = trpc.priceLists.list.useQuery({
    activeOnly: false,
    limit: 100,
  }, {
    enabled: !!orgId,
  });

  const createPriceListMutation = trpc.priceLists.create.useMutation({
    onSuccess: () => {
      toast.success('Price list created successfully!');
      setIsDialogOpen(false);
      form.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create price list');
    },
  });

  const updatePriceListMutation = trpc.priceLists.update.useMutation({
    onSuccess: () => {
      toast.success('Price list updated successfully!');
      setIsEditDialogOpen(false);
      setEditingPriceList(null);
      editForm.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update price list');
    },
  });

  const deletePriceListMutation = trpc.priceLists.delete.useMutation({
    onSuccess: () => {
      toast.success('Price list deleted successfully!');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete price list');
    },
  });

  const priceLists = priceListsData?.data || [];

  const form = useForm<PriceListFormValues>({
    resolver: zodResolver(priceListFormSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      currencyCode: "USD",
      isDefault: false,
      isActive: true,
    },
  });

  const editForm = useForm<PriceListFormValues>({
    resolver: zodResolver(priceListFormSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      currencyCode: "USD",
      isDefault: false,
      isActive: true,
    },
  });

  // Clear state when organization changes
  useEffect(() => {
    if (orgId && orgId !== previousOrgIdRef.current) {
      previousOrgIdRef.current = orgId;
      form.reset();
      editForm.reset();
    }
  }, [orgId, form, editForm]);

  // Handle form submission for create
  const onSubmit = async (values: PriceListFormValues) => {
    if (!orgId) {
      toast.error('Organization not selected.');
      return;
    }

    createPriceListMutation.mutate(values);
  };

  // Handle form submission for edit
  const onEditSubmit = async (values: PriceListFormValues) => {
    if (!orgId || !editingPriceList) {
      toast.error('Organization not selected.');
      return;
    }

    updatePriceListMutation.mutate({
      id: editingPriceList.id,
      data: values,
    });
  };

  // Handle delete
  const handleDelete = async (priceList: PriceList) => {
    if (!confirm(`Are you sure you want to delete the price list "${priceList.name}"?`)) {
      return;
    }

    deletePriceListMutation.mutate({ id: priceList.id });
  };

  // Open edit dialog
  const openEditDialog = (priceList: PriceList) => {
    setEditingPriceList(priceList);
    editForm.reset({
      name: priceList.name,
      code: priceList.code,
      description: priceList.description || "",
      currencyCode: priceList.currencyCode,
      isDefault: priceList.isDefault,
      isActive: priceList.isActive,
    });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Price Lists</h1>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Price List
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[625px]">
              <DialogHeader>
                <DialogTitle>Create Price List</DialogTitle>
                <DialogDescription>
                  Add a new price list to manage item pricing across different customer segments or regions.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Standard Pricing" {...field} />
                        </FormControl>
                        <FormDescription>
                          A descriptive name for this price list.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code</FormLabel>
                        <FormControl>
                          <Input placeholder="STD" {...field} />
                        </FormControl>
                        <FormDescription>
                          A unique code to identify this price list.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Standard pricing for all customers..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currencyCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency Code</FormLabel>
                        <FormControl>
                          <Input placeholder="USD" {...field} />
                        </FormControl>
                        <FormDescription>
                          Three-letter currency code (e.g., USD, EUR, GBP).
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
                          <FormLabel className="text-base">Default Price List</FormLabel>
                          <FormDescription>
                            Use this as the default price list for new customers.
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
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active</FormLabel>
                          <FormDescription>
                            Active price lists can be used for pricing calculations.
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
                    <Button type="submit" disabled={createPriceListMutation.isPending}>
                      {createPriceListMutation.isPending ? 'Creating...' : 'Create Price List'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-muted-foreground">
          Manage price lists that can be assigned to warehouses and customers for flexible pricing.
        </p>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Edit Price List</DialogTitle>
            <DialogDescription>
              Update price list information.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Standard Pricing" {...field} />
                    </FormControl>
                    <FormDescription>
                      A descriptive name for this price list.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input placeholder="STD" {...field} />
                    </FormControl>
                    <FormDescription>
                      A unique code to identify this price list.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Standard pricing for all customers..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="currencyCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency Code</FormLabel>
                    <FormControl>
                      <Input placeholder="USD" {...field} />
                    </FormControl>
                    <FormDescription>
                      Three-letter currency code (e.g., USD, EUR, GBP).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Default Price List</FormLabel>
                      <FormDescription>
                        Use this as the default price list for new customers.
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
              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Active price lists can be used for pricing calculations.
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
                    setEditingPriceList(null);
                    editForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updatePriceListMutation.isPending}>
                  {updatePriceListMutation.isPending ? 'Updating...' : 'Update Price List'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-10">Loading price lists...</div>
      ) : priceLists.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground mb-4">No price lists found. Create your first price list to get started.</p>
        </div>
      ) : (
        <Table>
          <TableCaption>A list of all price lists in your organization.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {priceLists.map((priceList) => (
              <TableRow key={priceList.id}>
                <TableCell className="font-medium">{priceList.code}</TableCell>
                <TableCell>{priceList.name}</TableCell>
                <TableCell className="max-w-xs truncate">{priceList.description || '-'}</TableCell>
                <TableCell>{priceList.currencyCode}</TableCell>
                <TableCell>
                  <Badge variant={priceList.isDefault ? 'default' : 'outline'}>
                    {priceList.isDefault ? 'Default' : 'Standard'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={priceList.isActive ? 'default' : 'secondary'}>
                    {priceList.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(priceList.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/lists/price-lists/${priceList.id}/items`)}
                      title="Manage Items"
                    >
                      <Package className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(priceList)}
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(priceList)}
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