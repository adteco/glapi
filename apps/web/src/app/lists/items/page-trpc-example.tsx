'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Trash2, Copy, Package } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function ItemsPageWithTRPC() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    itemCode: '',
    name: '',
    description: '',
    categoryId: '',
    unitOfMeasureId: '',
    defaultPrice: 0,
    cost: 0,
    sku: '',
    barcode: '',
    isActive: true,
    isSerialized: false,
    isLotTracked: false,
    reorderPoint: 0,
    reorderQuantity: 0,
    leadTimeDays: 0,
  });

  // tRPC queries
  const { data: items, isLoading, refetch } = trpc.items.list.useQuery({
    categoryId: selectedCategory || undefined,
    search: searchTerm || undefined,
    includeInactive: false,
  });

  const { data: categories } = trpc.items.categories.list.useQuery();
  
  // tRPC mutations
  const createItem = trpc.items.create.useMutation({
    onSuccess: () => {
      toast.success('Item created successfully');
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create item');
    },
  });

  const deleteItem = trpc.items.delete.useMutation({
    onSuccess: () => {
      toast.success('Item deleted successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete item');
    },
  });

  const duplicateItem = trpc.items.create.useMutation({
    onSuccess: () => {
      toast.success('Item duplicated successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to duplicate item');
    },
  });

  const resetForm = () => {
    setFormData({
      itemCode: '',
      name: '',
      description: '',
      categoryId: '',
      unitOfMeasureId: '',
      defaultPrice: 0,
      cost: 0,
      sku: '',
      barcode: '',
      isActive: true,
      isSerialized: false,
      isLotTracked: false,
      reorderPoint: 0,
      reorderQuantity: 0,
      leadTimeDays: 0,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // unitOfMeasureId is required, so don't submit if it's missing
    if (!formData.unitOfMeasureId) {
      alert('Unit of Measure is required');
      return;
    }
    
    createItem.mutate({
      ...formData,
      categoryId: formData.categoryId || null,
      unitOfMeasureId: formData.unitOfMeasureId,
      description: formData.description || undefined,
      sku: formData.sku || undefined,
      upc: formData.barcode || undefined, // mapping barcode to upc
      defaultPrice: formData.defaultPrice || undefined,
      defaultCost: formData.cost || undefined, // mapping cost to defaultCost
    });
  };

  const handleDuplicate = async (item: any) => {
    duplicateItem.mutate({
      ...item,
      itemCode: `${item.itemCode}-COPY`,
      name: `${item.name} (Copy)`,
      id: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      deleteItem.mutate({ id });
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Items</CardTitle>
              <CardDescription>Manage your inventory items</CardDescription>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>Create New Item</DialogTitle>
                    <DialogDescription>
                      Add a new item to your inventory
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="itemCode">Item Code *</Label>
                        <Input
                          id="itemCode"
                          value={formData.itemCode}
                          onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="categoryId">Category</Label>
                      <Select
                        value={formData.categoryId}
                        onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {categories?.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="defaultPrice">Default Price</Label>
                        <Input
                          id="defaultPrice"
                          type="number"
                          step="0.01"
                          value={formData.defaultPrice}
                          onChange={(e) => setFormData({ ...formData, defaultPrice: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="cost">Cost</Label>
                        <Input
                          id="cost"
                          type="number"
                          step="0.01"
                          value={formData.cost}
                          onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createItem.isPending}>
                      Create
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All categories</SelectItem>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.itemCode}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>
                    {categories?.find(c => c.id === item.categoryId)?.name || '-'}
                  </TableCell>
                  <TableCell>${item.defaultPrice?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell>${(item as any).cost?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell>
                    <Badge variant={item.isActive ? 'default' : 'secondary'}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => router.push(`/lists/items/${item.id}/edit`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => router.push(`/lists/items/${item.id}/variants`)}
                      >
                        <Package className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDuplicate(item)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}