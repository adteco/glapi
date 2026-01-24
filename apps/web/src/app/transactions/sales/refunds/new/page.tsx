'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
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
import { Checkbox } from "@/components/ui/checkbox";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

interface Customer {
  id?: string;
  name?: string;
  companyName?: string;
}

interface BankAccount {
  id: string;
  name: string;
  accountNumber?: string;
}

// Form schemas
const creditMemoApplicationSchema = z.object({
  creditMemoId: z.string().min(1, "Credit memo is required"),
  creditMemoNumber: z.string(),
  amountAvailable: z.number(),
  amountToApply: z.number().min(0, "Amount must be positive"),
  selected: z.boolean(),
});

const refundFormSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  refundDate: z.string().min(1, "Refund date is required"),
  refundMethod: z.string().min(1, "Refund method is required"),
  bankAccountId: z.string().optional(),
  referenceNumber: z.string().optional(),
  memo: z.string().max(1000, "Memo too long").optional(),
  creditMemoApplications: z.array(creditMemoApplicationSchema),
});

type RefundFormValues = z.infer<typeof refundFormSchema>;

const REFUND_METHODS = [
  { value: 'CHECK', label: 'Check' },
  { value: 'ACH', label: 'ACH Transfer' },
  { value: 'WIRE', label: 'Wire Transfer' },
  { value: 'CREDIT_CARD', label: 'Credit Card Refund' },
  { value: 'CASH', label: 'Cash' },
  { value: 'OTHER', label: 'Other' },
];

export default function NewRefundPage() {
  const router = useRouter();
  const { orgId } = useAuth();

  // TRPC for customers list
  const { data: customersData } = trpc.customers.list.useQuery(
    {},
    { enabled: !!orgId }
  );

  const customers = (Array.isArray(customersData) ? customersData : (customersData as { data?: Customer[] } | undefined)?.data) || [];

  // Placeholder for bank accounts - would come from TRPC when available
  const bankAccounts = [] as BankAccount[];

  const form = useForm<RefundFormValues>({
    resolver: zodResolver(refundFormSchema),
    defaultValues: {
      customerId: "",
      refundDate: new Date().toISOString().split('T')[0],
      refundMethod: "",
      bankAccountId: "",
      referenceNumber: "",
      memo: "",
      creditMemoApplications: [],
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "creditMemoApplications",
  });

  const handleSubmit = async (values: RefundFormValues) => {
    // TODO: Connect to actual TRPC mutation when backend is ready
    console.log('Refund data:', values);
    toast.success('Refund created successfully');
    router.push('/transactions/sales/refunds');
  };

  // Calculate totals
  const watchedApplications = form.watch('creditMemoApplications');

  const totalAmountAvailable = watchedApplications.reduce((sum, app) => {
    return app.selected ? sum + (app.amountAvailable || 0) : sum;
  }, 0);

  const totalAmountToApply = watchedApplications.reduce((sum, app) => {
    return app.selected ? sum + (app.amountToApply || 0) : sum;
  }, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to create refunds.</p></div>;
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1600px]">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Customer Refund</h1>
          <p className="text-muted-foreground">Issue a refund to a customer</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Customer Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
              <CardDescription>Select the customer to refund</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id || ''} value={customer.id || ''}>
                              {customer.companyName || 'Unknown'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Refund Details */}
          <Card>
            <CardHeader>
              <CardTitle>Refund Details</CardTitle>
              <CardDescription>Enter refund information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <FormField
                  control={form.control}
                  name="refundDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Refund Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="refundMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Refund Method *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REFUND_METHODS.map((method) => (
                            <SelectItem key={method.value} value={method.value}>
                              {method.label}
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
                  name="bankAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Bank Account</SelectItem>
                          {bankAccounts.map((account: BankAccount) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
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
                        <Input placeholder="Check #, confirmation #" {...field} />
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
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Credits Selected</p>
                  <p className="text-lg font-semibold mt-1">{watchedApplications.filter(a => a.selected).length}</p>
                </div>
                <div className="text-center p-3 bg-background rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Available</p>
                  <p className="text-lg font-semibold mt-1">{formatCurrency(totalAmountAvailable)}</p>
                </div>
                <div className="text-center p-3 bg-primary/10 rounded-lg border-2 border-primary/20">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Refund Total</p>
                  <p className="text-xl font-bold mt-1">{formatCurrency(totalAmountToApply)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Credit Memos to Apply Section */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Available Credit Memos</CardTitle>
                  <CardDescription>Select credit memos to apply to this refund</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {fields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Select a customer to see their available credit memos.</p>
                  <p className="text-sm mt-2">Credit memos with available balances will appear here once you select a customer.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="border rounded-lg p-4">
                      <div className="flex items-center gap-4">
                        <FormField
                          control={form.control}
                          name={`creditMemoApplications.${index}.selected`}
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div>
                            <label className="text-xs text-muted-foreground">Credit Memo #</label>
                            <p className="font-medium">{watchedApplications[index]?.creditMemoNumber}</p>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Available</label>
                            <p className="font-medium">{formatCurrency(watchedApplications[index]?.amountAvailable || 0)}</p>
                          </div>
                          <FormField
                            control={form.control}
                            name={`creditMemoApplications.${index}.amountToApply`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Amount to Refund</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="h-9"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    disabled={!watchedApplications[index]?.selected}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Memo Section */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
              <CardDescription>Add any notes for this refund</CardDescription>
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
              Create Refund
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
