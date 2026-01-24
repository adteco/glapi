'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Eye, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
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

interface VendorBillLine {
  id: string;
  itemId: string | null;
  itemName: string | null;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  lineAmount: number | string;
  totalLineAmount: number | string;
}

interface VendorBill {
  id: string;
  transactionNumber: string;
  vendorId: string;
  transactionDate: string | Date;
  dueDate: string | Date | null;
  subtotalAmount: number | string;
  taxAmount: number | string | null;
  totalAmount: number | string;
  status: string;
  memo: string | null;
  vendorName: string;
  lines?: VendorBillLine[];
}

export default function VendorBillsPage() {
  const router = useRouter();
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const { orgId } = useAuth();

  // Placeholder data - replace with actual TRPC query when backend is ready
  const bills = [] as VendorBill[];
  const isLoading = false;
  const selectedBill = null as VendorBill | null;

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'DRAFT': return 'outline';
      case 'PENDING': return 'secondary';
      case 'APPROVED': return 'default';
      case 'PAID': return 'default';
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
    return <div className="container mx-auto py-10"><p>Please select an organization to view vendor bills.</p></div>;
  }

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading vendor bills...</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Vendor Bills</h1>
        <Button onClick={() => router.push('/transactions/purchasing/vendor-bills/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Vendor Bill
        </Button>
      </div>

      <Table>
        <TableCaption>A list of vendor bills.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Bill #</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bills.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                No vendor bills found. Create your first vendor bill to get started.
              </TableCell>
            </TableRow>
          ) : (
            bills.map((bill) => (
              <TableRow key={bill.id}>
                <TableCell className="font-medium">{bill.transactionNumber}</TableCell>
                <TableCell>{bill.vendorName || 'Unknown'}</TableCell>
                <TableCell>{formatDate(bill.transactionDate)}</TableCell>
                <TableCell>{formatDate(bill.dueDate)}</TableCell>
                <TableCell className="text-right">{formatCurrency(bill.totalAmount)}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(bill.status)}>
                    {bill.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedBillId(bill.id);
                        setIsViewDialogOpen(true);
                      }}
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {bill.status === 'DRAFT' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedBillId(bill.id);
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

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vendor Bill Details</DialogTitle>
            <DialogDescription>
              View vendor bill {selectedBill?.transactionNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedBill ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Bill Number</label>
                  <p className="text-sm">{selectedBill.transactionNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Vendor</label>
                  <p className="text-sm">{selectedBill.vendorName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <p className="text-sm">{formatDate(selectedBill.transactionDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Due Date</label>
                  <p className="text-sm">{formatDate(selectedBill.dueDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <p className="text-sm">
                    <Badge variant={getStatusBadgeVariant(selectedBill.status)}>
                      {selectedBill.status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Total</label>
                  <p className="text-sm font-bold">{formatCurrency(selectedBill.totalAmount)}</p>
                </div>
              </div>
            </div>
          ) : (
            <p>Bill not found</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor Bill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this vendor bill?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast.success('Vendor bill deleted');
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
