'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
  Edit,
  Trash2,
  DollarSign,
  Timer,
  Briefcase,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { RouterOutputs } from '@glapi/trpc';

// Use TRPC inferred types to prevent type drift
type TimeEntry = RouterOutputs['timeEntries']['list']['data'][number];
type Project = RouterOutputs['projects']['list']['data'][number];
type Employee = RouterOutputs['employees']['list']['data'][number];

// Create form schema
const createTimeEntryFormSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  projectId: z.string().min(1, 'Project is required'),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  hours: z.coerce.number().positive('Hours must be positive').max(24, 'Max 24 hours'),
  entryType: z.enum(['REGULAR', 'OVERTIME', 'DOUBLE_TIME', 'OTHER']).default('REGULAR'),
  isBillable: z.boolean().default(true),
  description: z.string().max(500).optional(),
});

// Edit form schema (employee cannot be changed here)
const updateTimeEntryFormSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  hours: z.coerce.number().positive('Hours must be positive').max(24, 'Max 24 hours'),
  entryType: z.enum(['REGULAR', 'OVERTIME', 'DOUBLE_TIME', 'OTHER']).default('REGULAR'),
  isBillable: z.boolean().default(true),
  description: z.string().max(500).optional(),
});

type CreateTimeEntryFormValues = z.infer<typeof createTimeEntryFormSchema>;
type UpdateTimeEntryFormValues = z.infer<typeof updateTimeEntryFormSchema>;

const entryTypes = [
  { value: 'REGULAR', label: 'Regular' },
  { value: 'OVERTIME', label: 'Overtime' },
  { value: 'DOUBLE_TIME', label: 'Double Time' },
  { value: 'OTHER', label: 'Other' },
];

