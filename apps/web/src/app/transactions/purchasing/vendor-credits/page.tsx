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

interface VendorCredit {
  id: string;
  creditNumber: string;
  vendorId: string;
  vendorName: string;
  transactionDate: string | Date;
  totalAmount: number | string;
  appliedAmount: number | string;
  remainingAmount: number | string;
  status: string;
  memo: string | null;
  relatedBillNumber: string | null;
}

export default function VendorCreditsPage() {
  const router = useRouter();
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCreditId, setSelectedCreditId] = useState<string | null>(null);
  const { orgId } = useAuth();

  const credits = [] as VendorCredit[];
  const isLoading = false;
  const selectedCredit = null as VendorCredit | null;

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
    return <div className="container mx-auto py-10"><p>Please select an organization to view vendor credits.</p></div>;
  }

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading vendor credits...</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Vendor Credits</h1>
        <Button onClick={() => router.push('/transactions/purchasing/vendor-credits/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Vendor Credit
        </Button>
      </div>

      <Table>
        <TableCaption>A list of vendor credits (bill credits).</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Credit #</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Related Bill</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {credits.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                No vendor credits found. Create your first vendor credit to get started.
              </TableCell>
            </TableRow>
          ) : (
            credits.map((credit) => (
              <TableRow key={credit.id}>
                <TableCell className="font-medium">{credit.creditNumber}</TableCell>
                <TableCell>{credit.vendorName}</TableCell>
                <TableCell>{formatDate(credit.transactionDate)}</TableCell>
                <TableCell>{credit.relatedBillNumber || '-'}</TableCell>
                <TableCell className="text-right">{formatCurrency(credit.totalAmount)}</TableCell>
                <TableCell className="text-right">{formatCurrency(credit.remainingAmount)}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(credit.status)}>
                    {credit.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedCreditId(credit.id);
                        setIsViewDialogOpen(true);
                      }}
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {credit.status === 'DRAFT' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedCreditId(credit.id);
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
            <DialogTitle>Vendor Credit Details</DialogTitle>
            <DialogDescription>
              View vendor credit {selectedCredit?.creditNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedCredit ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Credit Number</label>
                  <p className="text-sm">{selectedCredit.creditNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Vendor</label>
                  <p className="text-sm">{selectedCredit.vendorName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Amount</label>
                  <p className="text-sm font-bold">{formatCurrency(selectedCredit.totalAmount)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Remaining</label>
                  <p className="text-sm">{formatCurrency(selectedCredit.remainingAmount)}</p>
                </div>
              </div>
            </div>
          ) : (
            <p>Credit not found</p>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor Credit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this vendor credit? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast.success('Vendor credit deleted');
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
