'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Clock, Edit, Trash, Users } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { RouterOutputs } from '@glapi/trpc';

// Use TRPC inferred types
type PaymentTerms = RouterOutputs['accountingLists']['listPaymentTerms']['data'][number];

// Form schema
const paymentTermsFormSchema = z.object({
  code: z.string().min(1, "Code is required").max(20, "Code must be 20 characters or less"),
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  dueDateType: z.enum(['net_days', 'day_of_month', 'end_of_month']).default('net_days'),
  netDays: z.number().int().min(0).max(365).default(30),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  discountDays: z.number().int().min(0).max(365).default(0),
  discountPercent: z.number().min(0).max(100).default(0),
});

type PaymentTermsFormValues = z.infer<typeof paymentTermsFormSchema>;

export default function PaymentTermsPage() {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PaymentTerms | null>(null);
  const { orgId } = useAuth();
  const previousOrgIdRef = useRef<string | null>(null);

  // tRPC queries and mutations
  const { data: paymentTermsData, isLoading, refetch } = trpc.accountingLists.listPaymentTerms.useQuery({
    activeOnly: false,
    limit: 100,
  }, {
    enabled: !!orgId,
  });

  const createMutation = trpc.accountingLists.createPaymentTerms.useMutation({
    onSuccess: () => {
      toast.success('Payment terms created successfully!');
      setIsDialogOpen(false);
      form.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create payment terms');
    },
  });

  const updateMutation = trpc.accountingLists.updatePaymentTerms.useMutation({
    onSuccess: () => {
      toast.success('Payment terms updated successfully!');
      setIsEditDialogOpen(false);
      setEditingItem(null);
      editForm.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update payment terms');
    },
  });

  const deleteMutation = trpc.accountingLists.deletePaymentTerms.useMutation({
    onSuccess: () => {
      toast.success('Payment terms deleted successfully!');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete payment terms');
    },
  });

  const paymentTermsList = paymentTermsData?.data || [];

  const form = useForm<PaymentTermsFormValues>({
    resolver: zodResolver(paymentTermsFormSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      isActive: true,
      isDefault: false,
      sortOrder: 0,
      dueDateType: "net_days",
      netDays: 30,
      dayOfMonth: null,
      discountDays: 0,
      discountPercent: 0,
    },
  });

  const editForm = useForm<PaymentTermsFormValues>({
    resolver: zodResolver(paymentTermsFormSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      isActive: true,
      isDefault: false,
      sortOrder: 0,
      dueDateType: "net_days",
      netDays: 30,
      dayOfMonth: null,
      discountDays: 0,
      discountPercent: 0,
    },
  });

  // Clear state when organization changes
  useEffect(() => {
    if (orgId && orgId !== previousOrgIdRef.current) {
      previousOrgIdRef.current = orgId;
      form.reset();
      editForm.reset();
    }
  }, [orgId, form, editForm]);

  // Handle form submission for create
  const onSubmit = async (values: PaymentTermsFormValues) => {
    if (!orgId) {
      toast.error('Organization not selected.');
      return;
    }

    createMutation.mutate(values);
  };

  // Handle form submission for edit
  const onEditSubmit = async (values: PaymentTermsFormValues) => {
    if (!orgId || !editingItem) {
      toast.error('Organization not selected.');
      return;
    }

    updateMutation.mutate({
      id: editingItem.id,
      data: values,
    });
  };

  // Handle delete
  const handleDelete = async (item: PaymentTerms) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) {
      return;
    }

    deleteMutation.mutate({ id: item.id });
  };

  // Open edit dialog
  const openEditDialog = (item: PaymentTerms) => {
    setEditingItem(item);
    editForm.reset({
      code: item.code,
      name: item.name,
      description: item.description || "",
      isActive: item.isActive,
      isDefault: item.isDefault,
      sortOrder: item.sortOrder,
      dueDateType: item.details.dueDateType,
      netDays: item.details.netDays,
      dayOfMonth: item.details.dayOfMonth,
      discountDays: item.details.discountDays,
      discountPercent: item.details.discountPercent,
    });
    setIsEditDialogOpen(true);
  };

  // Format payment terms display
  const formatTermsDisplay = (item: PaymentTerms) => {
    const { dueDateType, netDays, dayOfMonth, discountDays, discountPercent } = item.details;

    let dueStr = '';
    switch (dueDateType) {
      case 'net_days':
        dueStr = `Net ${netDays}`;
        break;
      case 'day_of_month':
        dueStr = `Due ${dayOfMonth}${getOrdinalSuffix(dayOfMonth || 0)} of month`;
        break;
      case 'end_of_month':
        dueStr = netDays > 0 ? `EOM + ${netDays}` : 'End of Month';
        break;
    }

    if (discountPercent > 0 && discountDays > 0) {
      return `${discountPercent}/${discountDays} ${dueStr}`;
    }

    return dueStr;
  };

  const getOrdinalSuffix = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  // Render form fields (shared between create and edit)
  const renderFormFields = (formInstance: typeof form) => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={formInstance.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code</FormLabel>
              <FormControl>
                <Input placeholder="NET30" {...field} />
              </FormControl>
              <FormDescription>Unique identifier for this payment term</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={formInstance.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Net 30 Days" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={formInstance.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description (Optional)</FormLabel>
            <FormControl>
              <Textarea placeholder="Payment due within 30 days of invoice date..." {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={formInstance.control}
          name="dueDateType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Due Date Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="net_days">Net Days</SelectItem>
                  <SelectItem value="day_of_month">Day of Month</SelectItem>
                  <SelectItem value="end_of_month">End of Month</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>How the due date is calculated</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={formInstance.control}
          name="netDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Net Days</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormDescription>Days until payment is due</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {formInstance.watch('dueDateType') === 'day_of_month' && (
        <FormField
          control={formInstance.control}
          name="dayOfMonth"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Day of Month</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                />
              </FormControl>
              <FormDescription>Payment due on this day each month</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={formInstance.control}
          name="discountPercent"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Discount Percent</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                />
              </FormControl>
              <FormDescription>Early payment discount %</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={formInstance.control}
          name="discountDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Discount Days</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormDescription>Pay within X days for discount</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={formInstance.control}
          name="isDefault"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Default</FormLabel>
                <FormDescription>Use as default for new customers</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={formInstance.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Active</FormLabel>
                <FormDescription>Available for selection</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </>
  );

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Payment Terms</h1>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Payment Terms
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[625px]">
              <DialogHeader>
                <DialogTitle>Create Payment Terms</DialogTitle>
                <DialogDescription>
                  Define payment terms including due dates and early payment discounts.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {renderFormFields(form)}
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false);
                        form.reset();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? 'Creating...' : 'Create'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-muted-foreground">
          Manage payment terms that define when invoices are due and any early payment discounts.
        </p>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Edit Payment Terms</DialogTitle>
            <DialogDescription>Update payment terms configuration.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              {renderFormFields(editForm)}
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingItem(null);
                    editForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-10">Loading payment terms...</div>
      ) : paymentTermsList.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground mb-4">No payment terms found. Create your first payment terms to get started.</p>
        </div>
      ) : (
        <Table>
          <TableCaption>A list of all payment terms in your organization.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Terms</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentTermsList.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.code}</TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell>{formatTermsDisplay(item)}</TableCell>
                <TableCell>
                  <Badge variant={item.isDefault ? 'default' : 'outline'}>
                    {item.isDefault ? 'Default' : 'Standard'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={item.isActive ? 'default' : 'secondary'}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/lists/payment-terms/${item.id}`)}
                      title="View Customers"
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(item)}
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item)}
                      title="Delete"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
