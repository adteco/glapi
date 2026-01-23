'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import {
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, parseISO, isValid } from 'date-fns';
import type { RouterOutputs } from '@glapi/trpc';

// Use TRPC inferred types to prevent type drift
type TimeEntryFromAPI = RouterOutputs['timeEntries']['list']['data'][number];
type TimeEntry = TimeEntryFromAPI;

type TimeEntryStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'POSTED' | 'CANCELLED';
type TimeEntryType = 'REGULAR' | 'OVERTIME' | 'DOUBLE_TIME' | 'PTO' | 'SICK' | 'HOLIDAY' | 'OTHER';

const STATUS_COLORS: Record<TimeEntryStatus, string> = {
  DRAFT: 'secondary',
  SUBMITTED: 'default',
  APPROVED: 'default',
  REJECTED: 'destructive',
  POSTED: 'default',
  CANCELLED: 'secondary',
};

const STATUS_LABELS: Record<TimeEntryStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled',
};

const ENTRY_TYPE_LABELS: Record<TimeEntryType, string> = {
  REGULAR: 'Regular',
  OVERTIME: 'Overtime',
  DOUBLE_TIME: 'Double Time',
  PTO: 'PTO',
  SICK: 'Sick',
  HOLIDAY: 'Holiday',
  OTHER: 'Other',
};

