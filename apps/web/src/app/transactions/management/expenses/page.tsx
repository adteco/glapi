'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Send,
  CheckCircle,
  XCircle,
  Paperclip,
  ArrowRightLeft,
} from 'lucide-react';

type ExpenseStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'POSTED' | 'CANCELLED';

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled',
};

const STATUS_COLORS: Record<ExpenseStatus, 'default' | 'secondary' | 'destructive'> = {
  DRAFT: 'secondary',
  SUBMITTED: 'default',
  APPROVED: 'default',
  REJECTED: 'destructive',
  POSTED: 'default',
  CANCELLED: 'secondary',
};

const EXPENSE_TYPE_LABELS = {
  TRAVEL: 'Travel',
  MATERIALS: 'Materials',
  SUBCONTRACT: 'Subcontract',
  EQUIPMENT: 'Equipment',
  OTHER: 'Other',
};

const flattenTaskTree = (nodes: any[] = [], depth = 0): Array<any & { depth: number }> =>
  nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenTaskTree(node.children || [], depth + 1),
  ]);

export default function ProjectExpensesPage() {
  const { orgId } = useAuth();
  const [activeTab, setActiveTab] = useState<'my-expenses' | 'approvals'>('my-expenses');
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | 'ALL'>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [attachmentExpenseId, setAttachmentExpenseId] = useState<string | null>(null);
  const [attachmentForm, setAttachmentForm] = useState({
    fileName: '',
    fileUrl: '',
    contentType: '',
    fileSize: '',
  });

  const [formData, setFormData] = useState({
    projectId: '',
    projectTaskId: '',
    expenseType: 'OTHER',
    vendorName: '',
    vendorInvoiceNumber: '',
    expenseDate: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    currencyCode: 'USD',
    description: '',
    isBillable: 'true',
  });

  const projectsQuery = trpc.projects.list.useQuery(
    { orderBy: 'name', orderDirection: 'asc', limit: 100 },
    { enabled: !!orgId }
  );
  const projects = projectsQuery.data?.data ?? [];
  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project] as const)),
    [projects]
  );

  const { data: projectTaskTree } = trpc.projectTasks.getTree.useQuery(
    { projectId: formData.projectId },
    { enabled: !!formData.projectId }
  );
  const taskOptions = useMemo(() => flattenTaskTree(projectTaskTree || []), [projectTaskTree]);

  const expensesQuery = trpc.projectExpenses.list.useQuery(
    {
      filters: {
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      },
      orderBy: 'expenseDate',
      orderDirection: 'desc',
    },
    { enabled: !!orgId }
  );

  const approvalsQuery = trpc.projectExpenses.list.useQuery(
    {
      filters: { status: 'SUBMITTED' },
    },
    { enabled: !!orgId && activeTab === 'approvals' }
  );

  const createMutation = trpc.projectExpenses.create.useMutation({
    onSuccess: () => {
      toast.success('Expense logged');
      setIsCreateOpen(false);
      setFormData({
        projectId: '',
        projectTaskId: '',
        expenseType: 'OTHER',
        vendorName: '',
        vendorInvoiceNumber: '',
        expenseDate: format(new Date(), 'yyyy-MM-dd'),
        amount: '',
        currencyCode: 'USD',
        description: '',
        isBillable: 'true',
      });
      expensesQuery.refetch();
    },
    onError: (error) => toast.error(error.message || 'Failed to create expense'),
  });

  const deleteMutation = trpc.projectExpenses.delete.useMutation({
    onSuccess: () => {
      toast.success('Expense deleted');
      expensesQuery.refetch();
    },
    onError: (error) => toast.error(error.message || 'Failed to delete expense'),
  });

  const submitMutation = trpc.projectExpenses.submit.useMutation({
    onSuccess: () => {
      toast.success('Expense submitted');
      expensesQuery.refetch();
    },
    onError: (error) => toast.error(error.message || 'Submit failed'),
  });

  const approveMutation = trpc.projectExpenses.approve.useMutation({
    onSuccess: () => {
      toast.success('Expense approved');
      approvalsQuery.refetch();
    },
    onError: (error) => toast.error(error.message || 'Approve failed'),
  });

  const rejectMutation = trpc.projectExpenses.reject.useMutation({
    onSuccess: () => {
      toast.success('Expense rejected');
      approvalsQuery.refetch();
    },
    onError: (error) => toast.error(error.message || 'Reject failed'),
  });

  const attachmentsQuery = trpc.projectExpenses.listAttachments.useQuery(
    { expenseId: attachmentExpenseId ?? '' },
    { enabled: !!attachmentExpenseId }
  );
  const addAttachmentMutation = trpc.projectExpenses.addAttachment.useMutation({
    onSuccess: () => {
      toast.success('Attachment added');
      setAttachmentForm({ fileName: '', fileUrl: '', contentType: '', fileSize: '' });
      attachmentsQuery.refetch();
    },
    onError: (error) => toast.error(error.message || 'Attachment failed'),
  });
  const deleteAttachmentMutation = trpc.projectExpenses.deleteAttachment.useMutation({
    onSuccess: () => {
      toast.success('Attachment removed');
      attachmentsQuery.refetch();
    },
    onError: (error) => toast.error(error.message || 'Remove failed'),
  });

  const expenses = expensesQuery.data?.data ?? [];
  const approvals = approvalsQuery.data?.data ?? [];
  const attachments = attachmentsQuery.data ?? [];

  const handleCreate = () => {
    if (!formData.expenseDate || !formData.amount) {
      toast.error('Date and amount are required');
      return;
    }
    createMutation.mutate({
      projectId: formData.projectId || undefined,
      projectTaskId: formData.projectTaskId || undefined,
      expenseType: formData.expenseType as any,
      vendorName: formData.vendorName || undefined,
      vendorInvoiceNumber: formData.vendorInvoiceNumber || undefined,
      expenseDate: formData.expenseDate,
      amount: formData.amount,
      currencyCode: formData.currencyCode || 'USD',
      description: formData.description || undefined,
      isBillable: formData.isBillable === 'true',
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this expense?')) return;
    deleteMutation.mutate({ id });
  };

  const handleSubmit = (id: string) => submitMutation.mutate({ id });
  const handleApprove = (id: string) => approveMutation.mutate({ id });
  const handleReject = (id: string) => {
    const reason = prompt('Rejection reason?');
    if (!reason) return;
    rejectMutation.mutate({ id, reason });
  };
  const handlePost = (id: string) => postMutation.mutate({ expenseIds: [id] });

  const openAttachmentsDialog = (expenseId: string) => {
    setAttachmentExpenseId(expenseId);
    setAttachmentForm({ fileName: '', fileUrl: '', contentType: '', fileSize: '' });
  };

  const handleAddAttachment = () => {
    if (!attachmentExpenseId) return;
    if (!attachmentForm.fileName || !attachmentForm.fileUrl) {
      toast.error('File name and URL required');
      return;
    }
    addAttachmentMutation.mutate({
      expenseId: attachmentExpenseId,
      fileName: attachmentForm.fileName.trim(),
      fileUrl: attachmentForm.fileUrl.trim(),
      contentType: attachmentForm.contentType || undefined,
      fileSize: attachmentForm.fileSize ? Number(attachmentForm.fileSize) : undefined,
    });
  };

  const handleDeleteAttachment = (attachmentId: string) => {
    deleteAttachmentMutation.mutate({ attachmentId });
  };

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view expenses.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'my-expenses' | 'approvals')}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Project Expenses</h1>
            <p className="text-muted-foreground">Log reimbursable costs and manage approvals</p>
          </div>
          <TabsList>
            <TabsTrigger value="my-expenses">
              <Plus className="mr-2 h-4 w-4" />
              My Expenses
            </TabsTrigger>
            <TabsTrigger value="approvals">
              <CheckCircle className="mr-2 h-4 w-4" />
              Approvals
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="my-expenses">
          <Card>
            <CardHeader className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <CardTitle>Logged Expenses</CardTitle>
                  <CardDescription>Track project costs awaiting approval</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ExpenseStatus | 'ALL')}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All statuses</SelectItem>
                      {Object.keys(STATUS_LABELS).map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_LABELS[status as ExpenseStatus]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Expense
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{format(parseISO(expense.expenseDate), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{expense.vendorName || 'Unspecified'}</p>
                          <p className="text-xs text-muted-foreground">{expense.vendorInvoiceNumber || ''}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{EXPENSE_TYPE_LABELS[expense.expenseType as keyof typeof EXPENSE_TYPE_LABELS]}</Badge>
                      </TableCell>
                      <TableCell>
                        {expense.projectId ? (
                          <div>
                            <p className="font-medium">
                              {projectMap.get(expense.projectId)?.name || expense.projectId}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {projectMap.get(expense.projectId)?.projectCode || ''}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {expense.currencyCode} {parseFloat(expense.amount).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_COLORS[expense.status as ExpenseStatus]}>
                          {STATUS_LABELS[expense.status as ExpenseStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openAttachmentsDialog(expense.id)}>
                          <Paperclip className="h-4 w-4" />
                        </Button>
                        {expense.status === 'DRAFT' && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleSubmit(expense.id)}>
                              <Send className="mr-2 h-4 w-4" />
                              Submit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(expense.id)}>
                              Delete
                            </Button>
                          </>
                        )}
                        {expense.status === 'APPROVED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePost(expense.id)}
                            disabled={postMutation.isPending}
                          >
                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                            Post to GL
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {expenses.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No expenses logged yet. Start by adding your first project expense.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>Review expenses submitted by your team</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvals.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{format(parseISO(expense.expenseDate), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{expense.employeeId.slice(0, 8)}…</p>
                          {expense.projectId && (
                            <p className="text-xs text-muted-foreground">
                              {projectMap.get(expense.projectId)?.name || expense.projectId}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{expense.vendorName || 'Unspecified'}</TableCell>
                      <TableCell>
                        {expense.currencyCode} {parseFloat(expense.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="flex gap-2">
                        <Button size="sm" onClick={() => handleApprove(expense.id)}>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleReject(expense.id)}>
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {approvals.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No expenses awaiting approval right now.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create expense dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log Project Expense</DialogTitle>
            <DialogDescription>Capture reimbursable costs tied to your projects.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Project</Label>
              <Select
                value={formData.projectId}
                onValueChange={(value) => setFormData({ ...formData, projectId: value, projectTaskId: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Project Task</Label>
              <Select
                value={formData.projectTaskId}
                onValueChange={(value) => setFormData({ ...formData, projectTaskId: value })}
                disabled={!taskOptions.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional task" />
                </SelectTrigger>
                <SelectContent>
                  {taskOptions.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {`${'— '.repeat(task.depth)}${task.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Vendor Name</Label>
              <Input value={formData.vendorName} onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })} />
            </div>
            <div>
              <Label>Invoice Number</Label>
              <Input
                value={formData.vendorInvoiceNumber}
                onChange={(e) => setFormData({ ...formData, vendorInvoiceNumber: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Expense Date</Label>
              <Input
                type="date"
                value={formData.expenseDate}
                onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Currency</Label>
              <Input
                value={formData.currencyCode}
                onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value })}
                placeholder="USD"
              />
            </div>
            <div>
              <Label>Expense Type</Label>
              <Select
                value={formData.expenseType}
                onValueChange={(value) => setFormData({ ...formData, expenseType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the expense"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!attachmentExpenseId}
        onOpenChange={(open) => {
          if (!open) {
            setAttachmentExpenseId(null);
            setAttachmentForm({ fileName: '', fileUrl: '', contentType: '', fileSize: '' });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Expense Attachments</DialogTitle>
            <DialogDescription>Upload receipts or supporting documents.</DialogDescription>
          </DialogHeader>
          {attachmentsQuery.isLoading ? (
            <p>Loading attachments...</p>
          ) : attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attachments added yet.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="border rounded px-3 py-2 flex justify-between">
                  <div>
                    <p className="font-medium">{attachment.fileName}</p>
                    <a className="text-xs text-blue-600 underline" href={attachment.fileUrl} target="_blank" rel="noreferrer">
                      {attachment.fileUrl}
                    </a>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteAttachment(attachment.id)}
                    disabled={deleteAttachmentMutation.isPending}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-3">
            <Input
              placeholder="File name"
              value={attachmentForm.fileName}
              onChange={(e) => setAttachmentForm({ ...attachmentForm, fileName: e.target.value })}
            />
            <Input
              placeholder="File URL"
              value={attachmentForm.fileUrl}
              onChange={(e) => setAttachmentForm({ ...attachmentForm, fileUrl: e.target.value })}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Content type (optional)"
                value={attachmentForm.contentType}
                onChange={(e) => setAttachmentForm({ ...attachmentForm, contentType: e.target.value })}
              />
              <Input
                placeholder="File size bytes (optional)"
                value={attachmentForm.fileSize}
                onChange={(e) => setAttachmentForm({ ...attachmentForm, fileSize: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button onClick={handleAddAttachment} disabled={addAttachmentMutation.isPending}>
                Add Attachment
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
  const postMutation = trpc.projectExpenses.postToGL.useMutation({
    onSuccess: (result) => {
      const txnReference = result.glTransactionId ? ` (GL txn ${result.glTransactionId.slice(0, 8)}…)` : '';
      toast.success(`Expense posted to GL${txnReference}`);
      expensesQuery.refetch();
      approvalsQuery.refetch();
    },
    onError: (error) => toast.error(error.message || 'Failed to post expense to GL'),
  });
