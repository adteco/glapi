'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { ItemForm } from '@/components/forms/item-form';

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
}

function NewItemPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken, orgId } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateFrom, setDuplicateFrom] = useState<Item | null>(null);

  const duplicateId = searchParams.get('duplicate');

  useEffect(() => {
    if (duplicateId) {
      fetchItemToDuplicate(duplicateId);
    }
  }, [duplicateId]);

  const fetchItemToDuplicate = async (itemId: string) => {
    try {
      const token = await getToken();
      if (!token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/items/${itemId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const item = await response.json();
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
      }
    } catch (error) {
      console.error('Error fetching item to duplicate:', error);
      toast.error('Failed to load item for duplication');
    }
  };

  const handleSubmit = async (values: any) => {
    if (!orgId) {
      toast.error('No organization selected');
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
      const response = await fetch(`${apiUrl}/api/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || 'Failed to create item');
        return;
      }

      await response.json();
      toast.success('Item created successfully');
      
      // Redirect to the items list or the created item
      router.push('/lists/items');
    } catch (error) {
      console.error('Error creating item:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/lists/items');
  };

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