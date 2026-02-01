'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { ArrowLeft, Send, Check, X, FileText, Trash2, ShoppingCart, ExternalLink, Truck, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from '@/lib/trpc';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SalesOrderDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { orgId } = useAuth();
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const { data: salesOrder, isLoading, refetch } = trpc.salesOrders.get.useQuery(
    { id },
    { enabled: !!orgId && !!id }
  );

  // Get parent transaction (estimate this was created from)
  const { data: parentTransaction } = trpc.estimates.getParentTransaction.useQuery(
    { id },
    { enabled: !!orgId && !!id }
  );

  // Get child transactions (invoices created from this sales order)
  const { data: childTransactions } = trpc.estimates.getChildTransactions.useQuery(
    { parentId: id },
    { enabled: !!orgId && !!id }
  );

  // Mutations
  const submitMutation = trpc.salesOrders.submit.useMutation({
    onSuccess: () => {
      toast.success('Sales order submitted for approval');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to submit sales order');
    },
  });

  const approveMutation = trpc.salesOrders.approve.useMutation({
    onSuccess: () => {
      toast.success('Sales order approved');
      setIsApproveDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to approve sales order');
    },
  });

  const rejectMutation = trpc.salesOrders.reject.useMutation({
    onSuccess: () => {
      toast.success('Sales order rejected');
      setIsRejectDialogOpen(false);
      setRejectReason('');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reject sales order');
    },
  });

  const cancelMutation = trpc.salesOrders.cancel.useMutation({
    onSuccess: () => {
      toast.success('Sales order cancelled');
      setIsCancelDialogOpen(false);
      setCancelReason('');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to cancel sales order');
    },
  });

  const createInvoiceMutation = trpc.salesOrders.createInvoice.useMutation({
    onSuccess: () => {
      toast.success('Invoice created from sales order');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create invoice');
    },
  });

  const formatCurrency = (amount: string | number | null) => {
    const num = parseFloat(String(amount || 0));
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'DRAFT': return 'outline';
      case 'SUBMITTED': return 'secondary';
      case 'APPROVED': return 'default';
      case 'PARTIALLY_FULFILLED': return 'secondary';
      case 'FULFILLED': return 'default';
      case 'CLOSED': return 'secondary';
      case 'CANCELLED': return 'destructive';
      case 'REJECTED': return 'destructive';
      default: return 'outline';
    }
  };

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view this sales order.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <p>Loading sales order...</p>
      </div>
    );
  }

  if (!salesOrder) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <p>Sales order not found.</p>
      </div>
    );
  }

  const canSubmit = salesOrder.status === 'DRAFT';
  const canApproveReject = salesOrder.status === 'SUBMITTED';
  const canCreateInvoice = ['APPROVED', 'PARTIALLY_FULFILLED'].includes(salesOrder.status);
  const canCancel = !['CANCELLED', 'CLOSED', 'FULFILLED'].includes(salesOrder.status);

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/transactions/sales/sales-orders')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sales Orders
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sales Order Header Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">{salesOrder.orderNumber}</CardTitle>
                  <CardDescription>
                    {salesOrder.entity?.name || 'Unknown Customer'}
                  </CardDescription>
                </div>
                <Badge variant={getStatusBadgeVariant(salesOrder.status)} className="text-lg px-4 py-1">
                  {salesOrder.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Order Date</p>
                  <p className="font-medium">{formatDate(salesOrder.orderDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Date</p>
                  <p className="font-medium">{formatDate(salesOrder.requestedDeliveryDate || null)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Terms</p>
                  <p className="font-medium">{salesOrder.paymentTerms || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Shipping Method</p>
                  <p className="font-medium">{salesOrder.shippingMethod || 'N/A'}</p>
                </div>
              </div>
              {salesOrder.memo && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Memo</p>
                  <p className="text-sm">{salesOrder.memo}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Line Items Card */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesOrder.lines?.map((line: any) => (
                    <TableRow key={line.id}>
                      <TableCell>{line.description}</TableCell>
                      <TableCell className="text-right">{Number(line.quantity).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(line.unitPrice)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(line.lineAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator className="my-4" />

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(salesOrder.subtotal)}</span>
                  </div>
                  {parseFloat(String(salesOrder.discountAmount || 0)) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-destructive">-{formatCurrency(salesOrder.discountAmount)}</span>
                    </div>
                  )}
                  {parseFloat(String(salesOrder.taxAmount || 0)) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{formatCurrency(salesOrder.taxAmount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>{formatCurrency(salesOrder.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canCreateInvoice && (
                <Button
                  className="w-full justify-start"
                  onClick={() => createInvoiceMutation.mutate({ salesOrderId: salesOrder.id })}
                  disabled={createInvoiceMutation.isPending}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {createInvoiceMutation.isPending ? 'Creating...' : 'Create Invoice'}
                </Button>
              )}

              {canSubmit && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => submitMutation.mutate({ id: salesOrder.id })}
                  disabled={submitMutation.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {submitMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
                </Button>
              )}

              {canApproveReject && (
                <>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-green-600 hover:text-green-700"
                    onClick={() => setIsApproveDialogOpen(true)}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {approveMutation.isPending ? 'Processing...' : 'Approve'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-destructive hover:text-destructive"
                    onClick={() => setIsRejectDialogOpen(true)}
                    disabled={rejectMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    {rejectMutation.isPending ? 'Processing...' : 'Reject'}
                  </Button>
                </>
              )}

              {canCreateInvoice && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => toast.info('Fulfillment coming soon')}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Create Fulfillment
                </Button>
              )}

              {canCancel && (
                <>
                  <Separator />
                  <Button
                    variant="destructive"
                    className="w-full justify-start"
                    onClick={() => setIsCancelDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Cancel Order
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{salesOrder.entity?.name || 'Unknown Customer'}</p>
            </CardContent>
          </Card>

          {/* Parent Transaction (Source Estimate) */}
          {parentTransaction && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Created From</CardTitle>
              </CardHeader>
              <CardContent>
                <button
                  onClick={() => {
                    if (parentTransaction.typeCode === 'ESTIMATE') {
                      router.push(`/transactions/sales/estimates/${parentTransaction.id}`);
                    }
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-primary">{parentTransaction.transactionNumber}</p>
                      <p className="text-xs text-muted-foreground">{parentTransaction.typeName}</p>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </button>
              </CardContent>
            </Card>
          )}

          {/* Child Transactions (Invoices) */}
          {childTransactions && childTransactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Related Invoices</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {childTransactions.map((txn: { id: string; transactionNumber: string | null; typeCode: string | null; typeName: string | null; totalAmount: string | null; status: string | null }) => (
                  <button
                    key={txn.id}
                    onClick={() => {
                      if (txn.typeCode === 'INVOICE') {
                        router.push(`/transactions/sales/invoices/${txn.id}`);
                      }
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-primary">{txn.transactionNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(txn.totalAmount)} - {txn.status}
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Sales Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve sales order {salesOrder.orderNumber}?
              This will allow fulfillment and invoicing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => approveMutation.mutate({ id: salesOrder.id })}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Sales Order</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting sales order {salesOrder.orderNumber}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectMutation.mutate({ id: salesOrder.id, reason: rejectReason })}
              disabled={rejectMutation.isPending || !rejectReason}
              className="bg-destructive hover:bg-destructive/90"
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Sales Order</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for cancelling sales order {salesOrder.orderNumber}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate({ id: salesOrder.id, reason: cancelReason })}
              disabled={cancelMutation.isPending || !cancelReason}
              className="bg-destructive hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
