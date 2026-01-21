'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import {
  Plus,
  Trash2,
  ArrowLeft,
  Lock,
  Unlock,
  Check,
  X,
  RefreshCw,
  Save,
  AlertTriangle,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// Types
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
  totalPendingChanges?: string | null;
  totalActualCost?: string | null;
  totalCommittedCost?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: Date | null;
}

interface BudgetLineWithCostCode {
  id: string;
  budgetVersionId: string;
  projectCostCodeId: string;
  lineNumber: number;
  description?: string | null;
  originalBudgetAmount: string;
  revisedBudgetAmount: string;
  approvedChanges: string;
  pendingChanges: string;
  actualCost: string;
  committedCost: string;
  forecastAmount: string;
  estimateToComplete: string;
  varianceAmount: string;
  variancePercent: string;
  budgetUnits?: string | null;
  actualUnits?: string | null;
  unitOfMeasure?: string | null;
  unitRate?: string | null;
  notes?: string | null;
  costCode?: {
    id: string;
    costCode: string;
    costCodeName: string;
    costType: string;
    parentId?: string | null;
  };
}

interface VarianceSummary {
  totalOriginalBudget: string;
  totalRevisedBudget: string;
  totalActualCost: string;
  totalCommittedCost: string;
  totalVariance: string;
  variancePercent: string;
  lineCount: number;
  overBudgetLineCount: number;
  underBudgetLineCount: number;
}

// Editable cell state
interface EditingCell {
  lineId: string;
  field: string;
  value: string;
}

// Form schema for adding a line
const addLineSchema = z.object({
  projectCostCodeId: z.string().min(1, 'Cost code is required'),
  description: z.string().max(500).optional(),
  originalBudgetAmount: z.string().regex(/^-?\d+(\.\d{1,4})?$/, 'Invalid amount'),
  budgetUnits: z.string().optional(),
  unitOfMeasure: z.string().max(50).optional(),
  unitRate: z.string().regex(/^-?\d+(\.\d{1,6})?$/).optional(),
  notes: z.string().max(2000).optional(),
});

type AddLineFormValues = z.infer<typeof addLineSchema>;

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

// Helper to format percentage
function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return `${numValue.toFixed(1)}%`;
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

// Helper to get variance color
function getVarianceColor(variance: string | number): string {
  const numValue = typeof variance === 'string' ? parseFloat(variance) : variance;
  if (numValue > 0) return 'text-green-600';
  if (numValue < 0) return 'text-red-600';
  return '';
}

