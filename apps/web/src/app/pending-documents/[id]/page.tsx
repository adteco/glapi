'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  ArrowLeft,
  Check,
  X,
  Archive,
  FileText,
  Clock,
  User,
  Mail,
  Calendar,
  DollarSign,
  Building,
  Hash,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  History,
  Sparkles,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import type { RouterOutputs } from '@glapi/trpc';

type DocumentWithHistory = RouterOutputs['pendingDocuments']['getByIdWithHistory'];

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  PENDING_REVIEW: { label: 'Pending Review', variant: 'default', icon: Clock },
  IN_REVIEW: { label: 'In Review', variant: 'secondary', icon: Eye },
  APPROVED: { label: 'Approved', variant: 'outline', icon: CheckCircle },
  REJECTED: { label: 'Rejected', variant: 'destructive', icon: XCircle },
  CONVERTED: { label: 'Converted', variant: 'outline', icon: FileText },
  CONVERSION_FAILED: { label: 'Failed', variant: 'destructive', icon: AlertTriangle },
  ARCHIVED: { label: 'Archived', variant: 'secondary', icon: Archive },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  HIGH: { label: 'High', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  MEDIUM: { label: 'Medium', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  LOW: { label: 'Low', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
};

export default function PendingDocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { orgId } = useAuth();
  const documentId = params.id as string;

  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [archiveReason, setArchiveReason] = useState('');
  const [conversionTarget, setConversionTarget] = useState<string>('VENDOR_BILL');
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');

  const { data: document, isLoading, refetch } = trpc.pendingDocuments.getByIdWithHistory.useQuery(
    { id: documentId },
    { enabled: !!orgId && !!documentId }
  );

  const approveMutation = trpc.pendingDocuments.approve.useMutation({
    onSuccess: () => {
      toast.success('Document approved successfully');
      setIsApproveDialogOpen(false);
      setApprovalNotes('');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to approve document');
    },
  });

  const rejectMutation = trpc.pendingDocuments.reject.useMutation({
    onSuccess: () => {
      toast.success('Document rejected');
      setIsRejectDialogOpen(false);
      setRejectionReason('');
      setRejectionNotes('');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reject document');
    },
  });

  const archiveMutation = trpc.pendingDocuments.archive.useMutation({
    onSuccess: () => {
      toast.success('Document archived');
      setIsArchiveDialogOpen(false);
      setArchiveReason('');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to archive document');
    },
  });

  const { data: conversionPreview, isLoading: isLoadingPreview } = trpc.pendingDocuments.previewConversion.useQuery(
    { id: documentId },
    { enabled: !!orgId && !!documentId && isConvertDialogOpen }
  );

  const convertMutation = trpc.pendingDocuments.convertToVendorBill.useMutation({
    onSuccess: (result) => {
      toast.success('Document converted to vendor bill successfully');
      setIsConvertDialogOpen(false);
      router.push(`/transactions/purchasing/vendor-bills/${result.vendorBill.id}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to convert document');
    },
  });

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number | string | null | undefined) => {
    if (amount == null) return '-';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  const canApprove = document && ['PENDING_REVIEW', 'IN_REVIEW', 'CONVERSION_FAILED'].includes(document.status);
  const canReject = document && ['PENDING_REVIEW', 'IN_REVIEW', 'APPROVED'].includes(document.status);
  const canArchive = document && document.status !== 'CONVERTED' && document.status !== 'ARCHIVED';
  const canConvert = document && document.status === 'APPROVED';

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select an organization</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Document Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The document you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
            </p>
            <Button onClick={() => router.push('/pending-documents')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Inbox
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConf = statusConfig[document.status] || statusConfig.PENDING_REVIEW;
  const priorityConf = priorityConfig[document.priority] || priorityConfig.MEDIUM;
  const StatusIcon = statusConf.icon;
  const extractedData = document.extractedData as any;
  const invoiceData = extractedData?.invoice;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/pending-documents')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {document.subject || '(No Subject)'}
            </h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" />
              From: {document.senderName || document.senderEmail}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusConf.variant}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {statusConf.label}
          </Badge>
          <Badge className={priorityConf.className} variant="outline">
            {priorityConf.label} Priority
          </Badge>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {canApprove && (
          <Button onClick={() => setIsApproveDialogOpen(true)}>
            <Check className="mr-2 h-4 w-4" />
            Approve
          </Button>
        )}
        {canReject && (
          <Button variant="destructive" onClick={() => setIsRejectDialogOpen(true)}>
            <X className="mr-2 h-4 w-4" />
            Reject
          </Button>
        )}
        {canArchive && (
          <Button variant="outline" onClick={() => setIsArchiveDialogOpen(true)}>
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </Button>
        )}
        {canConvert && (
          <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => setIsConvertDialogOpen(true)}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Convert to Vendor Bill
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="extracted">
            <TabsList>
              <TabsTrigger value="extracted">
                <Sparkles className="mr-2 h-4 w-4" />
                Extracted Data
              </TabsTrigger>
              <TabsTrigger value="summary">
                <FileText className="mr-2 h-4 w-4" />
                Summary
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="mr-2 h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="extracted" className="space-y-4">
              {invoiceData ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Invoice Details</CardTitle>
                    <CardDescription>Data extracted by AI analysis</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Vendor Name</Label>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{invoiceData.vendorName || '-'}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Vendor Email</Label>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{invoiceData.vendorEmail || '-'}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Invoice Number</Label>
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{invoiceData.invoiceNumber || '-'}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">PO Number</Label>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{invoiceData.poNumber || '-'}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Invoice Date</Label>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{invoiceData.invoiceDate || '-'}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Due Date</Label>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{invoiceData.dueDate || '-'}</span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Subtotal</Label>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{formatCurrency(invoiceData.subtotal)}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Tax</Label>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{formatCurrency(invoiceData.taxAmount)}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Total</Label>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="text-lg font-bold">{formatCurrency(invoiceData.totalAmount)}</span>
                        </div>
                      </div>
                    </div>

                    {invoiceData.lineItems && invoiceData.lineItems.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <Label className="text-muted-foreground mb-2 block">Line Items</Label>
                          <div className="rounded-md border">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/50">
                                  <th className="text-left p-2">Description</th>
                                  <th className="text-right p-2">Qty</th>
                                  <th className="text-right p-2">Unit Price</th>
                                  <th className="text-right p-2">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {invoiceData.lineItems.map((item: any, idx: number) => (
                                  <tr key={idx} className="border-b last:border-0">
                                    <td className="p-2">{item.description || '-'}</td>
                                    <td className="text-right p-2">{item.quantity ?? '-'}</td>
                                    <td className="text-right p-2">{formatCurrency(item.unitPrice)}</td>
                                    <td className="text-right p-2">{formatCurrency(item.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No extracted invoice data available</p>
                  </CardContent>
                </Card>
              )}

              {extractedData?.entities && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Extracted Entities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      {extractedData.entities.companies?.length > 0 && (
                        <div>
                          <Label className="text-muted-foreground">Companies</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {extractedData.entities.companies.map((c: string, i: number) => (
                              <Badge key={i} variant="secondary">{c}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {extractedData.entities.people?.length > 0 && (
                        <div>
                          <Label className="text-muted-foreground">People</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {extractedData.entities.people.map((p: string, i: number) => (
                              <Badge key={i} variant="secondary">{p}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {extractedData.entities.amounts?.length > 0 && (
                        <div>
                          <Label className="text-muted-foreground">Amounts</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {extractedData.entities.amounts.map((a: string, i: number) => (
                              <Badge key={i} variant="outline">{a}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {extractedData.entities.dates?.length > 0 && (
                        <div>
                          <Label className="text-muted-foreground">Dates</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {extractedData.entities.dates.map((d: string, i: number) => (
                              <Badge key={i} variant="outline">{d}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="summary" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">AI Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">
                    {document.summary || 'No summary available'}
                  </p>
                </CardContent>
              </Card>

              {document.actionItems && document.actionItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Action Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1">
                      {document.actionItems.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Review History</CardTitle>
                </CardHeader>
                <CardContent>
                  {document.reviewHistory && document.reviewHistory.length > 0 ? (
                    <div className="space-y-4">
                      {document.reviewHistory.map((entry, idx) => (
                        <div key={idx} className="flex gap-4 pb-4 border-b last:border-0 last:pb-0">
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-4 w-4" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{entry.action}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(entry.performedAt)}
                              </span>
                            </div>
                            {entry.fromStatus && entry.toStatus && (
                              <p className="text-sm text-muted-foreground">
                                Status changed from {entry.fromStatus} to {entry.toStatus}
                              </p>
                            )}
                            {entry.notes && (
                              <p className="text-sm mt-1">{entry.notes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No review history yet</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Document Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Document Type</Label>
                <p className="font-medium">{document.documentType}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Source</Label>
                <p className="font-medium">{document.source}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Received</Label>
                <p className="font-medium">{formatDate(document.receivedAt)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Confidence Score</Label>
                <p className="font-medium">
                  {document.confidenceScore
                    ? `${(parseFloat(document.confidenceScore) * 100).toFixed(1)}%`
                    : '-'}
                </p>
              </div>
              {document.matchedVendor && (
                <div>
                  <Label className="text-muted-foreground">Matched Vendor</Label>
                  <p className="font-medium">{(document.matchedVendor as any).name || document.matchedVendorId}</p>
                </div>
              )}
              {document.reviewedAt && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-muted-foreground">Reviewed</Label>
                    <p className="font-medium">{formatDate(document.reviewedAt)}</p>
                  </div>
                  {document.reviewNotes && (
                    <div>
                      <Label className="text-muted-foreground">Review Notes</Label>
                      <p className="text-sm">{document.reviewNotes}</p>
                    </div>
                  )}
                </>
              )}
              {document.rejectionReason && (
                <div>
                  <Label className="text-muted-foreground">Rejection Reason</Label>
                  <p className="text-sm text-destructive">{document.rejectionReason}</p>
                </div>
              )}
              {document.convertedAt && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-muted-foreground">Converted</Label>
                    <p className="font-medium">{formatDate(document.convertedAt)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Converted To</Label>
                    <p className="font-medium">{document.conversionTargetType}</p>
                  </div>
                </>
              )}
              {document.conversionError && (
                <div>
                  <Label className="text-muted-foreground">Conversion Error</Label>
                  <p className="text-sm text-destructive">{document.conversionError}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sender Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Name</Label>
                <p className="font-medium">{document.senderName || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <p className="font-medium break-all">{document.senderEmail}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Recipients</Label>
                <p className="text-sm break-all">{document.recipients || '-'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Approve Dialog */}
      <AlertDialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Document</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the document as approved and ready for conversion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Convert To</Label>
              <Select value={conversionTarget} onValueChange={setConversionTarget}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VENDOR_BILL">Vendor Bill</SelectItem>
                  <SelectItem value="PURCHASE_ORDER">Purchase Order</SelectItem>
                  <SelectItem value="VENDOR_CREDIT">Vendor Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add any notes about this approval..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => approveMutation.mutate({
                id: documentId,
                notes: approvalNotes || undefined,
              })}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Document</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this document.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Input
                placeholder="e.g., Duplicate, Invalid, Incomplete..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Additional Notes (optional)</Label>
              <Textarea
                placeholder="Add any additional context..."
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectMutation.mutate({
                id: documentId,
                reason: rejectionReason,
                notes: rejectionNotes || undefined,
              })}
              disabled={rejectMutation.isPending || !rejectionReason}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Dialog */}
      <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Document</AlertDialogTitle>
            <AlertDialogDescription>
              Archive this document if it&apos;s spam, a duplicate, or otherwise not actionable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Input
                placeholder="e.g., Spam, Duplicate, Not relevant..."
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => archiveMutation.mutate({
                id: documentId,
                reason: archiveReason || undefined,
              })}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending ? 'Archiving...' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Convert to Vendor Bill Dialog */}
      <AlertDialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to Vendor Bill</AlertDialogTitle>
            <AlertDialogDescription>
              Review the extracted data and create a draft vendor bill.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {isLoadingPreview ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : conversionPreview ? (
            <div className="space-y-4 py-4">
              {/* Warnings */}
              {conversionPreview.warnings.length > 0 && (
                <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Attention needed</p>
                      <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside mt-1">
                        {conversionPreview.warnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Vendor Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Vendor</Label>
                  {conversionPreview.suggestedVendor ? (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{conversionPreview.suggestedVendor.name}</span>
                      <Badge variant="secondary" className="ml-auto">Auto-matched</Badge>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No vendor matched. Please select one manually.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Invoice Number</Label>
                  <p className="font-medium">{conversionPreview.suggestedData.vendorInvoiceNumber || '-'}</p>
                </div>
                <div className="space-y-2">
                  <Label>Bill Date</Label>
                  <p className="font-medium">{conversionPreview.suggestedData.billDate || '-'}</p>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <p className="font-medium">{conversionPreview.suggestedData.dueDate || '-'}</p>
                </div>
              </div>

              {/* Line Items Preview */}
              {conversionPreview.suggestedData.lines && conversionPreview.suggestedData.lines.length > 0 && (
                <div>
                  <Label className="mb-2 block">Line Items</Label>
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-2">Description</th>
                          <th className="text-right p-2">Qty</th>
                          <th className="text-right p-2">Unit Price</th>
                          <th className="text-right p-2">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conversionPreview.suggestedData.lines.map((line, idx) => (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="p-2">{line.itemName}</td>
                            <td className="text-right p-2">{line.quantity || '1'}</td>
                            <td className="text-right p-2">{formatCurrency(line.unitPrice)}</td>
                            <td className="text-right p-2">{formatCurrency(line.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!conversionPreview?.suggestedVendor) {
                  toast.error('Please select a vendor before converting');
                  return;
                }
                convertMutation.mutate({
                  pendingDocumentId: documentId,
                  vendorId: conversionPreview.suggestedVendor.id,
                });
              }}
              disabled={convertMutation.isPending || !conversionPreview?.suggestedVendor}
              className="bg-green-600 hover:bg-green-700"
            >
              {convertMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Create Vendor Bill
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
