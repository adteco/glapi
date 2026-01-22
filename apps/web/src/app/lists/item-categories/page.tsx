'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Plus, ChevronRight, ChevronDown, Edit, Trash2, Folder, FolderOpen } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { RouterOutputs } from '@glapi/trpc';

// Use TRPC inferred types to prevent type drift
type ItemCategoryTree = NonNullable<RouterOutputs['items']['categories']['tree']>[number];
type ItemCategoryFlat = RouterOutputs['items']['categories']['list'][number];

// Extended interface for UI display (combines both types)
interface ItemCategory {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  parentCategoryId?: string | null;
  level: number;
  path: string;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  children?: ItemCategory[];
}

const categoryFormSchema = z.object({
  code: z.string().min(1, "Code is required").max(50),
  name: z.string().min(1, "Name is required").max(255),
  parentCategoryId: z.string().optional(),
  isActive: z.boolean().default(true),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export default function ItemCategoriesPage() {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | null>(null);
  const { orgId } = useAuth();

  // TRPC queries - using items router since itemCategories doesn't exist
  const { data: categoriesData, isLoading, refetch } = trpc.items.categories.tree.useQuery(undefined, {
    enabled: !!orgId,
  });
  
  const { data: flatCategoriesData } = trpc.items.categories.list.useQuery(undefined, {
    enabled: !!orgId,
  });

  const createCategoryMutation = trpc.items.categories.create.useMutation({
    onSuccess: () => {
      toast.success('Category created successfully');
      setIsAddDialogOpen(false);
      form.reset();
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create category');
    },
  });

  const updateCategoryMutation = trpc.items.categories.update.useMutation({
    onSuccess: () => {
      toast.success('Category updated successfully');
      setIsEditDialogOpen(false);
      form.reset();
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update category');
    },
  });

  const deleteCategoryMutation = trpc.items.categories.delete.useMutation({
    onSuccess: () => {
      toast.success('Category deleted successfully');
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete category');
    },
  });

  const categories = categoriesData || [];
  const flatCategories = flatCategoriesData || [];

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      code: "",
      name: "",
      parentCategoryId: "",
      isActive: true,
    },
  });


  const toggleExpanded = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleAddCategory = async (values: CategoryFormValues) => {
    createCategoryMutation.mutate({
      ...values,
      parentCategoryId: values.parentCategoryId || undefined,
    });
  };

  const handleEditCategory = async (values: CategoryFormValues) => {
    if (!selectedCategory) return;
    
    updateCategoryMutation.mutate({
      id: selectedCategory.id,
      data: {
        ...values,
        parentCategoryId: values.parentCategoryId || undefined,
      },
    });
  };

  const handleDeleteCategory = async (category: ItemCategory) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"? This action cannot be undone.`)) {
      return;
    }

    deleteCategoryMutation.mutate({ id: category.id });
  };

  const openEditDialog = (category: ItemCategory) => {
    setSelectedCategory(category);
    form.reset({
      code: category.code,
      name: category.name,
      parentCategoryId: category.parentCategoryId || "",
      isActive: category.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const renderCategory = (category: ItemCategory, level: number = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);

    return (
      <div key={category.id} className="select-none">
        <div 
          className={`flex items-center justify-between py-3 px-4 hover:bg-gray-100/50 rounded-md transition-colors border-b border-gray-100 ${
            !category.isActive ? 'opacity-50' : ''
          }`}
          style={{ paddingLeft: `${level * 24 + 16}px` }}
        >
          <div className="flex items-center gap-2 flex-1">
            {hasChildren && (
              <button
                onClick={() => toggleExpanded(category.id)}
                className="p-0.5 hover:bg-gray-200/50 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
            {!hasChildren && <div className="w-5" />}
            
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 text-blue-600" />
              ) : (
                <Folder className="h-4 w-4 text-blue-600" />
              )}
              <span className="font-medium">{category.name}</span>
              <span className="text-sm text-gray-500">({category.code})</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openEditDialog(category)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteCategory(category)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {category.children!.map((child: ItemCategory) => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading categories...</p></div>;
  }

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view categories.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Item Categories</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500 mb-4">No categories found. Create your first category to get started.</p>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Category
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          {categories.map((category: ItemCategory) => renderCategory(category))}
        </div>
      )}

      {/* Add Category Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>
              Create a new item category. You can organize categories hierarchically.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddCategory)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input placeholder="ELECTRONICS" {...field} />
                    </FormControl>
                    <FormDescription>
                      A unique code for this category
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Electronics" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parentCategoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Category (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select parent category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {flatCategories.map((category: ItemCategory) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.path ? category.path.replace(/\//g, ' → ') : category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select a parent to create a subcategory
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Set whether this category is currently active
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createCategoryMutation.isPending}>
                  {createCategoryMutation.isPending ? "Creating..." : "Create Category"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the category details.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditCategory)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parentCategoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {flatCategories
                          .filter((cat: ItemCategoryFlat) => cat.id !== selectedCategory?.id)
                          .map((category: ItemCategoryFlat) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.path ? category.path.replace(/\//g, ' -> ') : category.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Set whether this category is currently active
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateCategoryMutation.isPending}>
                  {updateCategoryMutation.isPending ? "Updating..." : "Update Category"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}