export default function BudgetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const versionId = params.id as string;
  const { orgId } = useAuth();

  const [isAddLineDialogOpen, setIsAddLineDialogOpen] = useState(false);
  const [isDeleteLineDialogOpen, setIsDeleteLineDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<BudgetLineWithCostCode | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  // TRPC queries
  const {
    data: version,
    isLoading: versionLoading,
    refetch: refetchVersion,
  } = trpc.projectBudgets.getVersion.useQuery(
    { id: versionId },
    { enabled: !!versionId && !!orgId }
  );

  const {
    data: linesData,
    isLoading: linesLoading,
    refetch: refetchLines,
  } = trpc.projectBudgets.getVersionLinesWithCostCodes.useQuery(
    { budgetVersionId: versionId },
    { enabled: !!versionId && !!orgId }
  );

  const {
    data: varianceSummary,
    refetch: refetchVariance,
  } = trpc.projectBudgets.getVarianceSummary.useQuery(
    { budgetVersionId: versionId },
    { enabled: !!versionId && !!orgId }
  );

  // Mutations
  const createLineMutation = trpc.projectBudgets.createLine.useMutation({
    onSuccess: () => {
      toast.success('Budget line added successfully');
      setIsAddLineDialogOpen(false);
      lineForm.reset();
      refetchLines();
      refetchVersion();
      refetchVariance();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add budget line');
    },
  });

  const updateLineMutation = trpc.projectBudgets.updateLine.useMutation({
    onSuccess: () => {
      toast.success('Budget line updated');
      setEditingCell(null);
      refetchLines();
      refetchVersion();
      refetchVariance();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update budget line');
      setEditingCell(null);
    },
  });

  const deleteLineMutation = trpc.projectBudgets.deleteLine.useMutation({
    onSuccess: () => {
      toast.success('Budget line deleted successfully');
      setIsDeleteLineDialogOpen(false);
      setSelectedLine(null);
      refetchLines();
      refetchVersion();
      refetchVariance();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete budget line');
    },
  });

  const updateStatusMutation = trpc.projectBudgets.updateVersionStatus.useMutation({
    onSuccess: () => {
      toast.success('Status updated successfully');
      setIsStatusDialogOpen(false);
      refetchVersion();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update status');
    },
  });

  const versionData = version as BudgetVersion | undefined;
  const lines = (linesData as BudgetLineWithCostCode[] | undefined) || [];
  const summary = varianceSummary as VarianceSummary | undefined;

  const lineForm = useForm<AddLineFormValues>({
    resolver: zodResolver(addLineSchema),
    defaultValues: {
      projectCostCodeId: '',
      description: '',
      originalBudgetAmount: '0',
      budgetUnits: '',
      unitOfMeasure: '',
      unitRate: '',
      notes: '',
    },
  });

  // Check if editing is allowed (only DRAFT status)
  const canEdit = versionData?.status === 'DRAFT';

  const handleAddLine = async (values: AddLineFormValues) => {
    createLineMutation.mutate({
      budgetVersionId: versionId,
      line: {
        projectCostCodeId: values.projectCostCodeId,
        description: values.description || undefined,
        originalBudgetAmount: values.originalBudgetAmount,
        budgetUnits: values.budgetUnits || undefined,
        unitOfMeasure: values.unitOfMeasure || undefined,
        unitRate: values.unitRate || undefined,
        notes: values.notes || undefined,
      },
    });
  };

  const handleDeleteLine = async () => {
    if (!selectedLine) return;
    deleteLineMutation.mutate({ lineId: selectedLine.id });
  };

  const handleStatusChange = (status: string) => {
    setNewStatus(status);
    setIsStatusDialogOpen(true);
  };

  const confirmStatusChange = () => {
    updateStatusMutation.mutate({
      id: versionId,
      status: newStatus as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'LOCKED',
    });
  };

  // Inline editing handlers
  const handleCellClick = useCallback(
    (lineId: string, field: string, currentValue: string) => {
      if (!canEdit) return;
      setEditingCell({ lineId, field, value: currentValue });
    },
    [canEdit]
  );

  const handleCellChange = useCallback((value: string) => {
    if (!editingCell) return;
    setEditingCell({ ...editingCell, value });
  }, [editingCell]);

  const handleCellSave = useCallback(() => {
    if (!editingCell) return;

    const updateData: Record<string, string> = {};
    updateData[editingCell.field] = editingCell.value;

    updateLineMutation.mutate({
      lineId: editingCell.lineId,
      data: updateData,
    });
  }, [editingCell, updateLineMutation]);

  const handleCellCancel = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCellSave();
      } else if (e.key === 'Escape') {
        handleCellCancel();
      }
    },
    [handleCellSave, handleCellCancel]
  );

  // Render editable cell
  const renderEditableCell = (
    lineId: string,
    field: string,
    value: string,
    isCurrency = false
  ) => {
    const isEditing = editingCell?.lineId === lineId && editingCell?.field === field;

    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <Input
            type="text"
            value={editingCell.value}
            onChange={(e) => handleCellChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-7 w-24 text-right text-sm"
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCellSave}
            disabled={updateLineMutation.isPending}
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCellCancel}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    return (
      <span
        className={`${canEdit ? 'cursor-pointer hover:bg-muted/50 px-1 rounded' : ''}`}
        onClick={() => handleCellClick(lineId, field, value)}
        title={canEdit ? 'Click to edit' : 'Version is locked'}
      >
        {isCurrency ? formatCurrency(value) : value}
      </span>
    );
  };

  if (versionLoading) {
    return (
      <div className="container mx-auto py-10">
        <p>Loading budget version...</p>
      </div>
    );
  }

  if (!versionData) {
    return (
      <div className="container mx-auto py-10">
        <p>Budget version not found.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/construction/budgets">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/construction/budgets">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">v{versionData.versionNumber} - {versionData.versionName}</h1>
            <Badge variant={getStatusBadgeVariant(versionData.status)}>
              {versionData.status}
            </Badge>
            {versionData.status === 'LOCKED' && (
              <Lock className="h-4 w-4 text-muted-foreground" />
            )}
            {versionData.isCurrent && (
              <Badge variant="outline">Current</Badge>
            )}
          </div>
          {versionData.description && (
            <p className="text-muted-foreground mt-1">{versionData.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            refetchLines();
            refetchVersion();
            refetchVariance();
          }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {versionData.status === 'DRAFT' && (
            <Button onClick={() => handleStatusChange('SUBMITTED')}>
              Submit for Approval
            </Button>
          )}
          {versionData.status === 'SUBMITTED' && (
            <Button onClick={() => handleStatusChange('APPROVED')} variant="default">
              <Check className="mr-2 h-4 w-4" />
              Approve
            </Button>
          )}
          {versionData.status === 'APPROVED' && (
            <Button onClick={() => handleStatusChange('LOCKED')} variant="destructive">
              <Lock className="mr-2 h-4 w-4" />
              Lock Version
            </Button>
          )}
        </div>
      </div>

      {/* Locked Warning */}
      {!canEdit && (
        <Alert className="mb-6">
          <Lock className="h-4 w-4" />
          <AlertTitle>Version Locked</AlertTitle>
          <AlertDescription>
            This budget version is in {versionData.status} status. Editing is only allowed for DRAFT versions.
            To make changes, create a new version by copying this one.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Original Budget</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary?.totalOriginalBudget)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Revised Budget</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary?.totalRevisedBudget)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Actual Cost</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary?.totalActualCost)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Committed Cost</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary?.totalCommittedCost)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Variance</CardDescription>
            <CardTitle className={`text-2xl ${getVarianceColor(summary?.totalVariance || '0')}`}>
              {formatCurrency(summary?.totalVariance)}
              <span className="text-sm ml-1">({formatPercent(summary?.variancePercent)})</span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Variance Warning */}
      {summary && summary.overBudgetLineCount > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Over Budget Warning</AlertTitle>
          <AlertDescription>
            {summary.overBudgetLineCount} line{summary.overBudgetLineCount > 1 ? 's' : ''} are
            over budget. Review the highlighted items below.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="lines" className="space-y-4">
        <TabsList>
          <TabsTrigger value="lines">Budget Lines ({lines.length})</TabsTrigger>
          <TabsTrigger value="variance">Variance Analysis</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Lines Tab */}
        <TabsContent value="lines" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Budget Lines</h2>
              {canEdit && (
                <p className="text-sm text-muted-foreground">
                  Click on amount cells to edit inline
                </p>
              )}
            </div>
            {canEdit && (
              <Button onClick={() => setIsAddLineDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Line
              </Button>
            )}
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableCaption>
                {lines.length === 0
                  ? 'No budget lines yet. Add lines to build your budget.'
                  : 'Project budget lines with variance tracking'}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Cost Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Original</TableHead>
                  <TableHead className="text-right">Revised</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Committed</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  {canEdit && <TableHead className="text-right w-[80px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => {
                  const varianceNum = parseFloat(line.varianceAmount || '0');
                  const isOverBudget = varianceNum < 0;

                  return (
                    <TableRow
                      key={line.id}
                      className={isOverBudget ? 'bg-red-50' : ''}
                    >
                      <TableCell className="font-medium">
                        {line.costCode?.costCode || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span>{line.costCode?.costCodeName || line.description || '-'}</span>
                          {line.costCode?.costType && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {line.costCode.costType}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {renderEditableCell(
                          line.id,
                          'originalBudgetAmount',
                          line.originalBudgetAmount,
                          true
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderEditableCell(
                          line.id,
                          'revisedBudgetAmount',
                          line.revisedBudgetAmount,
                          true
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(line.actualCost)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(line.committedCost)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${getVarianceColor(line.varianceAmount)}`}>
                        {formatCurrency(line.varianceAmount)}
                      </TableCell>
                      <TableCell className={`text-right ${getVarianceColor(line.varianceAmount)}`}>
                        {formatPercent(line.variancePercent)}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedLine(line);
                              setIsDeleteLineDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {/* Totals Row */}
                {lines.length > 0 && summary && (
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell colSpan={2}>TOTALS</TableCell>
                    <TableCell className="text-right">{formatCurrency(summary.totalOriginalBudget)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(summary.totalRevisedBudget)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(summary.totalActualCost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(summary.totalCommittedCost)}</TableCell>
                    <TableCell className={`text-right ${getVarianceColor(summary.totalVariance)}`}>
                      {formatCurrency(summary.totalVariance)}
                    </TableCell>
                    <TableCell className={`text-right ${getVarianceColor(summary.totalVariance)}`}>
                      {formatPercent(summary.variancePercent)}
                    </TableCell>
                    {canEdit && <TableCell />}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Variance Analysis Tab */}
        <TabsContent value="variance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Budget vs Actual Summary</CardTitle>
              <CardDescription>
                Overview of budget performance across all cost codes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {summary ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Lines</p>
                    <p className="text-2xl font-bold">{summary.lineCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Over Budget</p>
                    <p className="text-2xl font-bold text-red-600">
                      {summary.overBudgetLineCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Under Budget</p>
                    <p className="text-2xl font-bold text-green-600">
                      {summary.underBudgetLineCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Overall Variance %</p>
                    <p className={`text-2xl font-bold ${getVarianceColor(summary.variancePercent)}`}>
                      {formatPercent(summary.variancePercent)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Loading variance summary...</p>
              )}
            </CardContent>
          </Card>

          {/* Variance by Cost Type */}
          <Card>
            <CardHeader>
              <CardTitle>Variance by Cost Type</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cost Type</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {['LABOR', 'MATERIAL', 'EQUIPMENT', 'SUBCONTRACT', 'OTHER'].map((costType) => {
                    const typeLines = lines.filter((l) => l.costCode?.costType === costType);
                    if (typeLines.length === 0) return null;

                    const typeBudget = typeLines.reduce(
                      (sum, l) => sum + parseFloat(l.revisedBudgetAmount || '0'),
                      0
                    );
                    const typeActual = typeLines.reduce(
                      (sum, l) => sum + parseFloat(l.actualCost || '0'),
                      0
                    );
                    const typeVariance = typeBudget - typeActual;
                    const typeVariancePct = typeBudget > 0 ? (typeVariance / typeBudget) * 100 : 0;

                    return (
                      <TableRow key={costType}>
                        <TableCell className="font-medium">{costType}</TableCell>
                        <TableCell className="text-right">{formatCurrency(typeBudget)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(typeActual)}</TableCell>
                        <TableCell className={`text-right font-medium ${getVarianceColor(typeVariance)}`}>
                          {formatCurrency(typeVariance)}
                        </TableCell>
                        <TableCell className={`text-right ${getVarianceColor(typeVariance)}`}>
                          {formatPercent(typeVariancePct)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Version Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Version Number</p>
                  <p className="font-medium">v{versionData.versionNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Version Name</p>
                  <p className="font-medium">{versionData.versionName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={getStatusBadgeVariant(versionData.status)}>
                    {versionData.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Version</p>
                  <p className="font-medium">{versionData.isCurrent ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Project ID</p>
                  <p className="font-medium">{versionData.projectId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Effective Date</p>
                  <p className="font-medium">{formatDate(versionData.effectiveDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDate(versionData.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{formatDate(versionData.updatedAt)}</p>
                </div>
                {versionData.approvedAt && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Approved By</p>
                      <p className="font-medium">{versionData.approvedBy || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Approved Date</p>
                      <p className="font-medium">{formatDate(versionData.approvedAt)}</p>
                    </div>
                  </>
                )}
              </div>
              {versionData.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="font-medium whitespace-pre-wrap">{versionData.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Line Dialog */}
      <Dialog open={isAddLineDialogOpen} onOpenChange={setIsAddLineDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add Budget Line</DialogTitle>
            <DialogDescription>
              Add a new budget line item linked to a cost code.
            </DialogDescription>
          </DialogHeader>
          <Form {...lineForm}>
            <form onSubmit={lineForm.handleSubmit(handleAddLine)} className="space-y-4">
              <FormField
                control={lineForm.control}
                name="projectCostCodeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Code ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter cost code UUID" {...field} />
                    </FormControl>
                    <FormDescription>
                      The project cost code this budget line is for
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={lineForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional description..."
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={lineForm.control}
                  name="originalBudgetAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={lineForm.control}
                  name="budgetUnits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget Units</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="e.g., 100"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={lineForm.control}
                  name="unitOfMeasure"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit of Measure</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Hours, SF, EA"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={lineForm.control}
                  name="unitRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Rate</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="0.00"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={lineForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional notes..."
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
                  onClick={() => setIsAddLineDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createLineMutation.isPending}>
                  {createLineMutation.isPending ? 'Adding...' : 'Add Line'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Line Confirmation Dialog */}
      <AlertDialog open={isDeleteLineDialogOpen} onOpenChange={setIsDeleteLineDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget Line</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the budget line for cost code {selectedLine?.costCode?.costCode}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLine}
              disabled={deleteLineMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteLineMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Change Confirmation Dialog */}
      <AlertDialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Status</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change the status to "{newStatus}"?
              {newStatus === 'SUBMITTED' && (
                <span className="block mt-2 text-yellow-600">
                  Once submitted, editing will be disabled until the version is returned to DRAFT status.
                </span>
              )}
              {newStatus === 'APPROVED' && (
                <span className="block mt-2 text-yellow-600">
                  Approval confirms this budget version. Editing remains disabled.
                </span>
              )}
              {newStatus === 'LOCKED' && (
                <span className="block mt-2 text-red-600">
                  Locking this version is permanent. No further changes can be made.
                  To modify, you must create a new version.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStatusChange}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? 'Updating...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
