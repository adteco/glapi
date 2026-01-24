'use client';

import { useParams, useRouter } from 'next/navigation';
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
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  ArrowLeft,
  RefreshCw,
  Mail,
  User,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  MousePointerClick,
  Eye,
  Ban,
  ExternalLink,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function CommunicationEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: event, isLoading } = trpc.communicationEvents.get.useQuery({
    id: params.id as string,
  });

  const resendMutation = trpc.communicationEvents.resend.useMutation({
    onSuccess: () => {
      toast.success('Email queued for resend');
      utils.communicationEvents.get.invalidate({ id: params.id as string });
    },
    onError: (error) => {
      toast.error(`Failed to resend: ${error.message}`);
    },
  });

  const cancelMutation = trpc.communicationEvents.cancel.useMutation({
    onSuccess: () => {
      toast.success('Email cancelled');
      utils.communicationEvents.get.invalidate({ id: params.id as string });
    },
    onError: (error) => {
      toast.error(`Failed to cancel: ${error.message}`);
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'sent':
      case 'sending':
        return <Send className="h-5 w-5 text-blue-500" />;
      case 'bounced':
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'complained':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-gray-500" />;
      default:
        return <Mail className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
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
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const getTrackingEventIcon = (type: string) => {
    switch (type) {
      case 'send':
        return <Send className="h-4 w-4" />;
      case 'delivery':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'open':
        return <Eye className="h-4 w-4 text-blue-500" />;
      case 'click':
        return <MousePointerClick className="h-4 w-4 text-purple-500" />;
      case 'bounce':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'complaint':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Skeleton className="h-[400px]" />
          </div>
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Mail className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">Event not found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          The communication event could not be found.
        </p>
        <Link href="/admin/communications/log">
          <Button className="mt-4" variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Log
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/communications/log">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            {getStatusIcon(event.status)}
            <div>
              <h1 className="text-xl font-bold">{event.subject}</h1>
              <p className="text-sm text-muted-foreground">
                To: {event.toEmail}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(event.status === 'failed' || event.status === 'bounced') && (
            <Button
              variant="outline"
              onClick={() => resendMutation.mutate({ id: event.id })}
              disabled={resendMutation.isPending}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {resendMutation.isPending ? 'Resending...' : 'Resend'}
            </Button>
          )}
          {event.status === 'pending' && (
            <Button
              variant="outline"
              onClick={() => cancelMutation.mutate({ id: event.id })}
              disabled={cancelMutation.isPending}
            >
              <Ban className="mr-2 h-4 w-4" />
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel'}
            </Button>
          )}
          {getStatusBadge(event.status)}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Email Content */}
          <Card>
            <CardHeader>
              <CardTitle>Email Content</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="html">
                <TabsList>
                  <TabsTrigger value="html">HTML</TabsTrigger>
                  <TabsTrigger value="text">Plain Text</TabsTrigger>
                </TabsList>
                <TabsContent value="html" className="mt-4">
                  <div className="border rounded-md">
                    <iframe
                      srcDoc={event.htmlBody}
                      className="w-full h-[400px]"
                      title="Email Preview"
                      sandbox=""
                    />
                  </div>
                </TabsContent>
                <TabsContent value="text" className="mt-4">
                  {event.textBody ? (
                    <pre className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded-md max-h-[400px] overflow-auto">
                      {event.textBody}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No plain text version available
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Tracking Events Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery Timeline</CardTitle>
              <CardDescription>
                Track the email&apos;s journey from send to delivery
              </CardDescription>
            </CardHeader>
            <CardContent>
              {event.trackingEvents && event.trackingEvents.length > 0 ? (
                <div className="space-y-4">
                  {event.trackingEvents.map((trackingEvent, index) => (
                    <div key={trackingEvent.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-background">
                          {getTrackingEventIcon(trackingEvent.eventType)}
                        </div>
                        {index < event.trackingEvents!.length - 1 && (
                          <div className="w-px flex-1 bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between">
                          <p className="font-medium capitalize">
                            {trackingEvent.eventType.replace('_', ' ')}
                          </p>
                          <span className="text-sm text-muted-foreground">
                            {format(
                              new Date(trackingEvent.occurredAt),
                              'MMM d, yyyy h:mm a'
                            )}
                          </span>
                        </div>
                        {trackingEvent.eventType === 'bounce' && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {trackingEvent.bounceType}
                            {trackingEvent.bounceSubType &&
                              ` - ${trackingEvent.bounceSubType}`}
                          </p>
                        )}
                        {trackingEvent.eventType === 'click' &&
                          trackingEvent.clickedUrl && (
                            <p className="text-sm text-muted-foreground mt-1 truncate">
                              URL: {trackingEvent.clickedUrl}
                            </p>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No tracking events recorded yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Recipient</p>
                  <p className="text-sm text-muted-foreground">
                    {event.toName && `${event.toName} `}
                    <span className="text-foreground">{event.toEmail}</span>
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">From</p>
                  <p className="text-sm text-muted-foreground">
                    {event.fromName && `${event.fromName} `}
                    <span className="text-foreground">{event.fromEmail}</span>
                  </p>
                  {event.replyTo && (
                    <p className="text-xs text-muted-foreground">
                      Reply-To: {event.replyTo}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Timestamps</p>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      Created:{' '}
                      {format(new Date(event.createdAt), 'MMM d, yyyy h:mm a')}
                    </p>
                    {event.scheduledAt && (
                      <p>
                        Scheduled:{' '}
                        {format(
                          new Date(event.scheduledAt),
                          'MMM d, yyyy h:mm a'
                        )}
                      </p>
                    )}
                    {event.sentAt && (
                      <p>
                        Sent:{' '}
                        {format(new Date(event.sentAt), 'MMM d, yyyy h:mm a')}
                      </p>
                    )}
                    {event.deliveredAt && (
                      <p>
                        Delivered:{' '}
                        {format(
                          new Date(event.deliveredAt),
                          'MMM d, yyyy h:mm a'
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {event.templateId && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Template</p>
                      <Link
                        href={`/admin/communications/templates/${event.templateId}`}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        View Template
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </>
              )}

              {event.workflowExecutionId && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Workflow</p>
                      <Link
                        href={`/admin/communications/workflows/${event.workflowExecutionId}`}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        View Execution
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Error Info (if any) */}
          {(event.status === 'failed' || event.status === 'bounced') &&
            event.errorMessage && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive">Error Details</CardTitle>
                </CardHeader>
                <CardContent>
                  {event.errorCode && (
                    <p className="text-sm font-medium mb-2">
                      Code: {event.errorCode}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {event.errorMessage}
                  </p>
                  {event.retryCount > 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Retry attempts: {event.retryCount}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

          {/* Template Variables (if any) */}
          {event.templateVariables &&
            Object.keys(event.templateVariables).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Template Variables</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(
                      event.templateVariables as Record<string, unknown>
                    ).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex justify-between text-sm border-b pb-2 last:border-0"
                      >
                        <span className="font-mono text-muted-foreground">
                          {'{{'}{key}{'}}'}
                        </span>
                        <span className="truncate max-w-[150px]">
                          {String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
        </div>
      </div>
    </div>
  );
}
