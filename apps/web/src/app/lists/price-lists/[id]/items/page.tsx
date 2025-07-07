'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useApiClient } from '@/lib/api-client.client';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Package, Trash, Edit, DollarSign } from 'lucide-react';
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Define interfaces
interface PriceList {
  id: string;
  name: string;
  code: string;
  currencyCode: string;
  isActive: boolean;
}

interface Item {
  id: string;
  itemCode: string;
  name: string;
  description?: string;
  defaultPrice?: number;
  isActive: boolean;
}

interface ItemPricing {
  id: string;
  itemId: string;
  priceListId: string;
  unitPrice: number;
  minQuantity: number;
  effectiveDate: string;
  expirationDate?: string;
  createdAt: string;
  updatedAt: string;
  item?: Item;
}

// Form schema
const itemPricingFormSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  unitPrice: z.string().min(1, "Price is required").refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: "Price must be a valid positive number",
  }),
  minQuantity: z.string().min(1, "Minimum quantity is required").refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Minimum quantity must be a positive number",
  }),
  effectiveDate: z.string().min(1, "Effective date is required"),
  expirationDate: z.string().optional(),
});

type ItemPricingFormValues = z.infer<typeof itemPricingFormSchema>;

export default function PriceListItemsPage() {
  const params = useParams();
  const router = useRouter();
  const priceListId = params.id as string;
  
  const [priceList, setPriceList] = useState<PriceList | null>(null);
  const [itemPricings, setItemPricings] = useState<ItemPricing[]>([]);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPricing, setEditingPricing] = useState<ItemPricing | null>(null);
  const { orgId } = useAuth();
  const { apiClient, apiGet, apiPost, apiDelete } = useApiClient();
  const previousOrgIdRef = useRef<string | null>(null);

  const form = useForm<ItemPricingFormValues>({
    resolver: zodResolver(itemPricingFormSchema),
    defaultValues: {
      itemId: "",
      unitPrice: "",
      minQuantity: "1",
      effectiveDate: new Date().toISOString().split('T')[0],
      expirationDate: "",
    },
  });

  const editForm = useForm<ItemPricingFormValues>({
    resolver: zodResolver(itemPricingFormSchema),
    defaultValues: {
      itemId: "",
      unitPrice: "",
      minQuantity: "1",
      effectiveDate: new Date().toISOString().split('T')[0],
      expirationDate: "",
    },
  });

  // Fetch price list details
  const fetchPriceList = useCallback(async () => {
    if (!orgId || !priceListId) return;
    
    try {
      const data = await apiGet<PriceList>(`/api/price-lists/${priceListId}`);
      setPriceList(data);
    } catch (error) {
      console.error('Error fetching price list:', error);
      toast.error('Failed to fetch price list details');
    }
  }, [orgId, priceListId, apiGet]);

  // Fetch item pricings
  const fetchItemPricings = useCallback(async () => {
    if (!orgId || !priceListId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const data = await apiGet<ItemPricing[] | { data: ItemPricing[] }>(`/api/price-lists/${priceListId}/items?limit=1000`);
      
      // Handle both paginated and non-paginated responses
      const pricings = Array.isArray(data) ? data : (data.data || []);
      
      // Fetch item details for each pricing
      const enrichedPricings = await Promise.all(
        pricings.map(async (pricing: ItemPricing) => {
          try {
            const item = await apiGet<Item>(`/api/items/${pricing.itemId}`);
            return { ...pricing, item };
          } catch (err) {
            console.error('Error fetching item details:', err);
            return pricing;
          }
        })
      );
      
      setItemPricings(enrichedPricings);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Failed to fetch price list items.');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, priceListId, apiGet]);

  // Fetch available items
  const fetchItems = useCallback(async () => {
    if (!orgId) return;
    
    try {
      const data = await apiGet<{ data: Item[] }>('/api/items?activeOnly=true&limit=1000');
      console.log('Items fetched:', data);
      setAvailableItems(data.data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  }, [orgId, apiGet]);

  // Clear data and refetch when organization changes
  useEffect(() => {
    if (orgId && orgId !== previousOrgIdRef.current) {
      // Clear existing data immediately when org changes
      setPriceList(null);
      setItemPricings([]);
      setAvailableItems([]);
      previousOrgIdRef.current = orgId;
    }
    fetchPriceList();
    fetchItemPricings();
    fetchItems();
  }, [orgId, fetchPriceList, fetchItemPricings, fetchItems]);

  // Handle form submission for create
  const onSubmit = async (values: ItemPricingFormValues) => {
    if (!orgId || !priceListId) {
      toast.error('Missing required information.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost(`/api/price-lists/${priceListId}/items`, {
        itemId: values.itemId,
        unitPrice: parseFloat(values.unitPrice),
        minQuantity: parseFloat(values.minQuantity),
        effectiveDate: values.effectiveDate,
        expirationDate: values.expirationDate || undefined,
      });
      
      toast.success('Item added to price list successfully!');
      setIsDialogOpen(false);
      form.reset();
      
      // Refresh the list
      await fetchItemPricings();
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Failed to add item to price list.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle form submission for edit
  const onEditSubmit = async (values: ItemPricingFormValues) => {
    if (!orgId || !editingPricing) {
      toast.error('Missing required information.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient(`/api/item-pricing/${editingPricing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          unitPrice: parseFloat(values.unitPrice),
          minQuantity: parseFloat(values.minQuantity),
          effectiveDate: values.effectiveDate,
          expirationDate: values.expirationDate || undefined,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update item pricing');
      }
      
      toast.success('Item pricing updated successfully!');
      setIsEditDialogOpen(false);
      setEditingPricing(null);
      editForm.reset();
      
      // Refresh the list
      await fetchItemPricings();
    } catch (error) {
      console.error('Error updating pricing:', error);
      toast.error('Failed to update item pricing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (itemPricingId: string) => {
    if (!confirm('Are you sure you want to remove this item from the price list?')) {
      return;
    }

    try {
      await apiDelete(`/api/item-pricing/${itemPricingId}`);
      toast.success('Item removed from price list successfully!');
      await fetchItemPricings();
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('Failed to remove item from price list.');
    }
  };

  // Open edit dialog
  const openEditDialog = (pricing: ItemPricing) => {
    setEditingPricing(pricing);
    editForm.reset({
      itemId: pricing.itemId,
      unitPrice: pricing.unitPrice.toString(),
      minQuantity: pricing.minQuantity.toString(),
      effectiveDate: pricing.effectiveDate,
      expirationDate: pricing.expirationDate || "",
    });
    setIsEditDialogOpen(true);
  };

  // Filter out already priced items
  const getAvailableItemsForPricing = () => {
    const pricedItemIds = itemPricings.map(ip => ip.itemId);
    return availableItems.filter(item => !pricedItemIds.includes(item.id));
  };

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => router.push('/lists/price-lists')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Price Lists
        </Button>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <DollarSign className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold">Price List Items</h1>
              {priceList && (
                <p className="text-muted-foreground">
                  {priceList.name} ({priceList.code}) - {priceList.currencyCode}
                </p>
              )}
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                disabled={getAvailableItemsForPricing().length === 0}
                title={getAvailableItemsForPricing().length === 0 ? "No items available to add" : "Add item to price list"}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Item ({getAvailableItemsForPricing().length} available)
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[625px]">
              <DialogHeader>
                <DialogTitle>Add Item to Price List</DialogTitle>
                <DialogDescription>
                  Set pricing for an item in this price list.
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
                            {getAvailableItemsForPricing().map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.itemCode} - {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose an item to add to this price list.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="unitPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Price</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="0.00" 
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Price per unit in {priceList?.currencyCode || 'USD'}.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="minQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Quantity</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="1"
                            placeholder="1" 
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Minimum quantity for this price to apply.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="effectiveDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Effective Date</FormLabel>
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
                      {isSubmitting ? 'Adding...' : 'Add Item'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Edit Item Pricing</DialogTitle>
            <DialogDescription>
              Update pricing information for this item.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Item</p>
                <p className="text-sm text-muted-foreground">
                  {editingPricing?.item?.itemCode} - {editingPricing?.item?.name}
                </p>
              </div>
              
              <FormField
                control={editForm.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="0.00" 
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Price per unit in {priceList?.currencyCode || 'USD'}.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="minQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Quantity</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="1"
                        placeholder="1" 
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum quantity for this price to apply.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="effectiveDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
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
                    setIsEditDialogOpen(false);
                    setEditingPricing(null);
                    editForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Updating...' : 'Update Pricing'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-10">Loading price list items...</div>
      ) : itemPricings.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground mb-4">
            No items in this price list yet. Add items to set their prices.
          </p>
        </div>
      ) : (
        <Table>
          <TableCaption>Items and their prices in this price list.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Item Code</TableHead>
              <TableHead>Item Name</TableHead>
              <TableHead>Unit Price</TableHead>
              <TableHead>Min Quantity</TableHead>
              <TableHead>Effective Date</TableHead>
              <TableHead>Expiration Date</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itemPricings.map((pricing) => (
              <TableRow key={pricing.id}>
                <TableCell className="font-medium">{pricing.item?.itemCode || '-'}</TableCell>
                <TableCell>{pricing.item?.name || '-'}</TableCell>
                <TableCell>{priceList?.currencyCode} {pricing.unitPrice.toFixed(2)}</TableCell>
                <TableCell>{pricing.minQuantity}</TableCell>
                <TableCell>{new Date(pricing.effectiveDate).toLocaleDateString()}</TableCell>
                <TableCell>
                  {pricing.expirationDate ? new Date(pricing.expirationDate).toLocaleDateString() : '-'}
                </TableCell>
                <TableCell>{new Date(pricing.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(pricing)}
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(pricing.id)}
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