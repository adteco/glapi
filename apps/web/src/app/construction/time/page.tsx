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
  Clock,
  Calendar,
  Check,
  X,
  Send,
  RotateCcw,
  Filter,
  ChevronLeft,
  ChevronRight,
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
import type { RouterOutputs } from '@glapi/trpc';

// Use TRPC inferred types to prevent type drift
type TimeEntry = RouterOutputs['timeEntries']['list']['data'][number];

// Form schema for creating time entry
const createTimeEntrySchema = z.object({
  projectId: z.string().uuid().optional().or(z.literal('')),
  costCodeId: z.string().uuid().optional().or(z.literal('')),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  hours: z.coerce.number().positive('Hours must be positive').max(24, 'Max 24 hours'),
  entryType: z.enum(['REGULAR', 'OVERTIME', 'DOUBLE_TIME', 'PTO', 'SICK', 'HOLIDAY', 'OTHER']),
  description: z.string().max(500).optional(),
  isBillable: z.boolean().default(true),
});

type CreateTimeEntryFormValues = z.infer<typeof createTimeEntrySchema>;

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
    case 'POSTED':
      return 'default';
    default:
      return 'outline';
  }
}

// Format helpers
function formatDate(date: string | Date | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
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

// Get week start/end
function getWeekRange(date: Date): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

export default function TimeEntriesPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [activeTab, setActiveTab] = useState('list');
  const { orgId } = useAuth();

  const weekRange = useMemo(() => getWeekRange(currentWeek), [currentWeek]);

  // TRPC queries
  const {
    data: entriesData,
    isLoading,
    refetch,
  } = trpc.timeEntries.list.useQuery(
    {
      filters: {
        ...(statusFilter ? { status: statusFilter as any } : {}),
        ...(projectFilter ? { projectId: projectFilter } : {}),
        ...(activeTab === 'weekly' ? { startDate: weekRange.start, endDate: weekRange.end } : {}),
      },
      orderBy: 'entryDate',
      orderDirection: 'desc',
      limit: 100,
    },
    { enabled: !!orgId }
  );

  const { data: pendingApprovalsData, refetch: refetchPending } =
    trpc.timeEntries.getPendingApprovals.useQuery({}, { enabled: !!orgId });

  const { data: projectsData } = trpc.projects.list.useQuery(
    { filters: { status: 'active' } },
    { enabled: !!orgId }
  );

  const { data: costCodesData } = trpc.projectCostCodes.list.useQuery({}, { enabled: !!orgId });

  const createMutation = trpc.timeEntries.create.useMutation({
    onSuccess: () => {
      toast.success('Time entry created successfully');
      setIsCreateDialogOpen(false);
      form.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create time entry');
    },
  });

  const submitMutation = trpc.timeEntries.submit.useMutation({
    onSuccess: () => {
      toast.success('Time entries submitted for approval');
      setSelectedEntries([]);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to submit time entries');
    },
  });

  const approveMutation = trpc.timeEntries.approve.useMutation({
    onSuccess: () => {
      toast.success('Time entries approved');
      setSelectedEntries([]);
      refetch();
      refetchPending();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to approve time entries');
    },
  });

  const rejectMutation = trpc.timeEntries.reject.useMutation({
    onSuccess: () => {
      toast.success('Time entries rejected');
      setSelectedEntries([]);
      setIsRejectDialogOpen(false);
      setRejectionReason('');
      refetch();
      refetchPending();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reject time entries');
    },
  });

  const returnToDraftMutation = trpc.timeEntries.returnToDraft.useMutation({
    onSuccess: () => {
      toast.success('Time entries returned to draft');
      setSelectedEntries([]);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to return time entries to draft');
    },
  });

  const deleteMutation = trpc.timeEntries.delete.useMutation({
    onSuccess: () => {
      toast.success('Time entry deleted');
      setSelectedEntries([]);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete time entry');
    },
  });

  const entries = (entriesData?.data as TimeEntry[] | undefined) || [];
  const pendingApprovals = (pendingApprovalsData?.data || []) as TimeEntry[];
  const projects = (projectsData?.data || []) as Array<{ id: string; name: string; projectCode: string }>;
  const costCodes = (costCodesData?.data || []) as Array<{ id: string; costCode: string; name: string }>;

  // Weekly summary calculations
  const weeklySummary = useMemo(() => {
    const weekEntries = entries.filter((e) => {
      const entryDate = new Date(e.entryDate);
      const start = new Date(weekRange.start);
      const end = new Date(weekRange.end);
      return entryDate >= start && entryDate <= end;
    });

    const totalHours = weekEntries.reduce((sum, e) => sum + parseFloat(e.hours || '0'), 0);
    const billableHours = weekEntries
      .filter((e) => e.isBillable)
      .reduce((sum, e) => sum + parseFloat(e.hours || '0'), 0);
    const totalCost = weekEntries.reduce((sum, e) => sum + parseFloat(e.totalCost || '0'), 0);

    return { totalHours, billableHours, totalCost, entryCount: weekEntries.length };
  }, [entries, weekRange]);

  const form = useForm<CreateTimeEntryFormValues>({
    resolver: zodResolver(createTimeEntrySchema),
    defaultValues: {
      projectId: '',
      costCodeId: '',
      entryDate: new Date().toISOString().split('T')[0],
      hours: 8,
      entryType: 'REGULAR',
      description: '',
      isBillable: true,
    },
  });

  const handleCreate = async (values: CreateTimeEntryFormValues) => {
    createMutation.mutate({
      projectId: values.projectId || undefined,
      costCodeId: values.costCodeId || undefined,
      entryDate: values.entryDate,
      hours: values.hours.toString(),
      entryType: values.entryType,
      description: values.description || undefined,
      isBillable: values.isBillable,
    });
  };

  const handleSubmit = () => {
    if (selectedEntries.length === 0) {
      toast.error('Select time entries to submit');
      return;
    }
    submitMutation.mutate({ timeEntryIds: selectedEntries });
  };

  const handleApprove = () => {
    if (selectedEntries.length === 0) {
      toast.error('Select time entries to approve');
      return;
    }
    approveMutation.mutate({ timeEntryIds: selectedEntries });
  };

  const handleReject = () => {
    if (selectedEntries.length === 0) {
      toast.error('Select time entries to reject');
      return;
    }
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    rejectMutation.mutate({ timeEntryIds: selectedEntries, reason: rejectionReason });
  };

  const handleReturnToDraft = () => {
    if (selectedEntries.length === 0) {
      toast.error('Select time entries to return to draft');
      return;
    }
    returnToDraftMutation.mutate({ timeEntryIds: selectedEntries });
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

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + (direction === 'prev' ? -7 : 7));
      return d;
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <p>Loading time entries...</p>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view time entries.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Time Entries</h1>
          <p className="text-muted-foreground mt-1">Track and manage employee time entries</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Entry
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>This Week</CardDescription>
            <CardTitle className="text-2xl">{weeklySummary.totalHours.toFixed(1)} hrs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {weeklySummary.entryCount} entries logged
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Billable Hours</CardDescription>
            <CardTitle className="text-2xl">{weeklySummary.billableHours.toFixed(1)} hrs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {weeklySummary.totalHours > 0
                ? ((weeklySummary.billableHours / weeklySummary.totalHours) * 100).toFixed(0)
                : 0}
              % utilization
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Labor Cost</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(weeklySummary.totalCost)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Including burden</p>
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
            <Clock className="h-4 w-4 mr-2" />
            All Entries
          </TabsTrigger>
          <TabsTrigger value="weekly">
            <Calendar className="h-4 w-4 mr-2" />
            Weekly View
          </TabsTrigger>
          <TabsTrigger value="approvals">
            <Check className="h-4 w-4 mr-2" />
            Approvals ({pendingApprovals.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-center">
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
                <SelectItem value="POSTED">Posted</SelectItem>
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
              <span className="text-sm font-medium mr-4">
                {selectedEntries.length} selected
              </span>
              <Button size="sm" variant="outline" onClick={handleSubmit}>
                <Send className="h-4 w-4 mr-1" />
                Submit
              </Button>
              <Button size="sm" variant="outline" onClick={handleReturnToDraft}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Return to Draft
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedEntries([])}
              >
                Clear Selection
              </Button>
            </div>
          )}

          {/* Table */}
          <Table>
            <TableCaption>
              {entries.length === 0
                ? 'No time entries found. Create one to get started.'
                : `Showing ${entries.length} time entries.`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      selectedEntries.length > 0 &&
                      selectedEntries.length ===
                        entries.filter((e) => e.status === 'DRAFT' || e.status === 'SUBMITTED')
                          .length
                    }
                    onCheckedChange={selectAllEntries}
                  />
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Cost</TableHead>
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
                  <TableCell className="font-medium">{formatDate(entry.entryDate)}</TableCell>
                  <TableCell>
                    {entry.projectId
                      ? projects.find((p) => p.id === entry.projectId)?.projectCode || 'Unknown'
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{entry.entryType}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{entry.hours}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {entry.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(entry.status)}>{entry.status}</Badge>
                    {entry.status === 'REJECTED' && entry.rejectionReason && (
                      <p className="text-xs text-destructive mt-1">{entry.rejectionReason}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(entry.totalCost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="weekly" className="space-y-4">
          {/* Week Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="text-center">
              <h3 className="font-semibold">
                Week of {formatDate(weekRange.start)} - {formatDate(weekRange.end)}
              </h3>
              <p className="text-sm text-muted-foreground">
                {weeklySummary.totalHours.toFixed(1)} hours total
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Weekly Entries Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries
                .filter((e) => {
                  const entryDate = new Date(e.entryDate);
                  const start = new Date(weekRange.start);
                  const end = new Date(weekRange.end);
                  return entryDate >= start && entryDate <= end;
                })
                .map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{formatDate(entry.entryDate)}</TableCell>
                    <TableCell>
                      {entry.projectId
                        ? projects.find((p) => p.id === entry.projectId)?.projectCode || 'Unknown'
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.entryType}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{entry.hours}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {entry.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(entry.status)}>{entry.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4">
          {/* Approval Actions */}
          {selectedEntries.length > 0 && (
            <div className="flex gap-2 p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium mr-4">
                {selectedEntries.length} selected
              </span>
              <Button size="sm" variant="default" onClick={handleApprove}>
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setIsRejectDialogOpen(true)}
              >
                <X className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedEntries([])}
              >
                Clear Selection
              </Button>
            </div>
          )}

          <Table>
            <TableCaption>
              {pendingApprovals.length === 0
                ? 'No pending approvals.'
                : `${pendingApprovals.length} entries awaiting approval.`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      pendingApprovals.length > 0 &&
                      selectedEntries.length === pendingApprovals.length
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
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead>Description</TableHead>
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
                  <TableCell className="font-medium">{formatDate(entry.entryDate)}</TableCell>
                  <TableCell>{entry.employeeId.slice(0, 8)}...</TableCell>
                  <TableCell>
                    {entry.projectId
                      ? projects.find((p) => p.id === entry.projectId)?.projectCode || 'Unknown'
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono">{entry.hours}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {entry.description || '-'}
                  </TableCell>
                  <TableCell>{formatDate(entry.submittedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      {/* Create Time Entry Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Time Entry</DialogTitle>
            <DialogDescription>
              Log time for a project or general work.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
              <FormField
                control={form.control}
                name="entryDate"
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hours</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.25" min="0" max="24" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="entryType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="REGULAR">Regular</SelectItem>
                          <SelectItem value="OVERTIME">Overtime</SelectItem>
                          <SelectItem value="DOUBLE_TIME">Double Time</SelectItem>
                          <SelectItem value="PTO">PTO</SelectItem>
                          <SelectItem value="SICK">Sick</SelectItem>
                          <SelectItem value="HOLIDAY">Holiday</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What did you work on?"
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
                name="isBillable"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Billable</FormLabel>
                      <FormDescription>Mark this time as billable to the client</FormDescription>
                    </div>
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
                  {createMutation.isPending ? 'Creating...' : 'Create Entry'}
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
            <AlertDialogTitle>Reject Time Entries</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting {selectedEntries.length} time{' '}
              {selectedEntries.length === 1 ? 'entry' : 'entries'}.
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
