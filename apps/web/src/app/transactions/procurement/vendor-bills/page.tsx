'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  CreditCard,
  Search,
  Download,
  Filter,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

// Types for Vendor Bills
interface VendorBill {
  id: string;
  billNumber: string;
  vendorId: string;
  vendorName: string;
  purchaseOrderNumber?: string;
  billDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID' | 'CANCELLED';
  matchStatus: 'PENDING' | 'MATCHED' | 'VARIANCE' | 'NOT_APPLICABLE';
  hasVariance: boolean;
  varianceAmount?: number;
}

// Mock data - in production this would come from the API
const mockBills: VendorBill[] = [
  {
    id: '1',
    billNumber: 'BILL-2026-001',
    vendorId: 'v1',
    vendorName: 'Acme Supplies Inc.',
    purchaseOrderNumber: 'PO-2026-015',
    billDate: '2026-01-15',
    dueDate: '2026-02-15',
    totalAmount: 12500.00,
    paidAmount: 0,
    balanceDue: 12500.00,
    status: 'APPROVED',
    matchStatus: 'MATCHED',
    hasVariance: false,
  },
  {
    id: '2',
    billNumber: 'BILL-2026-002',
    vendorId: 'v2',
    vendorName: 'Global Parts Ltd.',
    purchaseOrderNumber: 'PO-2026-018',
    billDate: '2026-01-12',
    dueDate: '2026-01-25',
    totalAmount: 8750.00,
    paidAmount: 0,
    balanceDue: 8750.00,
    status: 'APPROVED',
    matchStatus: 'VARIANCE',
    hasVariance: true,
    varianceAmount: 125.00,
  },
  {
    id: '3',
    billNumber: 'BILL-2026-003',
    vendorId: 'v3',
    vendorName: 'Tech Components',
    billDate: '2026-01-10',
    dueDate: '2026-02-10',
    totalAmount: 5200.00,
    paidAmount: 2600.00,
    balanceDue: 2600.00,
    status: 'PARTIALLY_PAID',
    matchStatus: 'MATCHED',
    hasVariance: false,
  },
  {
    id: '4',
    billNumber: 'BILL-2026-004',
    vendorId: 'v1',
    vendorName: 'Acme Supplies Inc.',
    purchaseOrderNumber: 'PO-2026-022',
    billDate: '2026-01-08',
    dueDate: '2026-01-20',
    totalAmount: 3400.00,
    paidAmount: 3400.00,
    balanceDue: 0,
    status: 'PAID',
    matchStatus: 'MATCHED',
    hasVariance: false,
  },
  {
    id: '5',
    billNumber: 'BILL-2026-005',
    vendorId: 'v4',
    vendorName: 'Industrial Supplies Co.',
    billDate: '2026-01-17',
    dueDate: '2026-02-17',
    totalAmount: 15800.00,
    paidAmount: 0,
    balanceDue: 15800.00,
    status: 'PENDING_APPROVAL',
    matchStatus: 'PENDING',
    hasVariance: false,
  },
];

const statusColors: Record<string, string> = {
  DRAFT: 'secondary',
  PENDING_APPROVAL: 'outline',
  APPROVED: 'default',
  PARTIALLY_PAID: 'default',
  PAID: 'default',
  VOID: 'destructive',
  CANCELLED: 'destructive',
};

const matchStatusColors: Record<string, string> = {
  PENDING: 'outline',
  MATCHED: 'default',
  VARIANCE: 'destructive',
  NOT_APPLICABLE: 'secondary',
};

