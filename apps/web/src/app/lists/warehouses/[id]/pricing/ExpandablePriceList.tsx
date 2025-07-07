'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useApiClient } from '@/lib/api-client.client';

interface PriceList {
  id: string;
  name: string;
  code: string;
  currencyCode: string;
  isDefault: boolean;
  isActive: boolean;
}

interface Item {
  id: string;
  itemCode: string;
  name: string;
  description?: string;
}

interface ItemPricing {
  id: string;
  itemId: string;
  priceListId: string;
  unitPrice: number;
  minQuantity: number;
  effectiveDate: string;
  expirationDate?: string;
  item?: Item;
}

interface ExpandablePriceListProps {
  priceList: PriceList;
  priority: number;
}

export function ExpandablePriceList({ priceList, priority }: ExpandablePriceListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [items, setItems] = useState<ItemPricing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { orgId } = useAuth();
  const { apiGet } = useApiClient();
  const previousOrgIdRef = useRef<string | null>(null);

  const fetchPriceListItems = useCallback(async () => {
    if (!orgId) return;
    
    if (!isExpanded) {
      setIsExpanded(true);
      if (items.length > 0) return; // Already loaded
      
      setIsLoading(true);
      try {
        const response = await apiGet<{ data: ItemPricing[] } | ItemPricing[]>(`/api/price-lists/${priceList.id}/items?limit=100`);
        const pricings = Array.isArray(response) ? response : ((response as any).data || []);
        
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
        
        setItems(enrichedPricings);
      } catch (error) {
        console.error('Error fetching items:', error);
        toast.error('Failed to load items.');
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsExpanded(false);
    }
  }, [orgId, priceList.id, isExpanded, items.length, apiGet]);

  // Clear data when organization changes
  useEffect(() => {
    if (orgId && orgId !== previousOrgIdRef.current) {
      // Clear existing data immediately when org changes
      setItems([]);
      setIsExpanded(false);
      previousOrgIdRef.current = orgId;
    }
  }, [orgId]);

  return (
    <div className="space-y-2">
      <div 
        className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer rounded-lg border"
        onClick={fetchPriceListItems}
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="p-0 h-auto">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          <div className="flex items-center gap-6">
            <span className="font-medium">Priority {priority}</span>
            <div>
              <h3 className="font-medium">{priceList.name}</h3>
              <p className="text-sm text-muted-foreground">{priceList.code} • {priceList.currencyCode}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <span className="text-sm text-muted-foreground">{items.length} items</span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="ml-8 border rounded-lg">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">Loading items...</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No items in this price list</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Min Qty</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Expiration Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((pricing) => (
                  <TableRow key={pricing.id}>
                    <TableCell className="font-medium">{pricing.item?.itemCode || '-'}</TableCell>
                    <TableCell>{pricing.item?.name || '-'}</TableCell>
                    <TableCell>{priceList.currencyCode} {pricing.unitPrice.toFixed(2)}</TableCell>
                    <TableCell>{pricing.minQuantity}</TableCell>
                    <TableCell>{new Date(pricing.effectiveDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {pricing.expirationDate ? new Date(pricing.expirationDate).toLocaleDateString() : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}