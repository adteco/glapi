'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'sonner';
import { ArrowLeft, Clock, Users, Trash } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import type { RouterOutputs } from '@glapi/trpc';

type PaymentTerms = RouterOutputs['accountingLists']['getPaymentTerms'];

export default function PaymentTermsDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { orgId } = useAuth();

  // Get payment terms details
  const { data: paymentTerms, isLoading: isLoadingTerms } = trpc.accountingLists.getPaymentTerms.useQuery(
    { id },
    { enabled: !!orgId && !!id }
  );

  // Get customers assigned to this payment terms
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

  // Format payment terms display
  const formatTermsDisplay = (terms: PaymentTerms) => {
    if (!terms) return '';
    const { dueDateType, netDays, dayOfMonth, discountDays, discountPercent } = terms.details;

    let dueStr = '';
    switch (dueDateType) {
      case 'net_days':
        dueStr = `Net ${netDays}`;
        break;
      case 'day_of_month':
        dueStr = `Due ${dayOfMonth}${getOrdinalSuffix(dayOfMonth || 0)} of month`;
        break;
      case 'end_of_month':
        dueStr = netDays > 0 ? `EOM + ${netDays}` : 'End of Month';
        break;
    }

    if (discountPercent > 0 && discountDays > 0) {
      return `${discountPercent}/${discountDays} ${dueStr}`;
    }

    return dueStr;
  };

  const getOrdinalSuffix = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  if (isLoadingTerms) {
    return <div className="container mx-auto py-10">Loading payment terms...</div>;
  }

  if (!paymentTerms) {
    return <div className="container mx-auto py-10">Payment terms not found</div>;
  }

  const customers = customersData?.data || [];

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" onClick={() => router.push('/lists/payment-terms')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Payment Terms
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <Clock className="h-8 w-8" />
          <h1 className="text-3xl font-bold">{paymentTerms.name}</h1>
          {paymentTerms.isDefault && <Badge>Default</Badge>}
          <Badge variant={paymentTerms.isActive ? 'default' : 'secondary'}>
            {paymentTerms.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <p className="text-muted-foreground">{paymentTerms.description || 'No description'}</p>
      </div>

      {/* Details Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Payment Terms Details</CardTitle>
            <CardDescription>Configuration for this payment term</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Code</span>
              <span className="font-medium">{paymentTerms.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Terms</span>
              <span className="font-medium">{formatTermsDisplay(paymentTerms)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due Date Type</span>
              <span className="font-medium capitalize">{paymentTerms.details.dueDateType.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Net Days</span>
              <span className="font-medium">{paymentTerms.details.netDays}</span>
            </div>
            {paymentTerms.details.dayOfMonth && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Day of Month</span>
                <span className="font-medium">{paymentTerms.details.dayOfMonth}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Early Payment Discount</CardTitle>
            <CardDescription>Discount configuration for early payment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentTerms.details.discountPercent > 0 ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount Percent</span>
                  <span className="font-medium">{paymentTerms.details.discountPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount Days</span>
                  <span className="font-medium">{paymentTerms.details.discountDays} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Summary</span>
                  <span className="font-medium">
                    {paymentTerms.details.discountPercent}% off if paid within {paymentTerms.details.discountDays} days
                  </span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">No early payment discount configured</p>
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
            Customers who have these payment terms assigned
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingCustomers ? (
            <div className="text-center py-4">Loading customers...</div>
          ) : customers.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No customers assigned to these payment terms.
            </div>
          ) : (
            <Table>
              <TableCaption>Customers using these payment terms</TableCaption>
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
