'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { ItemForm } from '@/components/forms/item-form';
import { useApiClient } from '@/lib/api-client.client';

interface Item {
  id: string;
  itemCode: string;
  name: string;
  description?: string;
  itemType: 'INVENTORY_ITEM' | 'NON_INVENTORY_ITEM' | 'SERVICE' | 'CHARGE' | 'DISCOUNT' | 'TAX' | 'ASSEMBLY' | 'KIT';
  categoryId?: string;
  unitOfMeasureId: string;
  incomeAccountId?: string;
  expenseAccountId?: string;
  assetAccountId?: string;
  cogsAccountId?: string;
  defaultPrice?: number;
  defaultCost?: number;
  isTaxable: boolean;
  taxCode?: string;
  isActive: boolean;
  isPurchasable: boolean;
  isSaleable: boolean;
  trackQuantity: boolean;
  trackLotNumbers: boolean;
  trackSerialNumbers: boolean;
  sku?: string;
  upc?: string;
  manufacturerPartNumber?: string;
  weight?: number;
  weightUnit?: string;
  isParent: boolean;
  variantAttributes?: any;
  createdAt?: string;
  updatedAt?: string;
}

function NewItemPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { orgId } = useAuth();
  const { apiGet, apiPost } = useApiClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateFrom, setDuplicateFrom] = useState<Partial<Item> | null>(null);
  const previousOrgIdRef = useRef<string | null>(null);

  const duplicateId = searchParams.get('duplicate');

  const fetchItemToDuplicate = useCallback(async (itemId: string) => {
    try {
      const item = await apiGet<Item>(`/api/items/${itemId}`);
      // Remove unique fields when duplicating
      const { id, itemCode, sku, upc, createdAt, updatedAt, ...itemData } = item;
      // Convert null values to undefined for form compatibility
      const transformedData = {
        ...itemData,
        name: `${item.name} (Copy)`,
        itemCode: '', // User must provide new code
        description: itemData.description ?? undefined,
        categoryId: itemData.categoryId ?? undefined,
        incomeAccountId: itemData.incomeAccountId ?? undefined,
        expenseAccountId: itemData.expenseAccountId ?? undefined,
        assetAccountId: itemData.assetAccountId ?? undefined,
        cogsAccountId: itemData.cogsAccountId ?? undefined,
        defaultPrice: itemData.defaultPrice ?? undefined,
        defaultCost: itemData.defaultCost ?? undefined,
        taxCode: itemData.taxCode ?? undefined,
        sku: undefined, // Reset SKU for duplicate
        upc: undefined, // Reset UPC for duplicate
        manufacturerPartNumber: itemData.manufacturerPartNumber ?? undefined,
        weight: itemData.weight ?? undefined,
        weightUnit: itemData.weightUnit ?? undefined,
      };
      setDuplicateFrom(transformedData);
    } catch (error) {
      console.error('Error fetching item to duplicate:', error);
      toast.error('Failed to load item for duplication');
    }
  }, [apiGet]);

  // Clear data when organization changes
  useEffect(() => {
    if (orgId && orgId !== previousOrgIdRef.current) {
      // Clear existing data immediately when org changes
      setDuplicateFrom(null);
      previousOrgIdRef.current = orgId;
    }
  }, [orgId]);

  // Fetch duplicate item when duplicateId changes
  useEffect(() => {
    if (duplicateId && orgId) {
      fetchItemToDuplicate(duplicateId);
    }
  }, [duplicateId, orgId, fetchItemToDuplicate]);

  const handleSubmit = useCallback(async (values: any) => {
    if (!orgId) {
      toast.error('No organization selected');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost('/api/items', values);
      toast.success('Item created successfully');
      
      // Redirect to the items list or the created item
      router.push('/lists/items');
    } catch (error) {
      console.error('Error creating item:', error);
      toast.error('Failed to create item');
    } finally {
      setIsSubmitting(false);
    }
  }, [orgId, apiPost, router]);

  const handleCancel = useCallback(() => {
    router.push('/lists/items');
  }, [router]);

  return (
    <div className="container mx-auto py-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">
          {duplicateFrom ? 'Duplicate Item' : 'Create New Item'}
        </h1>
        
        <ItemForm
          initialData={duplicateFrom}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}

export default function NewItemPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-10">
        <div className="max-w-4xl mx-auto">
          <p>Loading...</p>
        </div>
      </div>
    }>
      <NewItemPageContent />
    </Suspense>
  );
}