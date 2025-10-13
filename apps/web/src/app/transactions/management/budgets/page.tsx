'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Eye, Copy, Calendar, TrendingUp, TrendingDown, BarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Define interfaces for the Budget data
interface Budget {
  id: string;
  name: string;
  description: string;
  budgetType: 'ANNUAL' | 'QUARTERLY' | 'MONTHLY';
  fiscalYear: number;
  startDate: string;
  endDate: string;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
  totalBudgeted: number;
  totalActual: number;
  variance: number;
  variancePercent: number;
  lastModified: string;
  lines: BudgetLine[];
}

interface BudgetLine {
  id: string;
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountCategory: 'Revenue' | 'Expense' | 'COGS';
  budgetedAmount: number;
  actualAmount: number;
  variance: number;
  variancePercent: number;
  period1: number;
  period2: number;
  period3: number;
  period4: number;
  period5: number;
  period6: number;
  period7: number;
  period8: number;
  period9: number;
  period10: number;
  period11: number;
  period12: number;
  notes?: string;
}

// Form schemas
const budgetLineSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  budgetedAmount: z.number().min(0, "Budgeted amount must be positive"),
  period1: z.number().min(0, "Amount must be positive").optional(),
  period2: z.number().min(0, "Amount must be positive").optional(),
  period3: z.number().min(0, "Amount must be positive").optional(),
  period4: z.number().min(0, "Amount must be positive").optional(),
  period5: z.number().min(0, "Amount must be positive").optional(),
  period6: z.number().min(0, "Amount must be positive").optional(),
  period7: z.number().min(0, "Amount must be positive").optional(),
  period8: z.number().min(0, "Amount must be positive").optional(),
  period9: z.number().min(0, "Amount must be positive").optional(),
  period10: z.number().min(0, "Amount must be positive").optional(),
  period11: z.number().min(0, "Amount must be positive").optional(),
  period12: z.number().min(0, "Amount must be positive").optional(),
  notes: z.string().optional(),
});

const budgetFormSchema = z.object({
  name: z.string().min(1, "Budget name is required"),
  description: z.string().max(500, "Description too long").optional(),
  budgetType: z.enum(['ANNUAL', 'QUARTERLY', 'MONTHLY']),
  fiscalYear: z.number().min(2020).max(2030),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  lines: z.array(budgetLineSchema).min(1, "At least one budget line is required"),
});

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

