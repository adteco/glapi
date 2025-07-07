'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Plus, DollarSign, Trash } from 'lucide-react';
import { ExpandablePriceList } from './ExpandablePriceList';
import { useApiClient } from '@/lib/api-client.client';
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
interface Warehouse {
  id: string;
  warehouseId: string;
  name: string;
  isActive: boolean;
}

interface PriceList {
  id: string;
  name: string;
  code: string;
  currencyCode: string;
  isDefault: boolean;
  isActive: boolean;
}

interface WarehousePriceList {
  id: string;
  warehouseId: string;
  priceListId: string;
  priority: number;
  effectiveDate?: string;
  expirationDate?: string;
  createdAt: string;
  updatedAt: string;
  priceList?: PriceList;
}

// Form schema
const warehousePriceListFormSchema = z.object({
  priceListId: z.string().min(1, "Price list is required"),
  priority: z.number().min(1).max(999).default(1),
  effectiveDate: z.string().optional(),
  expirationDate: z.string().optional(),
});

type WarehousePriceListFormValues = z.infer<typeof warehousePriceListFormSchema>;

export default function WarehousePricingPage() {
  const params = useParams();
  const router = useRouter();
  const warehouseId = params.id as string;
  
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [warehousePriceLists, setWarehousePriceLists] = useState<WarehousePriceList[]>([]);
  const [availablePriceLists, setAvailablePriceLists] = useState<PriceList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { orgId } = useAuth();
  const { apiGet, apiPost, apiDelete } = useApiClient();
  const previousOrgIdRef = useRef<string | null>(null);

  const form = useForm<WarehousePriceListFormValues>({
    resolver: zodResolver(warehousePriceListFormSchema),
    defaultValues: {
      priceListId: "",
      priority: 1,
      effectiveDate: "",
      expirationDate: "",
    },
  });

  // Fetch warehouse details
  const fetchWarehouse = useCallback(async () => {
    if (!orgId || !warehouseId) return;
    
    try {
      const data = await apiGet<Warehouse>(`/api/warehouses/${warehouseId}`);
      setWarehouse(data);
    } catch (error) {
      console.error('Error fetching warehouse:', error);
      toast.error('Failed to fetch warehouse details');
    }
  }, [orgId, warehouseId, apiGet]);

  useEffect(() => {
    fetchWarehouse();
  }, [fetchWarehouse]);

  // Fetch warehouse price lists
  const fetchWarehousePriceLists = useCallback(async () => {
    if (!orgId || !warehouseId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const data = await apiGet<WarehousePriceList[]>(`/api/warehouses/${warehouseId}/price-lists`);
      setWarehousePriceLists(data);
    } catch (error) {
      console.error('Error fetching price lists:', error);
      toast.error('Failed to fetch price lists.');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, warehouseId, apiGet]);

  // Clear data and refetch when organization changes
  useEffect(() => {
    if (orgId && orgId !== previousOrgIdRef.current) {
      // Clear existing data immediately when org changes
      setWarehouse(null);
      setWarehousePriceLists([]);
      setAvailablePriceLists([]);
      previousOrgIdRef.current = orgId;
    }
    fetchWarehousePriceLists();
  }, [orgId, fetchWarehousePriceLists]);

  // Fetch available price lists
  useEffect(() => {
    const fetchPriceLists = async () => {
      if (!orgId) return;
      
      try {
        const data = await apiGet<{ data: PriceList[] }>('/api/price-lists?activeOnly=true');
        setAvailablePriceLists(data.data || []);
      } catch (error) {
        console.error('Error fetching price lists:', error);
      }
    };

    fetchPriceLists();
  }, [orgId, apiGet]);

  // Handle form submission
  const onSubmit = async (values: WarehousePriceListFormValues) => {
    if (!orgId || !warehouseId) {
      toast.error('Missing required information.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost(`/api/warehouses/${warehouseId}/price-lists`, {
        priceListId: values.priceListId,
        priority: values.priority,
        effectiveDate: values.effectiveDate || undefined,
        expirationDate: values.expirationDate || undefined,
      });
      
      toast.success('Price list assigned successfully!');
      setIsDialogOpen(false);
      form.reset();
      
      // Refresh the list
      await fetchWarehousePriceLists();
    } catch (error) {
      console.error('Error assigning price list:', error);
      toast.error('Failed to assign price list.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (priceListId: string) => {
    if (!confirm('Are you sure you want to remove this price list from the warehouse?')) {
      return;
    }

    try {
      await apiDelete(`/api/warehouses/${warehouseId}/price-lists?priceListId=${priceListId}`);
      toast.success('Price list removed successfully!');
      await fetchWarehousePriceLists();
    } catch (error) {
      console.error('Error removing price list:', error);
      toast.error('Failed to remove price list.');
    }
  };

  // Filter out already assigned price lists
  const getAvailablePriceLists = () => {
    const assignedIds = warehousePriceLists.map(wpl => wpl.priceListId);
    return availablePriceLists.filter(pl => !assignedIds.includes(pl.id));
  };

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => router.push('/lists/warehouses')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Warehouses
        </Button>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <DollarSign className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold">Warehouse Pricing</h1>
              {warehouse && (
                <p className="text-muted-foreground">
                  {warehouse.name} ({warehouse.warehouseId})
                </p>
              )}
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={getAvailablePriceLists().length === 0}>
                <Plus className="mr-2 h-4 w-4" />
                Assign Price List
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Price List</DialogTitle>
                <DialogDescription>
                  Assign a price list to this warehouse with priority and date range.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="priceListId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price List</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a price list" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {getAvailablePriceLists().map((priceList) => (
                              <SelectItem key={priceList.id} value={priceList.id}>
                                {priceList.name} ({priceList.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose a price list to assign to this warehouse.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="1" 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormDescription>
                          Lower numbers have higher priority (1 is highest).
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
                      {isSubmitting ? 'Assigning...' : 'Assign Price List'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10">Loading price lists...</div>
      ) : warehousePriceLists.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground mb-4">
            No price lists assigned to this warehouse. Assign a price list to enable pricing.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-2">Assigned Price Lists</h2>
            <p className="text-sm text-muted-foreground">Click on a price list to view its items</p>
          </div>
          {warehousePriceLists
            .sort((a, b) => a.priority - b.priority)
            .map((wpl) => (
              <div key={wpl.id} className="relative">
                {wpl.priceList && (
                  <ExpandablePriceList 
                    priceList={wpl.priceList} 
                    priority={wpl.priority}
                  />
                )}
                <div className="absolute top-4 right-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(wpl.priceListId)}
                    title="Remove from warehouse"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}