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

interface Refund {
  id: string;
  refundNumber: string;
  customerId: string;
  customerName: string;
  refundDate: string | Date;
  refundMethod: string;
  totalAmount: number | string;
  status: string;
  memo: string | null;
  bankAccountName: string | null;
  creditMemosApplied: number;
}

export default function RefundsPage() {
  const router = useRouter();
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRefundId, setSelectedRefundId] = useState<string | null>(null);
  const { orgId } = useAuth();

  const refunds = [] as Refund[];
  const isLoading = false;
  const selectedRefund = null as Refund | null;

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
    return <div className="container mx-auto py-10"><p>Please select an organization to view refunds.</p></div>;
  }

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading refunds...</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Customer Refunds</h1>
        <Button onClick={() => router.push('/transactions/sales/refunds/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Refund
        </Button>
      </div>

      <Table>
        <TableCaption>A list of customer refunds.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Refund #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Bank Account</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Credits</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {refunds.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                No refunds found. Create your first refund to get started.
              </TableCell>
            </TableRow>
          ) : (
            refunds.map((refund) => (
              <TableRow key={refund.id}>
                <TableCell className="font-medium">{refund.refundNumber}</TableCell>
                <TableCell>{refund.customerName}</TableCell>
                <TableCell>{formatDate(refund.refundDate)}</TableCell>
                <TableCell>{refund.refundMethod}</TableCell>
                <TableCell>{refund.bankAccountName || '-'}</TableCell>
                <TableCell className="text-right">{formatCurrency(refund.totalAmount)}</TableCell>
                <TableCell>{refund.creditMemosApplied}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(refund.status)}>
                    {refund.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedRefundId(refund.id);
                        setIsViewDialogOpen(true);
                      }}
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {refund.status === 'DRAFT' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedRefundId(refund.id);
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
            <DialogTitle>Refund Details</DialogTitle>
            <DialogDescription>
              View refund {selectedRefund?.refundNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedRefund ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Refund Number</label>
                  <p className="text-sm">{selectedRefund.refundNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Customer</label>
                  <p className="text-sm">{selectedRefund.customerName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Amount</label>
                  <p className="text-sm font-bold">{formatCurrency(selectedRefund.totalAmount)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Method</label>
                  <p className="text-sm">{selectedRefund.refundMethod}</p>
                </div>
              </div>
            </div>
          ) : (
            <p>Refund not found</p>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Refund</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this refund? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast.success('Refund deleted');
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
