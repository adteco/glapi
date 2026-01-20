'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Calendar,
  DollarSign,
  FileText,
  Building2,
  Hash,
} from 'lucide-react';

export default function DepositDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { orgId } = useAuth();
  const depositId = params.id as string;

  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false);
  const [bankStatementDate, setBankStatementDate] = useState('');
  const [bankStatementRef, setBankStatementRef] = useState('');
  const [bankStatementAmount, setBankStatementAmount] = useState('');

  // Fetch deposit details
  const {
    data: deposit,
    isLoading,
    refetch,
  } = trpc.bankDeposits.get.useQuery(
    { id: depositId },
    { enabled: Boolean(orgId) && Boolean(depositId) }
  );

  // Fetch GL summary
  const { data: glSummary } = trpc.bankDeposits.glSummary.useQuery(
    { depositId },
    { enabled: Boolean(orgId) && Boolean(depositId) }
  );

  // Reconcile mutation
  const reconcileMutation = trpc.bankDeposits.reconcile.useMutation({
    onSuccess: () => {
      toast.success('Deposit reconciled successfully');
      setReconcileDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reconcile deposit');
    },
  });

  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      OPEN: { variant: 'secondary', label: 'Open' },
      SUBMITTED: { variant: 'default', label: 'Submitted' },
      RECONCILED: { variant: 'outline', label: 'Reconciled' },
      CANCELLED: { variant: 'destructive', label: 'Cancelled' },
    };
    const config = variants[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getReconciliationBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      PENDING: { variant: 'secondary', label: 'Pending' },
      MATCHED: { variant: 'outline', label: 'Matched' },
      EXCEPTION: { variant: 'destructive', label: 'Exception' },
    };
    const config = variants[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleReconcileClick = () => {
    if (deposit) {
      setBankStatementDate(deposit.depositDate);
      setBankStatementAmount(deposit.totalAmount);
    }
    setReconcileDialogOpen(true);
  };

  const handleReconcileSubmit = () => {
    if (!bankStatementDate || !bankStatementRef || !bankStatementAmount) {
      toast.error('Please fill in all fields');
      return;
    }
    reconcileMutation.mutate({
      depositId,
      bankStatementDate,
      bankStatementRef,
      bankStatementAmount,
    });
  };

  // Calculate variance if amounts differ
  const calculateVariance = () => {
    if (!deposit || !bankStatementAmount) return null;
    const systemAmount = parseFloat(deposit.totalAmount);
    const bankAmount = parseFloat(bankStatementAmount);
    const variance = bankAmount - systemAmount;
    if (Math.abs(variance) < 0.01) return null;
    return variance;
  };

  const variance = calculateVariance();

  if (isLoading) {
    return (
      <div className="container py-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!deposit) {
    return (
      <div className="container py-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-lg font-medium">Deposit not found</p>
            <Link href="/reconciliation/deposits" className="mt-4">
              <Button variant="outline">Back to Deposits</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canReconcile = deposit.status === 'SUBMITTED' && deposit.reconciliationStatus === 'PENDING';

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/reconciliation/deposits">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{deposit.depositNumber}</h1>
            <p className="text-muted-foreground">
              Deposit Details
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(deposit.status)}
          {getReconciliationBadge(deposit.reconciliationStatus || 'PENDING')}
          {canReconcile && (
            <Button onClick={handleReconcileClick}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Reconcile
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deposit Date</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatDate(deposit.depositDate)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(deposit.totalAmount)}</div>
            <p className="text-xs text-muted-foreground">{deposit.currencyCode}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payments</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{deposit.paymentCount}</div>
            <p className="text-xs text-muted-foreground">Customer payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bank Account</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold truncate">{deposit.bankAccountName || '-'}</div>
          </CardContent>
        </Card>
      </div>

      {/* GL Posting Status */}
      {glSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              GL Posting Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {glSummary.isPosted ? (
                <>
                  <Badge variant="outline" className="text-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Posted
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Transaction ID: {glSummary.glTransactionId}
                  </span>
                  {glSummary.postedAt && (
                    <span className="text-sm text-muted-foreground">
                      Posted: {formatDate(glSummary.postedAt)}
                    </span>
                  )}
                </>
              ) : (
                <Badge variant="secondary">Not Posted</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reconciliation Details (if reconciled) */}
      {deposit.reconciliationStatus === 'MATCHED' && deposit.bankStatementRef && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Reconciliation Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label className="text-muted-foreground">Bank Statement Reference</Label>
                <p className="font-medium">{deposit.bankStatementRef}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Bank Statement Date</Label>
                <p className="font-medium">{formatDate(deposit.bankStatementDate)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Reconciled On</Label>
                <p className="font-medium">{formatDate(deposit.reconciledAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payments in Deposit</CardTitle>
          <CardDescription>
            Customer payments included in this deposit batch
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deposit.payments && deposit.payments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deposit.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.paymentNumber}</TableCell>
                    <TableCell>{payment.entity?.name || '-'}</TableCell>
                    <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{payment.paymentMethod}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(payment.paymentAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{payment.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground">No payments in this deposit</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reconcile Dialog */}
      <Dialog open={reconcileDialogOpen} onOpenChange={setReconcileDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Reconcile Deposit</DialogTitle>
            <DialogDescription>
              Match this deposit against your bank statement. Enter the bank statement details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bankStatementDate">Bank Statement Date</Label>
              <Input
                id="bankStatementDate"
                type="date"
                value={bankStatementDate}
                onChange={(e) => setBankStatementDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankStatementRef">Bank Statement Reference</Label>
              <Input
                id="bankStatementRef"
                placeholder="e.g., Check #12345 or Transaction ID"
                value={bankStatementRef}
                onChange={(e) => setBankStatementRef(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankStatementAmount">Bank Statement Amount</Label>
              <Input
                id="bankStatementAmount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={bankStatementAmount}
                onChange={(e) => setBankStatementAmount(e.target.value)}
              />
            </div>

            {/* Comparison */}
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">System Amount</Label>
                <p className="text-lg font-bold">{formatCurrency(deposit.totalAmount)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Bank Amount</Label>
                <p className="text-lg font-bold">
                  {bankStatementAmount ? formatCurrency(bankStatementAmount) : '-'}
                </p>
              </div>
            </div>

            {/* Variance Alert */}
            {variance !== null && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Amount Variance Detected</AlertTitle>
                <AlertDescription>
                  There is a {formatCurrency(Math.abs(variance))} difference between the system
                  amount and bank statement amount. An exception will be created for review.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReconcileDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReconcileSubmit}
              disabled={
                !bankStatementDate ||
                !bankStatementRef ||
                !bankStatementAmount ||
                reconcileMutation.isPending
              }
            >
              {reconcileMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {variance !== null ? 'Reconcile with Exception' : 'Reconcile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
