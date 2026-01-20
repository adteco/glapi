'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/lib/trpc';

// =============================================================================
// Types
// =============================================================================

type StepKey = 'welcome' | 'organization' | 'chart_of_accounts' | 'opening_balances' | 'integrations';

interface StepConfig {
  key: StepKey;
  name: string;
  description: string;
  icon: string;
  estimatedTime: string;
}

// =============================================================================
// Step Indicator Component
// =============================================================================

function StepIndicator({
  steps,
  currentStepIndex,
  completedSteps,
}: {
  steps: StepConfig[];
  currentStepIndex: number;
  completedSteps: Set<StepKey>;
}) {
  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, index) => {
        const isComplete = completedSteps.has(step.key);
        const isCurrent = index === currentStepIndex;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  isComplete
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isComplete ? '✓' : index + 1}
              </div>
              <span
                className={`mt-2 text-xs text-center max-w-[80px] ${
                  isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
                }`}
              >
                {step.name}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-2 ${
                  isComplete ? 'bg-green-500' : 'bg-muted'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Progress Bar Component
// =============================================================================

function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div
        className="bg-primary h-2 rounded-full transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

// =============================================================================
// Checklist Item Component
// =============================================================================

function ChecklistItem({
  item,
  onToggle,
  disabled,
}: {
  item: {
    id: string;
    itemKey: string;
    itemName: string;
    isRequired: boolean;
    isCompleted: boolean;
  };
  onToggle: (itemId: string, completed: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div
      className={`flex items-center space-x-3 p-3 border rounded-lg ${
        item.isCompleted ? 'bg-green-50 border-green-200' : 'bg-background'
      }`}
    >
      <Checkbox
        id={item.id}
        checked={item.isCompleted}
        onCheckedChange={(checked) => onToggle(item.id, checked as boolean)}
        disabled={disabled}
      />
      <label
        htmlFor={item.id}
        className={`flex-1 text-sm cursor-pointer ${
          item.isCompleted ? 'line-through text-muted-foreground' : ''
        }`}
      >
        {item.itemName}
        {item.isRequired && (
          <span className="text-red-500 ml-1">*</span>
        )}
      </label>
    </div>
  );
}

// =============================================================================
// Welcome Step
// =============================================================================

function WelcomeStep({
  onComplete,
  onSkip,
  canSkip,
}: {
  onComplete: () => void;
  onSkip: () => void;
  canSkip: boolean;
}) {
  return (
    <div className="text-center space-y-6">
      <div className="text-6xl">👋</div>
      <div>
        <h2 className="text-2xl font-bold mb-2">Welcome to GLAPI</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Let&apos;s get your accounting system set up. This wizard will guide you through
          the essential steps to configure your organization.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">🏢 Organization</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Set up your company details, subsidiaries, and departments
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">📊 Chart of Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configure your account structure for tracking finances
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">🔗 Integrations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Connect with your existing tools and systems
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center gap-4 pt-4">
        <Button onClick={onComplete} size="lg">
          Get Started
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Organization Setup Step
// =============================================================================

function OrganizationStep({
  checklistItems,
  onCompleteItem,
  onUncompleteItem,
  onComplete,
  onSkip,
  canSkip,
  canProceed,
  loading,
}: {
  checklistItems: Array<{
    id: string;
    itemKey: string;
    itemName: string;
    isRequired: boolean;
    isCompleted: boolean;
  }>;
  onCompleteItem: (itemId: string) => void;
  onUncompleteItem: (itemId: string) => void;
  onComplete: () => void;
  onSkip: () => void;
  canSkip: boolean;
  canProceed: boolean;
  loading: boolean;
}) {
  const router = useRouter();

  const handleToggle = (itemId: string, completed: boolean) => {
    if (completed) {
      onCompleteItem(itemId);
    } else {
      onUncompleteItem(itemId);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Organization Setup</h2>
        <p className="text-muted-foreground">
          Configure your company structure and settings
        </p>
      </div>

      <div className="space-y-3">
        {checklistItems.map(item => (
          <ChecklistItem
            key={item.id}
            item={item}
            onToggle={handleToggle}
            disabled={loading}
          />
        ))}
      </div>

      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="font-medium mb-2">Quick Links</h4>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/settings/organization')}>
            Organization Settings
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/subsidiaries')}>
            Manage Subsidiaries
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/departments')}>
            Manage Departments
          </Button>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        {canSkip ? (
          <Button variant="ghost" onClick={onSkip} disabled={loading}>
            Skip for now
          </Button>
        ) : (
          <div />
        )}
        <Button onClick={onComplete} disabled={!canProceed || loading}>
          {loading ? 'Saving...' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Chart of Accounts Step
// =============================================================================

function ChartOfAccountsStep({
  checklistItems,
  onCompleteItem,
  onUncompleteItem,
  onComplete,
  onSkip,
  canSkip,
  canProceed,
  loading,
}: {
  checklistItems: Array<{
    id: string;
    itemKey: string;
    itemName: string;
    isRequired: boolean;
    isCompleted: boolean;
  }>;
  onCompleteItem: (itemId: string) => void;
  onUncompleteItem: (itemId: string) => void;
  onComplete: () => void;
  onSkip: () => void;
  canSkip: boolean;
  canProceed: boolean;
  loading: boolean;
}) {
  const router = useRouter();

  const handleToggle = (itemId: string, completed: boolean) => {
    if (completed) {
      onCompleteItem(itemId);
    } else {
      onUncompleteItem(itemId);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Chart of Accounts</h2>
        <p className="text-muted-foreground">
          Set up your account structure for tracking finances
        </p>
      </div>

      <div className="space-y-3">
        {checklistItems.map(item => (
          <ChecklistItem
            key={item.id}
            item={item}
            onToggle={handleToggle}
            disabled={loading}
          />
        ))}
      </div>

      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="font-medium mb-2">Quick Links</h4>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/accounts')}>
            Manage Accounts
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/migration')}>
            Import from CSV
          </Button>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        {canSkip ? (
          <Button variant="ghost" onClick={onSkip} disabled={loading}>
            Skip for now
          </Button>
        ) : (
          <div />
        )}
        <Button onClick={onComplete} disabled={!canProceed || loading}>
          {loading ? 'Saving...' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Opening Balances Step
// =============================================================================

function OpeningBalancesStep({
  checklistItems,
  onCompleteItem,
  onUncompleteItem,
  onComplete,
  onSkip,
  canSkip,
  canProceed,
  loading,
}: {
  checklistItems: Array<{
    id: string;
    itemKey: string;
    itemName: string;
    isRequired: boolean;
    isCompleted: boolean;
  }>;
  onCompleteItem: (itemId: string) => void;
  onUncompleteItem: (itemId: string) => void;
  onComplete: () => void;
  onSkip: () => void;
  canSkip: boolean;
  canProceed: boolean;
  loading: boolean;
}) {
  const router = useRouter();

  const handleToggle = (itemId: string, completed: boolean) => {
    if (completed) {
      onCompleteItem(itemId);
    } else {
      onUncompleteItem(itemId);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Opening Balances</h2>
        <p className="text-muted-foreground">
          Enter your starting account balances as of your go-live date
        </p>
      </div>

      <div className="space-y-3">
        {checklistItems.map(item => (
          <ChecklistItem
            key={item.id}
            item={item}
            onToggle={handleToggle}
            disabled={loading}
          />
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">Tip</h4>
        <p className="text-sm text-blue-700">
          Opening balances should be entered as of your accounting period start date.
          Make sure debits equal credits before proceeding.
        </p>
      </div>

      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="font-medium mb-2">Quick Links</h4>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/transactions/journal')}>
            Journal Entry
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/migration')}>
            Import Balances
          </Button>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        {canSkip ? (
          <Button variant="ghost" onClick={onSkip} disabled={loading}>
            Skip for now
          </Button>
        ) : (
          <div />
        )}
        <Button onClick={onComplete} disabled={!canProceed || loading}>
          {loading ? 'Saving...' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Integrations Step
// =============================================================================

function IntegrationsStep({
  checklistItems,
  onCompleteItem,
  onUncompleteItem,
  onComplete,
  onSkip,
  canSkip,
  canProceed,
  loading,
}: {
  checklistItems: Array<{
    id: string;
    itemKey: string;
    itemName: string;
    isRequired: boolean;
    isCompleted: boolean;
  }>;
  onCompleteItem: (itemId: string) => void;
  onUncompleteItem: (itemId: string) => void;
  onComplete: () => void;
  onSkip: () => void;
  canSkip: boolean;
  canProceed: boolean;
  loading: boolean;
}) {
  const router = useRouter();

  const handleToggle = (itemId: string, completed: boolean) => {
    if (completed) {
      onCompleteItem(itemId);
    } else {
      onUncompleteItem(itemId);
    }
  };

  const integrations = [
    { id: 'bank', name: 'Bank Feeds', icon: '🏦', status: 'available' },
    { id: 'payroll', name: 'Payroll (Gusto)', icon: '💼', status: 'available' },
    { id: 'crm', name: 'CRM (Salesforce)', icon: '📊', status: 'available' },
    { id: 'payment', name: 'Payment Processing', icon: '💳', status: 'coming_soon' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Integrations</h2>
        <p className="text-muted-foreground">
          Connect with your existing tools and services
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {integrations.map(integration => (
          <Card
            key={integration.id}
            className={integration.status === 'coming_soon' ? 'opacity-60' : ''}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span>{integration.icon}</span>
                  {integration.name}
                </CardTitle>
                {integration.status === 'coming_soon' && (
                  <Badge variant="secondary">Coming Soon</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {integration.status === 'available' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/settings/integrations')}
                >
                  Configure
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Not Available
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      <div className="space-y-3">
        <h4 className="font-medium">Optional Setup</h4>
        {checklistItems.map(item => (
          <ChecklistItem
            key={item.id}
            item={item}
            onToggle={handleToggle}
            disabled={loading}
          />
        ))}
      </div>

      <div className="flex justify-between pt-4">
        {canSkip ? (
          <Button variant="ghost" onClick={onSkip} disabled={loading}>
            Skip for now
          </Button>
        ) : (
          <div />
        )}
        <Button onClick={onComplete} disabled={!canProceed || loading}>
          {loading ? 'Saving...' : 'Complete Setup'}
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Complete Step
// =============================================================================

function CompleteStep() {
  const router = useRouter();

  return (
    <div className="text-center space-y-6">
      <div className="text-6xl">🎉</div>
      <div>
        <h2 className="text-2xl font-bold mb-2">Setup Complete!</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Your GLAPI account is ready to use. You can always return to complete
          any skipped steps or modify your settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 max-w-xl mx-auto">
        <Button onClick={() => router.push('/dashboard')} size="lg">
          Go to Dashboard
        </Button>
        <Button variant="outline" onClick={() => router.push('/settings')} size="lg">
          Review Settings
        </Button>
      </div>

      <div className="pt-8">
        <h4 className="font-medium mb-4">What&apos;s Next?</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <Card>
            <CardContent className="pt-4">
              <h5 className="font-medium mb-1">Create Transactions</h5>
              <p className="text-sm text-muted-foreground">
                Start recording journal entries and invoices
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <h5 className="font-medium mb-1">View Reports</h5>
              <p className="text-sm text-muted-foreground">
                Explore financial statements and analytics
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <h5 className="font-medium mb-1">Invite Team</h5>
              <p className="text-sm text-muted-foreground">
                Add team members and configure permissions
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Onboarding Page
// =============================================================================

export default function OnboardingPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  // Fetch onboarding state
  const { data: onboardingState, isLoading: stateLoading, refetch } = trpc.onboarding.getOrInitialize.useQuery();

  // Mutations
  const startStepMutation = trpc.onboarding.startStep.useMutation({
    onSuccess: () => refetch(),
  });
  const completeStepMutation = trpc.onboarding.completeStep.useMutation({
    onSuccess: () => refetch(),
  });
  const skipStepMutation = trpc.onboarding.skipStep.useMutation({
    onSuccess: () => refetch(),
  });
  const completeItemMutation = trpc.onboarding.completeChecklistItem.useMutation({
    onSuccess: () => refetch(),
  });
  const uncompleteItemMutation = trpc.onboarding.uncompleteChecklistItem.useMutation({
    onSuccess: () => refetch(),
  });

  // Step configuration
  const stepConfigs: StepConfig[] = [
    { key: 'welcome', name: 'Welcome', description: 'Get started', icon: '👋', estimatedTime: '2 min' },
    { key: 'organization', name: 'Organization', description: 'Company setup', icon: '🏢', estimatedTime: '5 min' },
    { key: 'chart_of_accounts', name: 'Accounts', description: 'Chart of accounts', icon: '📊', estimatedTime: '10 min' },
    { key: 'opening_balances', name: 'Balances', description: 'Opening balances', icon: '💰', estimatedTime: '15 min' },
    { key: 'integrations', name: 'Integrations', description: 'Connect tools', icon: '🔗', estimatedTime: '5 min' },
  ];

  // Derived state
  const currentStep = onboardingState?.currentStepDetails;
  const currentStepKey = currentStep?.step.stepKey as StepKey | undefined;
  const currentStepIndex = stepConfigs.findIndex(s => s.key === currentStepKey);
  const isComplete = onboardingState?.isComplete ?? false;

  const completedSteps = new Set<StepKey>(
    onboardingState?.steps
      .filter(s => s.isComplete)
      .map(s => s.step.stepKey as StepKey) ?? []
  );

  const loading = startStepMutation.isPending ||
    completeStepMutation.isPending ||
    skipStepMutation.isPending ||
    completeItemMutation.isPending ||
    uncompleteItemMutation.isPending;

  // Handlers
  const handleCompleteStep = async (stepKey?: StepKey) => {
    const key = stepKey ?? currentStepKey;
    if (!key) return;

    try {
      const result = await completeStepMutation.mutateAsync({ stepKey: key });
      if (result.success) {
        if (result.isOnboardingComplete) {
          toast.success('Onboarding complete!');
        } else if (result.nextStep) {
          // Auto-start next step
          await startStepMutation.mutateAsync({ stepKey: result.nextStep.stepKey as StepKey });
        }
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Failed to complete step');
    }
  };

  const handleSkipStep = async () => {
    if (!currentStepKey) return;

    try {
      const result = await skipStepMutation.mutateAsync({
        stepKey: currentStepKey,
        reason: 'Skipped during onboarding',
      });
      if (result.success && result.nextStep) {
        await startStepMutation.mutateAsync({ stepKey: result.nextStep.stepKey as StepKey });
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Failed to skip step');
    }
  };

  const handleCompleteItem = async (itemId: string) => {
    try {
      await completeItemMutation.mutateAsync({ itemId });
    } catch (error) {
      toast.error('Failed to update checklist item');
    }
  };

  const handleUncompleteItem = async (itemId: string) => {
    try {
      await uncompleteItemMutation.mutateAsync({ itemId });
    } catch (error) {
      toast.error('Failed to update checklist item');
    }
  };

  // Loading state
  if (stateLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading onboarding...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">Setup Wizard</h1>
            {!isComplete && onboardingState?.progress && (
              <Badge variant="outline">
                {onboardingState.progress.percentComplete}% Complete
              </Badge>
            )}
          </div>

          {!isComplete && (
            <ProgressBar
              value={onboardingState?.progress?.percentComplete ?? 0}
              max={100}
            />
          )}
        </div>

        {/* Step Indicator */}
        {!isComplete && (
          <StepIndicator
            steps={stepConfigs}
            currentStepIndex={currentStepIndex >= 0 ? currentStepIndex : 0}
            completedSteps={completedSteps}
          />
        )}

        {/* Main Content */}
        <Card>
          <CardContent className="p-6">
            {isComplete ? (
              <CompleteStep />
            ) : currentStepKey === 'welcome' ? (
              <WelcomeStep
                onComplete={() => handleCompleteStep('welcome')}
                onSkip={handleSkipStep}
                canSkip={currentStep?.step.canSkip ?? false}
              />
            ) : currentStepKey === 'organization' ? (
              <OrganizationStep
                checklistItems={currentStep?.checklistItems ?? []}
                onCompleteItem={handleCompleteItem}
                onUncompleteItem={handleUncompleteItem}
                onComplete={() => handleCompleteStep()}
                onSkip={handleSkipStep}
                canSkip={currentStep?.step.canSkip ?? false}
                canProceed={currentStep?.canProceed ?? false}
                loading={loading}
              />
            ) : currentStepKey === 'chart_of_accounts' ? (
              <ChartOfAccountsStep
                checklistItems={currentStep?.checklistItems ?? []}
                onCompleteItem={handleCompleteItem}
                onUncompleteItem={handleUncompleteItem}
                onComplete={() => handleCompleteStep()}
                onSkip={handleSkipStep}
                canSkip={currentStep?.step.canSkip ?? false}
                canProceed={currentStep?.canProceed ?? false}
                loading={loading}
              />
            ) : currentStepKey === 'opening_balances' ? (
              <OpeningBalancesStep
                checklistItems={currentStep?.checklistItems ?? []}
                onCompleteItem={handleCompleteItem}
                onUncompleteItem={handleUncompleteItem}
                onComplete={() => handleCompleteStep()}
                onSkip={handleSkipStep}
                canSkip={currentStep?.step.canSkip ?? false}
                canProceed={currentStep?.canProceed ?? false}
                loading={loading}
              />
            ) : currentStepKey === 'integrations' ? (
              <IntegrationsStep
                checklistItems={currentStep?.checklistItems ?? []}
                onCompleteItem={handleCompleteItem}
                onUncompleteItem={handleUncompleteItem}
                onComplete={() => handleCompleteStep()}
                onSkip={handleSkipStep}
                canSkip={currentStep?.step.canSkip ?? false}
                canProceed={currentStep?.canProceed ?? false}
                loading={loading}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading step...</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        {!isComplete && (
          <div className="mt-6 flex justify-between text-sm text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard')}
            >
              Skip Setup (Complete Later)
            </Button>
            <span>
              Estimated time remaining: {
                stepConfigs
                  .slice(currentStepIndex >= 0 ? currentStepIndex : 0)
                  .filter(s => !completedSteps.has(s.key))
                  .reduce((acc, s) => acc + parseInt(s.estimatedTime), 0)
              } min
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
