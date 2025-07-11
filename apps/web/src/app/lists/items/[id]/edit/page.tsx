'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
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
  const itemId = params.id as string;

  // tRPC queries
  const { data: item, isLoading, error } = trpc.items.getById.useQuery(itemId, {
    enabled: !!orgId && !!itemId,
  });

  const updateItemMutation = trpc.items.update.useMutation({
    onSuccess: () => {
      toast.success('Item updated successfully');
      router.push('/lists/items');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update item');
    },
  });

  const handleSubmit = async (values: any) => {
    if (!orgId) {
      toast.error('No organization selected');
      return;
    }

    updateItemMutation.mutate({
      id: itemId,
      data: values,
    });
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

  if (error || !item) {
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
          initialData={{
            ...item,
            description: item.description ?? undefined,
            categoryId: item.categoryId ?? undefined,
            incomeAccountId: item.incomeAccountId ?? undefined,
            expenseAccountId: item.expenseAccountId ?? undefined,
            assetAccountId: item.assetAccountId ?? undefined,
            cogsAccountId: item.cogsAccountId ?? undefined,
            defaultPrice: item.defaultPrice ?? undefined,
            defaultCost: item.defaultCost ?? undefined,
            taxCode: item.taxCode ?? undefined,
            sku: item.sku ?? undefined,
            upc: item.upc ?? undefined,
            manufacturerPartNumber: item.manufacturerPartNumber ?? undefined,
            weight: item.weight ?? undefined,
            weightUnit: item.weightUnit ?? undefined,
          }}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={updateItemMutation.isPending}
        />
      </div>
    </div>
  );
}