function ProjectTimePageContent() {
  const { orgId } = useAuth();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('projectId');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>(initialProjectId || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Get current week dates
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  // TRPC queries
  const { data: entriesData, isLoading, refetch } = trpc.timeEntries.list.useQuery(
    {
      page: 1,
      limit: 100,
      orderBy: 'entryDate',
      orderDirection: 'desc',
      filters: {
        projectId: projectFilter !== 'all' ? projectFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter as any : undefined,
      },
    },
    { enabled: !!orgId }
  );

  const { data: projectsData } = trpc.projects.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: !!orgId }
  );

  const { data: employeesData } = trpc.employees.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: !!orgId }
  );

  const { data: summaryData } = trpc.timeEntries.getSummaryByProject.useQuery(
    {
      startDate: startOfWeek.toISOString().split('T')[0],
      endDate: endOfWeek.toISOString().split('T')[0],
    },
    { enabled: !!orgId }
  );

  // TRPC mutations
  const createMutation = trpc.timeEntries.create.useMutation({
    onSuccess: () => {
      toast.success('Time entry created');
      setIsCreateOpen(false);
      createForm.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create time entry');
    },
  });

  const updateMutation = trpc.timeEntries.update.useMutation({
    onSuccess: () => {
      toast.success('Time entry updated');
      setIsEditOpen(false);
      setSelectedEntry(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update time entry');
    },
  });

  const deleteMutation = trpc.timeEntries.delete.useMutation({
    onSuccess: () => {
      toast.success('Time entry deleted');
      setIsDeleteOpen(false);
      setSelectedEntry(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete time entry');
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

  // Forms
  const createForm = useForm<CreateTimeEntryFormValues>({
    resolver: zodResolver(createTimeEntryFormSchema),
    defaultValues: {
      employeeId: '',
      projectId: '',
      entryDate: new Date().toISOString().split('T')[0],
      hours: 0,
      entryType: 'REGULAR',
      isBillable: true,
      description: '',
    },
  });

  const editForm = useForm<UpdateTimeEntryFormValues>({
    resolver: zodResolver(updateTimeEntryFormSchema),
    defaultValues: {
      projectId: '',
      entryDate: new Date().toISOString().split('T')[0],
      hours: 0,
      entryType: 'REGULAR',
      isBillable: true,
      description: '',
    },
  });

  // Data extraction
  const entries = entriesData?.data || [];
  const projects = projectsData?.data || [];
  const employees = employeesData?.data || [];

  // Calculate weekly totals
  const weeklyTotalHours = summaryData?.reduce(
    (sum: number, item: any) => sum + parseFloat(item.totalHours || '0'),
    0
  ) || 0;
  const weeklyBillableHours = summaryData?.reduce(
    (sum: number, item: any) => sum + parseFloat(item.billableHours || '0'),
    0
  ) || 0;

  // Handlers
  const handleCreateEntry = (data: CreateTimeEntryFormValues) => {
    createMutation.mutate({
      employeeId: data.employeeId,
      projectId: data.projectId,
      entryDate: data.entryDate,
      hours: String(data.hours),
      entryType: data.entryType,
      isBillable: data.isBillable,
      description: data.description || undefined,
    });
  };

  const handleEditEntry = (entry: TimeEntry) => {
    setSelectedEntry(entry);
    editForm.reset({
      projectId: entry.projectId || '',
      entryDate: entry.entryDate,
      hours: parseFloat(entry.hours),
      entryType: entry.entryType as any,
      isBillable: entry.isBillable,
      description: entry.description || '',
    });
    setIsEditOpen(true);
  };

  const handleUpdateEntry = (data: UpdateTimeEntryFormValues) => {
    if (!selectedEntry) return;
    updateMutation.mutate({
      id: selectedEntry.id,
      data: {
        projectId: data.projectId,
        entryDate: data.entryDate,
        hours: String(data.hours),
        entryType: data.entryType,
        isBillable: data.isBillable,
        description: data.description || null,
      },
    });
  };

  const handleDeleteEntry = () => {
    if (!selectedEntry) return;
    deleteMutation.mutate({ id: selectedEntry.id });
  };

  const handleSubmitEntries = () => {
    if (selectedEntries.length === 0) {
      toast.error('Please select entries to submit');
      return;
    }
    submitMutation.mutate({
      timeEntryIds: selectedEntries,
    });
  };

  const toggleEntrySelection = (entryId: string) => {
    setSelectedEntries((prev) =>
      prev.includes(entryId)
        ? prev.filter((id) => id !== entryId)
        : [...prev, entryId]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="outline"><Edit className="h-3 w-3 mr-1" />Draft</Badge>;
      case 'SUBMITTED':
        return <Badge className="bg-blue-100 text-blue-800"><Send className="h-3 w-3 mr-1" />Submitted</Badge>;
      case 'APPROVED':
        return <Badge className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-800"><X className="h-3 w-3 mr-1" />Rejected</Badge>;
      case 'POSTED':
        return <Badge className="bg-purple-100 text-purple-800"><Check className="h-3 w-3 mr-1" />Posted</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select an organization</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Project Time Tracking</h1>
          <p className="text-muted-foreground">Log and manage time entries for projects</p>
        </div>
        <div className="flex gap-2">
          {selectedEntries.length > 0 && (
            <Button variant="outline" onClick={handleSubmitEntries}>
              <Send className="mr-2 h-4 w-4" />
              Submit Selected ({selectedEntries.length})
            </Button>
          )}
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Log Time
          </Button>
        </div>
      </div>

      {/* Weekly Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weeklyTotalHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">Total hours logged</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Billable Hours</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weeklyBillableHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">
              {weeklyTotalHours > 0
                ? `${((weeklyBillableHours / weeklyTotalHours) * 100).toFixed(0)}% billable`
                : '0% billable'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData?.length || 0}</div>
            <p className="text-xs text-muted-foreground">With time this week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {entries.filter((e: TimeEntry) => e.status === 'DRAFT').length}
            </div>
            <p className="text-xs text-muted-foreground">Draft entries to submit</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((project: Project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Time Entries Table */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <Table>
          <TableCaption>Time entries for projects</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead>Billable</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No time entries found. Log your first time entry to get started.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry: TimeEntry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    {entry.status === 'DRAFT' && (
                      <Checkbox
                        checked={selectedEntries.includes(entry.id)}
                        onCheckedChange={() => toggleEntrySelection(entry.id)}
                      />
                    )}
                  </TableCell>
                  <TableCell>{formatDate(entry.entryDate)}</TableCell>
                  <TableCell className="font-medium">
                    {entry.projectId ? projects.find(p => p.id === entry.projectId)?.name || 'Unknown' : 'No Project'}
                  </TableCell>
                  <TableCell className="capitalize">
                    {entry.entryType.toLowerCase().replace('_', ' ')}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {parseFloat(entry.hours).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {entry.isBillable ? (
                      <Badge variant="outline" className="text-green-600">
                        <DollarSign className="h-3 w-3 mr-1" />Yes
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-500">No</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {entry.description || '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(entry.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {entry.status === 'DRAFT' && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditEntry(entry)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedEntry(entry);
                              setIsDeleteOpen(true);
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* Create Time Entry Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Time</DialogTitle>
            <DialogDescription>
              Record time spent on a project
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateEntry)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an employee" />
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
                control={createForm.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projects.map((project: Project) => (
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="entryDate"
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
                  control={createForm.control}
                  name="hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hours *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.25"
                          min="0.25"
                          max="24"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="entryType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {entryTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="isBillable"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-8">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Billable</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What did you work on?"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Saving...' : 'Save Entry'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Time Entry Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdateEntry)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projects.map((project: Project) => (
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="entryDate"
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
                  control={editForm.control}
                  name="hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hours *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.25"
                          min="0.25"
                          max="24"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="entryType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {entryTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="isBillable"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-8">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Billable</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What did you work on?"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Update Entry'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this time entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEntry}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Wrap in Suspense for useSearchParams() compatibility with Next.js 15 static generation
export default function ProjectTimePage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    }>
      <ProjectTimePageContent />
    </Suspense>
  );
}