export default function BudgetsPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const { orgId } = useAuth();
  
  // Mock data for now - replace with TRPC when available
  const budgets: Budget[] = [
    {
      id: '1',
      name: 'FY 2024 Annual Budget',
      description: 'Annual budget for fiscal year 2024',
      budgetType: 'ANNUAL',
      fiscalYear: 2024,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      status: 'ACTIVE',
      totalBudgeted: 500000,
      totalActual: 375000,
      variance: -125000,
      variancePercent: -25.0,
      lastModified: '2024-01-15T10:30:00Z',
      lines: [],
    },
    {
      id: '2',
      name: 'Q1 2024 Marketing Budget',
      description: 'Quarterly marketing budget for Q1 2024',
      budgetType: 'QUARTERLY',
      fiscalYear: 2024,
      startDate: '2024-01-01',
      endDate: '2024-03-31',
      status: 'CLOSED',
      totalBudgeted: 50000,
      totalActual: 48500,
      variance: -1500,
      variancePercent: -3.0,
      lastModified: '2024-03-31T16:45:00Z',
      lines: [],
    },
  ];

  const accounts = [
    { id: '1', number: '4000', name: 'Sales Revenue', category: 'Revenue' },
    { id: '2', number: '4010', name: 'Service Revenue', category: 'Revenue' },
    { id: '3', number: '5000', name: 'Cost of Goods Sold', category: 'COGS' },
    { id: '4', number: '6000', name: 'Salaries & Wages', category: 'Expense' },
    { id: '5', number: '6010', name: 'Marketing Expense', category: 'Expense' },
    { id: '6', number: '6020', name: 'Office Rent', category: 'Expense' },
    { id: '7', number: '6030', name: 'Utilities', category: 'Expense' },
    { id: '8', number: '6040', name: 'Professional Services', category: 'Expense' },
  ];

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      name: "",
      description: "",
      budgetType: "ANNUAL",
      fiscalYear: new Date().getFullYear(),
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0],
      lines: [
        { accountId: "", budgetedAmount: 0, period1: 0, period2: 0, period3: 0, period4: 0, period5: 0, period6: 0, period7: 0, period8: 0, period9: 0, period10: 0, period11: 0, period12: 0, notes: "" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  // Handle add budget
  const handleAddBudget = async (values: BudgetFormValues) => {
    try {
      // TODO: Implement TRPC mutation
      toast.success('Budget created successfully');
      setIsAddDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error('Failed to create budget');
    }
  };

  // Handle activate budget
  const handleActivateBudget = async (budget: Budget) => {
    try {
      // TODO: Implement TRPC mutation to activate budget
      toast.success('Budget activated successfully');
    } catch (error) {
      toast.error('Failed to activate budget');
    }
  };

  // Handle copy budget
  const handleCopyBudget = async (budget: Budget) => {
    try {
      // TODO: Implement TRPC mutation to copy budget
      toast.success('Budget copied successfully');
    } catch (error) {
      toast.error('Failed to copy budget');
    }
  };

  // Handle close budget
  const handleCloseBudget = async (budget: Budget) => {
    try {
      // TODO: Implement TRPC mutation to close budget
      toast.success('Budget closed successfully');
    } catch (error) {
      toast.error('Failed to close budget');
    }
  };

  // Handle delete budget
  const handleDeleteBudget = async () => {
    try {
      // TODO: Implement TRPC mutation
      toast.success('Budget deleted successfully');
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast.error('Failed to delete budget');
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'outline';
      case 'ACTIVE': return 'default';
      case 'CLOSED': return 'secondary';
      case 'ARCHIVED': return 'secondary';
      default: return 'outline';
    }
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-green-600';
    if (variance < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view budgets.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Budgets</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Budget
        </Button>
      </div>

      <Table>
        <TableCaption>A list of budget plans for fiscal planning and control.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Budget Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Fiscal Year</TableHead>
            <TableHead>Period</TableHead>
            <TableHead className="text-right">Budgeted</TableHead>
            <TableHead className="text-right">Actual</TableHead>
            <TableHead className="text-right">Variance</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {budgets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                No budgets found. Create your first budget to get started.
              </TableCell>
            </TableRow>
          ) : (
            budgets.map((budget) => (
              <TableRow key={budget.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{budget.name}</div>
                    <div className="text-sm text-gray-500">{budget.description}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{budget.budgetType}</Badge>
                </TableCell>
                <TableCell>{budget.fiscalYear}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    {new Date(budget.startDate).toLocaleDateString()} - {new Date(budget.endDate).toLocaleDateString()}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(budget.totalBudgeted)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(budget.totalActual)}
                </TableCell>
                <TableCell className="text-right">
                  <div className={getVarianceColor(budget.variance)}>
                    {formatCurrency(budget.variance)}
                    <div className="text-xs">
                      ({budget.variancePercent.toFixed(1)}%)
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(budget.status)}>
                    {budget.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedBudget(budget);
                        setIsViewDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopyBudget(budget)}
                      title="Copy Budget"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    {budget.status === 'DRAFT' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleActivateBudget(budget)}
                        title="Activate Budget"
                      >
                        <BarChart className="h-4 w-4" />
                      </Button>
                    )}
                    {budget.status === 'ACTIVE' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCloseBudget(budget)}
                        title="Close Budget"
                      >
                        <Calendar className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedBudget(budget);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Add Budget Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Budget</DialogTitle>
            <DialogDescription>
              Create a new budget for planning and financial control.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddBudget)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., FY 2024 Annual Budget" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="budgetType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ANNUAL">Annual</SelectItem>
                          <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                          <SelectItem value="MONTHLY">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Budget description..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="fiscalYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fiscal Year</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="2020"
                          max="2030"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Budget Lines</h3>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ accountId: "", budgetedAmount: 0, period1: 0, period2: 0, period3: 0, period4: 0, period5: 0, period6: 0, period7: 0, period8: 0, period9: 0, period10: 0, period11: 0, period12: 0, notes: "" })}
                  >
                    Add Budget Line
                  </Button>
                </div>

                {fields.map((field, index) => {
                  const selectedAccount = accounts.find(account => account.id === field.accountId);
                  
                  return (
                    <div key={field.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Budget Line {index + 1}</span>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name={`lines.${index}.accountId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select account" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {accounts.map((account) => (
                                    <SelectItem key={account.id} value={account.id}>
                                      {account.number} - {account.name}
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
                          name={`lines.${index}.budgetedAmount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Total Budgeted</FormLabel>
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
                        <FormField
                          control={form.control}
                          name={`lines.${index}.notes`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notes</FormLabel>
                              <FormControl>
                                <Input placeholder="Budget notes..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      {/* Monthly breakdown - only show if annual budget */}
                      {form.watch("budgetType") === "ANNUAL" && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Monthly Breakdown</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                              <FormField
                                key={month}
                                control={form.control}
                                name={`lines.${index}.period${month}` as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Month {month}</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="text-xs"
                                        {...field}
                                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {selectedAccount && (
                        <div className="bg-gray-50 p-3 rounded-md">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Account Category:</span>
                              <p>{selectedAccount.category}</p>
                            </div>
                            <div>
                              <span className="font-medium">Account Number:</span>
                              <p>{selectedAccount.number}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Create Budget
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Budget Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Budget Details</DialogTitle>
            <DialogDescription>
              View budget {selectedBudget?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedBudget && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Budget Name</label>
                  <p className="text-sm">{selectedBudget.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Budget Type</label>
                  <p className="text-sm">
                    <Badge variant="outline">{selectedBudget.budgetType}</Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Fiscal Year</label>
                  <p className="text-sm">{selectedBudget.fiscalYear}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <p className="text-sm">
                    <Badge variant={getStatusBadgeVariant(selectedBudget.status)}>
                      {selectedBudget.status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Start Date</label>
                  <p className="text-sm">{new Date(selectedBudget.startDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">End Date</label>
                  <p className="text-sm">{new Date(selectedBudget.endDate).toLocaleDateString()}</p>
                </div>
              </div>
              
              {selectedBudget.description && (
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <p className="text-sm">{selectedBudget.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <h4 className="font-semibold text-blue-700">Total Budgeted</h4>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(selectedBudget.totalBudgeted)}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <h4 className="font-semibold text-green-700">Total Actual</h4>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(selectedBudget.totalActual)}
                  </p>
                </div>
                <div className={`p-4 rounded-lg text-center ${selectedBudget.variance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <h4 className={`font-semibold ${selectedBudget.variance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    Variance
                  </h4>
                  <p className={`text-2xl font-bold ${selectedBudget.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(selectedBudget.variance)}
                  </p>
                  <p className={`text-sm ${selectedBudget.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedBudget.variancePercent.toFixed(1)}%
                  </p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Last Modified</label>
                <p className="text-sm">{new Date(selectedBudget.lastModified).toLocaleString()}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete budget "{selectedBudget?.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBudget}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}