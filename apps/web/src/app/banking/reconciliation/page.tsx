'use client';

import { useState } from 'react';
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
  Check,
  X,
  AlertTriangle,
  Building2,
  DollarSign,
  FileCheck,
  Clock,
  Search,
  CheckCircle2,
  XCircle,
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { RouterOutputs } from '@glapi/trpc';

// Use TRPC inferred types to prevent type drift
type BankDeposit = RouterOutputs['bankDeposits']['list']['data'][number];
type ReconciliationException = RouterOutputs['bankDeposits']['listExceptions']['data'][number];

// Form schemas
const reconcileFormSchema = z.object({
  bankStatementDate: z.string().min(1, 'Bank statement date is required'),
  bankStatementRef: z.string().min(1, 'Bank reference is required'),
  bankStatementAmount: z.string().refine((val) => !isNaN(parseFloat(val)), {
    message: 'Amount must be a valid number',
  }),
});

const resolveExceptionSchema = z.object({
  resolutionNotes: z.string().min(1, 'Resolution notes are required'),
});

type ReconcileFormValues = z.infer<typeof reconcileFormSchema>;
type ResolveExceptionValues = z.infer<typeof resolveExceptionSchema>;

export default function BankReconciliationPage() {
  const { orgId } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [selectedDeposit, setSelectedDeposit] = useState<BankDeposit | null>(null);
  const [selectedException, setSelectedException] = useState<ReconciliationException | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // TRPC queries
  const { data: dashboardData } = trpc.bankDeposits.dashboardStats.useQuery(
    {},
    { enabled: !!orgId }
  );

  const { data: depositsData, isLoading: depositsLoading, refetch: refetchDeposits } = trpc.bankDeposits.list.useQuery(
    {
      status: statusFilter !== 'all' ? statusFilter as any : undefined,
      page: 1,
      limit: 50,
    },
    { enabled: !!orgId }
  );

  const { data: pendingData, refetch: refetchPending } = trpc.bankDeposits.pendingReconciliation.useQuery(
    {},
    { enabled: !!orgId }
  );

  const { data: exceptionsData, isLoading: exceptionsLoading, refetch: refetchExceptions } = trpc.bankDeposits.listExceptions.useQuery(
    { status: 'EXCEPTION', page: 1, limit: 50 },
    { enabled: !!orgId }
  );

  // TRPC mutations
  const reconcileMutation = trpc.bankDeposits.reconcile.useMutation({
    onSuccess: () => {
      toast.success('Deposit reconciled successfully');
      setIsReconcileOpen(false);
      setSelectedDeposit(null);
      reconcileForm.reset();
      refetchDeposits();
      refetchPending();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reconcile deposit');
    },
  });

  const resolveExceptionMutation = trpc.bankDeposits.resolveException.useMutation({
    onSuccess: () => {
      toast.success('Exception resolved');
      setIsResolveOpen(false);
      setSelectedException(null);
      resolveForm.reset();
      refetchExceptions();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to resolve exception');
    },
  });

  // Forms
  const reconcileForm = useForm<ReconcileFormValues>({
    resolver: zodResolver(reconcileFormSchema),
    defaultValues: {
      bankStatementDate: new Date().toISOString().split('T')[0],
      bankStatementRef: '',
      bankStatementAmount: '',
    },
  });

  const resolveForm = useForm<ResolveExceptionValues>({
    resolver: zodResolver(resolveExceptionSchema),
    defaultValues: {
      resolutionNotes: '',
    },
  });

  // Data extraction
  const deposits = depositsData?.data || [];
  const pendingDeposits = pendingData || [];
  const exceptions = exceptionsData?.data || [];

  // Handlers
  const handleOpenReconcile = (deposit: BankDeposit) => {
    setSelectedDeposit(deposit);
    reconcileForm.reset({
      bankStatementDate: new Date().toISOString().split('T')[0],
      bankStatementRef: '',
      bankStatementAmount: deposit.totalAmount,
    });
    setIsReconcileOpen(true);
  };

  const handleReconcile = (data: ReconcileFormValues) => {
    if (!selectedDeposit) return;
    reconcileMutation.mutate({
      depositId: selectedDeposit.id,
      bankStatementDate: data.bankStatementDate,
      bankStatementRef: data.bankStatementRef,
      bankStatementAmount: data.bankStatementAmount,
    });
  };

  const handleOpenResolve = (exception: ReconciliationException) => {
    setSelectedException(exception);
    resolveForm.reset({ resolutionNotes: '' });
    setIsResolveOpen(true);
  };

  const handleResolveException = (data: ResolveExceptionValues) => {
    if (!selectedException) return;
    resolveExceptionMutation.mutate({
      exceptionId: selectedException.id,
      resolutionNotes: data.resolutionNotes,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Open</Badge>;
      case 'SUBMITTED':
        return <Badge className="bg-blue-100 text-blue-800"><FileCheck className="h-3 w-3 mr-1" />Submitted</Badge>;
      case 'RECONCILED':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Reconciled</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-gray-100 text-gray-800"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getReconciliationBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline" className="text-yellow-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'MATCHED':
        return <Badge className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1" />Matched</Badge>;
      case 'EXCEPTION':
        return <Badge className="bg-red-100 text-red-800"><AlertTriangle className="h-3 w-3 mr-1" />Exception</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
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
          <h1 className="text-3xl font-bold tracking-tight">Bank Reconciliation</h1>
          <p className="text-muted-foreground">Match deposits with bank statements</p>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reconciliation</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.pendingReconciliationCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(dashboardData?.pendingReconciliationAmount || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reconciled</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.reconciledDeposits || 0}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(dashboardData?.reconciledAmount || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exceptions</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {dashboardData?.openExceptionsCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">Need resolution</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.totalDeposits || 0}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(dashboardData?.totalAmount || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pendingDeposits.length})
          </TabsTrigger>
          <TabsTrigger value="all">All Deposits</TabsTrigger>
          <TabsTrigger value="exceptions">
            Exceptions ({exceptions.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Reconciliation Tab */}
        <TabsContent value="pending" className="space-y-4">
          {depositsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <Table>
              <TableCaption>Deposits ready for reconciliation</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Deposit #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Payments</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingDeposits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No deposits pending reconciliation
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingDeposits.map((deposit: BankDeposit) => (
                    <TableRow key={deposit.id}>
                      <TableCell className="font-medium">{deposit.depositNumber}</TableCell>
                      <TableCell>{formatDate(deposit.depositDate)}</TableCell>
                      <TableCell>{deposit.paymentCount || 0}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(deposit.totalAmount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(deposit.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleOpenReconcile(deposit)}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Reconcile
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* All Deposits Tab */}
        <TabsContent value="all" className="space-y-4">
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="RECONCILED">Reconciled</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {depositsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <Table>
              <TableCaption>All bank deposits</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Deposit #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reconciliation</TableHead>
                  <TableHead>Bank Ref</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deposits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No deposits found
                    </TableCell>
                  </TableRow>
                ) : (
                  deposits.map((deposit: BankDeposit) => (
                    <TableRow key={deposit.id}>
                      <TableCell className="font-medium">{deposit.depositNumber}</TableCell>
                      <TableCell>{formatDate(deposit.depositDate)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(deposit.totalAmount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(deposit.status)}</TableCell>
                      <TableCell>{getReconciliationBadge(deposit.reconciliationStatus)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {deposit.bankStatementRef || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {deposit.status === 'SUBMITTED' && deposit.reconciliationStatus === 'PENDING' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenReconcile(deposit)}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Reconcile
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* Exceptions Tab */}
        <TabsContent value="exceptions" className="space-y-4">
          {exceptionsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <Table>
              <TableCaption>Reconciliation exceptions requiring resolution</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Deposit #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">System Amount</TableHead>
                  <TableHead className="text-right">Bank Amount</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No exceptions to resolve
                    </TableCell>
                  </TableRow>
                ) : (
                  exceptions.map((exception: ReconciliationException) => (
                    <TableRow key={exception.id}>
                      <TableCell className="font-medium">{exception.depositNumber || '-'}</TableCell>
                      <TableCell className="capitalize">{exception.exceptionType.replace('_', ' ')}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{exception.exceptionDescription}</TableCell>
                      <TableCell className="text-right">{formatCurrency(exception.systemAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(exception.bankStatementAmount)}</TableCell>
                      <TableCell className="text-right font-medium text-destructive">
                        {formatCurrency(exception.varianceAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenResolve(exception)}
                        >
                          Resolve
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      {/* Reconcile Dialog */}
      <Dialog open={isReconcileOpen} onOpenChange={setIsReconcileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reconcile Deposit</DialogTitle>
            <DialogDescription>
              Match deposit {selectedDeposit?.depositNumber} with bank statement
            </DialogDescription>
          </DialogHeader>
          <Form {...reconcileForm}>
            <form onSubmit={reconcileForm.handleSubmit(handleReconcile)} className="space-y-4">
              {selectedDeposit && (
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deposit Amount:</span>
                    <span className="font-medium">{formatCurrency(selectedDeposit.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deposit Date:</span>
                    <span>{formatDate(selectedDeposit.depositDate)}</span>
                  </div>
                </div>
              )}

              <FormField
                control={reconcileForm.control}
                name="bankStatementDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank Statement Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={reconcileForm.control}
                name="bankStatementRef"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank Reference *</FormLabel>
                    <FormControl>
                      <Input placeholder="Bank transaction reference" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={reconcileForm.control}
                name="bankStatementAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank Statement Amount *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          className="pl-8"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsReconcileOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={reconcileMutation.isPending}>
                  {reconcileMutation.isPending ? 'Reconciling...' : 'Reconcile'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Resolve Exception Dialog */}
      <Dialog open={isResolveOpen} onOpenChange={setIsResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Exception</DialogTitle>
            <DialogDescription>
              Provide resolution notes for this reconciliation exception
            </DialogDescription>
          </DialogHeader>
          <Form {...resolveForm}>
            <form onSubmit={resolveForm.handleSubmit(handleResolveException)} className="space-y-4">
              {selectedException && (
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="capitalize">{selectedException.exceptionType.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">System Amount:</span>
                    <span>{formatCurrency(selectedException.systemAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank Amount:</span>
                    <span>{formatCurrency(selectedException.bankStatementAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Difference:</span>
                    <span className="font-medium text-destructive">
                      {formatCurrency(selectedException.varianceAmount)}
                    </span>
                  </div>
                  <p className="text-sm mt-2">{selectedException.exceptionDescription}</p>
                </div>
              )}

              <FormField
                control={resolveForm.control}
                name="resolutionNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resolution Notes *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Explain how this exception was resolved..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsResolveOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={resolveExceptionMutation.isPending}>
                  {resolveExceptionMutation.isPending ? 'Resolving...' : 'Resolve Exception'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
