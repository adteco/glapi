'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { ArrowLeft, Send, Check, X, Copy, Users, Mail, FileText, Trash2, ShoppingCart, ExternalLink } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from '@/lib/trpc';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EstimateDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { orgId } = useAuth();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');

  const { data: estimate, isLoading, refetch } = trpc.estimates.get.useQuery(
    { id },
    { enabled: !!orgId && !!id }
  );

  // Get child transactions (converted sales orders)
  const { data: childTransactions } = trpc.estimates.getChildTransactions.useQuery(
    { parentId: id },
    { enabled: !!orgId && !!id }
  );

  // Mutations
  const deleteMutation = trpc.estimates.delete.useMutation({
    onSuccess: () => {
      toast.success('Estimate deleted successfully');
      router.push('/transactions/sales/estimates');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete estimate');
    },
  });

  const sendMutation = trpc.estimates.send.useMutation({
    onSuccess: () => {
      toast.success('Estimate sent successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send estimate');
    },
  });

  const acceptMutation = trpc.estimates.accept.useMutation({
    onSuccess: () => {
      toast.success('Estimate accepted');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to accept estimate');
    },
  });

  const declineMutation = trpc.estimates.decline.useMutation({
    onSuccess: () => {
      toast.success('Estimate declined');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to decline estimate');
    },
  });

  const convertMutation = trpc.estimates.convertToSalesOrder.useMutation({
    onSuccess: (data) => {
      toast.success(`Converted to Sales Order ${data.transactionNumber}`);
      setIsConvertDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      console.error('Convert error:', error);
      toast.error(error.message || 'Failed to convert estimate');
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
      case 'SENT': return 'default';
      case 'ACCEPTED': return 'default';
      case 'DECLINED': return 'destructive';
      case 'EXPIRED': return 'secondary';
      case 'CONVERTED': return 'default';
      case 'CANCELLED': return 'destructive';
      default: return 'outline';
    }
  };

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view this estimate.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <p>Loading estimate...</p>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <p>Estimate not found.</p>
      </div>
    );
  }

  const canSend = estimate.status === 'DRAFT';
  const canAcceptDecline = ['DRAFT', 'SENT'].includes(estimate.status);
  const canConvert = ['DRAFT', 'SENT', 'ACCEPTED'].includes(estimate.status);
  const canDelete = estimate.status === 'DRAFT';

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/transactions/sales/estimates')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Estimates
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Estimate Header Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">{estimate.transactionNumber}</CardTitle>
                  <CardDescription>
                    {estimate.customerName} {estimate.projectName && `• ${estimate.projectName}`}
                  </CardDescription>
                </div>
                <Badge variant={getStatusBadgeVariant(estimate.status)} className="text-lg px-4 py-1">
                  {estimate.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{formatDate(estimate.transactionDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valid Until</p>
                  <p className="font-medium">{formatDate(estimate.estimateValidUntil)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sales Stage</p>
                  <p className="font-medium">{estimate.salesStage?.replace('_', ' ') || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Win Probability</p>
                  <p className="font-medium">{estimate.probability ? `${estimate.probability}%` : 'N/A'}</p>
                </div>
              </div>
              {estimate.memo && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{estimate.memo}</p>
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
                    <TableHead className="w-[100px]">Item</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estimate.lines?.map((line: any) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">{line.itemName || 'Custom'}</TableCell>
                      <TableCell>{line.description}</TableCell>
                      <TableCell className="text-right">{Number(line.quantity).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(line.unitPrice)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(line.totalLineAmount)}</TableCell>
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
                    <span>{formatCurrency(estimate.subtotalAmount)}</span>
                  </div>
                  {parseFloat(String(estimate.discountAmount || 0)) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-destructive">-{formatCurrency(estimate.discountAmount)}</span>
                    </div>
                  )}
                  {parseFloat(String(estimate.taxAmount || 0)) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{formatCurrency(estimate.taxAmount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>{formatCurrency(estimate.totalAmount)}</span>
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
              {canConvert && (
                <Button
                  className="w-full justify-start"
                  onClick={() => setIsConvertDialogOpen(true)}
                  disabled={convertMutation.isPending}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {convertMutation.isPending ? 'Converting...' : 'Convert to Sales Order'}
                </Button>
              )}

              {canSend && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => sendMutation.mutate({ id: estimate.id })}
                  disabled={sendMutation.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sendMutation.isPending ? 'Sending...' : 'Mark as Sent'}
                </Button>
              )}

              {canAcceptDecline && (
                <>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-green-600 hover:text-green-700"
                    onClick={() => acceptMutation.mutate({ id: estimate.id })}
                    disabled={acceptMutation.isPending}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {acceptMutation.isPending ? 'Processing...' : 'Mark as Accepted'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-destructive hover:text-destructive"
                    onClick={() => declineMutation.mutate({ id: estimate.id })}
                    disabled={declineMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    {declineMutation.isPending ? 'Processing...' : 'Mark as Declined'}
                  </Button>
                </>
              )}

              <Separator />

              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setIsEmailDialogOpen(true)}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email to Contact
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => toast.info('Contact assignment coming soon')}
              >
                <Users className="h-4 w-4 mr-2" />
                Assign Contacts
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => toast.info('PDF export coming soon')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Export as PDF
              </Button>

              {canDelete && (
                <>
                  <Separator />
                  <Button
                    variant="destructive"
                    className="w-full justify-start"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Estimate
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
              <p className="font-medium">{estimate.customerName}</p>
              {estimate.projectName && (
                <p className="text-sm text-muted-foreground mt-1">
                  Project: {estimate.projectName}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Related Transactions */}
          {childTransactions && childTransactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Related Transactions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {childTransactions.map((txn: { id: string; transactionNumber: string | null; typeCode: string | null; typeName: string | null }) => (
                  <button
                    key={txn.id}
                    onClick={() => {
                      if (txn.typeCode === 'SALES_ORDER') {
                        router.push(`/transactions/sales/sales-orders/${txn.id}`);
                      } else if (txn.typeCode === 'INVOICE') {
                        router.push(`/transactions/sales/invoices/${txn.id}`);
                      }
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      {txn.typeCode === 'SALES_ORDER' && <ShoppingCart className="h-4 w-4 text-muted-foreground" />}
                      {txn.typeCode === 'INVOICE' && <FileText className="h-4 w-4 text-muted-foreground" />}
                      <div>
                        <p className="text-sm font-medium text-primary">{txn.transactionNumber}</p>
                        <p className="text-xs text-muted-foreground">{txn.typeName}</p>
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

      {/* Convert Confirmation Dialog */}
      <AlertDialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to Sales Order</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new Sales Order from estimate {estimate.transactionNumber}.
              The estimate will be marked as converted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => convertMutation.mutate({ id: estimate.id })}
              disabled={convertMutation.isPending}
            >
              {convertMutation.isPending ? 'Converting...' : 'Convert'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Estimate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete estimate {estimate.transactionNumber}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate({ id: estimate.id })}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Estimate</DialogTitle>
            <DialogDescription>
              Send estimate {estimate.transactionNumber} to the customer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">To: {estimate.customerName}</p>
              <Textarea
                placeholder="Add a personal message (optional)..."
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              toast.info('Email functionality coming soon');
              setIsEmailDialogOpen(false);
            }}>
              <Mail className="h-4 w-4 mr-2" />
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
