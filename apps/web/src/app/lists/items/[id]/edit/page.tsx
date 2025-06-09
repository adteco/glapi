'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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

export default function EditItemPage() {
  const router = useRouter();
  const params = useParams();
  const { getToken, orgId } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [item, setItem] = useState<Item | null>(null);

  const itemId = params.id as string;

  useEffect(() => {
    if (itemId) {
      fetchItem();
    }
  }, [itemId]);

  const fetchItem = async () => {
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication token not available.');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/items/${itemId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || 'Failed to fetch item');
        router.push('/lists/items');
        return;
      }

      const data = await response.json();
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
      toast.error('An unexpected error occurred');
      router.push('/lists/items');
    } finally {
      setIsLoading(false);
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
      const response = await fetch(`${apiUrl}/api/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || 'Failed to update item');
        return;
      }

      toast.success('Item updated successfully');
      router.push('/lists/items');
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('An unexpected error occurred');
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