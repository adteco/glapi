'use client';

import { useState, Suspense } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Inbox,
  Search,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Archive,
  FileText,
  Mail,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import type { RouterOutputs } from '@glapi/trpc';

type PendingDocument = RouterOutputs['pendingDocuments']['list']['data'][number];
type StatusCounts = RouterOutputs['pendingDocuments']['getStatusCounts'];

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  PENDING_REVIEW: { label: 'Pending Review', variant: 'default', icon: Clock },
  IN_REVIEW: { label: 'In Review', variant: 'secondary', icon: Eye },
  APPROVED: { label: 'Approved', variant: 'outline', icon: CheckCircle },
  REJECTED: { label: 'Rejected', variant: 'destructive', icon: XCircle },
  CONVERTED: { label: 'Converted', variant: 'outline', icon: FileText },
  CONVERSION_FAILED: { label: 'Failed', variant: 'destructive', icon: AlertTriangle },
  ARCHIVED: { label: 'Archived', variant: 'secondary', icon: Archive },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  HIGH: { label: 'High', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  MEDIUM: { label: 'Medium', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  LOW: { label: 'Low', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
};

const documentTypeConfig: Record<string, { label: string; icon: React.ElementType }> = {
  INVOICE: { label: 'Invoice', icon: FileText },
  PURCHASE_ORDER: { label: 'Purchase Order', icon: FileText },
  RECEIPT: { label: 'Receipt', icon: FileText },
  SHIPPING: { label: 'Shipping', icon: FileText },
  SUPPORT: { label: 'Support', icon: Mail },
  MARKETING: { label: 'Marketing', icon: Mail },
  CONTRACT: { label: 'Contract', icon: FileText },
  REPORT: { label: 'Report', icon: FileText },
  NEWSLETTER: { label: 'Newsletter', icon: Mail },
  MEETING: { label: 'Meeting', icon: Mail },
  CREDIT_MEMO: { label: 'Credit Memo', icon: FileText },
  UNKNOWN: { label: 'Unknown', icon: FileText },
};

function PendingDocumentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { orgId } = useAuth();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.get('type') || 'all');
  const [priorityFilter, setPriorityFilter] = useState<string>(searchParams.get('priority') || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderBy, setOrderBy] = useState<'receivedAt' | 'priority' | 'documentType' | 'status'>('receivedAt');
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('desc');

  const { data: documentsData, isLoading, refetch } = trpc.pendingDocuments.list.useQuery(
    {
      page,
      limit: 25,
      orderBy,
      orderDirection,
      filters: {
        status: statusFilter !== 'all' ? statusFilter as any : undefined,
        documentType: typeFilter !== 'all' ? typeFilter as any : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter as any : undefined,
        search: searchQuery || undefined,
      },
    },
    { enabled: !!orgId }
  );

  const { data: statusCounts } = trpc.pendingDocuments.getStatusCounts.useQuery(
    undefined,
    { enabled: !!orgId }
  );

  const documents = documentsData?.data || [];
  const total = documentsData?.total || 0;
  const totalPages = documentsData?.totalPages || 1;

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleViewDocument = (id: string) => {
    router.push(`/pending-documents/${id}`);
  };

  const toggleSortOrder = () => {
    setOrderDirection(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select an organization</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Inbox className="h-8 w-8" />
            Magic Inbox
          </h1>
          <p className="text-muted-foreground">
            Review and process documents from your inbox
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
        {Object.entries(statusConfig).map(([status, config]) => {
          const Icon = config.icon;
          const count = statusCounts?.[status as keyof StatusCounts] || 0;
          const isActive = statusFilter === status;
          return (
            <Card
              key={status}
              className={`cursor-pointer transition-colors ${isActive ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
              onClick={() => setStatusFilter(isActive ? 'all' : status)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium truncate">
                  {config.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by subject or sender..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Document Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(documentTypeConfig).map(([type, config]) => (
              <SelectItem key={type} value={type}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {Object.entries(priorityConfig).map(([priority, config]) => (
              <SelectItem key={priority} value={priority}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={toggleSortOrder}>
          <ArrowUpDown className="mr-2 h-4 w-4" />
          {orderDirection === 'desc' ? 'Newest First' : 'Oldest First'}
        </Button>
      </div>

      {/* Documents Table */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <Inbox className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || priorityFilter !== 'all'
                        ? 'No documents match your filters.'
                        : 'No pending documents. Your inbox is empty!'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc: PendingDocument) => {
                  const statusConf = statusConfig[doc.status] || statusConfig.PENDING_REVIEW;
                  const priorityConf = priorityConfig[doc.priority] || priorityConfig.MEDIUM;
                  const typeConf = documentTypeConfig[doc.documentType] || documentTypeConfig.UNKNOWN;
                  const StatusIcon = statusConf.icon;
                  const TypeIcon = typeConf.icon;

                  return (
                    <TableRow
                      key={doc.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewDocument(doc.id)}
                    >
                      <TableCell className="whitespace-nowrap">
                        {formatDate(doc.receivedAt)}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate font-medium">
                        {doc.subject || '(No Subject)'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        <div className="flex flex-col">
                          <span className="text-sm">{doc.senderName || doc.senderEmail}</span>
                          {doc.senderName && (
                            <span className="text-xs text-muted-foreground">{doc.senderEmail}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <TypeIcon className="h-3 w-3 opacity-70" />
                          <span className="text-sm">{typeConf.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={priorityConf.className} variant="outline">
                          {priorityConf.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConf.variant}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {statusConf.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {doc.confidenceScore ? (
                          <span className={`text-sm ${
                            parseFloat(doc.confidenceScore) >= 0.8
                              ? 'text-green-600 dark:text-green-400'
                              : parseFloat(doc.confidenceScore) >= 0.5
                                ? 'text-yellow-600 dark:text-yellow-400'
                                : 'text-red-600 dark:text-red-400'
                          }`}>
                            {(parseFloat(doc.confidenceScore) * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDocument(doc.id);
                          }}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((page - 1) * 25) + 1} to {Math.min(page * 25, total)} of {total} documents
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PendingDocumentsPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    }>
      <PendingDocumentsContent />
    </Suspense>
  );
}
