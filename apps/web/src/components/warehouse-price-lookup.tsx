'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useApiClient } from '@/lib/api-client.client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import { DollarSign, Search, Building2, Package, User } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PriceLookupResult {
  warehouseId: string;
  warehouseName: string;
  priceListId: string;
  priceListName: string;
  unitPrice: number;
  minQuantity: number;
  effectiveDate: string | null;
  expirationDate: string | null;
}

interface WarehousePriceLookupProps {
  customers?: Array<{ id: string; name: string; code: string }>;
  items?: Array<{ id: string; itemCode: string; name: string }>;
}

export function WarehousePriceLookup({ customers = [], items = [] }: WarehousePriceLookupProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [priceResult, setPriceResult] = useState<PriceLookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { orgId } = useAuth();
  const { apiClient } = useApiClient();
  const previousOrgIdRef = useRef<string | null>(null);

  // Detect organization changes and clear data
  useEffect(() => {
    const currentOrgId = orgId || null;
    
    if (previousOrgIdRef.current && previousOrgIdRef.current !== currentOrgId) {
      // Organization changed, clear data
      setPriceResult(null);
      setSelectedCustomerId('');
      setSelectedItemId('');
      setQuantity('1');
      setError(null);
    }
    
    previousOrgIdRef.current = currentOrgId;
  }, [orgId]);

  const handleLookup = useCallback(async () => {
    if (!selectedCustomerId || !selectedItemId) {
      toast.error('Please select both a customer and an item');
      return;
    }

    if (!orgId) {
      toast.error('Organization not selected');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPriceResult(null);

    try {
      const response = await apiClient('/api/warehouse-pricing/calculate', {
        method: 'POST',
        body: JSON.stringify({
          customerId: selectedCustomerId,
          itemId: selectedItemId,
          quantity: parseFloat(quantity) || 1,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setError(data.details || 'No price found for this customer and item combination');
        } else {
          setError(data.message || data.error || 'Failed to calculate price');
        }
        return;
      }

      setPriceResult(data);
      toast.success('Price calculated successfully!');
    } catch (error) {
      console.error('Error calculating price:', error);
      setError('An unexpected error occurred while calculating the price');
      toast.error('Failed to calculate price');
    } finally {
      setIsLoading(false);
    }
  }, [apiClient, orgId, selectedCustomerId, selectedItemId, quantity]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const selectedItem = items.find(i => i.id === selectedItemId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-6 w-6" />
          Warehouse Price Lookup
        </CardTitle>
        <CardDescription>
          Look up customer-specific pricing based on warehouse assignments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="customer">Customer</Label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.code} - {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item">Item</Label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an item" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.itemCode} - {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              step="1"
              placeholder="1"
            />
          </div>

          <Button 
            onClick={handleLookup} 
            disabled={isLoading || !selectedCustomerId || !selectedItemId}
            className="w-full"
          >
            <Search className="mr-2 h-4 w-4" />
            {isLoading ? 'Looking up...' : 'Look Up Price'}
          </Button>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
            <p className="text-sm font-medium">Price Not Found</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {priceResult && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-lg">Price Information</h3>
            
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Customer</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedCustomer?.name} ({selectedCustomer?.code})
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Item</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedItem?.name} ({selectedItem?.itemCode})
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Warehouse</p>
                  <p className="text-sm text-muted-foreground">
                    {priceResult.warehouseName} ({priceResult.warehouseId})
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Price List</p>
                  <p className="text-sm text-muted-foreground">
                    {priceResult.priceListName}
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-primary/10 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-medium">Unit Price:</span>
                  <span className="text-2xl font-bold">
                    ${priceResult.unitPrice.toFixed(2)}
                  </span>
                </div>
                {priceResult.minQuantity > 1 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Minimum quantity: {priceResult.minQuantity}
                  </p>
                )}
              </div>

              {(priceResult.effectiveDate || priceResult.expirationDate) && (
                <div className="text-sm text-muted-foreground">
                  {priceResult.effectiveDate && (
                    <p>Effective from: {new Date(priceResult.effectiveDate).toLocaleDateString()}</p>
                  )}
                  {priceResult.expirationDate && (
                    <p>Expires on: {new Date(priceResult.expirationDate).toLocaleDateString()}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}