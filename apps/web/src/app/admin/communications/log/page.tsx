'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  Search,
  MoreHorizontal,
  Eye,
  RefreshCw,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Send,
  Ban,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow } from 'date-fns';
import type { RouterOutputs } from '@glapi/trpc';

type CommunicationEvent =
  RouterOutputs['communicationEvents']['list']['items'][number];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'sending', label: 'Sending' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'complained', label: 'Complained' },
  { value: 'failed', label: 'Failed' },
];

const EVENT_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'ad_hoc', label: 'Ad Hoc' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'transactional', label: 'Transactional' },
  { value: 'notification', label: 'Notification' },
];

export default function CommunicationLogPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [eventType, setEventType] = useState<string>('all');
  const [page, setPage] = useState(1);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.communicationEvents.list.useQuery({
    search: search || undefined,
    status:
      status !== 'all'
        ? (status as CommunicationEvent['status'])
        : undefined,
    eventType:
      eventType !== 'all'
        ? (eventType as CommunicationEvent['eventType'])
        : undefined,
    page,
    limit: 25,
  });

  const resendMutation = trpc.communicationEvents.resend.useMutation({
    onSuccess: () => {
      toast.success('Email queued for resend');
      utils.communicationEvents.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to resend: ${error.message}`);
    },
  });

  const cancelMutation = trpc.communicationEvents.cancel.useMutation({
    onSuccess: () => {
      toast.success('Email cancelled');
      utils.communicationEvents.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to cancel: ${error.message}`);
    },
  });

  const getStatusIcon = (eventStatus: string) => {
    switch (eventStatus) {
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'sent':
      case 'sending':
        return <Send className="h-4 w-4 text-blue-500" />;
      case 'bounced':
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'complained':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <Mail className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (eventStatus: string) => {
    const variants: Record<
      string,
      'default' | 'secondary' | 'destructive' | 'outline'
    > = {
      delivered: 'default',
      sent: 'secondary',
      sending: 'secondary',
      pending: 'outline',
      bounced: 'destructive',
      failed: 'destructive',
      complained: 'destructive',
    };
    return (
      <Badge variant={variants[eventStatus] || 'outline'}>{eventStatus}</Badge>
    );
  };

  const getEventTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      ad_hoc: 'bg-gray-100 text-gray-800',
      workflow: 'bg-purple-100 text-purple-800',
      transactional: 'bg-blue-100 text-blue-800',
      notification: 'bg-yellow-100 text-yellow-800',
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${colors[type] || colors.ad_hoc}`}
      >
        {type.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Communication Log</h1>
        <p className="text-muted-foreground">
          Track all sent communications and their delivery status
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by recipient email or subject..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={eventType}
              onValueChange={(value) => {
                setEventType(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : data?.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Mail className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">
                No communications found
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {search || status !== 'all' || eventType !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Communications will appear here after they are sent'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{getStatusIcon(event.status)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{event.toEmail}</p>
                        {event.toName && (
                          <p className="text-xs text-muted-foreground">
                            {event.toName}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[250px]">
                      <Link
                        href={`/admin/communications/log/${event.id}`}
                        className="hover:underline truncate block"
                      >
                        {event.subject}
                      </Link>
                    </TableCell>
                    <TableCell>{getEventTypeBadge(event.eventType)}</TableCell>
                    <TableCell>{getStatusBadge(event.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {event.sentAt ? (
                        <span title={format(new Date(event.sentAt), 'PPpp')}>
                          {formatDistanceToNow(new Date(event.sentAt), {
                            addSuffix: true,
                          })}
                        </span>
                      ) : event.scheduledAt ? (
                        <span
                          className="text-yellow-600"
                          title={format(new Date(event.scheduledAt), 'PPpp')}
                        >
                          Scheduled{' '}
                          {formatDistanceToNow(new Date(event.scheduledAt), {
                            addSuffix: true,
                          })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Pending</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/admin/communications/log/${event.id}`}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          {(event.status === 'failed' ||
                            event.status === 'bounced') && (
                            <DropdownMenuItem
                              onClick={() =>
                                resendMutation.mutate({ id: event.id })
                              }
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Resend
                            </DropdownMenuItem>
                          )}
                          {event.status === 'pending' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  cancelMutation.mutate({ id: event.id })
                                }
                                className="text-destructive"
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                Cancel
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-6 py-4">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * 25 + 1} to{' '}
              {Math.min(page * 25, data.pagination.total)} of{' '}
              {data.pagination.total} events
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((p) => Math.min(data.pagination.totalPages, p + 1))
                }
                disabled={page === data.pagination.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
