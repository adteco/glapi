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

interface Charge {
  id: string;
  chargeNumber: string;
  entityId: string;
  entityName: string;
  chargeType: string;
  transactionDate: string | Date;
  amount: number | string;
  status: string;
  description: string | null;
  projectId: string | null;
  projectName: string | null;
}

export default function ChargesPage() {
  const router = useRouter();
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedChargeId, setSelectedChargeId] = useState<string | null>(null);
  const { orgId } = useAuth();

  // Placeholder data - replace with actual TRPC query when backend is ready
  const charges = [] as Charge[];
  const isLoading = false;
  const selectedCharge = null as Charge | null;

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'DRAFT': return 'outline';
      case 'PENDING': return 'secondary';
      case 'BILLED': return 'default';
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
    return <div className="container mx-auto py-10"><p>Please select an organization to view charges.</p></div>;
  }

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading charges...</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Charges</h1>
        <Button onClick={() => router.push('/transactions/expenses/charges/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Charge
        </Button>
      </div>

      <Table>
        <TableCaption>A list of charges.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Charge #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Project</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {charges.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                No charges found. Create your first charge to get started.
              </TableCell>
            </TableRow>
          ) : (
            charges.map((charge) => (
              <TableRow key={charge.id}>
                <TableCell className="font-medium">{charge.chargeNumber}</TableCell>
                <TableCell>{charge.entityName || 'Unknown'}</TableCell>
                <TableCell>{charge.chargeType}</TableCell>
                <TableCell>{formatDate(charge.transactionDate)}</TableCell>
                <TableCell>{charge.projectName || '-'}</TableCell>
                <TableCell className="text-right">{formatCurrency(charge.amount)}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(charge.status)}>
                    {charge.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedChargeId(charge.id);
                        setIsViewDialogOpen(true);
                      }}
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {charge.status === 'DRAFT' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedChargeId(charge.id);
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
            <DialogTitle>Charge Details</DialogTitle>
            <DialogDescription>
              View charge {selectedCharge?.chargeNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedCharge ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Charge Number</label>
                  <p className="text-sm">{selectedCharge.chargeNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Customer</label>
                  <p className="text-sm">{selectedCharge.entityName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <p className="text-sm">{selectedCharge.chargeType}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <p className="text-sm">{formatDate(selectedCharge.transactionDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <p className="text-sm">
                    <Badge variant={getStatusBadgeVariant(selectedCharge.status)}>
                      {selectedCharge.status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Amount</label>
                  <p className="text-sm font-bold">{formatCurrency(selectedCharge.amount)}</p>
                </div>
              </div>
              {selectedCharge.description && (
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <p className="text-sm">{selectedCharge.description}</p>
                </div>
              )}
            </div>
          ) : (
            <p>Charge not found</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Charge</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this charge?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast.success('Charge deleted');
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
