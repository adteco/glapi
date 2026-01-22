'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { ItemForm } from '@/components/forms/item-form';
import { trpc } from '@/lib/trpc';

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
  const duplicateId = searchParams.get('duplicate');

  // tRPC queries
  const { data: itemToDuplicate } = trpc.items.getById.useQuery({ id: duplicateId! }, {
    enabled: !!duplicateId && !!orgId,
  });

  const createItemMutation = trpc.items.create.useMutation({
    onSuccess: () => {
      toast.success('Item created successfully');
      router.push('/lists/items');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create item');
    },
  });

  // Transform duplicate item data for form
  const duplicateFrom = itemToDuplicate ? {
    ...itemToDuplicate,
    name: `${itemToDuplicate.name} (Copy)`,
    itemCode: '', // User must provide new code
    sku: undefined, // Reset SKU for duplicate
    upc: undefined, // Reset UPC for duplicate
    description: itemToDuplicate.description ?? undefined,
    categoryId: itemToDuplicate.categoryId ?? undefined,
    incomeAccountId: itemToDuplicate.incomeAccountId ?? undefined,
    expenseAccountId: itemToDuplicate.expenseAccountId ?? undefined,
    assetAccountId: itemToDuplicate.assetAccountId ?? undefined,
    cogsAccountId: itemToDuplicate.cogsAccountId ?? undefined,
    defaultPrice: itemToDuplicate.defaultPrice ?? undefined,
    defaultCost: itemToDuplicate.defaultCost ?? undefined,
    taxCode: itemToDuplicate.taxCode ?? undefined,
    manufacturerPartNumber: itemToDuplicate.manufacturerPartNumber ?? undefined,
    weight: itemToDuplicate.weight ?? undefined,
    weightUnit: itemToDuplicate.weightUnit ?? undefined,
  } : null;

  const handleSubmit = async (values: any) => {
    if (!orgId) {
      toast.error('No organization selected');
      return;
    }

    createItemMutation.mutate(values);
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
          isSubmitting={createItemMutation.isPending}
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