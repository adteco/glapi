'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Receipt,
  Calendar,
  Check,
  X,
  Send,
  RotateCcw,
  Filter,
  DollarSign,
  CreditCard,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// Types
interface ExpenseEntry {
  id: string;
  organizationId: string;
  employeeId: string;
  projectId: string | null;
  costCodeId: string | null;
  expenseDate: string;
  category: string;
  merchantName: string | null;
  description: string;
  amount: string;
  currencyCode: string;
  taxAmount: string | null;
  paymentMethod: string;
  requiresReimbursement: boolean;
  reimbursementAmount: string | null;
  isBillable: boolean;
  billableAmount: string | null;
  status: string;
  submittedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
}

// Expense categories
const EXPENSE_CATEGORIES = [
  'TRAVEL',
  'LODGING',
  'MEALS',
  'TRANSPORTATION',
  'SUPPLIES',
  'EQUIPMENT',
  'MATERIALS',
  'SUBCONTRACTOR',
  'COMMUNICATIONS',
  'PROFESSIONAL_SERVICES',
  'INSURANCE',
  'PERMITS_FEES',
  'OTHER',
] as const;

// Payment methods
const PAYMENT_METHODS = [
  'CORPORATE_CARD',
  'PERSONAL_CARD',
  'CASH',
  'CHECK',
  'DIRECT_PAYMENT',
  'REIMBURSEMENT_PENDING',
  'OTHER',
] as const;

// Form schema for creating expense entry
const createExpenseSchema = z.object({
  projectId: z.string().uuid().optional().or(z.literal('')),
  costCodeId: z.string().uuid().optional().or(z.literal('')),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  category: z.enum(EXPENSE_CATEGORIES),
  merchantName: z.string().max(200).optional(),
  description: z.string().min(1, 'Description is required').max(1000),
  amount: z.coerce.number().positive('Amount must be positive'),
  taxAmount: z.coerce.number().min(0).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  requiresReimbursement: z.boolean().default(true),
  isBillable: z.boolean().default(false),
  billingMarkup: z.coerce.number().min(0).max(1).optional(),
});

type CreateExpenseFormValues = z.infer<typeof createExpenseSchema>;

// Status badge helper
function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'DRAFT':
      return 'outline';
    case 'SUBMITTED':
      return 'secondary';
    case 'APPROVED':
      return 'default';
    case 'REJECTED':
      return 'destructive';
    case 'REIMBURSED':
      return 'default';
    case 'POSTED':
      return 'default';
    default:
      return 'outline';
  }
}

// Category badge helper
function getCategoryBadgeColor(category: string): string {
  const colors: Record<string, string> = {
    TRAVEL: 'bg-blue-100 text-blue-800',
    LODGING: 'bg-purple-100 text-purple-800',
    MEALS: 'bg-orange-100 text-orange-800',
    TRANSPORTATION: 'bg-cyan-100 text-cyan-800',
    SUPPLIES: 'bg-green-100 text-green-800',
    EQUIPMENT: 'bg-slate-100 text-slate-800',
    MATERIALS: 'bg-amber-100 text-amber-800',
    SUBCONTRACTOR: 'bg-pink-100 text-pink-800',
    COMMUNICATIONS: 'bg-indigo-100 text-indigo-800',
    PROFESSIONAL_SERVICES: 'bg-violet-100 text-violet-800',
    INSURANCE: 'bg-teal-100 text-teal-800',
    PERMITS_FEES: 'bg-rose-100 text-rose-800',
    OTHER: 'bg-gray-100 text-gray-800',
  };
  return colors[category] || colors.OTHER;
}

// Format helpers
function formatDate(date: string | Date | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(numValue);
}

