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
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/trpc';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Calendar,
  TrendingUp,
  Package,
  FileText,
  BarChart3
} from 'lucide-react';

interface ObligationStatus {
  label: string;
  value: 'not_started' | 'in_progress' | 'satisfied' | 'cancelled';
  color: string;
  icon: React.ComponentType<any>;
}

const statusConfig: Record<string, ObligationStatus> = {
  not_started: {
    label: 'Not Started',
    value: 'not_started',
    color: 'secondary',
    icon: Clock
  },
  in_progress: {
    label: 'In Progress',
    value: 'in_progress',
    color: 'default',
    icon: TrendingUp
  },
  satisfied: {
    label: 'Satisfied',
    value: 'satisfied',
    color: 'success',
    icon: CheckCircle
  },
  cancelled: {
    label: 'Cancelled',
    value: 'cancelled',
    color: 'destructive',
    icon: AlertCircle
  }
};

export function PerformanceObligationsView() {
  const [selectedTab, setSelectedTab] = useState('active');
  const [selectedObligation, setSelectedObligation] = useState<string | null>(null);

  // Fetch performance obligations
  const { data: obligations } = api.revenue.performanceObligations.list.useQuery({
    status: selectedTab === 'all' ? undefined : selectedTab
  });

  const { data: summary } = api.revenue.performanceObligations.getSummary.useQuery();

  const satisfactionMethods = {
    point_in_time: { label: 'Point in Time', icon: CheckCircle },
    over_time: { label: 'Over Time', icon: Clock },
    milestone: { label: 'Milestone Based', icon: BarChart3 }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Obligations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total || 0}</div>
            <div className="text-sm text-muted-foreground mt-1">
              Across all contracts
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Obligations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.active || 0}</div>
            <div className="flex items-center mt-2">
              <TrendingUp className="h-4 w-4 text-blue-500 mr-1" />
              <span className="text-sm text-blue-500">
                {summary?.inProgress || 0} in progress
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.totalValue || 0)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Allocated amount
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Satisfaction Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentage(summary?.satisfactionRate || 0)}
            </div>
            <Progress 
              value={(summary?.satisfactionRate || 0) * 100} 
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Obligations Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Performance Obligations</CardTitle>
              <CardDescription>
                Track and manage revenue recognition obligations
              </CardDescription>
            </div>
            <Button>
              <FileText className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="in_progress">In Progress</TabsTrigger>
              <TabsTrigger value="satisfied">Satisfied</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Obligation ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Allocated Amount</TableHead>
                    <TableHead>Recognized</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {obligations?.map((obligation) => {
                    const status = statusConfig[obligation.status];
                    const StatusIcon = status.icon;
                    const method = satisfactionMethods[obligation.satisfactionMethod as keyof typeof satisfactionMethods];
                    const MethodIcon = method?.icon || Package;
                    const progress = obligation.allocatedAmount > 0 
                      ? (obligation.recognizedAmount / obligation.allocatedAmount) * 100
                      : 0;

                    return (
                      <TableRow key={obligation.id}>
                        <TableCell className="font-medium">
                          {obligation.obligationNumber}
                        </TableCell>
                        <TableCell>{obligation.customerName}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{obligation.itemName}</div>
                            <div className="text-sm text-muted-foreground">
                              {obligation.itemType}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MethodIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{method?.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(obligation.allocatedAmount)}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {formatCurrency(obligation.recognizedAmount)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatCurrency(obligation.remainingAmount)} remaining
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Progress value={progress} className="h-2 w-24" />
                            <span className="text-xs text-muted-foreground">
                              {progress.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <StatusIcon className="h-4 w-4" />
                            <Badge variant={status.color as any}>
                              {status.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedObligation(obligation.id)}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Obligations by Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Obligations by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary?.byType?.map((type) => (
                <div key={type.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{type.label}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {type.count} obligations
                    </span>
                    <span className="font-medium">
                      {formatCurrency(type.value)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary?.upcomingMilestones?.map((milestone) => (
                <div key={milestone.id} className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{milestone.name}</span>
                      <Badge variant="outline">
                        {new Date(milestone.date).toLocaleDateString()}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {milestone.description}
                    </p>
                    <div className="text-sm font-medium mt-1">
                      Revenue Impact: {formatCurrency(milestone.revenueImpact)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recognition Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Recognition Schedule</CardTitle>
          <CardDescription>
            Projected revenue recognition over the next 12 months
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <BarChart3 className="h-8 w-8 mr-2" />
            Recognition schedule chart would be rendered here
          </div>
        </CardContent>
      </Card>
    </div>
  );
}