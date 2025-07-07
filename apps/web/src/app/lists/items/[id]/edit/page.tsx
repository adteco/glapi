'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useApiClient } from '@/lib/api-client.client';
import { toast } from 'sonner';
import { ItemForm } from '@/components/forms/item-form';

interface Item {
  id: string;
  itemCode: string;
  name: string;
  description?: string | null;
  itemType: 'INVENTORY_ITEM' | 'NON_INVENTORY_ITEM' | 'SERVICE' | 'CHARGE' | 'DISCOUNT' | 'TAX' | 'ASSEMBLY' | 'KIT';
  categoryId?: string | null;
  unitOfMeasureId: string;
  incomeAccountId?: string | null;
  expenseAccountId?: string | null;
  assetAccountId?: string | null;
  cogsAccountId?: string | null;
  defaultPrice?: number | null;
  defaultCost?: number | null;
  isTaxable: boolean;
  taxCode?: string | null;
  isActive: boolean;
  isPurchasable: boolean;
  isSaleable: boolean;
  trackQuantity: boolean;
  trackLotNumbers: boolean;
  trackSerialNumbers: boolean;
  sku?: string | null;
  upc?: string | null;
  manufacturerPartNumber?: string | null;
  weight?: number | null;
  weightUnit?: string | null;
  isParent: boolean;
  variantAttributes?: any;
}

export default function EditItemPage() {
  const router = useRouter();
  const params = useParams();
  const { orgId } = useAuth();
  const { apiGet, apiPut } = useApiClient();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [item, setItem] = useState<Item | null>(null);
  const previousOrgIdRef = useRef<string | null>(null);

  const itemId = params.id as string;

  const fetchItem = useCallback(async () => {
    if (!orgId || !itemId) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await apiGet<Item>(`/api/items/${itemId}`);
      
      // Convert null values to undefined for form compatibility
      const transformedData = {
        ...data,
        description: data.description ?? undefined,
        categoryId: data.categoryId ?? undefined,
        incomeAccountId: data.incomeAccountId ?? undefined,
        expenseAccountId: data.expenseAccountId ?? undefined,
        assetAccountId: data.assetAccountId ?? undefined,
        cogsAccountId: data.cogsAccountId ?? undefined,
        defaultPrice: data.defaultPrice ?? undefined,
        defaultCost: data.defaultCost ?? undefined,
        taxCode: data.taxCode ?? undefined,
        sku: data.sku ?? undefined,
        upc: data.upc ?? undefined,
        manufacturerPartNumber: data.manufacturerPartNumber ?? undefined,
        weight: data.weight ?? undefined,
        weightUnit: data.weightUnit ?? undefined,
      };
      setItem(transformedData);
    } catch (error) {
      console.error('Error fetching item:', error);
      toast.error('Failed to fetch item');
      router.push('/lists/items');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, itemId, apiGet, router]);

  // Clear data and refetch when organization changes
  useEffect(() => {
    if (orgId && orgId !== previousOrgIdRef.current) {
      // Clear existing data immediately when org changes
      setItem(null);
      previousOrgIdRef.current = orgId;
    }
    if (itemId) {
      fetchItem();
    }
  }, [orgId, itemId, fetchItem]);

  const handleSubmit = async (values: any) => {
    if (!orgId) {
      toast.error('No organization selected');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPut(`/api/items/${itemId}`, values);
      toast.success('Item updated successfully');
      router.push('/lists/items');
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Failed to update item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/lists/items');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <p>Loading item...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="container mx-auto py-10">
        <p>Item not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Edit Item</h1>
        
        <ItemForm
          initialData={item}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}