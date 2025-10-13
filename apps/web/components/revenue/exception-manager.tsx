"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/trpc';
import { formatCurrency } from '@/lib/utils';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  MessageSquare,
  TrendingUp,
  Clock,
  ChevronRight
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ExceptionSeverity {
  value: 'critical' | 'warning' | 'info';
  label: string;
  color: string;
  icon: React.ComponentType<any>;
}

const severityConfig: Record<string, ExceptionSeverity> = {
  critical: {
    value: 'critical',
    label: 'Critical',
    color: 'destructive',
    icon: XCircle
  },
  warning: {
    value: 'warning',
    label: 'Warning',
    color: 'warning',
    icon: AlertTriangle
  },
  info: {
    value: 'info',
    label: 'Info',
    color: 'default',
    icon: AlertCircle
  }
};

export function ExceptionManager() {
  const [selectedException, setSelectedException] = useState<any>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch exceptions
  const { data: exceptionSummary } = api.sspAnalytics.getExceptionSummary.useQuery();
  const { data: exceptions } = api.sspAnalytics.getExceptions.useQuery({
    status: 'open',
    limit: 50
  });
  const { data: trends } = api.sspAnalytics.getExceptionTrends.useQuery({
    days: 30
  });

  // Mutations
  const acknowledgeException = api.sspAnalytics.acknowledgeException.useMutation({
    onSuccess: () => {
      toast({
        title: "Exception Acknowledged",
        description: "The exception has been marked as acknowledged."
      });
    }
  });

  const resolveException = api.sspAnalytics.resolveException.useMutation({
    onSuccess: () => {
      toast({
        title: "Exception Resolved",
        description: "The exception has been successfully resolved."
      });
      setIsResolveDialogOpen(false);
      setSelectedException(null);
      setResolutionNotes('');
    }
  });

  const handleAcknowledge = async (exceptionId: string) => {
    await acknowledgeException.mutateAsync({ exceptionId });
  };

  const handleResolve = async () => {
    if (!selectedException || !resolutionNotes) return;
    
    await resolveException.mutateAsync({
      exceptionId: selectedException.id,
      resolutionNotes
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Exceptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {exceptionSummary?.totalExceptions || 0}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {exceptionSummary?.unresolvedCount || 0} unresolved
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Critical Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {exceptionSummary?.criticalCount || 0}
            </div>
            <div className="flex items-center mt-2">
              <XCircle className="h-4 w-4 text-red-500 mr-1" />
              <span className="text-sm text-red-500">Requires immediate attention</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {exceptionSummary?.warningCount || 0}
            </div>
            <div className="flex items-center mt-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mr-1" />
              <span className="text-sm text-yellow-500">Review recommended</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Impacted Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(parseFloat(exceptionSummary?.totalImpactedRevenue || '0'))}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              At risk amount
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Exception Trends */}
      {trends && trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Exception Trends</CardTitle>
            <CardDescription>30-day exception patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {trends.map((trend) => (
                <div key={trend.exceptionType} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {trend.trend === 'increasing' ? (
                        <TrendingUp className="h-4 w-4 text-red-500" />
                      ) : trend.trend === 'decreasing' ? (
                        <TrendingUp className="h-4 w-4 text-green-500 rotate-180" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      )}
                      <span className="font-medium">
                        {trend.exceptionType.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                    <Badge variant="outline">{trend.count} occurrences</Badge>
                  </div>
                  <div className={`text-sm font-medium ${
                    trend.trend === 'increasing' ? 'text-red-500' :
                    trend.trend === 'decreasing' ? 'text-green-500' :
                    'text-gray-500'
                  }`}>
                    {trend.changePercentage > 0 ? '+' : ''}{trend.changePercentage.toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exception List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Open Exceptions</CardTitle>
              <CardDescription>Revenue recognition exceptions requiring review</CardDescription>
            </div>
            <Button variant="outline">
              Export Report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Exception Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Impact</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptions?.map((exception) => {
                const severity = severityConfig[exception.severity];
                const SeverityIcon = severity.icon;

                return (
                  <TableRow key={exception.id}>
                    <TableCell className="font-medium">
                      {exception.itemId}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {exception.exceptionType.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <SeverityIcon className="h-4 w-4" />
                        <Badge variant={severity.color as any}>
                          {severity.label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate">{exception.message}</p>
                    </TableCell>
                    <TableCell>
                      {exception.impactedRevenue ? (
                        <span className="font-medium">
                          {formatCurrency(parseFloat(exception.impactedRevenue))}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(exception.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(exception.createdAt).toLocaleTimeString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {exception.status === 'open' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAcknowledge(exception.id)}
                          >
                            Acknowledge
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedException(exception);
                            setIsResolveDialogOpen(true);
                          }}
                        >
                          Resolve
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Items Requiring Attention */}
      {exceptionSummary?.itemsRequiringAttention && exceptionSummary.itemsRequiringAttention.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Items Requiring Immediate Attention</CardTitle>
            <CardDescription>Critical exceptions by item</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {exceptionSummary.itemsRequiringAttention.map((itemId) => (
                <Alert key={itemId}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <span>Item {itemId} has critical exceptions</span>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resolve Exception Dialog */}
      <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Resolve Exception</DialogTitle>
            <DialogDescription>
              Provide resolution details for this exception
            </DialogDescription>
          </DialogHeader>
          {selectedException && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">{selectedException.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Type: {selectedException.exceptionType.replace(/_/g, ' ')}
                </p>
              </div>
              
              {selectedException.recommendedActions && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Recommended Actions:</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {selectedException.recommendedActions.map((action: string, index: number) => (
                      <li key={index}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="resolution" className="text-sm font-medium">
                  Resolution Notes
                </label>
                <Textarea
                  id="resolution"
                  placeholder="Describe how this exception was resolved..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleResolve}
              disabled={!resolutionNotes || resolveException.isLoading}
            >
              {resolveException.isLoading ? 'Resolving...' : 'Resolve Exception'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}