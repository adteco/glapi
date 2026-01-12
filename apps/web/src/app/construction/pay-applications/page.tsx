'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
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
import { Plus, Eye, Edit, Trash2, FileDown, Send, CheckCircle } from 'lucide-react';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// Types for Pay Application
interface PayApplication {
  id: string;
  applicationNumber: number;
  applicationDate: string;
  periodFrom: string;
  periodTo: string;
  payAppType: 'PROGRESS' | 'FINAL' | 'RETAINAGE_RELEASE';
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'CERTIFIED' | 'BILLED' | 'PAID' | 'REJECTED' | 'VOIDED';
  projectId: string;
  projectName: string;
  projectCode: string;
  contractSumToDate: number;
  totalCompletedAndStoredToDate: number;
  totalRetainage: number;
  totalEarnedLessRetainage: number;
  lessPreviousCertificates: number;
  currentPaymentDue: number;
  balanceToFinish: number;
  submittedDate?: string;
  approvedDate?: string;
  certifiedDate?: string;
  billedDate?: string;
  paidDate?: string;
}

// Form schema for creating Pay Application
const createPayAppSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  scheduleOfValuesId: z.string().min(1, 'Schedule of Values is required'),
  applicationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  payAppType: z.enum(['PROGRESS', 'FINAL', 'RETAINAGE_RELEASE']).default('PROGRESS'),
  retainagePercent: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
});

type CreatePayAppFormValues = z.infer<typeof createPayAppSchema>;

// Helper to get badge variant for status
function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'DRAFT':
      return 'outline';
    case 'SUBMITTED':
      return 'secondary';
    case 'APPROVED':
    case 'CERTIFIED':
      return 'default';
    case 'BILLED':
    case 'PAID':
      return 'default';
    case 'REJECTED':
    case 'VOIDED':
      return 'destructive';
    default:
      return 'outline';
  }
}

// Helper to get badge variant for type
function getTypeBadgeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (type) {
    case 'PROGRESS':
      return 'default';
    case 'FINAL':
      return 'secondary';
    case 'RETAINAGE_RELEASE':
      return 'outline';
    default:
      return 'outline';
  }
}

// Helper to format currency
function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
}

