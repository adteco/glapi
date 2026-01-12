'use client';

import { useState, useRef, useCallback } from 'react';
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
import { Plus, Eye, Edit, Trash2, FileDown, FileUp, Upload, AlertCircle } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
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

// Types for SOV
interface ScheduleOfValues {
  id: string;
  organizationId: string;
  projectId: string;
  sovNumber: string;
  version: number;
  status: 'DRAFT' | 'ACTIVE' | 'REVISED' | 'CLOSED';
  description?: string | null;
  originalContractAmount: string;
  currentContractAmount: string;
  defaultRetainagePercent?: string | null;
  retainageCapAmount?: string | null;
  effectiveDate?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Form schema for creating SOV
const createSovSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  description: z.string().max(500).optional(),
  originalContractAmount: z.coerce.number().nonnegative('Amount must be non-negative'),
  defaultRetainagePercent: z.coerce.number().min(0).max(100).optional(),
  retainageCapAmount: z.coerce.number().nonnegative().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
});

type CreateSovFormValues = z.infer<typeof createSovSchema>;

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

// CSV Import Types
interface CsvPreviewData {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export default function ScheduleOfValuesPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedSov, setSelectedSov] = useState<ScheduleOfValues | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [importProjectId, setImportProjectId] = useState('');
  const [importHasHeaders, setImportHasHeaders] = useState(true);
  const [csvData, setCsvData] = useState<string>('');
  const [csvPreview, setCsvPreview] = useState<CsvPreviewData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { orgId } = useAuth();

  // TRPC queries
  const {
    data: sovsData,
    isLoading,
    refetch,
  } = trpc.scheduleOfValues.list.useQuery(
    {
      filters: statusFilter ? { status: statusFilter as 'DRAFT' | 'ACTIVE' | 'REVISED' | 'CLOSED' } : undefined,
    },
    {
      enabled: !!orgId,
    }
  );

  const createMutation = trpc.scheduleOfValues.create.useMutation({
    onSuccess: () => {
      toast.success('Schedule of Values created successfully');
      setIsCreateDialogOpen(false);
      form.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create Schedule of Values');
    },
  });

  const deleteMutation = trpc.scheduleOfValues.delete.useMutation({
    onSuccess: () => {
      toast.success('Schedule of Values deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedSov(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete Schedule of Values');
    },
  });

  const importMutation = trpc.scheduleOfValues.import.useMutation({
    onSuccess: (result) => {
      toast.success(`Successfully imported SOV with ${result.linesImported} lines`);
      if (result.warnings && result.warnings.length > 0) {
        toast.warning(`${result.warnings.length} warnings during import`);
      }
      setIsImportDialogOpen(false);
      resetImportState();
      refetch();
    },
    onError: (error) => {
      setImportError(error.message || 'Failed to import Schedule of Values');
    },
  });

  const sovs = (sovsData?.data as ScheduleOfValues[] | undefined) || [];

  // Reset import state
  const resetImportState = useCallback(() => {
    setCsvData('');
    setCsvPreview(null);
    setImportProjectId('');
    setImportHasHeaders(true);
    setImportError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Parse CSV for preview
  const parseCsvForPreview = useCallback((content: string, hasHeaders: boolean): CsvPreviewData => {
    const lines = content.split('\n').filter(line => line.trim());
    const allRows = lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });

    const headers = hasHeaders && allRows.length > 0 ? allRows[0] : [];
    const dataRows = hasHeaders ? allRows.slice(1) : allRows;

    return {
      headers,
      rows: dataRows.slice(0, 5), // Preview first 5 rows
      totalRows: dataRows.length,
    };
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setImportError('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvData(content);
      setCsvPreview(parseCsvForPreview(content, importHasHeaders));
      setImportError(null);
    };
    reader.onerror = () => {
      setImportError('Failed to read file');
    };
    reader.readAsText(file);
  }, [importHasHeaders, parseCsvForPreview]);

  // Handle import
  const handleImport = useCallback(() => {
    if (!importProjectId) {
      setImportError('Project ID is required');
      return;
    }
    if (!csvData) {
      setImportError('Please upload a CSV file');
      return;
    }

    importMutation.mutate({
      projectId: importProjectId,
      csvData,
      hasHeaders: importHasHeaders,
    });
  }, [importProjectId, csvData, importHasHeaders, importMutation]);

  // Export SOV list to CSV
  const handleExportList = useCallback(() => {
    if (sovs.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['SOV Number', 'Description', 'Status', 'Original Amount', 'Current Amount', 'Effective Date'];
    const rows = sovs.map(sov => [
      sov.sovNumber,
      sov.description || '',
      sov.status,
      sov.originalContractAmount,
      sov.currentContractAmount,
      sov.effectiveDate || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sov-list-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Export completed');
  }, [sovs]);

  const form = useForm<CreateSovFormValues>({
    resolver: zodResolver(createSovSchema),
    defaultValues: {
      projectId: '',
      description: '',
      originalContractAmount: 0,
      defaultRetainagePercent: 10,
      retainageCapAmount: undefined,
      effectiveDate: '',
    },
  });

  const handleCreateSov = async (values: CreateSovFormValues) => {
    createMutation.mutate({
      projectId: values.projectId,
      description: values.description || undefined,
      originalContractAmount: values.originalContractAmount,
      defaultRetainagePercent: values.defaultRetainagePercent,
      retainageCapAmount: values.retainageCapAmount,
      effectiveDate: values.effectiveDate || undefined,
    });
  };

  const handleDeleteSov = async () => {
    if (!selectedSov) return;
    deleteMutation.mutate({ id: selectedSov.id });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <p>Loading schedules of values...</p>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view schedules of values.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Schedule of Values</h1>
          <p className="text-muted-foreground mt-1">
            Manage construction billing schedules and AIA G702/G703 documents
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportList}>
            <FileDown className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            <FileUp className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New SOV
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
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="REVISED">Revised</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Table>
        <TableCaption>
          {sovs.length === 0
            ? 'No schedules of values found. Create one to get started.'
            : 'A list of your organization\'s schedules of values.'}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>SOV Number</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Original Amount</TableHead>
            <TableHead className="text-right">Current Amount</TableHead>
            <TableHead>Effective Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sovs.map((sov) => (
            <TableRow key={sov.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/construction/sov/${sov.id}`}
                  className="text-primary hover:underline"
                >
                  {sov.sovNumber}
                </Link>
              </TableCell>
              <TableCell>{sov.description || '-'}</TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(sov.status)}>{sov.status}</Badge>
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(sov.originalContractAmount)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(sov.currentContractAmount)}
              </TableCell>
              <TableCell>{formatDate(sov.effectiveDate)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/construction/sov/${sov.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  {sov.status === 'DRAFT' && (
                    <>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/construction/sov/${sov.id}/edit`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedSov(sov);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                  >
                    <Link href={`/construction/sov/${sov.id}?tab=details&export=g703`}>
                      <FileDown className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Create SOV Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create Schedule of Values</DialogTitle>
            <DialogDescription>
              Create a new Schedule of Values for a construction project. This will be used for AIA
              G702/G703 billing.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateSov)} className="space-y-4">
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
                      The project this SOV is associated with
                    </FormDescription>
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
                        placeholder="Brief description of this SOV..."
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
                  control={form.control}
                  name="originalContractAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Original Contract Amount</FormLabel>
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
                  control={form.control}
                  name="defaultRetainagePercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Retainage %</FormLabel>
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="retainageCapAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retainage Cap Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Optional"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription>Maximum retainage to hold</FormDescription>
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
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create SOV'}
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
            <AlertDialogTitle>Delete Schedule of Values</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete SOV {selectedSov?.sovNumber}? This action cannot be
              undone and will delete all associated lines.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSov}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import CSV Dialog */}
      <Dialog
        open={isImportDialogOpen}
        onOpenChange={(open) => {
          setIsImportDialogOpen(open);
          if (!open) resetImportState();
        }}
      >
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Import Schedule of Values</DialogTitle>
            <DialogDescription>
              Import SOV lines from a CSV file. The CSV should contain columns for line number,
              description, and scheduled value at minimum.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {importError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="importProjectId">Project ID</Label>
              <Input
                id="importProjectId"
                placeholder="Enter project UUID"
                value={importProjectId}
                onChange={(e) => setImportProjectId(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                The project this SOV will be associated with
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="hasHeaders"
                checked={importHasHeaders}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setImportHasHeaders(checked);
                  if (csvData) {
                    setCsvPreview(parseCsvForPreview(csvData, checked));
                  }
                }}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="hasHeaders">First row contains headers</Label>
            </div>

            <div className="space-y-2">
              <Label>CSV File</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                {csvPreview ? (
                  <p className="text-sm text-foreground">
                    File loaded: {csvPreview.totalRows} rows
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Click to upload or drag and drop a CSV file
                  </p>
                )}
              </div>
            </div>

            {csvPreview && (
              <div className="space-y-2">
                <Label>Preview (first 5 rows)</Label>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    {csvPreview.headers.length > 0 && (
                      <TableHeader>
                        <TableRow>
                          {csvPreview.headers.map((header, idx) => (
                            <TableHead key={idx} className="whitespace-nowrap">
                              {header}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                    )}
                    <TableBody>
                      {csvPreview.rows.map((row, rowIdx) => (
                        <TableRow key={rowIdx}>
                          {row.map((cell, cellIdx) => (
                            <TableCell key={cellIdx} className="whitespace-nowrap">
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-sm text-muted-foreground">
                  Showing {csvPreview.rows.length} of {csvPreview.totalRows} rows
                </p>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Expected CSV Format</h4>
              <p className="text-sm text-muted-foreground mb-2">
                The CSV should contain the following columns (in order):
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Line Number (integer)</li>
                <li>Item Number (optional, string)</li>
                <li>Description (required, string)</li>
                <li>Scheduled Value (required, decimal)</li>
                <li>Retainage Percent (optional, decimal, 0-100)</li>
              </ul>
            </div>

            {importMutation.isPending && (
              <div className="space-y-2">
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary animate-pulse w-full" />
                </div>
                <p className="text-sm text-center text-muted-foreground">Importing...</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsImportDialogOpen(false);
                resetImportState();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={importMutation.isPending || !csvData || !importProjectId}
            >
              {importMutation.isPending ? 'Importing...' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
