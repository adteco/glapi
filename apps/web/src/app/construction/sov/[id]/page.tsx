'use client';

import { useState } from 'react';
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
  Edit,
  Trash2,
  FileDown,
  ArrowLeft,
  CheckCircle,
  XCircle,
  RefreshCw,
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// Types - matching the service layer types
interface SovLineWithProgress {
  id: string;
  lineNumber: number;
  itemNumber?: string | null;
  lineType: string;
  description: string;
  originalScheduledValue: number;
  changeOrderAmount: number;
  revisedScheduledValue: number;
  previousWorkCompleted: number;
  previousMaterialsStored: number;
  currentWorkCompleted: number;
  currentMaterialsStored: number;
  totalCompletedAndStored: number;
  percentComplete: number;
  balanceToFinish: number;
  retainagePercent: number;
  retainageHeld: number;
  retainageReleased: number;
  netRetainage: number;
  costCodeId?: string | null;
  costCodeName?: string | null;
}

interface SovSummary {
  id: string;
  sovNumber: string;
  projectId: string;
  projectName: string;
  status: string;
  originalContractAmount: number;
  approvedChangeOrders: number;
  pendingChangeOrders: number;
  revisedContractAmount: number;
  totalScheduledValue: number;
  totalPreviouslyBilled: number;
  totalCurrentBilling: number;
  totalBilledToDate: number;
  totalRetainageHeld: number;
  totalRetainageReleased: number;
  balanceToFinish: number;
  percentComplete: number;
  lineCount: number;
  activeLineCount: number;
  approvedChangeOrderCount: number;
  pendingChangeOrderCount: number;
}

interface ChangeOrderSummary {
  id: string;
  changeOrderNumber: string;
  description: string;
  amount: string;
  status: string;
  effectiveDate?: string;
  requestedDate?: Date;
  approvedDate?: Date;
}

// Form schema for adding a line
const addLineSchema = z.object({
  itemNumber: z.string().max(50).optional(),
  lineType: z.string().optional(),
  description: z.string().min(1, 'Description is required').max(500),
  originalScheduledValue: z.coerce.number().nonnegative('Amount must be non-negative'),
  retainagePercent: z.coerce.number().min(0).max(100).optional(),
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
    case 'ACTIVE':
      return 'default';
    case 'REVISED':
      return 'secondary';
    case 'CLOSED':
      return 'destructive';
    case 'APPROVED':
      return 'default';
    case 'PENDING':
      return 'secondary';
    case 'REJECTED':
      return 'destructive';
    default:
      return 'outline';
  }
}

