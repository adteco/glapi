'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'sonner';
import { ArrowLeft, CreditCard, Users, Trash } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import type { RouterOutputs } from '@glapi/trpc';

type PaymentMethod = RouterOutputs['accountingLists']['getPaymentMethod'];

export default function PaymentMethodDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { orgId } = useAuth();

  // Get payment method details
  const { data: paymentMethod, isLoading: isLoadingMethod } = trpc.accountingLists.getPaymentMethod.useQuery(
    { id },
    { enabled: !!orgId && !!id }
  );

  // Get customers assigned to this payment method
  const { data: customersData, isLoading: isLoadingCustomers, refetch: refetchCustomers } = trpc.accountingLists.getCustomersForAccountingList.useQuery(
    { accountingListId: id, limit: 100 },
    { enabled: !!orgId && !!id }
  );

  const removeFromCustomerMutation = trpc.accountingLists.removeFromCustomer.useMutation({
    onSuccess: () => {
      toast.success('Customer assignment removed');
      refetchCustomers();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to remove assignment');
    },
  });

  const handleRemoveCustomer = async (customerId: string) => {
    if (!confirm('Are you sure you want to remove this customer assignment?')) {
      return;
    }

    removeFromCustomerMutation.mutate({
      customerId,
      accountingListId: id,
    });
  };

  const methodTypeLabels: Record<string, string> = {
    cash: 'Cash',
    check: 'Check',
    credit_card: 'Credit Card',
    debit_card: 'Debit Card',
    ach: 'ACH',
    wire: 'Wire Transfer',
    other: 'Other',
  };

  if (isLoadingMethod) {
    return <div className="container mx-auto py-10">Loading payment method...</div>;
  }

  if (!paymentMethod) {
    return <div className="container mx-auto py-10">Payment method not found</div>;
  }

  const customers = customersData?.data || [];

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" onClick={() => router.push('/lists/payment-methods')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Payment Methods
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <CreditCard className="h-8 w-8" />
          <h1 className="text-3xl font-bold">{paymentMethod.name}</h1>
          {paymentMethod.isDefault && <Badge>Default</Badge>}
          <Badge variant={paymentMethod.isActive ? 'default' : 'secondary'}>
            {paymentMethod.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <p className="text-muted-foreground">{paymentMethod.description || 'No description'}</p>
      </div>

      {/* Details Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Payment Method Details</CardTitle>
            <CardDescription>Configuration for this payment method</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Code</span>
              <span className="font-medium">{paymentMethod.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Method Type</span>
              <span className="font-medium">
                {methodTypeLabels[paymentMethod.details.methodType] || paymentMethod.details.methodType}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={paymentMethod.isActive ? 'default' : 'secondary'}>
                {paymentMethod.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Configuration</CardTitle>
            <CardDescription>Default account for this payment method</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentMethod.details.depositAccountId ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deposit Account</span>
                <span className="font-medium">
                  {paymentMethod.details.depositAccount
                    ? `${paymentMethod.details.depositAccount.code} - ${paymentMethod.details.depositAccount.name}`
                    : paymentMethod.details.depositAccountId.substring(0, 8) + '...'}
                </span>
              </div>
            ) : (
              <p className="text-muted-foreground">No deposit account configured</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customer Assignments */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Assigned Customers</CardTitle>
          </div>
          <CardDescription>
            Customers who have this payment method assigned
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingCustomers ? (
            <div className="text-center py-4">Loading customers...</div>
          ) : customers.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No customers assigned to this payment method.
            </div>
          ) : (
            <Table>
              <TableCaption>Customers using this payment method</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer ID</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Expiration Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">
                      <Button
                        variant="link"
                        className="p-0 h-auto"
                        onClick={() => router.push(`/relationships/customers/${assignment.customerId}`)}
                      >
                        {assignment.customerId.substring(0, 8)}...
                      </Button>
                    </TableCell>
                    <TableCell>{assignment.priority}</TableCell>
                    <TableCell>
                      {assignment.effectiveDate
                        ? new Date(assignment.effectiveDate).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {assignment.expirationDate
                        ? new Date(assignment.expirationDate).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveCustomer(assignment.customerId)}
                        title="Remove Assignment"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
