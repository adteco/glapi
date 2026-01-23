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
const paymentMethodFormSchema = z.object({
  code: z.string().min(1, 'Code is required').max(20),
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  methodType: z.enum(['cash', 'check', 'credit_card', 'debit_card', 'ach', 'wire_transfer', 'other']),
  depositAccountId: z.string().uuid().optional().nullable(),
});

type PaymentMethodFormData = z.infer<typeof paymentMethodFormSchema>;

type PaymentMethodList = RouterOutputs['accountingLists']['listPaymentMethods'];

export default function PaymentMethodsPage() {
  const router = useRouter();
  const { orgId } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethodList['data'][number] | null>(null);

  // List payment methods
  const { data: paymentMethodsData, isLoading, refetch } = trpc.accountingLists.listPaymentMethods.useQuery(
    { limit: 100, page: 1 },
    { enabled: !!orgId }
  );

  // Get accounts for dropdown
  const { data: accountsData } = trpc.accounts.list.useQuery(
    { limit: 500 },
    { enabled: !!orgId }
  );

  // Form setup
  const form = useForm<PaymentMethodFormData>({
    resolver: zodResolver(paymentMethodFormSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      isActive: true,
      isDefault: false,
      methodType: 'check',
      depositAccountId: null,
    },
  });

  // Mutations
  const createMutation = trpc.accountingLists.createPaymentMethod.useMutation({
    onSuccess: () => {
      toast.success('Payment method created');
      setIsCreateDialogOpen(false);
      form.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create payment method');
    },
  });

  const updateMutation = trpc.accountingLists.updatePaymentMethod.useMutation({
    onSuccess: () => {
      toast.success('Payment method updated');
      setEditingPaymentMethod(null);
      form.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update payment method');
    },
  });

  const deleteMutation = trpc.accountingLists.deletePaymentMethod.useMutation({
    onSuccess: () => {
      toast.success('Payment method deleted');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete payment method');
    },
  });

  const handleCreateSubmit = (data: PaymentMethodFormData) => {
    createMutation.mutate({
      code: data.code,
      name: data.name,
      description: data.description || undefined,
      isActive: data.isActive,
      isDefault: data.isDefault,
      methodType: data.methodType,
      depositAccountId: data.depositAccountId || undefined,
    });
  };

  const handleUpdateSubmit = (data: PaymentMethodFormData) => {
    if (!editingPaymentMethod) return;

    updateMutation.mutate({
      id: editingPaymentMethod.id,
      data: {
        code: data.code,
        name: data.name,
        description: data.description || undefined,
        isActive: data.isActive,
        isDefault: data.isDefault,
        methodType: data.methodType,
        depositAccountId: data.depositAccountId || undefined,
      },
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return;
    deleteMutation.mutate({ id });
  };

  const openEditDialog = (paymentMethod: PaymentMethodList['data'][number]) => {
    setEditingPaymentMethod(paymentMethod);
    form.reset({
      code: paymentMethod.code,
      name: paymentMethod.name,
      description: paymentMethod.description || '',
      isActive: paymentMethod.isActive,
      isDefault: paymentMethod.isDefault,
      methodType: paymentMethod.details.methodType,
      depositAccountId: paymentMethod.details.depositAccountId || null,
    });
  };

  const methodTypeLabels: Record<string, string> = {
    cash: 'Cash',
    check: 'Check',
    credit_card: 'Credit Card',
    debit_card: 'Debit Card',
    ach: 'ACH',
    wire: 'Wire Transfer',
    other: 'Other',
  };

  if (isLoading) {
    return <div className="container mx-auto py-10">Loading payment methods...</div>;
  }

  const paymentMethods = paymentMethodsData?.data || [];
  const accounts = accountsData?.data || [];

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Payment Methods</h1>
          <p className="text-muted-foreground">Manage payment methods for your organization</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Payment Method
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Payment Method</DialogTitle>
              <DialogDescription>Add a new payment method to your organization</DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleCreateSubmit)}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Code</Label>
                    <Input id="code" {...form.register('code')} placeholder="CHK" />
                    {form.formState.errors.code && (
                      <p className="text-sm text-red-500">{form.formState.errors.code.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" {...form.register('name')} placeholder="Check" />
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
                  <Label htmlFor="methodType">Method Type</Label>
                  <Select
                    value={form.watch('methodType')}
                    onValueChange={(value) => form.setValue('methodType', value as PaymentMethodFormData['methodType'])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select method type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="debit_card">Debit Card</SelectItem>
                      <SelectItem value="ach">ACH</SelectItem>
                      <SelectItem value="wire_transfer">Wire Transfer</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="depositAccountId">Deposit Account (Optional)</Label>
                  <Select
                    value={form.watch('depositAccountId') || 'none'}
                    onValueChange={(value) => form.setValue('depositAccountId', value === 'none' ? null : value)}
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
      <Dialog open={!!editingPaymentMethod} onOpenChange={(open) => !open && setEditingPaymentMethod(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Payment Method</DialogTitle>
            <DialogDescription>Update the payment method details</DialogDescription>
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
                <Label htmlFor="edit-methodType">Method Type</Label>
                <Select
                  value={form.watch('methodType')}
                  onValueChange={(value) => form.setValue('methodType', value as PaymentMethodFormData['methodType'])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="debit_card">Debit Card</SelectItem>
                    <SelectItem value="ach">ACH</SelectItem>
                    <SelectItem value="wire_transfer">Wire Transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-depositAccountId">Deposit Account (Optional)</Label>
                <Select
                  value={form.watch('depositAccountId') || 'none'}
                  onValueChange={(value) => form.setValue('depositAccountId', value === 'none' ? null : value)}
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
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingPaymentMethod(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Methods Table */}
      <Table>
        <TableCaption>A list of your payment methods</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Default</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paymentMethods.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No payment methods found. Create one to get started.
              </TableCell>
            </TableRow>
          ) : (
            paymentMethods.map((method) => (
              <TableRow
                key={method.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/lists/payment-methods/${method.id}`)}
              >
                <TableCell className="font-medium">{method.code}</TableCell>
                <TableCell>{method.name}</TableCell>
                <TableCell>{methodTypeLabels[method.details.methodType] || method.details.methodType}</TableCell>
                <TableCell>
                  <Badge variant={method.isActive ? 'default' : 'secondary'}>
                    {method.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {method.isDefault && <Badge variant="outline">Default</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(method)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(method.id)}>
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