export default function SovDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sovId = params.id as string;
  const { orgId } = useAuth();

  const [isAddLineDialogOpen, setIsAddLineDialogOpen] = useState(false);
  const [isDeleteLineDialogOpen, setIsDeleteLineDialogOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<SovLineWithProgress | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');

  // TRPC queries
  const {
    data: sov,
    isLoading: sovLoading,
    refetch: refetchSov,
  } = trpc.scheduleOfValues.getById.useQuery(
    { id: sovId },
    { enabled: !!sovId && !!orgId }
  );

  const {
    data: linesData,
    isLoading: linesLoading,
    refetch: refetchLines,
  } = trpc.scheduleOfValues.getLines.useQuery(
    { sovId },
    { enabled: !!sovId && !!orgId }
  );

  const {
    data: changeOrdersData,
    isLoading: changeOrdersLoading,
    refetch: refetchChangeOrders,
  } = trpc.scheduleOfValues.getChangeOrders.useQuery(
    { sovId },
    { enabled: !!sovId && !!orgId }
  );

  const { data: validationResult, refetch: refetchValidation } =
    trpc.scheduleOfValues.validate.useQuery({ id: sovId }, { enabled: !!sovId && !!orgId });

  const { data: g703Data } = trpc.scheduleOfValues.generateG703.useQuery(
    { sovId },
    { enabled: !!sovId && !!orgId }
  );

  // Mutations
  const createLineMutation = trpc.scheduleOfValues.createLine.useMutation({
    onSuccess: () => {
      toast.success('Line added successfully');
      setIsAddLineDialogOpen(false);
      lineForm.reset();
      refetchLines();
      refetchSov();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add line');
    },
  });

  const deleteLineMutation = trpc.scheduleOfValues.deleteLine.useMutation({
    onSuccess: () => {
      toast.success('Line deleted successfully');
      setIsDeleteLineDialogOpen(false);
      setSelectedLine(null);
      refetchLines();
      refetchSov();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete line');
    },
  });

  const updateStatusMutation = trpc.scheduleOfValues.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('Status updated successfully');
      setIsStatusDialogOpen(false);
      refetchSov();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update status');
    },
  });

  const lines = (linesData as SovLineWithProgress[] | undefined) || [];
  const changeOrders = (changeOrdersData as ChangeOrderSummary[] | undefined) || [];

  const lineForm = useForm<AddLineFormValues>({
    resolver: zodResolver(addLineSchema),
    defaultValues: {
      itemNumber: '',
      lineType: '',
      description: '',
      originalScheduledValue: 0,
      retainagePercent: 10,
      notes: '',
    },
  });

  const handleAddLine = async (values: AddLineFormValues) => {
    createLineMutation.mutate({
      sovId,
      line: {
        description: values.description,
        originalScheduledValue: values.originalScheduledValue,
        itemNumber: values.itemNumber || undefined,
        lineType: values.lineType || undefined,
        retainagePercent: values.retainagePercent,
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
      id: sovId,
      status: newStatus as 'DRAFT' | 'ACTIVE' | 'REVISED' | 'CLOSED',
    });
  };

  const handleExportG703 = () => {
    if (g703Data) {
      // Convert G703 data to CSV format
      const headers = [
        'Item No.',
        'Description',
        'Scheduled Value',
        'Work Completed (Previous)',
        'Materials Stored (Previous)',
        'Work Completed (This Period)',
        'Materials Stored (This Period)',
        'Total Completed & Stored',
        '% Complete',
        'Balance to Finish',
        'Retainage',
      ];

      const csvContent = [
        headers.join(','),
        ...g703Data.lines.map((line: {
          itemNumber: string;
          descriptionOfWork: string;
          scheduledValue: number;
          workCompletedFromPrevious: number;
          materialsStoredFromPrevious: number;
          workCompletedThisPeriod: number;
          materialsStoredThisPeriod: number;
          totalCompletedAndStored: number;
          percentComplete: number;
          balanceToFinish: number;
          retainage: number;
        }) =>
          [
            `"${line.itemNumber}"`,
            `"${line.descriptionOfWork}"`,
            line.scheduledValue,
            line.workCompletedFromPrevious,
            line.materialsStoredFromPrevious,
            line.workCompletedThisPeriod,
            line.materialsStoredThisPeriod,
            line.totalCompletedAndStored,
            line.percentComplete,
            line.balanceToFinish,
            line.retainage,
          ].join(',')
        ),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `G703-${(sov as SovSummary)?.sovNumber || 'export'}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('G703 exported successfully');
    }
  };

  if (sovLoading) {
    return (
      <div className="container mx-auto py-10">
        <p>Loading schedule of values...</p>
      </div>
    );
  }

  if (!sov) {
    return (
      <div className="container mx-auto py-10">
        <p>Schedule of Values not found.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/construction/sov">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
          </Link>
        </Button>
      </div>
    );
  }

  const sovData = sov as SovSummary;
  const isDraft = sovData.status === 'DRAFT';

  // Calculate totals
  const totalOriginal = lines.reduce((sum, line) => sum + (line.originalScheduledValue || 0), 0);
  const totalCurrent = lines.reduce((sum, line) => sum + (line.revisedScheduledValue || 0), 0);
  const totalCompleted = lines.reduce((sum, line) => sum + (line.totalCompletedAndStored || 0), 0);
  const totalRetainage = lines.reduce((sum, line) => sum + (line.retainageHeld || 0), 0);
  const overallPercent = totalCurrent > 0 ? (totalCompleted / totalCurrent) * 100 : 0;

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/construction/sov">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{sovData.sovNumber}</h1>
            <Badge variant={getStatusBadgeVariant(sovData.status)}>{sovData.status}</Badge>
          </div>
          {sovData.projectName && (
            <p className="text-muted-foreground mt-1">Project: {sovData.projectName}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportG703}>
            <FileDown className="mr-2 h-4 w-4" />
            Export G703
          </Button>
          {isDraft && (
            <Button onClick={() => handleStatusChange('ACTIVE')}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Activate
            </Button>
          )}
          {sovData.status === 'ACTIVE' && (
            <Button variant="outline" onClick={() => handleStatusChange('CLOSED')}>
              <XCircle className="mr-2 h-4 w-4" />
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Original Contract</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(sovData.originalContractAmount)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Revised Contract</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(sovData.revisedContractAmount)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Billed to Date</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(sovData.totalBilledToDate)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overall Progress</CardDescription>
            <CardTitle className="text-2xl">{formatPercent(sovData.percentComplete)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Validation Alerts */}
      {validationResult && !validationResult.valid && (
        <Card className="mb-6 border-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-yellow-600">Validation Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1">
              {validationResult.errors?.map((error: { code: string; message: string }, i: number) => (
                <li key={i} className="text-red-600 text-sm">
                  {error.message}
                </li>
              ))}
              {validationResult.warnings?.map((warning: { code: string; message: string }, i: number) => (
                <li key={i} className="text-yellow-600 text-sm">
                  {warning.message}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="lines" className="space-y-4">
        <TabsList>
          <TabsTrigger value="lines">Lines ({lines.length})</TabsTrigger>
          <TabsTrigger value="change-orders">Change Orders ({changeOrders.length})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Lines Tab */}
        <TabsContent value="lines" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Schedule Lines</h2>
            {isDraft && (
              <Button onClick={() => setIsAddLineDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Line
              </Button>
            )}
          </div>

          <Table>
            <TableCaption>
              {lines.length === 0
                ? 'No lines yet. Add lines to build your schedule of values.'
                : 'Schedule of Values line items (AIA G703 format)'}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Item</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Scheduled Value</TableHead>
                <TableHead className="text-right">Previous</TableHead>
                <TableHead className="text-right">This Period</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Retainage</TableHead>
                {isDraft && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-medium">{line.itemNumber || line.lineNumber}</TableCell>
                  <TableCell>{line.description}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(line.revisedScheduledValue)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(
                      (line.previousWorkCompleted || 0) +
                        (line.previousMaterialsStored || 0)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(
                      (line.currentWorkCompleted || 0) +
                        (line.currentMaterialsStored || 0)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(line.totalCompletedAndStored)}
                  </TableCell>
                  <TableCell className="text-right">{formatPercent(line.percentComplete)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(line.balanceToFinish)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(line.retainageHeld)}</TableCell>
                  {isDraft && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
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
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {/* Totals Row */}
              {lines.length > 0 && (
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={2}>TOTALS</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalCurrent)}</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalCompleted)}</TableCell>
                  <TableCell className="text-right">{formatPercent(overallPercent)}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(totalCurrent - totalCompleted)}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(totalRetainage)}</TableCell>
                  {isDraft && <TableCell />}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        {/* Change Orders Tab */}
        <TabsContent value="change-orders" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Change Orders</h2>
            {(sovData.status === 'ACTIVE' || sovData.status === 'REVISED') && (
              <Button onClick={() => toast.info('Create change order feature coming soon')}>
                <Plus className="mr-2 h-4 w-4" />
                New Change Order
              </Button>
            )}
          </div>

          <Table>
            <TableCaption>
              {changeOrders.length === 0
                ? 'No change orders yet.'
                : 'List of change orders for this SOV'}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>CO Number</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Approved Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changeOrders.map((co) => (
                <TableRow key={co.id}>
                  <TableCell className="font-medium">{co.changeOrderNumber}</TableCell>
                  <TableCell>{co.description}</TableCell>
                  <TableCell className="text-right">{formatCurrency(co.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(co.status)}>{co.status}</Badge>
                  </TableCell>
                  <TableCell>{formatDate(co.effectiveDate)}</TableCell>
                  <TableCell>{formatDate(co.approvedDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SOV Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">SOV Number</p>
                  <p className="font-medium">{sovData.sovNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={getStatusBadgeVariant(sovData.status)}>{sovData.status}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Project ID</p>
                  <p className="font-medium">{sovData.projectId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Line Count</p>
                  <p className="font-medium">{sovData.lineCount} ({sovData.activeLineCount} active)</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Original Contract</p>
                  <p className="font-medium">{formatCurrency(sovData.originalContractAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Approved Change Orders</p>
                  <p className="font-medium">{formatCurrency(sovData.approvedChangeOrders)} ({sovData.approvedChangeOrderCount} orders)</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Change Orders</p>
                  <p className="font-medium">{formatCurrency(sovData.pendingChangeOrders)} ({sovData.pendingChangeOrderCount} orders)</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Revised Contract</p>
                  <p className="font-medium">{formatCurrency(sovData.revisedContractAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Scheduled Value</p>
                  <p className="font-medium">{formatCurrency(sovData.totalScheduledValue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Previously Billed</p>
                  <p className="font-medium">{formatCurrency(sovData.totalPreviouslyBilled)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Billing</p>
                  <p className="font-medium">{formatCurrency(sovData.totalCurrentBilling)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Billed to Date</p>
                  <p className="font-medium">{formatCurrency(sovData.totalBilledToDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Retainage Held</p>
                  <p className="font-medium">{formatCurrency(sovData.totalRetainageHeld)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Retainage Released</p>
                  <p className="font-medium">{formatCurrency(sovData.totalRetainageReleased)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Balance to Finish</p>
                  <p className="font-medium">{formatCurrency(sovData.balanceToFinish)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Percent Complete</p>
                  <p className="font-medium">{formatPercent(sovData.percentComplete)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Line Dialog */}
      <Dialog open={isAddLineDialogOpen} onOpenChange={setIsAddLineDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add Line Item</DialogTitle>
            <DialogDescription>
              Add a new line item to the Schedule of Values.
            </DialogDescription>
          </DialogHeader>
          <Form {...lineForm}>
            <form onSubmit={lineForm.handleSubmit(handleAddLine)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={lineForm.control}
                  name="itemNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={lineForm.control}
                  name="lineType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Line Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="LABOR">Labor</SelectItem>
                          <SelectItem value="MATERIAL">Material</SelectItem>
                          <SelectItem value="EQUIPMENT">Equipment</SelectItem>
                          <SelectItem value="SUBCONTRACT">Subcontract</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={lineForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description of Work</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Description of the work item..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={lineForm.control}
                  name="originalScheduledValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scheduled Value</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
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
                      <FormDescription>
                        Standard retainage is 10%
                      </FormDescription>
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
            <AlertDialogTitle>Delete Line Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete line {selectedLine?.itemNumber || selectedLine?.lineNumber} -
              "{selectedLine?.description}"? This action cannot be undone.
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
              {newStatus === 'ACTIVE' && (
                <span className="block mt-2 text-yellow-600">
                  Once activated, you cannot modify lines directly. Changes must be made through
                  change orders.
                </span>
              )}
              {newStatus === 'CLOSED' && (
                <span className="block mt-2 text-yellow-600">
                  Closing the SOV will prevent further billing against this schedule.
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
