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

interface CreditMemo {
  id: string;
  creditMemoNumber: string;
  customerId: string;
  customerName: string;
  transactionDate: string | Date;
  totalAmount: number | string;
  appliedAmount: number | string;
  remainingAmount: number | string;
  status: string;
  memo: string | null;
  relatedInvoiceNumber: string | null;
}

export default function CreditMemosPage() {
  const router = useRouter();
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCreditMemoId, setSelectedCreditMemoId] = useState<string | null>(null);
  const { orgId } = useAuth();

  const creditMemos = [] as CreditMemo[];
  const isLoading = false;
  const selectedCreditMemo = null as CreditMemo | null;

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'DRAFT': return 'outline';
      case 'OPEN': return 'secondary';
      case 'PARTIALLY_APPLIED': return 'default';
      case 'FULLY_APPLIED': return 'default';
      case 'CANCELLED': return 'destructive';
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
    return <div className="container mx-auto py-10"><p>Please select an organization to view credit memos.</p></div>;
  }

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading credit memos...</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Credit Memos</h1>
        <Button onClick={() => router.push('/transactions/sales/credit-memos/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Credit Memo
        </Button>
      </div>

      <Table>
        <TableCaption>A list of customer credit memos.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Credit Memo #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Related Invoice</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {creditMemos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                No credit memos found. Create your first credit memo to get started.
              </TableCell>
            </TableRow>
          ) : (
            creditMemos.map((creditMemo) => (
              <TableRow key={creditMemo.id}>
                <TableCell className="font-medium">{creditMemo.creditMemoNumber}</TableCell>
                <TableCell>{creditMemo.customerName}</TableCell>
                <TableCell>{formatDate(creditMemo.transactionDate)}</TableCell>
                <TableCell>{creditMemo.relatedInvoiceNumber || '-'}</TableCell>
                <TableCell className="text-right">{formatCurrency(creditMemo.totalAmount)}</TableCell>
                <TableCell className="text-right">{formatCurrency(creditMemo.remainingAmount)}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(creditMemo.status)}>
                    {creditMemo.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedCreditMemoId(creditMemo.id);
                        setIsViewDialogOpen(true);
                      }}
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {creditMemo.status === 'DRAFT' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedCreditMemoId(creditMemo.id);
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
            <DialogTitle>Credit Memo Details</DialogTitle>
            <DialogDescription>
              View credit memo {selectedCreditMemo?.creditMemoNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedCreditMemo ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Credit Memo Number</label>
                  <p className="text-sm">{selectedCreditMemo.creditMemoNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Customer</label>
                  <p className="text-sm">{selectedCreditMemo.customerName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Amount</label>
                  <p className="text-sm font-bold">{formatCurrency(selectedCreditMemo.totalAmount)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Remaining</label>
                  <p className="text-sm">{formatCurrency(selectedCreditMemo.remainingAmount)}</p>
                </div>
              </div>
            </div>
          ) : (
            <p>Credit memo not found</p>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Credit Memo</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this credit memo? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast.success('Credit memo deleted');
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
