'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import {
  Mail,
  FileText,
  GitBranch,
  TrendingUp,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function CommunicationsOverviewPage() {
  // Fetch statistics
  const { data: eventStats, isLoading: loadingEvents } =
    trpc.communicationEvents.getStats.useQuery({
      period: 'last_30_days',
    });

  const { data: templates, isLoading: loadingTemplates } =
    trpc.emailTemplates.list.useQuery({
      limit: 5,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });

  const { data: workflows, isLoading: loadingWorkflows } =
    trpc.communicationWorkflows.list.useQuery({
      limit: 5,
    });

  const { data: recentEvents, isLoading: loadingRecentEvents } =
    trpc.communicationEvents.list.useQuery({
      limit: 5,
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Communications Dashboard</h1>
        <p className="text-muted-foreground">
          Manage email templates, workflows, and track delivery metrics
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingEvents ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {eventStats?.totalSent ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loadingEvents ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {eventStats?.totalDelivered ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {eventStats?.totalSent
                    ? `${((eventStats.totalDelivered / eventStats.totalSent) * 100).toFixed(1)}% delivery rate`
                    : 'No emails sent'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bounced</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {loadingEvents ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {eventStats?.totalBounced ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {eventStats?.totalSent
                    ? `${((eventStats.totalBounced / eventStats.totalSent) * 100).toFixed(1)}% bounce rate`
                    : 'No bounces'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {loadingEvents ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {eventStats?.openRate
                    ? `${eventStats.openRate.toFixed(1)}%`
                    : '0%'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {eventStats?.totalOpened ?? 0} emails opened
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions and Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks to get started</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/admin/communications/templates/new">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Plus className="h-4 w-4" />
                Create Email Template
              </Button>
            </Link>
            <Link href="/admin/communications/workflows/new">
              <Button variant="outline" className="w-full justify-start gap-2">
                <GitBranch className="h-4 w-4" />
                Create Workflow
              </Button>
            </Link>
            <Link href="/admin/communications/log">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Mail className="h-4 w-4" />
                View Communication Log
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Templates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Templates</CardTitle>
              <CardDescription>Recently updated email templates</CardDescription>
            </div>
            <Link href="/admin/communications/templates">
              <Button variant="ghost" size="sm">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loadingTemplates ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : templates?.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No templates yet.{' '}
                <Link
                  href="/admin/communications/templates/new"
                  className="text-primary hover:underline"
                >
                  Create your first template
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {templates?.items.map((template) => (
                  <Link
                    key={template.id}
                    href={`/admin/communications/templates/${template.id}`}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-muted"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {template.name}
                      </span>
                    </div>
                    <Badge
                      variant={
                        template.status === 'active'
                          ? 'default'
                          : template.status === 'draft'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {template.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Communications */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Communications</CardTitle>
            <CardDescription>Latest email activity</CardDescription>
          </div>
          <Link href="/admin/communications/log">
            <Button variant="ghost" size="sm">
              View all
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loadingRecentEvents ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="mt-1 h-3 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : recentEvents?.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No communications sent yet.
            </p>
          ) : (
            <div className="space-y-3">
              {recentEvents?.items.map((event) => (
                <Link
                  key={event.id}
                  href={`/admin/communications/log/${event.id}`}
                  className="flex items-center justify-between rounded-md p-2 hover:bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        event.status === 'delivered'
                          ? 'bg-green-100 text-green-600'
                          : event.status === 'bounced' ||
                              event.status === 'failed'
                            ? 'bg-red-100 text-red-600'
                            : event.status === 'sent' ||
                                event.status === 'sending'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {event.status === 'delivered' ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : event.status === 'bounced' ||
                        event.status === 'failed' ? (
                        <XCircle className="h-4 w-4" />
                      ) : event.status === 'pending' ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{event.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        To: {event.toEmail}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      event.status === 'delivered'
                        ? 'default'
                        : event.status === 'bounced' ||
                            event.status === 'failed'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {event.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
