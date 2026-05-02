'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Loader2, Mail, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import {
  Form,
  FormControl,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

interface Item {
  id: string;
  name: string;
  description?: string;
  unitPrice?: number | string;
  cost?: number | string;
}

interface Vendor {
  id: string;
  name: string;
  companyName?: string;
}

// Form schemas
const billLineSchema = z.object({
  itemId: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  cost: z.number().min(0, "Cost must be positive").optional(),
});

const vendorBillFormSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  transactionDate: z.string().min(1, "Bill date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  referenceNumber: z.string().optional(),
  memo: z.string().max(1000, "Memo too long").optional(),
  lines: z.array(billLineSchema).min(1, "At least one line item is required"),
});

type VendorBillFormValues = z.infer<typeof vendorBillFormSchema>;

export default function NewVendorBillPage() {
  const router = useRouter();
  const { orgId } = useAuth();
  const [isDragOver, setIsDragOver] = useState(false);

  // TRPC for vendors list
  const { data: vendorsData } = trpc.vendors.list.useQuery(
    {},
    { enabled: !!orgId }
  );

  // TRPC for items list
  const { data: itemsData } = trpc.items.list.useQuery(
    {},
    { enabled: !!orgId }
  );

  const vendors = (Array.isArray(vendorsData) ? vendorsData : vendorsData?.data) || [];
  const items = itemsData || [];

  const form = useForm<VendorBillFormValues>({
    resolver: zodResolver(vendorBillFormSchema),
    defaultValues: {
      vendorId: "",
      transactionDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      referenceNumber: "",
      memo: "",
      lines: [
        { itemId: "", description: "", quantity: 1, unitPrice: 0, cost: 0 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const createUploadMutation = trpc.pendingDocuments.createManualVendorBillUpload.useMutation({
    onSuccess: (result) => {
      const status = result.document.status === 'APPROVED' ? 'approved' : 'queued for review';
      toast.success(`Vendor bill upload ${status}`);
      router.push(`/pending-documents/${result.document.id}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to queue vendor bill upload');
    },
  });

  const handleSubmit = async (values: VendorBillFormValues) => {
    // TODO: Connect to actual TRPC mutation when backend is ready
    console.log('Vendor Bill data:', values);
    toast.success('Vendor bill created successfully');
    router.push('/transactions/purchasing/vendor-bills');
  };

  const handleFiles = (files: FileList | File[]) => {
    const file = Array.from(files)[0];
    if (!file) {
      return;
    }

    const values = form.getValues();
    const selectedVendor = vendors.find((vendor: Vendor) => vendor.id === values.vendorId);

    createUploadMutation.mutate({
      file: {
        name: file.name,
        contentType: file.type || undefined,
        size: file.size,
      },
      vendorId: values.vendorId || undefined,
      vendorName: selectedVendor?.name,
      invoiceNumber: values.referenceNumber || undefined,
      invoiceDate: values.transactionDate || undefined,
      dueDate: values.dueDate || undefined,
      totalAmount: grandTotal || undefined,
      memo: values.memo || undefined,
    });
  };

  // Calculate line totals for display
  const watchedLines = form.watch('lines');

  const calculateAmount = (quantity: number, unitPrice: number) => {
    return quantity * unitPrice;
  };

  const calculateLineCost = (quantity: number, cost: number) => {
    return quantity * cost;
  };

  // Cumulative totals across all lines
  const totals = watchedLines.reduce((acc, line) => {
    const qty = line.quantity || 0;
    const price = line.unitPrice || 0;
    const cost = line.cost || 0;

    const amount = calculateAmount(qty, price);
    const totalCost = calculateLineCost(qty, cost);

    return {
      amount: acc.amount + amount,
      cost: acc.cost + totalCost,
      total: acc.total + amount,
    };
  }, { amount: 0, cost: 0, total: 0 });

  const grandTotal = totals.total;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to create vendor bills.</p></div>;
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1600px]">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Vendor Bill</h1>
          <p className="text-muted-foreground">Record a bill from a vendor</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)] mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Bill
            </CardTitle>
            <CardDescription>Drop an invoice file to queue it for extraction and approval.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`flex min-h-[180px] flex-col items-center justify-center rounded-md border border-dashed p-6 text-center transition-colors ${
                isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 bg-muted/20'
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragOver(false);
                handleFiles(event.dataTransfer.files);
              }}
            >
              <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
              <div className="space-y-1">
                <p className="font-medium">Drop invoice PDF or image</p>
                <p className="text-sm text-muted-foreground">The bill lands in Magic Inbox for approval rules.</p>
              </div>
              <div className="mt-4">
                <Input
                  id="vendor-bill-upload"
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={(event) => {
                    if (event.target.files) {
                      handleFiles(event.target.files);
                      event.target.value = '';
                    }
                  }}
                />
                <Button type="button" variant="outline" asChild disabled={createUploadMutation.isPending}>
                  <label htmlFor="vendor-bill-upload" className="cursor-pointer">
                    {createUploadMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Choose File
                  </label>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Bills
            </CardTitle>
            <CardDescription>Forward vendor invoices to Magic Inbox.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border p-4">
              <p className="text-sm font-medium">Forwarded invoice attachments</p>
              <p className="text-sm text-muted-foreground">
                Email intake uses the Magic Inbox address configured in Admin Settings.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/admin/settings')}
              >
                Configure Email
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/pending-documents?type=INVOICE')}
              >
                View Queue
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Vendor Information */}
          <Card>
            <CardHeader>
              <CardTitle>Vendor Information</CardTitle>
              <CardDescription>Select the vendor for this bill</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="vendorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vendor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vendors.map((vendor: Vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.name}
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
                  name="referenceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Vendor's invoice number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Bill Details */}
          <Card>
            <CardHeader>
              <CardTitle>Bill Details</CardTitle>
              <CardDescription>Set dates for this bill</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="transactionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bill Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Summary Totals Card */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-background rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Subtotal</p>
                  <p className="text-lg font-semibold mt-1">{formatCurrency(totals.amount)}</p>
                </div>
                <div className="text-center p-3 bg-background rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Cost</p>
                  <p className="text-lg font-semibold mt-1">{formatCurrency(totals.cost)}</p>
                </div>
                <div className="text-center p-3 bg-primary/10 rounded-lg border-2 border-primary/20">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Grand Total</p>
                  <p className="text-xl font-bold mt-1">{formatCurrency(grandTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items Section */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Line Items</CardTitle>
                  <CardDescription>Add items or expenses to this bill</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append({ itemId: "", description: "", quantity: 1, unitPrice: 0, cost: 0 })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Line Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => {
                const line = watchedLines[index];
                const qty = line?.quantity || 0;
                const price = line?.unitPrice || 0;
                const amount = calculateAmount(qty, price);

                return (
                  <div key={field.id} className="border rounded-lg p-4 space-y-4">
                    {/* Header Row */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Line {index + 1}</span>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Row 1: Item Select (full width) */}
                    <FormField
                      control={form.control}
                      name={`lines.${index}.itemId`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item</FormLabel>
                          <Select onValueChange={(val) => field.onChange(val === "custom" ? "" : val)} value={field.value || "custom"}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select item or enter custom" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="custom">Custom Item</SelectItem>
                              {items.map((item: Item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Row 2: Description (full width) */}
                    <FormField
                      control={form.control}
                      name={`lines.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description *</FormLabel>
                          <FormControl>
                            <Input placeholder="Line description..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Row 3: Quantity, Unit Price, Amount */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Qty *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="h-9"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lines.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Unit Price *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="h-9"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Amount</label>
                        <div className="h-9 px-3 py-2 bg-muted rounded-md text-sm font-medium">
                          {formatCurrency(amount)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Line Total</label>
                        <div className="h-9 px-3 py-2 bg-primary/10 rounded-md text-sm font-bold">
                          {formatCurrency(amount)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Memo Section */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
              <CardDescription>Add any notes for this vendor bill</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="memo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Memo</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 sticky bottom-0 bg-background py-4 border-t">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit">
              Create Vendor Bill
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
