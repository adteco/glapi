# TASK-016: Revenue Management UI Components

## Description
Build comprehensive React-based UI components for revenue recognition management, including dashboards, SSP management interfaces, contract modification workflows, and approval processes. These components will integrate with the existing Next.js web application using shadcn/ui components.

## Acceptance Criteria
- [ ] Revenue recognition dashboard with key metrics and visualizations
- [ ] SSP management interface with CRUD operations
- [ ] Contract modification workflow wizard
- [ ] Performance obligation tracking interface
- [ ] Revenue schedule viewer and editor
- [ ] Approval workflow management UI
- [ ] Period-end close dashboard
- [ ] Revenue forecasting visualizations
- [ ] Exception management interface
- [ ] Responsive design for all components

## Dependencies
- TASK-007: Revenue recognition tRPC router
- TASK-010: Reporting engine
- TASK-014: GL Integration (for journal entry UI)
- TASK-015: Advanced SSP Analytics (for SSP UI)

## Estimated Effort
5 days

## Technical Implementation

### Revenue Recognition Dashboard
```typescript
// apps/web/components/revenue/revenue-dashboard.tsx
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer 
} from 'recharts';
import { 
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText
} from 'lucide-react';
import { api } from '@/lib/trpc';
import { formatCurrency, formatPercentage } from '@/lib/utils';

interface MetricCard {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon: React.ComponentType<any>;
  description?: string;
}

export function RevenueDashboard() {
  const [dateRange, setDateRange] = useState({ start: new Date(), end: new Date() });
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  // Fetch data using tRPC
  const { data: arrData } = api.revenue.reports.arr.useQuery();
  const { data: mrrData } = api.revenue.reports.mrr.useQuery();
  const { data: deferredBalance } = api.revenue.reports.deferredBalance.useQuery();
  const { data: recognitionHistory } = api.revenue.reports.recognitionHistory.useQuery({
    startDate: dateRange.start,
    endDate: dateRange.end
  });

  // Key metrics
  const metrics: MetricCard[] = [
    {
      title: 'ARR',
      value: formatCurrency(arrData?.totalARR || 0),
      change: arrData?.netARRGrowth,
      changeType: (arrData?.netARRGrowth || 0) > 0 ? 'increase' : 'decrease',
      icon: TrendingUp,
      description: 'Annual Recurring Revenue'
    },
    {
      title: 'MRR',
      value: formatCurrency(mrrData?.totalMRR || 0),
      change: mrrData?.netMRRGrowth,
      changeType: (mrrData?.netMRRGrowth || 0) > 0 ? 'increase' : 'decrease',
      icon: DollarSign,
      description: 'Monthly Recurring Revenue'
    },
    {
      title: 'Deferred Revenue',
      value: formatCurrency(deferredBalance?.totalDeferred || 0),
      icon: Clock,
      description: 'Total unrecognized revenue'
    },
    {
      title: 'Recognition Rate',
      value: formatPercentage(0.87),
      changeType: 'neutral',
      icon: CheckCircle,
      description: 'On-time recognition percentage'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Revenue Recognition</h1>
          <p className="text-muted-foreground">ASC 606 compliant revenue management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            {selectedPeriod === 'month' ? 'This Month' : 
             selectedPeriod === 'quarter' ? 'This Quarter' : 'This Year'}
          </Button>
          <Button>Run Recognition</Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              {metric.change && (
                <div className="flex items-center text-xs">
                  {metric.changeType === 'increase' ? (
                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                  )}
                  <span className={
                    metric.changeType === 'increase' ? 'text-green-500' : 'text-red-500'
                  }>
                    {formatCurrency(Math.abs(metric.change))}
                  </span>
                </div>
              )}
              {metric.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {metric.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts and Analytics */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue Trends</TabsTrigger>
          <TabsTrigger value="obligations">Performance Obligations</TabsTrigger>
          <TabsTrigger value="deferred">Deferred Analysis</TabsTrigger>
          <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Recognition Trend</CardTitle>
              <CardDescription>Monthly recognized vs deferred revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={recognitionHistory?.data || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="recognized" 
                    stackId="1"
                    stroke="#8884d8" 
                    fill="#8884d8" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="deferred" 
                    stackId="1"
                    stroke="#82ca9d" 
                    fill="#82ca9d" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RevenueWaterfallChart />
            <ARRMovementChart data={arrData} />
          </div>
        </TabsContent>

        <TabsContent value="obligations">
          <PerformanceObligationsView />
        </TabsContent>

        <TabsContent value="deferred">
          <DeferredRevenueAnalysis data={deferredBalance} />
        </TabsContent>

        <TabsContent value="exceptions">
          <ExceptionsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Performance Obligations Component
function PerformanceObligationsView() {
  const { data: obligations } = api.revenue.performanceObligations.list.useQuery();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Obligations</CardTitle>
        <CardDescription>Active obligations requiring satisfaction</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {obligations?.data.map((obligation) => (
            <div key={obligation.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{obligation.itemName}</span>
                  <Badge variant={
                    obligation.status === 'active' ? 'default' : 
                    obligation.status === 'satisfied' ? 'success' : 'secondary'
                  }>
                    {obligation.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {obligation.obligationType} • {obligation.satisfactionMethod}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">
                  {formatCurrency(obligation.allocatedAmount)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {obligation.satisfactionMethod === 'over_time' && 
                    `${obligation.satisfactionPeriodMonths} months`
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### SSP Management Interface
```typescript
// apps/web/components/revenue/ssp-manager.tsx
"use client";

import { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/trpc';
import { formatCurrency } from '@/lib/utils';
import { Plus, Edit, Trash, AlertTriangle, CheckCircle } from 'lucide-react';

export function SSPManager() {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: sspEvidence } = api.revenue.ssp.list.useQuery();
  const { data: sspSummary } = api.revenue.ssp.summary.useQuery();

  const createSSPMutation = api.revenue.ssp.create.useMutation({
    onSuccess: () => {
      setIsAddDialogOpen(false);
      // Refetch data
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">SSP Management</h2>
          <p className="text-muted-foreground">Standalone Selling Price evidence and analysis</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add SSP Evidence
        </Button>
      </div>

      {/* SSP Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Items with SSP</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sspSummary?.totalItems || 0}</div>
            <div className="flex items-center mt-2">
              <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-500">
                {sspSummary?.vsoeCompliant || 0} VSOE compliant
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Exceptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sspSummary?.exceptionsCount || 0}</div>
            <div className="flex items-center mt-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mr-1" />
              <span className="text-sm text-yellow-500">
                {sspSummary?.criticalExceptions || 0} critical
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Average Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((sspSummary?.averageConfidence || 0) * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              Across all SSP evidence
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SSP Evidence Table */}
      <Card>
        <CardHeader>
          <CardTitle>SSP Evidence</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Evidence Type</TableHead>
                <TableHead>SSP Amount</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Evidence Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sspEvidence?.data.map((evidence) => (
                <TableRow key={evidence.id}>
                  <TableCell className="font-medium">
                    {evidence.itemName}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {evidence.evidenceType}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(evidence.sspAmount)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${evidence.confidenceLevel * 100}%` }}
                        />
                      </div>
                      <span className="text-sm">
                        {evidence.confidenceLevel === 'high' ? 'High' :
                         evidence.confidenceLevel === 'medium' ? 'Medium' : 'Low'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(evidence.evidenceDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={evidence.isActive ? 'default' : 'secondary'}>
                      {evidence.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add SSP Evidence Dialog */}
      <AddSSPEvidenceDialog 
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={(data) => createSSPMutation.mutate(data)}
      />
    </div>
  );
}
```

### Contract Modification Wizard
```typescript
// apps/web/components/revenue/contract-modification-wizard.tsx
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/trpc';
import { 
  ChevronRight, 
  ChevronLeft, 
  AlertCircle,
  CheckCircle,
  Calculator
} from 'lucide-react';

interface ModificationStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
}

export function ContractModificationWizard({ 
  subscriptionId 
}: { 
  subscriptionId: string 
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [modificationData, setModificationData] = useState<any>({
    modificationType: null,
    changes: {},
    effectiveDate: new Date(),
    adjustmentMethod: 'prospective' // or 'cumulative_catch_up'
  });

  const steps: ModificationStep[] = [
    {
      id: 'type',
      title: 'Modification Type',
      description: 'Select the type of contract modification',
      component: ModificationTypeSelector
    },
    {
      id: 'changes',
      title: 'Specify Changes',
      description: 'Define what is changing in the contract',
      component: ChangeSpecification
    },
    {
      id: 'impact',
      title: 'Impact Analysis',
      description: 'Review the revenue recognition impact',
      component: ImpactAnalysis
    },
    {
      id: 'accounting',
      title: 'Accounting Treatment',
      description: 'Choose prospective or cumulative catch-up',
      component: AccountingTreatment
    },
    {
      id: 'review',
      title: 'Review & Approve',
      description: 'Review all changes before applying',
      component: ReviewAndApprove
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    // Submit modification
    try {
      await api.subscriptions.modify.mutate({
        id: subscriptionId,
        ...modificationData
      });
      // Handle success
    } catch (error) {
      // Handle error
    }
  };

  const CurrentStepComponent = steps[currentStep].component;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Indicator */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Step {currentStep + 1} of {steps.length}</span>
          <span>{steps[currentStep].title}</span>
        </div>
        <Progress value={(currentStep + 1) / steps.length * 100} />
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep].title}</CardTitle>
          <CardDescription>{steps[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent>
          <CurrentStepComponent 
            data={modificationData}
            onChange={(updates: any) => setModificationData({
              ...modificationData,
              ...updates
            })}
            subscriptionId={subscriptionId}
          />
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handlePrevious}
          disabled={currentStep === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        
        {currentStep === steps.length - 1 ? (
          <Button onClick={handleComplete}>
            Complete Modification
            <CheckCircle className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleNext}>
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Step Components
function ModificationTypeSelector({ data, onChange }: any) {
  const types = [
    {
      id: 'add_items',
      title: 'Add Items',
      description: 'Add new products or services to the contract'
    },
    {
      id: 'remove_items',
      title: 'Remove Items',
      description: 'Remove products or services from the contract'
    },
    {
      id: 'change_quantity',
      title: 'Change Quantity',
      description: 'Modify quantities of existing items'
    },
    {
      id: 'change_price',
      title: 'Change Price',
      description: 'Update pricing for existing items'
    },
    {
      id: 'extend_term',
      title: 'Extend Term',
      description: 'Extend the contract end date'
    },
    {
      id: 'early_termination',
      title: 'Early Termination',
      description: 'Terminate the contract before end date'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {types.map((type) => (
        <Card 
          key={type.id}
          className={`cursor-pointer transition-all ${
            data.modificationType === type.id ? 'ring-2 ring-primary' : ''
          }`}
          onClick={() => onChange({ modificationType: type.id })}
        >
          <CardHeader>
            <CardTitle className="text-base">{type.title}</CardTitle>
            <CardDescription className="text-sm">
              {type.description}
            </CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function ImpactAnalysis({ data, subscriptionId }: any) {
  // Fetch impact preview
  const { data: impact } = api.subscriptions.previewModification.useQuery({
    id: subscriptionId,
    modifications: data.changes
  });

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          This modification will affect revenue recognition schedules
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Current Contract Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(impact?.currentValue || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Modified Contract Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(impact?.modifiedValue || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Show affected performance obligations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Affected Performance Obligations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {impact?.affectedObligations?.map((obligation: any) => (
              <div key={obligation.id} className="flex justify-between items-center p-2 border rounded">
                <span>{obligation.itemName}</span>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">
                    {formatCurrency(obligation.currentAmount)} → {formatCurrency(obligation.newAmount)}
                  </div>
                  <Badge variant={obligation.change > 0 ? 'success' : 'destructive'}>
                    {obligation.change > 0 ? '+' : ''}{formatCurrency(obligation.change)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Period-End Close Dashboard
```typescript
// apps/web/components/revenue/period-end-dashboard.tsx
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/trpc';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock,
  Play,
  Pause,
  RefreshCw
} from 'lucide-react';

interface CloseStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  required: boolean;
  duration?: number;
  error?: string;
}

export function PeriodEndCloseDashboard() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  
  const [closeSteps, setCloseSteps] = useState<CloseStep[]>([
    {
      id: 'validate',
      name: 'Validate Period Readiness',
      description: 'Check for unprocessed transactions and data integrity',
      status: 'pending',
      required: true
    },
    {
      id: 'recognize',
      name: 'Recognize Revenue',
      description: 'Process all scheduled revenue for the period',
      status: 'pending',
      required: true
    },
    {
      id: 'journal',
      name: 'Generate Journal Entries',
      description: 'Create journal entries for recognized revenue',
      status: 'pending',
      required: true
    },
    {
      id: 'reconcile',
      name: 'Reconcile Sub-ledger',
      description: 'Reconcile revenue sub-ledger with GL',
      status: 'pending',
      required: true
    },
    {
      id: 'reports',
      name: 'Generate Reports',
      description: 'Create period-end revenue reports',
      status: 'pending',
      required: false
    },
    {
      id: 'approve',
      name: 'Approve & Post',
      description: 'Review and post journal entries to GL',
      status: 'pending',
      required: true
    },
    {
      id: 'lock',
      name: 'Lock Period',
      description: 'Prevent further changes to the closed period',
      status: 'pending',
      required: true
    }
  ]);

  const runPeriodClose = async () => {
    setIsRunning(true);
    
    for (const step of closeSteps) {
      setCurrentStep(step.id);
      
      // Update step status to running
      updateStepStatus(step.id, 'running');
      
      try {
        // Execute step via API
        const result = await executeCloseStep(step.id);
        
        // Update step status to completed
        updateStepStatus(step.id, 'completed', result.duration);
      } catch (error: any) {
        // Update step status to failed
        updateStepStatus(step.id, 'failed', undefined, error.message);
        
        if (step.required) {
          setIsRunning(false);
          break;
        }
      }
    }
    
    setIsRunning(false);
    setCurrentStep(null);
  };

  const updateStepStatus = (
    stepId: string, 
    status: CloseStep['status'], 
    duration?: number,
    error?: string
  ) => {
    setCloseSteps(steps => 
      steps.map(step => 
        step.id === stepId 
          ? { ...step, status, duration, error }
          : step
      )
    );
  };

  const executeCloseStep = async (stepId: string) => {
    // Simulate API call - replace with actual tRPC calls
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { duration: Math.random() * 5000 };
  };

  const completedSteps = closeSteps.filter(s => s.status === 'completed').length;
  const progress = (completedSteps / closeSteps.length) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Period-End Close</h2>
          <p className="text-muted-foreground">January 2024 Revenue Close Process</p>
        </div>
        <div className="flex gap-2">
          {!isRunning ? (
            <Button onClick={runPeriodClose}>
              <Play className="h-4 w-4 mr-2" />
              Start Close Process
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => setIsRunning(false)}>
              <Pause className="h-4 w-4 mr-2" />
              Pause Process
            </Button>
          )}
        </div>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Close Progress</CardTitle>
          <CardDescription>
            {completedSteps} of {closeSteps.length} steps completed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="h-3" />
        </CardContent>
      </Card>

      {/* Validation Warnings */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Validation Warnings</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>3 invoices pending approval</li>
            <li>5 revenue schedules require manual review</li>
            <li>Prior period (December 2023) not fully closed</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Close Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Close Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {closeSteps.map((step) => (
              <div 
                key={step.id}
                className={`flex items-start gap-4 p-4 rounded-lg border ${
                  currentStep === step.id ? 'bg-muted' : ''
                }`}
              >
                <div className="mt-1">
                  {step.status === 'completed' && (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                  {step.status === 'failed' && (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  {step.status === 'running' && (
                    <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                  )}
                  {step.status === 'pending' && (
                    <Clock className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{step.name}</span>
                    {step.required && (
                      <Badge variant="outline" className="text-xs">Required</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {step.description}
                  </p>
                  {step.error && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertDescription>{step.error}</AlertDescription>
                    </Alert>
                  )}
                  {step.duration && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Completed in {(step.duration / 1000).toFixed(1)}s
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Files to Create
- `apps/web/components/revenue/revenue-dashboard.tsx`
- `apps/web/components/revenue/ssp-manager.tsx`
- `apps/web/components/revenue/contract-modification-wizard.tsx`
- `apps/web/components/revenue/period-end-dashboard.tsx`
- `apps/web/components/revenue/performance-obligations-view.tsx`
- `apps/web/components/revenue/revenue-schedules-grid.tsx`
- `apps/web/components/revenue/approval-workflow.tsx`
- `apps/web/components/revenue/exception-manager.tsx`
- `apps/web/components/revenue/charts/revenue-waterfall-chart.tsx`
- `apps/web/components/revenue/charts/arr-movement-chart.tsx`
- `apps/web/components/revenue/charts/deferred-analysis-chart.tsx`
- `apps/web/app/(dashboard)/revenue/page.tsx`
- `apps/web/app/(dashboard)/revenue/ssp/page.tsx`
- `apps/web/app/(dashboard)/revenue/obligations/page.tsx`
- `apps/web/app/(dashboard)/revenue/period-close/page.tsx`

### Definition of Done
- [ ] Revenue dashboard displaying real-time metrics
- [ ] SSP management interface with CRUD operations
- [ ] Contract modification wizard functional
- [ ] Performance obligation tracking interface complete
- [ ] Revenue schedule viewer and editor working
- [ ] Approval workflow UI implemented
- [ ] Period-end close dashboard operational
- [ ] All charts and visualizations rendering correctly
- [ ] Exception management interface functional
- [ ] Responsive design working on all screen sizes
- [ ] Integration with tRPC endpoints verified
- [ ] Loading states and error handling implemented
- [ ] Accessibility standards met (WCAG 2.1 AA)
- [ ] Component documentation complete