function formatCategory(category: string): string {
  return category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatPaymentMethod(method: string): string {
  return method.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function ExpenseEntriesPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState('list');
  const { orgId } = useAuth();

  // TRPC queries
  const {
    data: entriesData,
    isLoading,
    refetch,
  } = trpc.expenseEntries.list.useQuery(
    {
      filters: {
        ...(statusFilter ? { status: statusFilter as any } : {}),
        ...(categoryFilter ? { category: categoryFilter as any } : {}),
        ...(projectFilter ? { projectId: projectFilter } : {}),
      },
      orderBy: 'expenseDate',
      orderDirection: 'desc',
      limit: 100,
    },
    { enabled: !!orgId }
  );

  const { data: pendingApprovalsData, refetch: refetchPending } =
    trpc.expenseEntries.getPendingApprovals.useQuery({}, { enabled: !!orgId });

  const { data: projectsData } = trpc.projects.list.useQuery(
    { filters: { status: 'active' } },
    { enabled: !!orgId }
  );

  const { data: costCodesData } = trpc.projectCostCodes.list.useQuery({}, { enabled: !!orgId });

  const createMutation = trpc.expenseEntries.create.useMutation({
    onSuccess: () => {
      toast.success('Expense entry created successfully');
      setIsCreateDialogOpen(false);
      form.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create expense entry');
    },
  });

  const submitMutation = trpc.expenseEntries.submit.useMutation({
    onSuccess: () => {
      toast.success('Expenses submitted for approval');
      setSelectedEntries([]);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to submit expenses');
    },
  });

  const approveMutation = trpc.expenseEntries.approve.useMutation({
    onSuccess: () => {
      toast.success('Expenses approved');
      setSelectedEntries([]);
      refetch();
      refetchPending();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to approve expenses');
    },
  });

  const rejectMutation = trpc.expenseEntries.reject.useMutation({
    onSuccess: () => {
      toast.success('Expenses rejected');
      setSelectedEntries([]);
      setIsRejectDialogOpen(false);
      setRejectionReason('');
      refetch();
      refetchPending();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reject expenses');
    },
  });

  const returnToDraftMutation = trpc.expenseEntries.returnToDraft.useMutation({
    onSuccess: () => {
      toast.success('Expenses returned to draft');
      setSelectedEntries([]);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to return expenses to draft');
    },
  });

  const deleteMutation = trpc.expenseEntries.delete.useMutation({
    onSuccess: () => {
      toast.success('Expense entry deleted');
      setSelectedEntries([]);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete expense entry');
    },
  });

  const entries = (entriesData?.entries as ExpenseEntry[] | undefined) || [];
  const pendingApprovals = (pendingApprovalsData?.entries || []) as ExpenseEntry[];
  const projects = (projectsData?.data || []) as Array<{ id: string; name: string; projectCode: string }>;
  const costCodes = (costCodesData?.data || []) as Array<{ id: string; costCode: string; name: string }>;

  // Summary calculations
  const summary = useMemo(() => {
    const totalAmount = entries.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);
    const pendingReimbursement = entries
      .filter((e) => e.requiresReimbursement && e.status !== 'REIMBURSED')
      .reduce((sum, e) => sum + parseFloat(e.reimbursementAmount || e.amount || '0'), 0);
    const billableAmount = entries
      .filter((e) => e.isBillable)
      .reduce((sum, e) => sum + parseFloat(e.billableAmount || e.amount || '0'), 0);

    // Category breakdown
    const byCategory = entries.reduce(
      (acc, e) => {
        const cat = e.category;
        if (!acc[cat]) acc[cat] = { count: 0, amount: 0 };
        acc[cat].count++;
        acc[cat].amount += parseFloat(e.amount || '0');
        return acc;
      },
      {} as Record<string, { count: number; amount: number }>
    );

    return { totalAmount, pendingReimbursement, billableAmount, byCategory, entryCount: entries.length };
  }, [entries]);

  const form = useForm<CreateExpenseFormValues>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      projectId: '',
      costCodeId: '',
      expenseDate: new Date().toISOString().split('T')[0],
      category: 'OTHER',
      merchantName: '',
      description: '',
      amount: 0,
      taxAmount: 0,
      paymentMethod: 'PERSONAL_CARD',
      requiresReimbursement: true,
      isBillable: false,
      billingMarkup: 0,
    },
  });

  const handleCreate = async (values: CreateExpenseFormValues) => {
    createMutation.mutate({
      projectId: values.projectId || undefined,
      costCodeId: values.costCodeId || undefined,
      expenseDate: values.expenseDate,
      category: values.category,
      merchantName: values.merchantName || undefined,
      description: values.description,
      amount: values.amount.toFixed(4),
      taxAmount: values.taxAmount?.toFixed(4),
      paymentMethod: values.paymentMethod,
      requiresReimbursement: values.requiresReimbursement,
      isBillable: values.isBillable,
      billingMarkup: values.billingMarkup?.toString(),
    });
  };

  const handleSubmit = () => {
    if (selectedEntries.length === 0) {
      toast.error('Select expenses to submit');
      return;
    }
    submitMutation.mutate({ expenseEntryIds: selectedEntries });
  };

  const handleApprove = () => {
    if (selectedEntries.length === 0) {
      toast.error('Select expenses to approve');
      return;
    }
    approveMutation.mutate({ expenseEntryIds: selectedEntries });
  };

  const handleReject = () => {
    if (selectedEntries.length === 0) {
      toast.error('Select expenses to reject');
      return;
    }
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    rejectMutation.mutate({ expenseEntryIds: selectedEntries, reason: rejectionReason });
  };

  const handleReturnToDraft = () => {
    if (selectedEntries.length === 0) {
      toast.error('Select expenses to return to draft');
      return;
    }
    returnToDraftMutation.mutate({ expenseEntryIds: selectedEntries });
  };

  const toggleSelectEntry = (id: string) => {
    setSelectedEntries((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const selectAllEntries = () => {
    const selectableEntries = entries.filter((e) => e.status === 'DRAFT' || e.status === 'SUBMITTED');
    if (selectedEntries.length === selectableEntries.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(selectableEntries.map((e) => e.id));
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <p>Loading expense entries...</p>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view expense entries.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Expense Entries</h1>
          <p className="text-muted-foreground mt-1">Track and manage expense reports</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Expense
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Expenses</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary.totalAmount)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{summary.entryCount} entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Reimbursement</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary.pendingReimbursement)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Billable Amount</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary.billableAmount)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Client chargeable</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Approval</CardDescription>
            <CardTitle className="text-2xl">{pendingApprovals.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Awaiting your review</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">
            <Receipt className="h-4 w-4 mr-2" />
            All Expenses
          </TabsTrigger>
          <TabsTrigger value="categories">
            <DollarSign className="h-4 w-4 mr-2" />
            By Category
          </TabsTrigger>
          <TabsTrigger value="approvals">
            <Check className="h-4 w-4 mr-2" />
            Approvals ({pendingApprovals.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-center flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="REIMBURSED">Reimbursed</SelectItem>
                <SelectItem value="POSTED">Posted</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {formatCategory(cat)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.projectCode} - {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {selectedEntries.length > 0 && (
            <div className="flex gap-2 p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium mr-4">{selectedEntries.length} selected</span>
              <Button size="sm" variant="outline" onClick={handleSubmit}>
                <Send className="h-4 w-4 mr-1" />
                Submit
              </Button>
              <Button size="sm" variant="outline" onClick={handleReturnToDraft}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Return to Draft
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedEntries([])}>
                Clear Selection
              </Button>
            </div>
          )}

          {/* Table */}
          <Table>
            <TableCaption>
              {entries.length === 0
                ? 'No expense entries found. Create one to get started.'
                : `Showing ${entries.length} expense entries.`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      selectedEntries.length > 0 &&
                      selectedEntries.length ===
                        entries.filter((e) => e.status === 'DRAFT' || e.status === 'SUBMITTED').length
                    }
                    onCheckedChange={selectAllEntries}
                  />
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    {(entry.status === 'DRAFT' || entry.status === 'SUBMITTED') && (
                      <Checkbox
                        checked={selectedEntries.includes(entry.id)}
                        onCheckedChange={() => toggleSelectEntry(entry.id)}
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{formatDate(entry.expenseDate)}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryBadgeColor(entry.category)}`}
                    >
                      {formatCategory(entry.category)}
                    </span>
                  </TableCell>
                  <TableCell>{entry.merchantName || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{entry.description}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(entry.amount)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <CreditCard className="h-3 w-3" />
                      <span className="text-xs">{formatPaymentMethod(entry.paymentMethod)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(entry.status)}>{entry.status}</Badge>
                    {entry.status === 'REJECTED' && entry.rejectionReason && (
                      <p className="text-xs text-destructive mt-1">{entry.rejectionReason}</p>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(summary.byCategory)
              .sort((a, b) => b[1].amount - a[1].amount)
              .map(([category, data]) => (
                <Card key={category}>
                  <CardHeader className="pb-2">
                    <CardDescription>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryBadgeColor(category)}`}
                      >
                        {formatCategory(category)}
                      </span>
                    </CardDescription>
                    <CardTitle className="text-xl">{formatCurrency(data.amount)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{data.count} entries</p>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4">
          {/* Approval Actions */}
          {selectedEntries.length > 0 && (
            <div className="flex gap-2 p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium mr-4">{selectedEntries.length} selected</span>
              <Button size="sm" variant="default" onClick={handleApprove}>
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setIsRejectDialogOpen(true)}>
                <X className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedEntries([])}>
                Clear Selection
              </Button>
            </div>
          )}

          <Table>
            <TableCaption>
              {pendingApprovals.length === 0
                ? 'No pending approvals.'
                : `${pendingApprovals.length} expenses awaiting approval.`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      pendingApprovals.length > 0 && selectedEntries.length === pendingApprovals.length
                    }
                    onCheckedChange={() => {
                      if (selectedEntries.length === pendingApprovals.length) {
                        setSelectedEntries([]);
                      } else {
                        setSelectedEntries(pendingApprovals.map((e) => e.id));
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingApprovals.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedEntries.includes(entry.id)}
                      onCheckedChange={() => toggleSelectEntry(entry.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{formatDate(entry.expenseDate)}</TableCell>
                  <TableCell>{entry.employeeId.slice(0, 8)}...</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryBadgeColor(entry.category)}`}
                    >
                      {formatCategory(entry.category)}
                    </span>
                  </TableCell>
                  <TableCell>{entry.merchantName || '-'}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(entry.amount)}</TableCell>
                  <TableCell>{formatDate(entry.submittedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      {/* Create Expense Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create Expense Entry</DialogTitle>
            <DialogDescription>Log a business expense for reimbursement or tracking.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="expenseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {formatCategory(cat)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="merchantName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Merchant Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Delta Airlines, Hilton Hotel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe the expense..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          {...field}
                          value={field.value ?? ''}
                        />
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
                      <FormLabel>Payment Method</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PAYMENT_METHODS.map((method) => (
                            <SelectItem key={method} value={method}>
                              {formatPaymentMethod(method)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No Project</SelectItem>
                          {projects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.projectCode} - {p.name}
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
                  name="costCodeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost Code (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select cost code" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No Cost Code</SelectItem>
                          {costCodes.map((cc) => (
                            <SelectItem key={cc.id} value={cc.id}>
                              {cc.costCode} - {cc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="requiresReimbursement"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Requires Reimbursement</FormLabel>
                        <FormDescription>Check if this expense needs to be reimbursed</FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isBillable"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Billable to Client</FormLabel>
                        <FormDescription>Check if this expense can be billed to the client</FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Expense'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <AlertDialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Expenses</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting {selectedEntries.length}{' '}
              {selectedEntries.length === 1 ? 'expense' : 'expenses'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Rejection reason..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectionReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
