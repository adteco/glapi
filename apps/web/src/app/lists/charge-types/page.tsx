'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { Plus, Edit, Trash } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import type { RouterOutputs } from '@glapi/trpc';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Form schema
const chargeTypeFormSchema = z.object({
  code: z.string().min(1, 'Code is required').max(20),
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  chargeCategory: z.enum(['service', 'product', 'shipping', 'tax', 'discount', 'fee', 'other']),
  incomeAccountId: z.string().uuid().optional().nullable(),
  isTaxable: z.boolean().default(true),
});

type ChargeTypeFormData = z.infer<typeof chargeTypeFormSchema>;

type ChargeTypeList = RouterOutputs['accountingLists']['listChargeTypes'];

export default function ChargeTypesPage() {
  const router = useRouter();
  const { orgId } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingChargeType, setEditingChargeType] = useState<ChargeTypeList['data'][number] | null>(null);

  // List charge types
  const { data: chargeTypesData, isLoading, refetch } = trpc.accountingLists.listChargeTypes.useQuery(
    { limit: 100, page: 1 },
    { enabled: !!orgId }
  );

  // Get accounts for dropdown
  const { data: accountsData } = trpc.accounts.list.useQuery(
    { limit: 500 },
    { enabled: !!orgId }
  );

  // Form setup
  const form = useForm<ChargeTypeFormData>({
    resolver: zodResolver(chargeTypeFormSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      isActive: true,
      isDefault: false,
      chargeCategory: 'service',
      incomeAccountId: null,
      isTaxable: true,
    },
  });

  // Mutations
  const createMutation = trpc.accountingLists.createChargeType.useMutation({
    onSuccess: () => {
      toast.success('Charge type created');
      setIsCreateDialogOpen(false);
      form.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create charge type');
    },
  });

  const updateMutation = trpc.accountingLists.updateChargeType.useMutation({
    onSuccess: () => {
      toast.success('Charge type updated');
      setEditingChargeType(null);
      form.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update charge type');
    },
  });

  const deleteMutation = trpc.accountingLists.deleteChargeType.useMutation({
    onSuccess: () => {
      toast.success('Charge type deleted');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete charge type');
    },
  });

  const handleCreateSubmit = (data: ChargeTypeFormData) => {
    createMutation.mutate({
      code: data.code,
      name: data.name,
      description: data.description || undefined,
      isActive: data.isActive,
      isDefault: data.isDefault,
      chargeCategory: data.chargeCategory,
      incomeAccountId: data.incomeAccountId || undefined,
      isTaxable: data.isTaxable,
    });
  };

  const handleUpdateSubmit = (data: ChargeTypeFormData) => {
    if (!editingChargeType) return;

    updateMutation.mutate({
      id: editingChargeType.id,
      data: {
        code: data.code,
        name: data.name,
        description: data.description || undefined,
        isActive: data.isActive,
        isDefault: data.isDefault,
        chargeCategory: data.chargeCategory,
        incomeAccountId: data.incomeAccountId || undefined,
        isTaxable: data.isTaxable,
      },
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this charge type?')) return;
    deleteMutation.mutate({ id });
  };

  const openEditDialog = (chargeType: ChargeTypeList['data'][number]) => {
    setEditingChargeType(chargeType);
    form.reset({
      code: chargeType.code,
      name: chargeType.name,
      description: chargeType.description || '',
      isActive: chargeType.isActive,
      isDefault: chargeType.isDefault,
      chargeCategory: chargeType.details.chargeCategory,
      incomeAccountId: chargeType.details.incomeAccountId || null,
      isTaxable: chargeType.details.isTaxable,
    });
  };

  const categoryLabels: Record<string, string> = {
    service: 'Service',
    product: 'Product',
    shipping: 'Shipping',
    tax: 'Tax',
    discount: 'Discount',
    fee: 'Fee',
    other: 'Other',
  };

  if (isLoading) {
    return <div className="container mx-auto py-10">Loading charge types...</div>;
  }

  const chargeTypes = chargeTypesData?.data || [];
  const accounts = accountsData?.data || [];

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Charge Types</h1>
          <p className="text-muted-foreground">Manage charge types for billing and invoicing</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Charge Type
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Charge Type</DialogTitle>
              <DialogDescription>Add a new charge type to your organization</DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleCreateSubmit)}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Code</Label>
                    <Input id="code" {...form.register('code')} placeholder="LBR" />
                    {form.formState.errors.code && (
                      <p className="text-sm text-red-500">{form.formState.errors.code.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" {...form.register('name')} placeholder="Labor" />
                    {form.formState.errors.name && (
                      <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" {...form.register('description')} placeholder="Optional description" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chargeCategory">Category</Label>
                  <Select
                    value={form.watch('chargeCategory')}
                    onValueChange={(value) => form.setValue('chargeCategory', value as ChargeTypeFormData['chargeCategory'])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="service">Service</SelectItem>
                      <SelectItem value="product">Product</SelectItem>
                      <SelectItem value="shipping">Shipping</SelectItem>
                      <SelectItem value="tax">Tax</SelectItem>
                      <SelectItem value="discount">Discount</SelectItem>
                      <SelectItem value="fee">Fee</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="incomeAccountId">Income Account (Optional)</Label>
                  <Select
                    value={form.watch('incomeAccountId') || 'none'}
                    onValueChange={(value) => form.setValue('incomeAccountId', value === 'none' ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.accountNumber} - {account.accountName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      {...form.register('isActive')}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isDefault"
                      {...form.register('isDefault')}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="isDefault">Default</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isTaxable"
                      {...form.register('isTaxable')}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="isTaxable">Taxable</Label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingChargeType} onOpenChange={(open) => !open && setEditingChargeType(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Charge Type</DialogTitle>
            <DialogDescription>Update the charge type details</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleUpdateSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-code">Code</Label>
                  <Input id="edit-code" {...form.register('code')} />
                  {form.formState.errors.code && (
                    <p className="text-sm text-red-500">{form.formState.errors.code.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input id="edit-name" {...form.register('name')} />
                  {form.formState.errors.name && (
                    <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input id="edit-description" {...form.register('description')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-chargeCategory">Category</Label>
                <Select
                  value={form.watch('chargeCategory')}
                  onValueChange={(value) => form.setValue('chargeCategory', value as ChargeTypeFormData['chargeCategory'])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="shipping">Shipping</SelectItem>
                    <SelectItem value="tax">Tax</SelectItem>
                    <SelectItem value="discount">Discount</SelectItem>
                    <SelectItem value="fee">Fee</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-incomeAccountId">Income Account (Optional)</Label>
                <Select
                  value={form.watch('incomeAccountId') || 'none'}
                  onValueChange={(value) => form.setValue('incomeAccountId', value === 'none' ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.accountNumber} - {account.accountName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-isActive"
                    {...form.register('isActive')}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="edit-isActive">Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-isDefault"
                    {...form.register('isDefault')}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="edit-isDefault">Default</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-isTaxable"
                    {...form.register('isTaxable')}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="edit-isTaxable">Taxable</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingChargeType(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Charge Types Table */}
      <Table>
        <TableCaption>A list of your charge types</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Taxable</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Default</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {chargeTypes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No charge types found. Create one to get started.
              </TableCell>
            </TableRow>
          ) : (
            chargeTypes.map((chargeType) => (
              <TableRow
                key={chargeType.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/lists/charge-types/${chargeType.id}`)}
              >
                <TableCell className="font-medium">{chargeType.code}</TableCell>
                <TableCell>{chargeType.name}</TableCell>
                <TableCell>{categoryLabels[chargeType.details.chargeCategory] || chargeType.details.chargeCategory}</TableCell>
                <TableCell>
                  <Badge variant={chargeType.details.isTaxable ? 'default' : 'secondary'}>
                    {chargeType.details.isTaxable ? 'Yes' : 'No'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={chargeType.isActive ? 'default' : 'secondary'}>
                    {chargeType.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {chargeType.isDefault && <Badge variant="outline">Default</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(chargeType)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(chargeType.id)}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