export default function TimeEntriesPage() {
  const { orgId } = useAuth();
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'my-time' | 'approvals'>('my-time');
  const [statusFilter, setStatusFilter] = useState<TimeEntryStatus | 'ALL'>('ALL');

  const weekEnd = endOfWeek(selectedWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: selectedWeekStart, end: weekEnd });

  const [formData, setFormData] = useState({
    projectId: '',
    costCodeId: '',
    entryDate: format(new Date(), 'yyyy-MM-dd'),
    hours: '',
    entryType: 'REGULAR' as TimeEntryType,
    description: '',
    isBillable: true,
  });

  const [editFormData, setEditFormData] = useState({
    projectId: '',
    costCodeId: '',
    entryDate: '',
    hours: '',
    entryType: 'REGULAR' as TimeEntryType,
    description: '',
    isBillable: true,
  });

  // TRPC queries
  const {
    data: entriesData,
    isLoading,
    refetch,
  } = trpc.timeEntries.list.useQuery(
    {
      filters: {
        startDate: format(selectedWeekStart, 'yyyy-MM-dd'),
        endDate: format(weekEnd, 'yyyy-MM-dd'),
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      },
      orderBy: 'entryDate',
      orderDirection: 'asc',
    },
    {
      enabled: !!orgId,
    }
  );

  const { data: pendingApprovals, refetch: refetchApprovals } = trpc.timeEntries.getPendingApprovals.useQuery(
    {},
    {
      enabled: !!orgId && activeTab === 'approvals',
    }
  );

  // TRPC mutations
  const createMutation = trpc.timeEntries.create.useMutation({
    onSuccess: () => {
      toast.success('Time entry created');
      setIsCreateOpen(false);
      resetForm();
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
      refetchApprovals();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to approve time entries');
    },
  });

  const rejectMutation = trpc.timeEntries.reject.useMutation({
    onSuccess: () => {
      toast.success('Time entries rejected');
      setSelectedEntries([]);
      refetchApprovals();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reject time entries');
    },
  });

  const deleteMutation = trpc.timeEntries.delete.useMutation({
    onSuccess: () => {
      toast.success('Time entry deleted');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete time entry');
    },
  });

  const updateMutation = trpc.timeEntries.update.useMutation({
    onSuccess: () => {
      toast.success('Time entry updated');
      setIsEditOpen(false);
      setEditingEntry(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update time entry');
    },
  });

  const entries = entriesData?.data || [];
  const pendingList = pendingApprovals?.data || [];

  const handleCreate = async () => {
    if (!formData.hours || !formData.entryDate) {
      toast.error('Hours and date are required');
      return;
    }

    createMutation.mutate({
      projectId: formData.projectId || undefined,
      costCodeId: formData.costCodeId || undefined,
      entryDate: formData.entryDate,
      hours: formData.hours,
      entryType: formData.entryType,
      description: formData.description || undefined,
      isBillable: formData.isBillable,
    });
  };

  const handleSubmit = () => {
    if (selectedEntries.length === 0) {
      toast.error('Please select time entries to submit');
      return;
    }
    submitMutation.mutate({ timeEntryIds: selectedEntries });
  };

  const handleApprove = () => {
    if (selectedEntries.length === 0) {
      toast.error('Please select time entries to approve');
      return;
    }
    approveMutation.mutate({ timeEntryIds: selectedEntries });
  };

  const handleReject = () => {
    if (selectedEntries.length === 0) {
      toast.error('Please select time entries to reject');
      return;
    }
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    rejectMutation.mutate({ timeEntryIds: selectedEntries, reason });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this time entry?')) return;
    deleteMutation.mutate({ id });
  };

  const handleEdit = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setEditFormData({
      projectId: entry.projectId || '',
      costCodeId: entry.costCodeId || '',
      entryDate: entry.entryDate,
      hours: entry.hours,
      entryType: entry.entryType,
      description: entry.description || '',
      isBillable: entry.isBillable,
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingEntry) return;
    if (!editFormData.hours || !editFormData.entryDate) {
      toast.error('Hours and date are required');
      return;
    }

    updateMutation.mutate({
      id: editingEntry.id,
      data: {
        projectId: editFormData.projectId || null,
        costCodeId: editFormData.costCodeId || null,
        entryDate: editFormData.entryDate,
        hours: editFormData.hours,
        entryType: editFormData.entryType,
        description: editFormData.description || null,
        isBillable: editFormData.isBillable,
      },
    });
  };

  const toggleEntrySelection = (id: string) => {
    setSelectedEntries((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  };

  const selectAllDraftEntries = () => {
    const draftIds = entries.filter((e) => e.status === 'DRAFT').map((e) => e.id);
    setSelectedEntries(draftIds);
  };

  const resetForm = () => {
    setFormData({
      projectId: '',
      costCodeId: '',
      entryDate: format(new Date(), 'yyyy-MM-dd'),
      hours: '',
      entryType: 'REGULAR',
      description: '',
      isBillable: true,
    });
  };

  const goToPreviousWeek = () => setSelectedWeekStart(subWeeks(selectedWeekStart, 1));
  const goToNextWeek = () => setSelectedWeekStart(addWeeks(selectedWeekStart, 1));
  const goToCurrentWeek = () => setSelectedWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const getTotalHoursForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return entries
      .filter((e) => e.entryDate === dateStr)
      .reduce((sum, e) => sum + parseFloat(e.hours || '0'), 0)
      .toFixed(2);
  };

  const getTotalHoursForWeek = () => {
    return entries.reduce((sum, e) => sum + parseFloat(e.hours || '0'), 0).toFixed(2);
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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'my-time' | 'approvals')}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Time Tracking</h1>
            <p className="text-muted-foreground">Manage employee time entries and approvals</p>
          </div>
          <TabsList>
            <TabsTrigger value="my-time">
              <Clock className="mr-2 h-4 w-4" />
              My Time
            </TabsTrigger>
            <TabsTrigger value="approvals">
              <CheckCircle className="mr-2 h-4 w-4" />
              Approvals
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="my-time">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-center">
                    <CardTitle className="text-lg">
                      {format(selectedWeekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                    </CardTitle>
                    <CardDescription>Week Total: {getTotalHoursForWeek()} hours</CardDescription>
                  </div>
                  <Button variant="outline" size="icon" onClick={goToNextWeek}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={goToCurrentWeek}>
                    Today
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as TimeEntryStatus | 'ALL')}
                  >
                    <SelectTrigger className="w-[150px]">
                      <Filter className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Status</SelectItem>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="SUBMITTED">Submitted</SelectItem>
                      <SelectItem value="APPROVED">Approved</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                      <SelectItem value="POSTED">Posted</SelectItem>
                    </SelectContent>
                  </Select>

                  <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={resetForm}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Entry
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Create Time Entry</DialogTitle>
                        <DialogDescription>Log your hours for a project</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="entryDate">Date*</Label>
                            <Input
                              id="entryDate"
                              type="date"
                              value={formData.entryDate}
                              onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="hours">Hours*</Label>
                            <Input
                              id="hours"
                              type="number"
                              step="0.25"
                              min="0"
                              max="24"
                              value={formData.hours}
                              onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                              placeholder="8.00"
                              required
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="entryType">Entry Type</Label>
                            <Select
                              value={formData.entryType}
                              onValueChange={(v) => setFormData({ ...formData, entryType: v as TimeEntryType })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(ENTRY_TYPE_LABELS).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="isBillable">Billable</Label>
                            <Select
                              value={formData.isBillable ? 'true' : 'false'}
                              onValueChange={(v) => setFormData({ ...formData, isBillable: v === 'true' })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="true">Yes</SelectItem>
                                <SelectItem value="false">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="projectId">Project ID (optional)</Label>
                          <Input
                            id="projectId"
                            value={formData.projectId}
                            onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                            placeholder="Enter project UUID"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="What did you work on?"
                            rows={3}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleCreate}>Create</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Edit Dialog */}
                  <Dialog open={isEditOpen} onOpenChange={(open) => {
                    setIsEditOpen(open);
                    if (!open) setEditingEntry(null);
                  }}>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Edit Time Entry</DialogTitle>
                        <DialogDescription>Update your time entry details</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="editEntryDate">Date*</Label>
                            <Input
                              id="editEntryDate"
                              type="date"
                              value={editFormData.entryDate}
                              onChange={(e) => setEditFormData({ ...editFormData, entryDate: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="editHours">Hours*</Label>
                            <Input
                              id="editHours"
                              type="number"
                              step="0.25"
                              min="0"
                              max="24"
                              value={editFormData.hours}
                              onChange={(e) => setEditFormData({ ...editFormData, hours: e.target.value })}
                              placeholder="8.00"
                              required
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="editEntryType">Entry Type</Label>
                            <Select
                              value={editFormData.entryType}
                              onValueChange={(v) => setEditFormData({ ...editFormData, entryType: v as TimeEntryType })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(ENTRY_TYPE_LABELS).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="editIsBillable">Billable</Label>
                            <Select
                              value={editFormData.isBillable ? 'true' : 'false'}
                              onValueChange={(v) => setEditFormData({ ...editFormData, isBillable: v === 'true' })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="true">Yes</SelectItem>
                                <SelectItem value="false">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="editProjectId">Project ID (optional)</Label>
                          <Input
                            id="editProjectId"
                            value={editFormData.projectId}
                            onChange={(e) => setEditFormData({ ...editFormData, projectId: e.target.value })}
                            placeholder="Enter project UUID"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="editDescription">Description</Label>
                          <Textarea
                            id="editDescription"
                            value={editFormData.description}
                            onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                            placeholder="What did you work on?"
                            rows={3}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleUpdate}>Save Changes</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Weekly summary header */}
              <div className="grid grid-cols-7 gap-2 mb-4 text-center text-sm">
                {weekDays.map((day: Date) => (
                  <div key={day.toISOString()} className="p-2 bg-muted rounded">
                    <div className="font-medium">{format(day, 'EEE')}</div>
                    <div className="text-xs text-muted-foreground">{format(day, 'MMM d')}</div>
                    <div className="font-bold text-lg">{getTotalHoursForDay(day)}</div>
                  </div>
                ))}
              </div>

              {/* Actions bar */}
              {selectedEntries.length > 0 && (
                <div className="flex items-center gap-2 mb-4 p-2 bg-muted rounded">
                  <span className="text-sm">{selectedEntries.length} selected</span>
                  <Button size="sm" onClick={handleSubmit}>
                    <Send className="mr-2 h-4 w-4" />
                    Submit for Approval
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedEntries([])}>
                    Clear Selection
                  </Button>
                </div>
              )}

              {/* Draft entries quick select */}
              {entries.some((e) => e.status === 'DRAFT') && (
                <div className="mb-4">
                  <Button variant="outline" size="sm" onClick={selectAllDraftEntries}>
                    Select All Draft Entries
                  </Button>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Select</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Billable</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedEntries.includes(entry.id)}
                          onChange={() => toggleEntrySelection(entry.id)}
                          disabled={entry.status !== 'DRAFT'}
                          className="rounded"
                        />
                      </TableCell>
                      <TableCell>{format(parseISO(entry.entryDate), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="font-medium">{entry.hours}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ENTRY_TYPE_LABELS[entry.entryType]}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{entry.description || '-'}</TableCell>
                      <TableCell>{entry.isBillable ? 'Yes' : 'No'}</TableCell>
                      <TableCell>${parseFloat(entry.totalCost || '0').toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_COLORS[entry.status] as 'default' | 'secondary' | 'destructive'}>
                          {STATUS_LABELS[entry.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {entry.status === 'DRAFT' && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(entry)}>
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.id)}>
                              Delete
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {entries.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  No time entries for this week. Click &quot;Add Entry&quot; to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>Review and approve time entries from your team</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedEntries.length > 0 && (
                <div className="flex items-center gap-2 mb-4 p-2 bg-muted rounded">
                  <span className="text-sm">{selectedEntries.length} selected</span>
                  <Button size="sm" onClick={handleApprove}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleReject}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedEntries([])}>
                    Clear Selection
                  </Button>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Select</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingList.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedEntries.includes(entry.id)}
                          onChange={() => toggleEntrySelection(entry.id)}
                          className="rounded"
                        />
                      </TableCell>
                      <TableCell>
                        {entry.employee
                          ? `${entry.employee.firstName || ''} ${entry.employee.lastName || ''}`.trim() ||
                            entry.employee.email
                          : '-'}
                      </TableCell>
                      <TableCell>{format(parseISO(entry.entryDate), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="font-medium">{entry.hours}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ENTRY_TYPE_LABELS[entry.entryType]}</Badge>
                      </TableCell>
                      <TableCell>{entry.project?.name || '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{entry.description || '-'}</TableCell>
                      <TableCell>${parseFloat(entry.totalCost || '0').toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pendingList.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  No time entries pending approval.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
