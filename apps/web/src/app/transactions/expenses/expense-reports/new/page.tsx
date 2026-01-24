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

interface Employee {
  id: string;
  name: string;
}

const expenseCategories = [
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'MEALS', label: 'Meals & Entertainment' },
  { value: 'LODGING', label: 'Lodging' },
  { value: 'TRANSPORTATION', label: 'Transportation' },
  { value: 'SUPPLIES', label: 'Office Supplies' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'TRAINING', label: 'Training' },
  { value: 'OTHER', label: 'Other' },
];

// Form schemas
const expenseLineSchema = z.object({
  expenseDate: z.string().min(1, "Date is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  merchant: z.string().optional(),
});

const expenseReportFormSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  periodStart: z.string().min(1, "Period start is required"),
  periodEnd: z.string().min(1, "Period end is required"),
  purpose: z.string().min(1, "Purpose is required"),
  memo: z.string().max(1000, "Memo too long").optional(),
  lines: z.array(expenseLineSchema).min(1, "At least one expense is required"),
});

type ExpenseReportFormValues = z.infer<typeof expenseReportFormSchema>;

export default function NewExpenseReportPage() {
  const router = useRouter();
  const { orgId } = useAuth();

  // For now, use a placeholder - replace with actual employees TRPC query when available
  const employees: Employee[] = [];

  const form = useForm<ExpenseReportFormValues>({
    resolver: zodResolver(expenseReportFormSchema),
    defaultValues: {
      employeeId: "",
      periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      periodEnd: new Date().toISOString().split('T')[0],
      purpose: "",
      memo: "",
      lines: [
        { expenseDate: new Date().toISOString().split('T')[0], category: "", description: "", amount: 0, merchant: "" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const handleSubmit = async (values: ExpenseReportFormValues) => {
    // TODO: Connect to actual TRPC mutation when backend is ready
    console.log('Expense Report data:', values);
    toast.success('Expense report created successfully');
    router.push('/transactions/expenses/expense-reports');
  };

  // Calculate totals
  const watchedLines = form.watch('lines');

  const totals = watchedLines.reduce((acc, line) => {
    return {
      total: acc.total + (line.amount || 0),
      count: acc.count + 1,
    };
  }, { total: 0, count: 0 });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to create expense reports.</p></div>;
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1600px]">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Expense Report</h1>
          <p className="text-muted-foreground">Submit expenses for reimbursement</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Report Information */}
          <Card>
            <CardHeader>
              <CardTitle>Report Information</CardTitle>
              <CardDescription>Basic information about this expense report</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select employee" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees.map((employee: Employee) => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employee.name}
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
                  name="periodStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period Start *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="periodEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period End *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purpose *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Client meeting, Conference" {...field} />
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
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-background rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Expenses</p>
                  <p className="text-lg font-semibold mt-1">{totals.count} items</p>
                </div>
                <div className="text-center p-3 bg-primary/10 rounded-lg border-2 border-primary/20">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Amount</p>
                  <p className="text-xl font-bold mt-1">{formatCurrency(totals.total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Expense Items Section */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Expense Items</CardTitle>
                  <CardDescription>Add individual expenses to this report</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append({ expenseDate: new Date().toISOString().split('T')[0], category: "", description: "", amount: 0, merchant: "" })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => {
                const line = watchedLines[index];

                return (
                  <div key={field.id} className="border rounded-lg p-4 space-y-4">
                    {/* Header Row */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Expense {index + 1}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-bold">{formatCurrency(line?.amount || 0)}</span>
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
                    </div>

                    {/* Row 1: Date, Category, Merchant */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.expenseDate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date *</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lines.${index}.category`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {expenseCategories.map((cat) => (
                                  <SelectItem key={cat.value} value={cat.value}>
                                    {cat.label}
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
                        name={`lines.${index}.merchant`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Merchant</FormLabel>
                            <FormControl>
                              <Input placeholder="Vendor/Store name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Row 2: Description, Amount */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.description`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-3">
                            <FormLabel>Description *</FormLabel>
                            <FormControl>
                              <Input placeholder="What was this expense for?" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lines.${index}.amount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
              <CardDescription>Add any additional information</CardDescription>
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
                        placeholder="Additional notes or justifications..."
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
              Create Expense Report
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
