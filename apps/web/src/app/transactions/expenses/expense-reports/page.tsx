'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Eye, Check, X, Send } from 'lucide-react';
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

interface ExpenseReportLine {
  id: string;
  expenseDate: string | Date;
  category: string;
  description: string;
  amount: number | string;
  receipt?: string;
}

interface ExpenseReport {
  id: string;
  reportNumber: string;
  employeeId: string;
  employeeName: string;
  submittedDate: string | Date | null;
  periodStart: string | Date;
  periodEnd: string | Date;
  totalAmount: number | string;
  status: string;
  memo: string | null;
  lines?: ExpenseReportLine[];
}

export default function ExpenseReportsPage() {
  const router = useRouter();
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const { orgId } = useAuth();

  // Placeholder data - replace with actual TRPC query when backend is ready
  const reports = [] as ExpenseReport[];
  const isLoading = false;
  const selectedReport = null as ExpenseReport | null;

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'DRAFT': return 'outline';
      case 'SUBMITTED': return 'secondary';
      case 'APPROVED': return 'default';
      case 'REJECTED': return 'destructive';
      case 'REIMBURSED': return 'default';
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
    return <div className="container mx-auto py-10"><p>Please select an organization to view expense reports.</p></div>;
  }

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading expense reports...</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Expense Reports</h1>
        <Button onClick={() => router.push('/transactions/expenses/expense-reports/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Expense Report
        </Button>
      </div>

      <Table>
        <TableCaption>A list of expense reports.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Report #</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                No expense reports found. Create your first expense report to get started.
              </TableCell>
            </TableRow>
          ) : (
            reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell className="font-medium">{report.reportNumber}</TableCell>
                <TableCell>{report.employeeName || 'Unknown'}</TableCell>
                <TableCell>{formatDate(report.periodStart)} - {formatDate(report.periodEnd)}</TableCell>
                <TableCell>{formatDate(report.submittedDate)}</TableCell>
                <TableCell className="text-right">{formatCurrency(report.totalAmount)}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(report.status)}>
                    {report.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedReportId(report.id);
                        setIsViewDialogOpen(true);
                      }}
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {report.status === 'DRAFT' && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toast.success('Report submitted for approval')}
                          title="Submit"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedReportId(report.id);
                            setIsDeleteDialogOpen(true);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {report.status === 'SUBMITTED' && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toast.success('Report approved')}
                          title="Approve"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toast.success('Report rejected')}
                          title="Reject"
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
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
            <DialogTitle>Expense Report Details</DialogTitle>
            <DialogDescription>
              View expense report {selectedReport?.reportNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedReport ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Report Number</label>
                  <p className="text-sm">{selectedReport.reportNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Employee</label>
                  <p className="text-sm">{selectedReport.employeeName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Period</label>
                  <p className="text-sm">{formatDate(selectedReport.periodStart)} - {formatDate(selectedReport.periodEnd)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <p className="text-sm">
                    <Badge variant={getStatusBadgeVariant(selectedReport.status)}>
                      {selectedReport.status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Total</label>
                  <p className="text-sm font-bold">{formatCurrency(selectedReport.totalAmount)}</p>
                </div>
              </div>
            </div>
          ) : (
            <p>Report not found</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense report?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast.success('Expense report deleted');
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
