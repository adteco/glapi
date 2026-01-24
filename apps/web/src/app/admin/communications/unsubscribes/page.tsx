'use client';

import { useState } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  Search,
  UserX,
  Plus,
  RefreshCw,
  Mail,
  AlertCircle,
  Ban,
  MessageSquareX,
  UserCog,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';

const REASON_LABELS: Record<string, string> = {
  user_request: 'User Request',
  hard_bounce: 'Hard Bounce',
  complaint: 'Complaint',
  admin_action: 'Admin Action',
};

const REASON_ICONS: Record<string, React.ReactNode> = {
  user_request: <UserX className="h-4 w-4" />,
  hard_bounce: <Ban className="h-4 w-4" />,
  complaint: <MessageSquareX className="h-4 w-4" />,
  admin_action: <UserCog className="h-4 w-4" />,
};

const addUnsubscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
  reason: z.enum(['user_request', 'hard_bounce', 'complaint', 'admin_action']),
});

type AddUnsubscribeValues = z.infer<typeof addUnsubscribeSchema>;

export default function UnsubscribesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const utils = trpc.useUtils();

  // Note: This would need a new TRPC procedure to list unsubscribes
  // For now, we'll show the UI structure
  const isLoading = false;
  const data = {
    items: [] as Array<{
      id: string;
      email: string;
      reason: string;
      unsubscribedAt: string;
      resubscribedAt: string | null;
      isActive: boolean;
      entityType?: string;
      entityId?: string;
    }>,
    pagination: {
      total: 0,
      totalPages: 0,
    },
  };

  const { data: suppressionCheck } =
    trpc.communicationEvents.checkSuppression.useQuery(
      { email: search },
      { enabled: search.includes('@') }
    );

  const form = useForm<AddUnsubscribeValues>({
    resolver: zodResolver(addUnsubscribeSchema),
    defaultValues: {
      email: '',
      reason: 'admin_action',
    },
  });

  const handleAddSubmit = (values: AddUnsubscribeValues) => {
    // This would call a mutation to add to suppression list
    toast.success(`Added ${values.email} to suppression list`);
    setShowAddDialog(false);
    form.reset();
  };

  const getReasonBadge = (reason: string) => {
    const colors: Record<string, string> = {
      user_request: 'bg-blue-100 text-blue-800',
      hard_bounce: 'bg-red-100 text-red-800',
      complaint: 'bg-orange-100 text-orange-800',
      admin_action: 'bg-gray-100 text-gray-800',
    };
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${colors[reason] || colors.admin_action}`}
      >
        {REASON_ICONS[reason]}
        {REASON_LABELS[reason] || reason}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Unsubscribes & Suppression</h1>
          <p className="text-muted-foreground">
            Manage email suppression list and unsubscribed addresses
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add to Suppression List
        </Button>
      </div>

      {/* Quick Check */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Check Email Status</CardTitle>
          <CardDescription>
            Quickly check if an email is on the suppression list
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Enter email address to check..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          {search.includes('@') && suppressionCheck && (
            <div className="mt-4 p-4 rounded-md border">
              <div className="flex items-start gap-3">
                {suppressionCheck.isSuppressed ? (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-600">
                        Email is suppressed
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        This email address is on the suppression list and will
                        not receive any communications.
                      </p>
                      {suppressionCheck.reason && (
                        <div className="mt-2">
                          {getReasonBadge(suppressionCheck.reason)}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Mail className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-600">
                        Email is active
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        This email address can receive communications.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Suppressed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Emails on suppression list
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">User Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Manual unsubscribes
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Hard Bounces</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Invalid addresses
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Complaints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Spam reports
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Suppression List Table */}
      <Card>
        <CardHeader>
          <CardTitle>Suppression List</CardTitle>
          <CardDescription>
            All email addresses that are blocked from receiving communications
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <UserX className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">
                No suppressed emails
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                The suppression list is empty. Emails that bounce, receive
                complaints, or manually unsubscribe will appear here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Suppressed At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.email}</TableCell>
                    <TableCell>{getReasonBadge(item.reason)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(item.unsubscribedAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {item.isActive ? (
                        <Badge variant="destructive">Suppressed</Badge>
                      ) : (
                        <Badge variant="outline">Resubscribed</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.isActive && (
                        <Button variant="ghost" size="sm">
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Resubscribe
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Pagination */}
        {data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-6 py-4">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * 25 + 1} to{' '}
              {Math.min(page * 25, data.pagination.total)} of{' '}
              {data.pagination.total} entries
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

      {/* Add to Suppression List Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Suppression List</DialogTitle>
            <DialogDescription>
              Manually add an email address to the suppression list. This email
              will no longer receive any communications.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleAddSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="user@example.com"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin_action">
                          Admin Action
                        </SelectItem>
                        <SelectItem value="user_request">
                          User Request
                        </SelectItem>
                        <SelectItem value="hard_bounce">Hard Bounce</SelectItem>
                        <SelectItem value="complaint">Complaint</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Why this email is being suppressed
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Add to List</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
