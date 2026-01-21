'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  FileDown,
  Send,
  CheckCircle,
  XCircle,
  FileText,
  DollarSign,
  CreditCard,
  Ban,
  RotateCcw,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

// Types
interface PayAppSummary {
  id: string;
  applicationNumber: number;
  applicationDate: string;
  periodFrom: string;
  periodTo: string;
  payAppType: string;
  status: string;
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
  invoiceNumber?: string;
  notes?: string;
}

interface PayAppLineWithProgress {
  id: string;
  lineNumber: number;
  itemNumber?: string;
  description: string;
  scheduledValue: number;
  previousWorkCompleted: number;
  previousMaterialsStored: number;
  thisWorkCompleted: number;
  thisMaterialsStored: number;
  totalCompletedAndStored: number;
  percentComplete: number;
  balanceToFinish: number;
  retainagePercent: number;
  retainageAmount: number;
}

interface ApprovalHistoryItem {
  id: string;
  action: string;
  performedBy: string;
  performedAt: string;
  notes?: string;
}

// Helper functions
function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return `${value.toFixed(1)}%`;
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'DRAFT':
      return 'outline';
    case 'SUBMITTED':
      return 'secondary';
    case 'APPROVED':
    case 'CERTIFIED':
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

function PayApplicationDetailPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const payAppId = params.id as string;

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'lines');
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isCertifyDialogOpen, setIsCertifyDialogOpen] = useState(false);
  const [isBillDialogOpen, setIsBillDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [checkNumber, setCheckNumber] = useState('');
  const [certificationNumber, setCertificationNumber] = useState('');
  const [workflowNotes, setWorkflowNotes] = useState('');

  // TRPC queries
  const { data: payAppData, isLoading, refetch } = trpc.payApplications.getById.useQuery(
    { id: payAppId },
    { enabled: !!payAppId }
  );

  const { data: linesData } = trpc.payApplications.getLines.useQuery(
    { payApplicationId: payAppId },
    { enabled: !!payAppId }
  );

  const { data: historyData } = trpc.payApplications.getApprovalHistory.useQuery(
    { payApplicationId: payAppId },
    { enabled: !!payAppId }
  );

  // Mutations
  const submitMutation = trpc.payApplications.submit.useMutation({
    onSuccess: () => {
      toast.success('Pay application submitted successfully');
      setIsSubmitDialogOpen(false);
      setWorkflowNotes('');
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const approveMutation = trpc.payApplications.approve.useMutation({
    onSuccess: () => {
      toast.success('Pay application approved');
      setIsApproveDialogOpen(false);
      setWorkflowNotes('');
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const rejectMutation = trpc.payApplications.reject.useMutation({
    onSuccess: () => {
      toast.success('Pay application rejected');
      setIsRejectDialogOpen(false);
      setRejectReason('');
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const certifyMutation = trpc.payApplications.certify.useMutation({
    onSuccess: () => {
      toast.success('Pay application certified');
      setIsCertifyDialogOpen(false);
      setCertificationNumber('');
      setWorkflowNotes('');
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const billMutation = trpc.payApplications.bill.useMutation({
    onSuccess: () => {
      toast.success('Pay application marked as billed');
      setIsBillDialogOpen(false);
      setInvoiceNumber('');
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const paymentMutation = trpc.payApplications.recordPayment.useMutation({
    onSuccess: () => {
      toast.success('Payment recorded');
      setIsPaymentDialogOpen(false);
      setPaymentAmount('');
      setCheckNumber('');
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const revertMutation = trpc.payApplications.revertToDraft.useMutation({
    onSuccess: () => {
      toast.success('Reverted to draft');
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const payApp = payAppData as PayAppSummary | undefined;
  const lines = (linesData as PayAppLineWithProgress[] | undefined) || [];
  const history = (historyData as ApprovalHistoryItem[] | undefined) || [];

  // Export G702
  const handleExportG702 = useCallback(() => {
    if (!payApp || lines.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Create G702 summary CSV
    const g702Headers = [
      'Field',
      'Value',
    ];
    const g702Data = [
      ['Application Number', payApp.applicationNumber],
      ['Application Date', payApp.applicationDate],
      ['Period From', payApp.periodFrom],
      ['Period To', payApp.periodTo],
      ['Project', payApp.projectName],
      ['Contract Sum To Date', payApp.contractSumToDate],
      ['Total Completed & Stored To Date', payApp.totalCompletedAndStoredToDate],
      ['Total Retainage', payApp.totalRetainage],
      ['Total Earned Less Retainage', payApp.totalEarnedLessRetainage],
      ['Less Previous Certificates', payApp.lessPreviousCertificates],
      ['Current Payment Due', payApp.currentPaymentDue],
      ['Balance To Finish', payApp.balanceToFinish],
    ];

    const g702Content = [
      g702Headers.join(','),
      ...g702Data.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    // Create G703 continuation sheet
    const g703Headers = [
      'Item No.',
      'Description',
      'Scheduled Value',
      'Work Completed (From Previous)',
      'Work Completed (This Period)',
      'Materials Stored',
      'Total Completed & Stored',
      '% Complete',
      'Balance To Finish',
      'Retainage',
    ];
    const g703Data = lines.map((line) => [
      line.itemNumber || line.lineNumber,
      line.description,
      line.scheduledValue,
      line.previousWorkCompleted,
      line.thisWorkCompleted,
      line.thisMaterialsStored,
      line.totalCompletedAndStored,
      (line.percentComplete * 100).toFixed(1),
      line.balanceToFinish,
      line.retainageAmount,
    ]);

    const g703Content = [
      g703Headers.join(','),
      ...g703Data.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    // Combine both sheets
    const fullContent = `AIA G702 - Application and Certificate for Payment\n${g702Content}\n\n\nAIA G703 - Continuation Sheet\n${g703Content}`;

    const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pay-app-${payApp.applicationNumber}-g702-g703.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('G702/G703 export completed');
  }, [payApp, lines]);

  // Auto-export if URL param set
  useEffect(() => {
    if (searchParams.get('export') === 'g702' && payApp && lines.length > 0) {
      handleExportG702();
      router.replace(`/construction/pay-applications/${payAppId}`);
    }
  }, [searchParams, payApp, lines, handleExportG702, router, payAppId]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <p>Loading pay application...</p>
      </div>
    );
  }

  if (!payApp) {
    return (
      <div className="container mx-auto py-10">
        <p>Pay application not found.</p>
        <Button asChild className="mt-4">
          <Link href="/construction/pay-applications">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Pay Applications
          </Link>
        </Button>
      </div>
    );
  }

  const canSubmit = payApp.status === 'DRAFT';
  const canApprove = payApp.status === 'SUBMITTED';
  const canReject = payApp.status === 'SUBMITTED';
  const canCertify = payApp.status === 'APPROVED';
  const canBill = payApp.status === 'CERTIFIED';
  const canRecordPayment = payApp.status === 'BILLED';
  const canRevert = payApp.status === 'REJECTED';

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/construction/pay-applications">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Pay Application #{payApp.applicationNumber}</h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant={getStatusBadgeVariant(payApp.status)} className="text-sm">
              {payApp.status}
            </Badge>
            <Badge variant="outline">{payApp.payAppType}</Badge>
            <span className="text-muted-foreground">
              {payApp.projectCode} - {payApp.projectName}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportG702}>
            <FileDown className="mr-2 h-4 w-4" />
            Export G702/G703
          </Button>

          {/* Workflow Actions */}
          {canSubmit && (
            <Button onClick={() => setIsSubmitDialogOpen(true)}>
              <Send className="mr-2 h-4 w-4" />
              Submit
            </Button>
          )}
          {canApprove && (
            <>
              <Button onClick={() => setIsApproveDialogOpen(true)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button variant="destructive" onClick={() => setIsRejectDialogOpen(true)}>
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </>
          )}
          {canCertify && (
            <Button onClick={() => setIsCertifyDialogOpen(true)}>
              <FileText className="mr-2 h-4 w-4" />
              Certify
            </Button>
          )}
          {canBill && (
            <Button onClick={() => setIsBillDialogOpen(true)}>
              <DollarSign className="mr-2 h-4 w-4" />
              Mark Billed
            </Button>
          )}
          {canRecordPayment && (
            <Button onClick={() => setIsPaymentDialogOpen(true)}>
              <CreditCard className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          )}
          {canRevert && (
            <Button variant="outline" onClick={() => revertMutation.mutate({ payApplicationId: payAppId })}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Revert to Draft
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Contract Sum To Date</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(payApp.contractSumToDate)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Completed & Stored</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(payApp.totalCompletedAndStoredToDate)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Current Payment Due</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {formatCurrency(payApp.currentPaymentDue)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Retainage Held</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(payApp.totalRetainage)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="lines">Billing Lines ({lines.length})</TabsTrigger>
          <TabsTrigger value="workflow">Workflow History</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Lines Tab */}
        <TabsContent value="lines" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>G703 Continuation Sheet</CardTitle>
              <CardDescription>Billing progress for each line item</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">#</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Scheduled Value</TableHead>
                      <TableHead className="text-right">Previous</TableHead>
                      <TableHead className="text-right">This Period</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">% Complete</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Retainage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="font-medium">
                          {line.itemNumber || line.lineNumber}
                        </TableCell>
                        <TableCell>{line.description}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(line.scheduledValue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(line.previousWorkCompleted + line.previousMaterialsStored)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(line.thisWorkCompleted + line.thisMaterialsStored)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(line.totalCompletedAndStored)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(line.percentComplete * 100)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(line.balanceToFinish)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(line.retainageAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {lines.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          No billing lines found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflow Tab */}
        <TabsContent value="workflow" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Approval History</CardTitle>
              <CardDescription>Track the workflow status of this pay application</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Performed By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant="outline">{item.action}</Badge>
                      </TableCell>
                      <TableCell>{item.performedBy}</TableCell>
                      <TableCell>{formatDate(item.performedAt)}</TableCell>
                      <TableCell className="text-muted-foreground">{item.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {history.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No workflow history yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-4">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Application Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Application Date</p>
                    <p className="font-medium">{formatDate(payApp.applicationDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Application Type</p>
                    <p className="font-medium">{payApp.payAppType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Period From</p>
                    <p className="font-medium">{formatDate(payApp.periodFrom)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Period To</p>
                    <p className="font-medium">{formatDate(payApp.periodTo)}</p>
                  </div>
                </div>
                {payApp.invoiceNumber && (
                  <div>
                    <p className="text-sm text-muted-foreground">Invoice Number</p>
                    <p className="font-medium">{payApp.invoiceNumber}</p>
                  </div>
                )}
                {payApp.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="font-medium">{payApp.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contract Sum To Date</span>
                  <span className="font-medium">{formatCurrency(payApp.contractSumToDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Completed & Stored</span>
                  <span className="font-medium">
                    {formatCurrency(payApp.totalCompletedAndStoredToDate)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Retainage</span>
                  <span className="font-medium">{formatCurrency(payApp.totalRetainage)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Earned Less Retainage</span>
                  <span className="font-medium">
                    {formatCurrency(payApp.totalEarnedLessRetainage)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Less Previous Certificates</span>
                  <span className="font-medium">
                    ({formatCurrency(payApp.lessPreviousCertificates)})
                  </span>
                </div>
                <hr />
                <div className="flex justify-between text-lg">
                  <span className="font-medium">Current Payment Due</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(payApp.currentPaymentDue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Balance To Finish</span>
                  <span className="font-medium">{formatCurrency(payApp.balanceToFinish)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Submit Dialog */}
      <AlertDialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Pay Application</AlertDialogTitle>
            <AlertDialogDescription>
              Submit this pay application for review and approval. Once submitted, it cannot be
              edited unless rejected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="submitNotes">Notes (optional)</Label>
            <Textarea
              id="submitNotes"
              value={workflowNotes}
              onChange={(e) => setWorkflowNotes(e.target.value)}
              placeholder="Any notes for the reviewer..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                submitMutation.mutate({
                  payApplicationId: payAppId,
                  notes: workflowNotes || undefined,
                })
              }
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Dialog */}
      <AlertDialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Pay Application</AlertDialogTitle>
            <AlertDialogDescription>
              Approve this pay application for certification. Amount due:{' '}
              {formatCurrency(payApp.currentPaymentDue)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="approveNotes">Notes (optional)</Label>
            <Textarea
              id="approveNotes"
              value={workflowNotes}
              onChange={(e) => setWorkflowNotes(e.target.value)}
              placeholder="Approval notes..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                approveMutation.mutate({
                  payApplicationId: payAppId,
                  notes: workflowNotes || undefined,
                })
              }
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Pay Application</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this pay application.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rejectReason">Rejection Reason *</Label>
            <Textarea
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Please explain why this application is being rejected..."
              className="mt-2"
              required
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                rejectMutation.mutate({
                  payApplicationId: payAppId,
                  reason: rejectReason,
                })
              }
              disabled={rejectMutation.isPending || !rejectReason.trim()}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certify Dialog */}
      <Dialog open={isCertifyDialogOpen} onOpenChange={setIsCertifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Certify Pay Application</DialogTitle>
            <DialogDescription>
              Certify this pay application (architect certification for AIA G702).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="certificationNumber">Certification Number (optional)</Label>
              <Input
                id="certificationNumber"
                value={certificationNumber}
                onChange={(e) => setCertificationNumber(e.target.value)}
                placeholder="e.g., CERT-001"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="certifyNotes">Notes (optional)</Label>
              <Textarea
                id="certifyNotes"
                value={workflowNotes}
                onChange={(e) => setWorkflowNotes(e.target.value)}
                placeholder="Certification notes..."
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCertifyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                certifyMutation.mutate({
                  payApplicationId: payAppId,
                  certificationNumber: certificationNumber || undefined,
                  notes: workflowNotes || undefined,
                })
              }
              disabled={certifyMutation.isPending}
            >
              {certifyMutation.isPending ? 'Certifying...' : 'Certify'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bill Dialog */}
      <Dialog open={isBillDialogOpen} onOpenChange={setIsBillDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Billed</DialogTitle>
            <DialogDescription>
              Record the invoice details for this pay application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="invoiceNumber">Invoice Number *</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g., INV-001"
                className="mt-2"
                required
              />
            </div>
            <div>
              <Label htmlFor="invoiceDate">Invoice Date *</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="mt-2"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBillDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                billMutation.mutate({
                  payApplicationId: payAppId,
                  invoiceNumber,
                  invoiceDate,
                })
              }
              disabled={billMutation.isPending || !invoiceNumber.trim()}
            >
              {billMutation.isPending ? 'Saving...' : 'Mark Billed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record payment received for this pay application. Amount due:{' '}
              {formatCurrency(payApp.currentPaymentDue)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="paymentAmount">Payment Amount *</Label>
              <Input
                id="paymentAmount"
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder={String(payApp.currentPaymentDue)}
                className="mt-2"
                required
              />
            </div>
            <div>
              <Label htmlFor="paymentDate">Payment Date *</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="mt-2"
                required
              />
            </div>
            <div>
              <Label htmlFor="checkNumber">Check Number (optional)</Label>
              <Input
                id="checkNumber"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="e.g., 12345"
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                paymentMutation.mutate({
                  payApplicationId: payAppId,
                  paidAmount: parseFloat(paymentAmount),
                  paidDate: paymentDate,
                  checkNumber: checkNumber || undefined,
                })
              }
              disabled={paymentMutation.isPending || !paymentAmount}
            >
              {paymentMutation.isPending ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Wrap in Suspense for useSearchParams() - required by Next.js 16+
export default function PayApplicationDetailPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-10">
        <p>Loading pay application...</p>
      </div>
    }>
      <PayApplicationDetailPageContent />
    </Suspense>
  );
}
