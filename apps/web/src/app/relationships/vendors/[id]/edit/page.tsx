'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const vendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  displayName: z.string().optional(),
  code: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  taxId: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive', 'archived']),
  address: z.object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    stateProvince: z.string().optional(),
    postalCode: z.string().optional(),
    countryCode: z.string().optional(),
  }).optional(),
  metadata: z.object({
    paymentTerms: z.string().optional(),
    vendorType: z.string().optional(),
    ein: z.string().optional(),
    w9OnFile: z.boolean().optional(),
    defaultExpenseAccount: z.string().optional(),
  }).optional(),
});

type VendorFormValues = z.infer<typeof vendorSchema>;

const NO_DEFAULT_ACCOUNT = '__no_default_account__';

type VendorMetadataValues = {
  paymentTerms?: string;
  terms?: string;
  vendorType?: string;
  vendor_type?: string;
  ein?: string;
  w9OnFile?: boolean;
  defaultExpenseAccount?: string;
};

export default function EditVendorPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { orgId } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: '',
      displayName: '',
      code: '',
      email: '',
      phone: '',
      website: '',
      taxId: '',
      description: '',
      notes: '',
      status: 'active',
      address: {
        line1: '',
        line2: '',
        city: '',
        stateProvince: '',
        postalCode: '',
        countryCode: '',
      },
      metadata: {
        paymentTerms: '',
        vendorType: '',
        ein: '',
        w9OnFile: false,
        defaultExpenseAccount: '',
      },
    },
  });

  // Fetch vendor data
  const { data: vendor, isLoading: vendorLoading } = trpc.vendors.get.useQuery(
    { id },
    { 
      enabled: !!orgId && !!id,
      retry: 1,
    }
  );

  const { data: accountsData } = trpc.accounts.list.useQuery({
    limit: 500,
    isActive: true,
  }, {
    enabled: !!orgId,
  });

  const defaultAccountOptions = (accountsData?.data || [])
    .filter((account) => account.accountCategory === 'Expense' || account.accountCategory === 'COGS');

  // Update mutation
  const updateMutation = trpc.vendors.update.useMutation({
    onSuccess: () => {
      toast.success('Vendor updated successfully');
      router.push(`/relationships/vendors/${id}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update vendor');
    },
  });

  // Populate form when vendor data is loaded
  useEffect(() => {
    if (vendor) {
      const metadata = vendor.metadata as VendorMetadataValues | null | undefined;

      form.reset({
        name: vendor.name,
        displayName: vendor.displayName || '',
        code: vendor.code || '',
        email: vendor.email || '',
        phone: vendor.phone || '',
        website: vendor.website || '',
        taxId: vendor.taxId || '',
        description: vendor.description || '',
        notes: vendor.notes || '',
        status: vendor.status as 'active' | 'inactive' | 'archived',
        address: {
          line1: vendor.address?.line1 || '',
          line2: vendor.address?.line2 || '',
          city: vendor.address?.city || '',
          stateProvince: vendor.address?.stateProvince || '',
          postalCode: vendor.address?.postalCode || '',
          countryCode: vendor.address?.countryCode || '',
        },
        metadata: {
          paymentTerms: metadata?.paymentTerms || metadata?.terms || '',
          vendorType: metadata?.vendorType || metadata?.vendor_type || '',
          ein: metadata?.ein || '',
          w9OnFile: metadata?.w9OnFile || false,
          defaultExpenseAccount: metadata?.defaultExpenseAccount || '',
        },
      });
    }
  }, [vendor, form]);

  const onSubmit = async (values: VendorFormValues) => {
    setIsLoading(true);
    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          name: values.name,
          displayName: values.displayName || undefined,
          code: values.code || undefined,
          email: values.email || undefined,
          phone: values.phone || undefined,
          website: values.website || undefined,
          taxId: values.taxId || undefined,
          description: values.description || undefined,
          notes: values.notes || undefined,
          status: values.status,
          address: values.address?.line1 || values.address?.city ? {
            line1: values.address.line1 || undefined,
            line2: values.address.line2 || undefined,
            city: values.address.city || undefined,
            stateProvince: values.address.stateProvince || undefined,
            postalCode: values.address.postalCode || undefined,
            countryCode: values.address.countryCode || undefined,
          } : undefined,
          metadata: {
            terms: values.metadata?.paymentTerms || undefined,
            vendor_type: values.metadata?.vendorType || undefined,
            ein: values.metadata?.ein || undefined,
            w9OnFile: values.metadata?.w9OnFile,
            defaultExpenseAccount: values.metadata?.defaultExpenseAccount || undefined,
          },
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to edit vendor.</p>
      </div>
    );
  }

  if (vendorLoading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Vendor Not Found</h1>
        </div>
        <p className="text-muted-foreground">The vendor you're trying to edit doesn't exist or you don't have access to it.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Edit Vendor</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendor Information</CardTitle>
          <CardDescription>Update the vendor details below</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor Name *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormDescription>Name shown in UI</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor Code</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormDescription>Unique identifier code</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax ID</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://example.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Additional Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="metadata.vendorType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Type</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Supplier, Contractor" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="metadata.paymentTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Terms</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Net 30" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="metadata.ein"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>EIN</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="metadata.defaultExpenseAccount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Expense Account</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value === NO_DEFAULT_ACCOUNT ? '' : value);
                          }}
                          value={field.value || NO_DEFAULT_ACCOUNT}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={NO_DEFAULT_ACCOUNT}>No default account</SelectItem>
                            {defaultAccountOptions.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.accountNumber} - {account.accountName}
                              </SelectItem>
                            ))}
                            {defaultAccountOptions.length === 0 && (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                No expense accounts found
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="metadata.w9OnFile"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">W-9 On File</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="address.line1"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Street Address Line 1</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address.line2"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Street Address Line 2</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address.city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address.stateProvince"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State/Province</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address.postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address.countryCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country Code</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., US" maxLength={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormDescription>Notes visible only to your organization</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <span className="mr-2">Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
