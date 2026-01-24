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

// Form schemas
const estimateLineSchema = z.object({
  itemId: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  cost: z.number().min(0, "Cost must be positive").optional(),
  discountPercent: z.number().min(0).max(100, "Discount must be between 0 and 100").optional(),
});

const estimateFormSchema = z.object({
  entityId: z.string().min(1, "Client is required"),
  projectId: z.string().optional(),
  transactionDate: z.string().min(1, "Estimate date is required"),
  estimateValidUntil: z.string().min(1, "Valid until date is required"),
  memo: z.string().max(1000, "Memo too long").optional(),
  salesStage: z.enum(['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST']),
  probability: z.number().min(0).max(100, "Probability must be between 0 and 100"),
  lines: z.array(estimateLineSchema).min(1, "At least one line item is required"),
});

type EstimateFormValues = z.infer<typeof estimateFormSchema>;

const salesStageOptions = [
  { value: 'LEAD', label: 'Lead' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'PROPOSAL', label: 'Proposal' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'CLOSED_WON', label: 'Closed Won' },
  { value: 'CLOSED_LOST', label: 'Closed Lost' },
];

export default function NewEstimatePage() {
  const router = useRouter();
  const { orgId } = useAuth();

  // TRPC for customers (clients) list
  const { data: clientsData } = trpc.customers.list.useQuery(
    {},
    { enabled: !!orgId }
  );

  // TRPC for projects list
  const { data: projectsData } = trpc.projects.list.useQuery(
    {},
    { enabled: !!orgId }
  );

  // TRPC for items list
  const { data: itemsData } = trpc.items.list.useQuery(
    {},
    { enabled: !!orgId }
  );

  // Mutations
  const createMutation = trpc.estimates.create.useMutation({
    onSuccess: () => {
      toast.success('Estimate created successfully');
      router.push('/transactions/sales/estimates');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create estimate');
    },
  });

  const clients = clientsData || [];
  const projects = projectsData?.data || [];
  const items = itemsData || [];

  const form = useForm<EstimateFormValues>({
    resolver: zodResolver(estimateFormSchema),
    defaultValues: {
      entityId: "",
      projectId: "",
      transactionDate: new Date().toISOString().split('T')[0],
      estimateValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      memo: "",
      salesStage: "PROPOSAL",
      probability: 50,
      lines: [
        { itemId: "", description: "", quantity: 1, unitPrice: 0, cost: 0, discountPercent: 0 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const handleSubmit = async (values: EstimateFormValues) => {
    createMutation.mutate({
      entityId: values.entityId,
      projectId: values.projectId || undefined,
      transactionDate: new Date(values.transactionDate),
      estimateValidUntil: new Date(values.estimateValidUntil),
      memo: values.memo,
      salesStage: values.salesStage,
      probability: values.probability,
      lines: values.lines.map(line => ({
        itemId: line.itemId || undefined,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
      })),
    });
  };

  // Calculate line totals for display
  const watchedLines = form.watch('lines');

  const calculateAmount = (quantity: number, unitPrice: number) => {
    return quantity * unitPrice;
  };

  const calculateLineTotal = (quantity: number, unitPrice: number, discountPercent?: number) => {
    const subtotal = quantity * unitPrice;
    const discount = discountPercent ? (subtotal * discountPercent) / 100 : 0;
    return subtotal - discount;
  };

  const calculateLineCost = (quantity: number, cost: number) => {
    return quantity * cost;
  };

  const calculateGrossMargin = (amount: number, totalCost: number) => {
    return amount - totalCost;
  };

  const calculateGrossProfit = (amount: number, totalCost: number) => {
    if (amount === 0) return 0;
    return ((amount - totalCost) / amount) * 100;
  };

  // Cumulative totals across all lines
  const totals = watchedLines.reduce((acc, line) => {
    const qty = line.quantity || 0;
    const price = line.unitPrice || 0;
    const cost = line.cost || 0;
    const discount = line.discountPercent || 0;

    const amount = calculateAmount(qty, price);
    const totalCost = calculateLineCost(qty, cost);
    const lineTotal = calculateLineTotal(qty, price, discount);
    const discountAmount = amount - lineTotal;

    return {
      amount: acc.amount + amount,
      cost: acc.cost + totalCost,
      discount: acc.discount + discountAmount,
      total: acc.total + lineTotal,
    };
  }, { amount: 0, cost: 0, discount: 0, total: 0 });

  const totalGM = totals.amount - totals.cost;
  const totalGP = totals.amount > 0 ? ((totals.amount - totals.cost) / totals.amount) * 100 : 0;

  const grandTotal = totals.total;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to create estimates.</p></div>;
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1600px]">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Sales Estimate</h1>
          <p className="text-muted-foreground">Create a new sales estimate for a client</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Customer & Project Section */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
              <CardDescription>Select the client and optionally link to a project</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="entityId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map((client: { id?: string; companyName: string }) => (
                            <SelectItem key={client.id} value={client.id || ''}>
                              {client.companyName}
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
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === "none" ? "" : val)} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select project (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Project</SelectItem>
                          {projects.map((project: { id: string; name: string }) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
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

          {/* Dates & Stage Section */}
          <Card>
            <CardHeader>
              <CardTitle>Estimate Details</CardTitle>
              <CardDescription>Set dates, sales stage, and win probability</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <FormField
                  control={form.control}
                  name="transactionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimate Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="estimateValidUntil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid Until *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="salesStage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Stage</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {salesStageOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
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
                  name="probability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Win Probability (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="text-center p-3 bg-background rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Amount</p>
                  <p className="text-lg font-semibold mt-1">{formatCurrency(totals.amount)}</p>
                </div>
                <div className="text-center p-3 bg-background rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Cost</p>
                  <p className="text-lg font-semibold mt-1">{formatCurrency(totals.cost)}</p>
                </div>
                <div className="text-center p-3 bg-background rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Gross Margin</p>
                  <p className={`text-lg font-semibold mt-1 ${totalGM < 0 ? 'text-destructive' : 'text-green-600'}`}>
                    {formatCurrency(totalGM)}
                  </p>
                </div>
                <div className="text-center p-3 bg-background rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">GP%</p>
                  <p className={`text-lg font-semibold mt-1 ${totalGP < 0 ? 'text-destructive' : 'text-green-600'}`}>
                    {totalGP.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center p-3 bg-background rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Discount</p>
                  <p className="text-lg font-semibold mt-1 text-orange-500">
                    -{formatCurrency(totals.discount)}
                  </p>
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
                  <CardDescription>Add products or services to this estimate</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append({ itemId: "", description: "", quantity: 1, unitPrice: 0, cost: 0, discountPercent: 0 })}
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
                const cost = line?.cost || 0;
                const discount = line?.discountPercent || 0;
                const amount = calculateAmount(qty, price);
                const totalCost = calculateLineCost(qty, cost);
                const gm = calculateGrossMargin(amount, totalCost);
                const gp = calculateGrossProfit(amount, totalCost);
                const lineTotal = calculateLineTotal(qty, price, discount);

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

                    {/* Row 3: Quantity, Unit Price, Amount, Cost, GM, GP%, Discount */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
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
                      <FormField
                        control={form.control}
                        name={`lines.${index}.cost`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Unit Cost</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="h-9"
                                {...field}
                                value={field.value ?? 0}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-1">
                        <label className="text-xs font-medium">GM</label>
                        <div className={`h-9 px-3 py-2 bg-muted rounded-md text-sm font-medium ${gm < 0 ? 'text-destructive' : 'text-green-600'}`}>
                          {formatCurrency(gm)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">GP%</label>
                        <div className={`h-9 px-3 py-2 bg-muted rounded-md text-sm font-medium ${gp < 0 ? 'text-destructive' : 'text-green-600'}`}>
                          {gp.toFixed(1)}%
                        </div>
                      </div>
                      <FormField
                        control={form.control}
                        name={`lines.${index}.discountPercent`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Disc %</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                max="100"
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
                        <label className="text-xs font-medium">Line Total</label>
                        <div className="h-9 px-3 py-2 bg-primary/10 rounded-md text-sm font-bold">
                          {formatCurrency(lineTotal)}
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
              <CardDescription>Add any notes or special terms for this estimate</CardDescription>
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
                        placeholder="Additional notes, terms and conditions..."
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
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Estimate'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