// Helper to format date
function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function PayApplicationsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPayApp, setSelectedPayApp] = useState<PayApplication | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const { orgId } = useAuth();

  // TRPC queries
  const {
    data: payAppsData,
    isLoading,
    refetch,
  } = trpc.payApplications.list.useQuery(
    {
      filters: {
        ...(statusFilter ? { status: statusFilter as PayApplication['status'] } : {}),
        ...(typeFilter ? { payAppType: typeFilter as PayApplication['payAppType'] } : {}),
      },
    },
    {
      enabled: !!orgId,
    }
  );

  const createMutation = trpc.payApplications.create.useMutation({
    onSuccess: () => {
      toast.success('Pay Application created successfully');
      setIsCreateDialogOpen(false);
      form.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create Pay Application');
    },
  });

  const deleteMutation = trpc.payApplications.delete.useMutation({
    onSuccess: () => {
      toast.success('Pay Application deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedPayApp(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete Pay Application');
    },
  });

  const payApps = (payAppsData?.data as PayApplication[] | undefined) || [];

  const form = useForm<CreatePayAppFormValues>({
    resolver: zodResolver(createPayAppSchema),
    defaultValues: {
      projectId: '',
      scheduleOfValuesId: '',
      applicationDate: new Date().toISOString().split('T')[0],
      periodFrom: '',
      periodTo: '',
      payAppType: 'PROGRESS',
      retainagePercent: 10,
      notes: '',
    },
  });

  const handleCreatePayApp = async (values: CreatePayAppFormValues) => {
    createMutation.mutate({
      projectId: values.projectId,
      scheduleOfValuesId: values.scheduleOfValuesId,
      applicationDate: values.applicationDate,
      periodFrom: values.periodFrom,
      periodTo: values.periodTo,
      payAppType: values.payAppType,
      retainagePercent: values.retainagePercent,
      notes: values.notes || undefined,
    });
  };

  const handleDeletePayApp = async () => {
    if (!selectedPayApp) return;
    deleteMutation.mutate({ id: selectedPayApp.id });
  };

  // Export list to CSV
  const handleExportList = useCallback(() => {
    if (payApps.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = [
      'App #',
      'Project',
      'Type',
      'Status',
      'Application Date',
      'Period',
      'Contract Sum',
      'Completed & Stored',
      'Retainage',
      'Current Payment Due',
    ];
    const rows = payApps.map((pa) => [
      pa.applicationNumber,
      pa.projectName,
      pa.payAppType,
      pa.status,
      pa.applicationDate,
      `${pa.periodFrom} to ${pa.periodTo}`,
      pa.contractSumToDate,
      pa.totalCompletedAndStoredToDate,
      pa.totalRetainage,
      pa.currentPaymentDue,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pay-applications-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Export completed');
  }, [payApps]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <p>Loading pay applications...</p>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view pay applications.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Pay Applications</h1>
          <p className="text-muted-foreground mt-1">
            Manage AIA G702 Applications for Payment and billing workflow
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportList}>
            <FileDown className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Pay App
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="CERTIFIED">Certified</SelectItem>
            <SelectItem value="BILLED">Billed</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="VOIDED">Voided</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Types</SelectItem>
            <SelectItem value="PROGRESS">Progress</SelectItem>
            <SelectItem value="FINAL">Final</SelectItem>
            <SelectItem value="RETAINAGE_RELEASE">Retainage Release</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Table>
        <TableCaption>
          {payApps.length === 0
            ? 'No pay applications found. Create one to get started.'
            : "A list of your organization's pay applications."}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>App #</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Period</TableHead>
            <TableHead className="text-right">Current Due</TableHead>
            <TableHead className="text-right">Retainage</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payApps.map((payApp) => (
            <TableRow key={payApp.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/construction/pay-applications/${payApp.id}`}
                  className="text-primary hover:underline"
                >
                  #{payApp.applicationNumber}
                </Link>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{payApp.projectCode}</span>
                  <span className="text-sm text-muted-foreground">{payApp.projectName}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={getTypeBadgeVariant(payApp.payAppType)}>{payApp.payAppType}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(payApp.status)}>{payApp.status}</Badge>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {formatDate(payApp.periodFrom)} - {formatDate(payApp.periodTo)}
                </div>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(payApp.currentPaymentDue)}
              </TableCell>
              <TableCell className="text-right">{formatCurrency(payApp.totalRetainage)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/construction/pay-applications/${payApp.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  {payApp.status === 'DRAFT' && (
                    <>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/construction/pay-applications/${payApp.id}/edit`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedPayApp(payApp);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/construction/pay-applications/${payApp.id}?export=g702`}>
                      <FileDown className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Create Pay Application Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create Pay Application</DialogTitle>
            <DialogDescription>
              Create a new AIA G702 Application for Payment. This will generate billing lines from
              the selected Schedule of Values.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreatePayApp)} className="space-y-4">
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter project UUID" {...field} />
                    </FormControl>
                    <FormDescription>The project this pay application is for</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scheduleOfValuesId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schedule of Values ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter SOV UUID" {...field} />
                    </FormControl>
                    <FormDescription>The SOV to base this pay application on</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payAppType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Application Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PROGRESS">Progress Payment</SelectItem>
                        <SelectItem value="FINAL">Final Payment</SelectItem>
                        <SelectItem value="RETAINAGE_RELEASE">Retainage Release</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="applicationDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Application Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="periodFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period From</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="periodTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period To</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="retainagePercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Retainage %</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="10"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Standard is 10%</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional notes for this pay application..."
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Pay App'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pay Application</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Pay Application #{selectedPayApp?.applicationNumber}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePayApp}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