export default function VendorBillsPage() {
  const { orgId } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBill, setSelectedBill] = useState<VendorBill | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  if (!orgId) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Please select an organization to view vendor bills.</p>
      </div>
    );
  }

  // Filter bills
  const filteredBills = mockBills.filter(bill => {
    const matchesSearch =
      bill.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (bill.purchaseOrderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

    const matchesStatus = statusFilter === 'all' || bill.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate summary stats
  const stats = {
    totalBills: filteredBills.length,
    totalOutstanding: filteredBills.reduce((sum, b) => sum + b.balanceDue, 0),
    overdueCount: filteredBills.filter(b => new Date(b.dueDate) < new Date() && b.balanceDue > 0).length,
    varianceCount: filteredBills.filter(b => b.hasVariance).length,
  };

  const handleViewBill = (bill: VendorBill) => {
    setSelectedBill(bill);
    setViewDialogOpen(true);
  };

  const exportToCsv = () => {
    const headers = ['Bill Number', 'Vendor', 'PO Number', 'Bill Date', 'Due Date', 'Total', 'Balance Due', 'Status', 'Match Status'];
    const rows = filteredBills.map(b => [
      b.billNumber,
      b.vendorName,
      b.purchaseOrderNumber || '',
      b.billDate,
      b.dueDate,
      b.totalAmount.toFixed(2),
      b.balanceDue.toFixed(2),
      b.status,
      b.matchStatus,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor-bills-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Vendor Bills</h1>
          <p className="text-muted-foreground mt-1">
            Process and manage vendor invoices with 2/3-way matching
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCsv}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Bill
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBills}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalOutstanding.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className={stats.overdueCount > 0 ? 'border-red-200' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.overdueCount > 0 ? 'text-red-600' : ''}`}>
              {stats.overdueCount}
            </div>
          </CardContent>
        </Card>
        <Card className={stats.varianceCount > 0 ? 'border-orange-200' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">With Variances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.varianceCount > 0 ? 'text-orange-600' : ''}`}>
              {stats.varianceCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search bills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="VOID">Void</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bills Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill Number</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>PO Number</TableHead>
              <TableHead>Bill Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Balance Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Match</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No vendor bills found
                </TableCell>
              </TableRow>
            ) : (
              filteredBills.map((bill) => {
                const isOverdue = new Date(bill.dueDate) < new Date() && bill.balanceDue > 0;
                return (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium">{bill.billNumber}</TableCell>
                    <TableCell>{bill.vendorName}</TableCell>
                    <TableCell>
                      {bill.purchaseOrderNumber ? (
                        <Link href={`/transactions/inventory/purchase-orders?search=${bill.purchaseOrderNumber}`} className="text-blue-600 hover:underline">
                          {bill.purchaseOrderNumber}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{new Date(bill.billDate).toLocaleDateString()}</TableCell>
                    <TableCell className={isOverdue ? 'text-red-600 font-medium' : ''}>
                      {new Date(bill.dueDate).toLocaleDateString()}
                      {isOverdue && <AlertTriangle className="inline-block w-4 h-4 ml-1" />}
                    </TableCell>
                    <TableCell className="text-right">${bill.totalAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${bill.balanceDue.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[bill.status] as any}>
                        {bill.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={matchStatusColors[bill.matchStatus] as any}>
                        {bill.matchStatus}
                        {bill.hasVariance && bill.varianceAmount && (
                          <span className="ml-1">(${bill.varianceAmount})</span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleViewBill(bill)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {bill.status === 'PENDING_APPROVAL' && (
                          <>
                            <Button variant="ghost" size="icon" className="text-green-600">
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-red-600">
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {bill.balanceDue > 0 && bill.status === 'APPROVED' && (
                          <Button variant="ghost" size="icon" className="text-blue-600" asChild>
                            <Link href={`/transactions/procurement/bill-payments?billId=${bill.id}`}>
                              <CreditCard className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* View Bill Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bill Details - {selectedBill?.billNumber}</DialogTitle>
            <DialogDescription>
              View vendor bill information and matching details
            </DialogDescription>
          </DialogHeader>
          {selectedBill && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Vendor</p>
                  <p className="font-medium">{selectedBill.vendorName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">PO Number</p>
                  <p className="font-medium">{selectedBill.purchaseOrderNumber || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bill Date</p>
                  <p className="font-medium">{new Date(selectedBill.billDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">{new Date(selectedBill.dueDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="font-medium">${selectedBill.totalAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Balance Due</p>
                  <p className="font-medium">${selectedBill.balanceDue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={statusColors[selectedBill.status] as any}>
                    {selectedBill.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Match Status</p>
                  <Badge variant={matchStatusColors[selectedBill.matchStatus] as any}>
                    {selectedBill.matchStatus}
                  </Badge>
                </div>
              </div>
              {selectedBill.hasVariance && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <span className="font-medium text-orange-800">Variance Detected</span>
                  </div>
                  <p className="text-sm text-orange-700 mt-1">
                    This bill has a variance of ${selectedBill.varianceAmount?.toLocaleString()} from the matched documents.
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
