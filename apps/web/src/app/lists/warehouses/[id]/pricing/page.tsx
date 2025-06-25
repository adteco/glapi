'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Plus, DollarSign, Trash } from 'lucide-react';
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
  const { getToken, orgId } = useAuth();

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
  useEffect(() => {
    const fetchWarehouse = async () => {
      if (!orgId || !warehouseId) return;
      
      try {
        const token = await getToken();
        if (!token) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/warehouses/${warehouseId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          toast.error('Failed to fetch warehouse details');
          return;
        }

        const data = await response.json();
        setWarehouse(data);
      } catch (error) {
        console.error('Error fetching warehouse:', error);
        toast.error('An unexpected error occurred');
      }
    };

    fetchWarehouse();
  }, [orgId, warehouseId, getToken]);

  // Fetch warehouse price lists
  const fetchWarehousePriceLists = async () => {
    if (!orgId || !warehouseId) {
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
      const response = await fetch(`${apiUrl}/api/warehouses/${warehouseId}/price-lists`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorResult = await response.json();
        toast.error(errorResult.message || 'Failed to fetch price lists.');
        throw new Error('Failed to fetch price lists');
      }

      const data = await response.json();
      setWarehousePriceLists(data);
    } catch (error) {
      console.error('Error fetching price lists:', error);
      if (!(error instanceof Error && error.message === 'Failed to fetch price lists')) {
        toast.error('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehousePriceLists();
  }, [orgId, warehouseId, getToken]);

  // Fetch available price lists
  useEffect(() => {
    const fetchPriceLists = async () => {
      if (!orgId) return;
      
      try {
        const token = await getToken();
        if (!token) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/price-lists?activeOnly=true`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch price lists');
          return;
        }

        const data = await response.json();
        setAvailablePriceLists(data.data || []);
      } catch (error) {
        console.error('Error fetching price lists:', error);
      }
    };

    fetchPriceLists();
  }, [orgId, getToken]);

  // Handle form submission
  const onSubmit = async (values: WarehousePriceListFormValues) => {
    if (!orgId || !warehouseId) {
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
      const response = await fetch(`${apiUrl}/api/warehouses/${warehouseId}/price-lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceListId: values.priceListId,
          priority: values.priority,
          effectiveDate: values.effectiveDate || undefined,
          expirationDate: values.expirationDate || undefined,
        }),
      });

      if (!response.ok) {
        const errorResult = await response.json();
        toast.error(errorResult.message || 'Failed to assign price list.');
        throw new Error('Failed to assign price list');
      }

      const result = await response.json();
      
      toast.success('Price list assigned successfully!');
      setIsDialogOpen(false);
      form.reset();
      
      // Refresh the list
      await fetchWarehousePriceLists();
    } catch (error) {
      console.error('Error assigning price list:', error);
      if (!(error instanceof Error && error.message === 'Failed to assign price list')) {
        toast.error('An unexpected error occurred.');
      }
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
      const token = await getToken();
      if (!token) {
        toast.error('Authentication token not available.');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(
        `${apiUrl}/api/warehouses/${warehouseId}/price-lists?priceListId=${priceListId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorResult = await response.json();
        toast.error(errorResult.message || 'Failed to remove price list.');
        throw new Error('Failed to remove price list');
      }

      toast.success('Price list removed successfully!');
      await fetchWarehousePriceLists();
    } catch (error) {
      console.error('Error removing price list:', error);
      toast.error('An unexpected error occurred.');
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
        <Table>
          <TableCaption>Price lists assigned to this warehouse, ordered by priority.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Priority</TableHead>
              <TableHead>Price List</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Effective Date</TableHead>
              <TableHead>Expiration Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {warehousePriceLists
              .sort((a, b) => a.priority - b.priority)
              .map((wpl) => (
                <TableRow key={wpl.id}>
                  <TableCell className="font-medium">{wpl.priority}</TableCell>
                  <TableCell>{wpl.priceList?.name || '-'}</TableCell>
                  <TableCell>{wpl.priceList?.code || '-'}</TableCell>
                  <TableCell>{wpl.priceList?.currencyCode || 'USD'}</TableCell>
                  <TableCell>
                    {wpl.effectiveDate ? new Date(wpl.effectiveDate).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>
                    {wpl.expirationDate ? new Date(wpl.expirationDate).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={wpl.priceList?.isActive ? 'default' : 'secondary'}>
                      {wpl.priceList?.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(wpl.priceListId)}
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