'use client';

import { useState } from 'react';
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
import { Plus, Eye, Copy, Trash2, FileUp, FileDown, Lock } from 'lucide-react';
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

// Types for Budget Versions
interface BudgetVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  versionName: string;
  description?: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'LOCKED' | 'SUPERSEDED';
  isCurrent: boolean;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  totalOriginalBudget?: string | null;
  totalRevisedBudget?: string | null;
  totalApprovedChanges?: string | null;
  totalActualCost?: string | null;
  totalCommittedCost?: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: Date | null;
}

// Form schema for creating a budget version
const createVersionSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  versionName: z.string().min(1, 'Version name is required').max(100),
  description: z.string().max(500).optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
});

type CreateVersionFormValues = z.infer<typeof createVersionSchema>;

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

// Helper to get badge variant for status
function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'DRAFT':
      return 'outline';
    case 'SUBMITTED':
      return 'secondary';
    case 'APPROVED':
      return 'default';
    case 'LOCKED':
      return 'destructive';
    case 'SUPERSEDED':
      return 'secondary';
    default:
      return 'outline';
  }
}

export default function ProjectBudgetsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<BudgetVersion | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [copyVersionName, setCopyVersionName] = useState('');
  const { orgId } = useAuth();

  // TRPC queries
  const {
    data: versionsData,
    isLoading,
    refetch,
  } = trpc.projectBudgets.listVersions.useQuery(
    {
      filters: statusFilter ? { status: statusFilter as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'LOCKED' | 'SUPERSEDED' } : undefined,
      orderBy: 'versionNumber',
      orderDirection: 'desc',
    },
    {
      enabled: !!orgId,
    }
  );

  const createMutation = trpc.projectBudgets.createVersion.useMutation({
    onSuccess: () => {
      toast.success('Budget version created successfully');
      setIsCreateDialogOpen(false);
      form.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create budget version');
    },
  });

  const deleteMutation = trpc.projectBudgets.deleteVersion.useMutation({
    onSuccess: () => {
      toast.success('Budget version deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedVersion(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete budget version');
    },
  });

  const copyMutation = trpc.projectBudgets.copyVersion.useMutation({
    onSuccess: () => {
      toast.success('Budget version copied successfully');
      setIsCopyDialogOpen(false);
      setSelectedVersion(null);
      setCopyVersionName('');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to copy budget version');
    },
  });

  const versions = (versionsData?.data as BudgetVersion[] | undefined) || [];

  const form = useForm<CreateVersionFormValues>({
    resolver: zodResolver(createVersionSchema),
    defaultValues: {
      projectId: '',
      versionName: '',
      description: '',
      effectiveDate: '',
    },
  });

  const handleCreateVersion = async (values: CreateVersionFormValues) => {
    createMutation.mutate({
      projectId: values.projectId,
      versionName: values.versionName,
      description: values.description || undefined,
      effectiveDate: values.effectiveDate || undefined,
    });
  };

  const handleDeleteVersion = async () => {
    if (!selectedVersion) return;
    deleteMutation.mutate({ id: selectedVersion.id });
  };

  const handleCopyVersion = async () => {
    if (!selectedVersion || !copyVersionName.trim()) return;
    copyMutation.mutate({
      sourceVersionId: selectedVersion.id,
      newVersionName: copyVersionName.trim(),
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <p>Loading budget versions...</p>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view project budgets.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Project Budgets</h1>
          <p className="text-muted-foreground mt-1">
            Manage project budget versions and track budget vs actual costs
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Budget
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
            <SelectItem value="LOCKED">Locked</SelectItem>
            <SelectItem value="SUPERSEDED">Superseded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Table>
        <TableCaption>
          {versions.length === 0
            ? 'No budget versions found. Create one to get started.'
            : 'A list of project budget versions.'}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Version</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Original Budget</TableHead>
            <TableHead className="text-right">Revised Budget</TableHead>
            <TableHead className="text-right">Actual Cost</TableHead>
            <TableHead>Effective Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.map((version) => (
            <TableRow key={version.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/construction/budgets/${version.id}`}
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  v{version.versionNumber}
                  {version.isCurrent && (
                    <Badge variant="outline" className="ml-1 text-xs">Current</Badge>
                  )}
                </Link>
              </TableCell>
              <TableCell>{version.versionName}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Badge variant={getStatusBadgeVariant(version.status)}>
                    {version.status}
                  </Badge>
                  {version.status === 'LOCKED' && (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(version.totalOriginalBudget)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(version.totalRevisedBudget)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(version.totalActualCost)}
              </TableCell>
              <TableCell>{formatDate(version.effectiveDate)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/construction/budgets/${version.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedVersion(version);
                      setCopyVersionName(`${version.versionName} (Copy)`);
                      setIsCopyDialogOpen(true);
                    }}
                    title="Copy Budget"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {version.status === 'DRAFT' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedVersion(version);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Create Version Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create Budget Version</DialogTitle>
            <DialogDescription>
              Create a new budget version for a project. Budget versions track original and revised
              budget amounts against actual costs.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateVersion)} className="space-y-4">
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter project UUID" {...field} />
                    </FormControl>
                    <FormDescription>
                      The project this budget is associated with
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="versionName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Version Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Initial Budget, Revised Q2" {...field} />
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
                      <Textarea
                        placeholder="Brief description of this budget version..."
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="effectiveDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                  {createMutation.isPending ? 'Creating...' : 'Create Budget'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Copy Version Dialog */}
      <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Copy Budget Version</DialogTitle>
            <DialogDescription>
              Create a new draft budget by copying version v{selectedVersion?.versionNumber}.
              All budget lines will be copied to the new version.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Version Name</label>
              <Input
                value={copyVersionName}
                onChange={(e) => setCopyVersionName(e.target.value)}
                placeholder="Enter new version name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCopyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCopyVersion}
              disabled={copyMutation.isPending || !copyVersionName.trim()}
            >
              {copyMutation.isPending ? 'Copying...' : 'Copy Budget'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget Version</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete budget version v{selectedVersion?.versionNumber} -
              "{selectedVersion?.versionName}"? This action cannot be undone and will delete all
              associated budget lines.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVersion}
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
