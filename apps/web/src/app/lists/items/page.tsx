'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Trash2, Search, Filter, Copy, Package } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Define interfaces for the Item data
interface Item {
  id: string;
  organizationId: string;
  itemCode: string;
  name: string;
  description?: string | null;
  itemType: 'INVENTORY_ITEM' | 'NON_INVENTORY_ITEM' | 'SERVICE' | 'CHARGE' | 'DISCOUNT' | 'TAX' | 'ASSEMBLY' | 'KIT';
  isParent: boolean;
  parentItemId?: string | null;
  categoryId?: string | null;
  defaultPrice?: number | null;
  defaultCost?: number | null;
  isTaxable: boolean;
  isActive: boolean;
  isPurchasable: boolean;
  isSaleable: boolean;
  trackQuantity: boolean;
  trackLotNumbers: boolean;
  trackSerialNumbers: boolean;
  sku?: string | null;
  upc?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ItemCategory {
  id: string;
  code: string;
  name: string;
}

export default function ItemsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const { orgId } = useAuth();
  const router = useRouter();

  // TRPC queries
  const { data: itemsData, isLoading: itemsLoading, refetch: refetchItems } = trpc.items.list.useQuery({
    search: searchQuery || undefined,
    categoryId: selectedCategory !== 'all' ? selectedCategory : undefined,
    includeInactive: !showActiveOnly,
  }, {
    enabled: !!orgId,
  });

  const { data: categoriesData, isLoading: categoriesLoading } = trpc.items.categories.list.useQuery({
    page: 1,
    limit: 100,
  }, {
    enabled: !!orgId,
  });

  const deleteItemMutation = trpc.items.delete.useMutation({
    onSuccess: () => {
      toast.success('Item deleted successfully');
      refetchItems();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete item');
    },
  });

  const items = itemsData || [];
  const categories = categoriesData?.data || [];
  const isLoading = itemsLoading || categoriesLoading;

  const totalPages = Math.ceil(items.length / 20);
  const total = items.length;

  const handleEdit = (item: Item) => {
    router.push(`/lists/items/${item.id}/edit`);
  };

  const handleDelete = async (item: Item) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) {
      return;
    }

    deleteItemMutation.mutate({ id: item.id });
  };

  const handleDuplicate = (item: Item) => {
    router.push(`/lists/items/new?duplicate=${item.id}`);
  };

  const handleViewVariants = (item: Item) => {
    router.push(`/lists/items/${item.id}/variants`);
  };

  const getItemTypeBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (type) {
      case 'INVENTORY_ITEM': return 'default';
      case 'SERVICE': return 'secondary';
      case 'ASSEMBLY':
      case 'KIT': return 'outline';
      default: return 'outline';
    }
  };

  const formatItemType = (type: string): string => {
    return type.split('_').map(word => 
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ');
  };

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading items...</p></div>;
  }

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view items.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Items</h1>
        <Button onClick={() => router.push('/lists/items/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="INVENTORY_ITEM">Inventory Item</SelectItem>
            <SelectItem value="NON_INVENTORY_ITEM">Non-Inventory Item</SelectItem>
            <SelectItem value="SERVICE">Service</SelectItem>
            <SelectItem value="CHARGE">Charge</SelectItem>
            <SelectItem value="DISCOUNT">Discount</SelectItem>
            <SelectItem value="TAX">Tax</SelectItem>
            <SelectItem value="ASSEMBLY">Assembly</SelectItem>
            <SelectItem value="KIT">Kit</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category: any) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={showActiveOnly ? "default" : "outline"}
          onClick={() => setShowActiveOnly(!showActiveOnly)}
        >
          <Filter className="mr-2 h-4 w-4" />
          Active Only
        </Button>
      </div>

      {/* Results summary */}
      <div className="mb-4 text-sm text-muted-foreground">
        Showing {items.length} of {total} items
      </div>

      <Table>
        <TableCaption>A list of your items.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Default Price</TableHead>
            <TableHead className="text-center">Saleable</TableHead>
            <TableHead className="text-center">Purchasable</TableHead>
            <TableHead className="text-center">Active</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item: Item) => {
            const category = categories.find((c: any) => c.id === item.categoryId);
            
            return (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {item.itemCode}
                    {item.isParent && (
                      <Badge variant="outline" className="text-xs">Parent</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{item.name}</div>
                    {item.description && (
                      <div className="text-sm text-muted-foreground">{item.description}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getItemTypeBadgeVariant(item.itemType)}>
                    {formatItemType(item.itemType)}
                  </Badge>
                </TableCell>
                <TableCell>{category?.name || '-'}</TableCell>
                <TableCell className="text-right">
                  {item.defaultPrice ? `$${item.defaultPrice.toFixed(2)}` : '-'}
                </TableCell>
                <TableCell className="text-center">
                  {item.isSaleable ? '✓' : '-'}
                </TableCell>
                <TableCell className="text-center">
                  {item.isPurchasable ? '✓' : '-'}
                </TableCell>
                <TableCell className="text-center">
                  {item.isActive ? '✓' : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {item.isParent && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewVariants(item)}
                        title="View Variants"
                      >
                        <Package className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDuplicate(item)}
                      title="Duplicate"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(item)}
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(item)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <div className="flex items-center gap-2">
            Page {currentPage} of {totalPages}
          </div>
          <Button
            variant="outline"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}