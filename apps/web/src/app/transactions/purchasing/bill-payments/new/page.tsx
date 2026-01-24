'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
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

interface Vendor {
  id: string;
  name: string;
  companyName?: string;
}

interface BankAccount {
  id: string;
  name: string;
  accountNumber?: string;
}

// Form schemas
const billApplicationSchema = z.object({
  billId: z.string().min(1, "Bill is required"),
  billNumber: z.string(),
  amountDue: z.number(),
  amountToApply: z.number().min(0, "Amount must be positive"),
  selected: z.boolean(),
});

const billPaymentFormSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  paymentDate: z.string().min(1, "Payment date is required"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  bankAccountId: z.string().optional(),
  referenceNumber: z.string().optional(),
  memo: z.string().max(1000, "Memo too long").optional(),
  billApplications: z.array(billApplicationSchema),
});

type BillPaymentFormValues = z.infer<typeof billPaymentFormSchema>;

const PAYMENT_METHODS = [
  { value: 'CHECK', label: 'Check' },
  { value: 'ACH', label: 'ACH Transfer' },
  { value: 'WIRE', label: 'Wire Transfer' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'CASH', label: 'Cash' },
  { value: 'OTHER', label: 'Other' },
];

export default function NewBillPaymentPage() {
  const router = useRouter();
  const { orgId } = useAuth();

  // TRPC for vendors list
  const { data: vendorsData } = trpc.vendors.list.useQuery(
    {},
    { enabled: !!orgId }
  );

  const vendors = (Array.isArray(vendorsData) ? vendorsData : vendorsData?.data) || [];

  // Placeholder for bank accounts - would come from TRPC when available
  const bankAccounts = [] as BankAccount[];

  const form = useForm<BillPaymentFormValues>({
    resolver: zodResolver(billPaymentFormSchema),
    defaultValues: {
      vendorId: "",
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: "",
      bankAccountId: "",
      referenceNumber: "",
      memo: "",
      billApplications: [],
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "billApplications",
  });

  const handleSubmit = async (values: BillPaymentFormValues) => {
    // TODO: Connect to actual TRPC mutation when backend is ready
    console.log('Bill Payment data:', values);
    toast.success('Bill payment created successfully');
    router.push('/transactions/purchasing/bill-payments');
  };

  // Calculate totals
  const watchedApplications = form.watch('billApplications');

  const totalAmountDue = watchedApplications.reduce((sum, app) => {
    return app.selected ? sum + (app.amountDue || 0) : sum;
  }, 0);

  const totalAmountToApply = watchedApplications.reduce((sum, app) => {
    return app.selected ? sum + (app.amountToApply || 0) : sum;
  }, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to create bill payments.</p></div>;
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1600px]">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Bill Payment</h1>
          <p className="text-muted-foreground">Record a payment to a vendor</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Vendor Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Vendor Information</CardTitle>
              <CardDescription>Select the vendor you are paying</CardDescription>
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
              </div>
            </CardContent>
          </Card>

          {/* Payment Details */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
              <CardDescription>Enter payment information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <FormField
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PAYMENT_METHODS.map((method) => (
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
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Bills Selected</p>
                  <p className="text-lg font-semibold mt-1">{watchedApplications.filter(a => a.selected).length}</p>
                </div>
                <div className="text-center p-3 bg-background rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Due</p>
                  <p className="text-lg font-semibold mt-1">{formatCurrency(totalAmountDue)}</p>
                </div>
                <div className="text-center p-3 bg-primary/10 rounded-lg border-2 border-primary/20">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Payment Total</p>
                  <p className="text-xl font-bold mt-1">{formatCurrency(totalAmountToApply)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bills to Pay Section */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Outstanding Bills</CardTitle>
                  <CardDescription>Select bills to pay and enter amounts</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {fields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Select a vendor to see their outstanding bills.</p>
                  <p className="text-sm mt-2">Outstanding bills will appear here once you select a vendor.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="border rounded-lg p-4">
                      <div className="flex items-center gap-4">
                        <FormField
                          control={form.control}
                          name={`billApplications.${index}.selected`}
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
                            <label className="text-xs text-muted-foreground">Bill #</label>
                            <p className="font-medium">{watchedApplications[index]?.billNumber}</p>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Amount Due</label>
                            <p className="font-medium">{formatCurrency(watchedApplications[index]?.amountDue || 0)}</p>
                          </div>
                          <FormField
                            control={form.control}
                            name={`billApplications.${index}.amountToApply`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Amount to Pay</FormLabel>
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
              <CardDescription>Add any notes for this payment</CardDescription>
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
              Create Bill Payment
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
