'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface BillPayment {
  id: string;
  paymentNumber: string;
  vendorId: string;
  vendorName: string;
  paymentDate: string | Date;
  paymentMethod: string;
  totalAmount: number | string;
  status: string;
  memo: string | null;
  bankAccountName: string | null;
  billsApplied: number;
}

export default function BillPaymentsPage() {
  const router = useRouter();
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const { orgId } = useAuth();

  const payments = [] as BillPayment[];
  const isLoading = false;
  const selectedPayment = null as BillPayment | null;

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'DRAFT': return 'outline';
      case 'PENDING': return 'secondary';
      case 'COMPLETED': return 'default';
      case 'VOIDED': return 'destructive';
      default: return 'outline';
    }
  };

  const formatCurrency = (amount: string | number | null) => {
    const num = parseFloat(String(amount || 0));
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view bill payments.</p></div>;
  }

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading bill payments...</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Bill Payments</h1>
        <Button onClick={() => router.push('/transactions/purchasing/bill-payments/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Bill Payment
        </Button>
      </div>

      <Table>
        <TableCaption>A list of bill payments to vendors.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Payment #</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Bank Account</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Bills</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                No bill payments found. Create your first bill payment to get started.
              </TableCell>
            </TableRow>
          ) : (
            payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="font-medium">{payment.paymentNumber}</TableCell>
                <TableCell>{payment.vendorName}</TableCell>
                <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                <TableCell>{payment.paymentMethod}</TableCell>
                <TableCell>{payment.bankAccountName || '-'}</TableCell>
                <TableCell className="text-right">{formatCurrency(payment.totalAmount)}</TableCell>
                <TableCell>{payment.billsApplied}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(payment.status)}>
                    {payment.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedPaymentId(payment.id);
                        setIsViewDialogOpen(true);
                      }}
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {payment.status === 'DRAFT' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedPaymentId(payment.id);
                          setIsDeleteDialogOpen(true);
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Bill Payment Details</DialogTitle>
            <DialogDescription>
              View payment {selectedPayment?.paymentNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedPayment ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Payment Number</label>
                  <p className="text-sm">{selectedPayment.paymentNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Vendor</label>
                  <p className="text-sm">{selectedPayment.vendorName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Amount</label>
                  <p className="text-sm font-bold">{formatCurrency(selectedPayment.totalAmount)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Method</label>
                  <p className="text-sm">{selectedPayment.paymentMethod}</p>
                </div>
              </div>
            </div>
          ) : (
            <p>Payment not found</p>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bill Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this bill payment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast.success('Bill payment deleted');
                setIsDeleteDialogOpen(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
