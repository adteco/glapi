"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/trpc';
import { formatCurrency } from '@/lib/utils';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock,
  Play,
  Pause,
  RefreshCw,
  FileText,
  Lock,
  Calculator,
  CheckSquare
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface CloseStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  required: boolean;
  duration?: number;
  error?: string;
  icon: React.ComponentType<any>;
}

export function PeriodEndCloseDashboard() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth()
  });
  const { toast } = useToast();
  
  const [closeSteps, setCloseSteps] = useState<CloseStep[]>([
    {
      id: 'validate',
      name: 'Validate Period Readiness',
      description: 'Check for unprocessed transactions and data integrity',
      status: 'pending',
      required: true,
      icon: CheckSquare
    },
    {
      id: 'recognize',
      name: 'Recognize Revenue',
      description: 'Process all scheduled revenue for the period',
      status: 'pending',
      required: true,
      icon: Calculator
    },
    {
      id: 'journal',
      name: 'Generate Journal Entries',
      description: 'Create journal entries for recognized revenue',
      status: 'pending',
      required: true,
      icon: FileText
    },
    {
      id: 'reconcile',
      name: 'Reconcile Sub-ledger',
      description: 'Reconcile revenue sub-ledger with GL',
      status: 'pending',
      required: true,
      icon: RefreshCw
    },
    {
      id: 'reports',
      name: 'Generate Reports',
      description: 'Create period-end revenue reports',
      status: 'pending',
      required: false,
      icon: FileText
    },
    {
      id: 'approve',
      name: 'Approve & Post',
      description: 'Review and post journal entries to GL',
      status: 'pending',
      required: true,
      icon: CheckCircle2
    },
    {
      id: 'lock',
      name: 'Lock Period',
      description: 'Prevent further changes to the closed period',
      status: 'pending',
      required: true,
      icon: Lock
    }
  ]);

  // Fetch validation issues
  const { data: validationIssues } = api.periodEnd.validatePeriod.useQuery({
    year: selectedPeriod.year,
    month: selectedPeriod.month
  });

  // Fetch period status
  const { data: periodStatus } = api.periodEnd.getPeriodStatus.useQuery({
    year: selectedPeriod.year,
    month: selectedPeriod.month
  });

  const runPeriodClose = async () => {
    setIsRunning(true);
    
    for (const step of closeSteps) {
      if (!isRunning) break; // Allow interruption
      
      setCurrentStep(step.id);
      updateStepStatus(step.id, 'running');
      
      try {
        const startTime = Date.now();
        
        // Execute step via API
        const result = await executeCloseStep(step.id);
        
        const duration = Date.now() - startTime;
        updateStepStatus(step.id, 'completed', duration);
        
      } catch (error: any) {
        updateStepStatus(step.id, 'failed', undefined, error.message);
        
        if (step.required) {
          setIsRunning(false);
          toast({
            title: "Period Close Failed",
            description: `Failed at step: ${step.name}. ${error.message}`,
            variant: "destructive"
          });
          break;
        } else {
          // Skip non-required failed steps
          updateStepStatus(step.id, 'skipped');
        }
      }
    }
    
    if (isRunning) {
      setIsRunning(false);
      setCurrentStep(null);
      toast({
        title: "Period Close Completed",
        description: "All steps have been completed successfully.",
      });
    }
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
    // Call actual API endpoints based on step
    switch (stepId) {
      case 'validate':
        return await api.periodEnd.validatePeriod.query({
          year: selectedPeriod.year,
          month: selectedPeriod.month
        });
      case 'recognize':
        return await api.revenue.recognition.runScheduled.mutate({
          date: new Date(selectedPeriod.year, selectedPeriod.month, 1).toISOString()
        });
      case 'journal':
        return await api.journalEntries.generateForPeriod.mutate({
          year: selectedPeriod.year,
          month: selectedPeriod.month
        });
      case 'reconcile':
        return await api.periodEnd.reconcile.mutate({
          year: selectedPeriod.year,
          month: selectedPeriod.month
        });
      case 'reports':
        return await api.reports.generatePeriodEnd.mutate({
          year: selectedPeriod.year,
          month: selectedPeriod.month
        });
      case 'approve':
        return await api.journalEntries.approveAndPost.mutate({
          year: selectedPeriod.year,
          month: selectedPeriod.month
        });
      case 'lock':
        return await api.periodEnd.lockPeriod.mutate({
          year: selectedPeriod.year,
          month: selectedPeriod.month
        });
      default:
        // Simulate for demo
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { success: true };
    }
  };

  const completedSteps = closeSteps.filter(s => s.status === 'completed').length;
  const progress = (completedSteps / closeSteps.length) * 100;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Period-End Close</h2>
          <p className="text-muted-foreground">
            {monthNames[selectedPeriod.month]} {selectedPeriod.year} Revenue Close Process
          </p>
        </div>
        <div className="flex gap-2">
          {!isRunning ? (
            <Button 
              onClick={runPeriodClose}
              disabled={periodStatus?.isLocked}
            >
              <Play className="h-4 w-4 mr-2" />
              Start Close Process
            </Button>
          ) : (
            <Button 
              variant="destructive" 
              onClick={() => {
                setIsRunning(false);
                setCurrentStep(null);
              }}
            >
              <Pause className="h-4 w-4 mr-2" />
              Pause Process
            </Button>
          )}
        </div>
      </div>

      {/* Period Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Period Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={periodStatus?.isLocked ? 'secondary' : 'default'}>
              {periodStatus?.isLocked ? 'Locked' : 'Open'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Revenue to Recognize</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(periodStatus?.revenueToRecognize || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Journal Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {periodStatus?.journalEntryCount || 0}
            </div>
            <div className="text-sm text-muted-foreground">
              {periodStatus?.unapprovedEntries || 0} pending approval
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Last Close Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {periodStatus?.lastCloseDate 
                ? new Date(periodStatus.lastCloseDate).toLocaleDateString()
                : 'Never closed'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview */}
      {(isRunning || completedSteps > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Close Progress</CardTitle>
            <CardDescription>
              {completedSteps} of {closeSteps.length} steps completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="h-3" />
            <div className="mt-2 text-sm text-muted-foreground">
              {currentStep && `Currently running: ${closeSteps.find(s => s.id === currentStep)?.name}`}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Warnings */}
      {validationIssues && validationIssues.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Validation Warnings</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {validationIssues.map((issue, index) => (
                <li key={index}>{issue.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Close Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Close Steps</CardTitle>
          <CardDescription>
            Complete all required steps to close the period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {closeSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div 
                  key={step.id}
                  className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                    currentStep === step.id ? 'bg-muted border-primary' : ''
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
                    {step.status === 'skipped' && (
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    )}
                    {step.status === 'pending' && (
                      <Clock className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
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
                        <AlertDescription className="text-sm">{step.error}</AlertDescription>
                      </Alert>
                    )}
                    {step.duration && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Completed in {(step.duration / 1000).toFixed(1)}s
                      </p>
                    )}
                  </div>

                  {step.status === 'completed' && (
                    <Button variant="ghost" size="sm">
                      View Details
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Manual Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Actions</CardTitle>
          <CardDescription>
            Additional actions that may be required
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox id="review-exceptions" />
                <label htmlFor="review-exceptions" className="text-sm font-medium">
                  Review and resolve revenue exceptions
                </label>
              </div>
              <Button variant="outline" size="sm">Review</Button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox id="approve-adjustments" />
                <label htmlFor="approve-adjustments" className="text-sm font-medium">
                  Approve manual adjustments
                </label>
              </div>
              <Button variant="outline" size="sm">View</Button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox id="export-gl" />
                <label htmlFor="export-gl" className="text-sm font-medium">
                  Export journal entries to GL system
                </label>
              </div>
              <Button variant="outline" size="sm">Export</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}