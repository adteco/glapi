'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { WorkflowForm, WorkflowFormValues } from '@/components/workflows/workflow-form';
import { ArrowLeft, Play, Pause, Archive, History, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function EditWorkflowPage() {
  const params = useParams();
  const workflowId = params.id as string;
  const { orgId } = useAuth();
  const router = useRouter();

  // Fetch workflow data
  const {
    data: workflow,
    isLoading,
    refetch,
  } = trpc.workflows.get.useQuery(
    { id: workflowId },
    {
      enabled: !!orgId && !!workflowId,
    }
  );

  // Mutations
  const updateMutation = trpc.workflows.update.useMutation({
    onSuccess: () => {
      toast.success('Workflow updated successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update workflow');
    },
  });

  const addStepMutation = trpc.workflows.addStep.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add step');
    },
  });

  const updateStepMutation = trpc.workflows.updateStep.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update step');
    },
  });

  const deleteStepMutation = trpc.workflows.deleteStep.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete step');
    },
  });

  const publishMutation = trpc.workflows.publish.useMutation({
    onSuccess: () => {
      toast.success('Workflow published successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to publish workflow');
    },
  });

  const pauseMutation = trpc.workflows.pause.useMutation({
    onSuccess: () => {
      toast.success('Workflow paused');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to pause workflow');
    },
  });

  const resumeMutation = trpc.workflows.resume.useMutation({
    onSuccess: () => {
      toast.success('Workflow resumed');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to resume workflow');
    },
  });

  const archiveMutation = trpc.workflows.archive.useMutation({
    onSuccess: () => {
      toast.success('Workflow archived');
      router.push('/admin/workflows');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to archive workflow');
    },
  });

  const handleSubmit = async (data: WorkflowFormValues) => {
    // Update workflow definition
    await updateMutation.mutateAsync({
      id: workflowId,
      data: {
        name: data.name,
        description: data.description,
        triggerType: data.triggerType,
        triggerConfig: data.triggerConfig,
        maxExecutionTimeMs: data.maxExecutionTimeMs,
        maxRetries: data.maxRetries,
        retryDelayMs: data.retryDelayMs,
        enableLogging: data.enableLogging,
        enableMetrics: data.enableMetrics,
        tags: data.tags,
        category: data.category,
      },
    });

    // Handle steps - sync existing steps with form data
    const existingSteps = workflow?.steps || [];
    const formSteps = data.steps || [];

    // Delete steps that are no longer in the form
    for (const existingStep of existingSteps) {
      const stillExists = formSteps.some((s) => s.id === existingStep.id);
      if (!stillExists) {
        await deleteStepMutation.mutateAsync({ stepId: existingStep.id });
      }
    }

    // Add or update steps
    for (let i = 0; i < formSteps.length; i++) {
      const formStep = formSteps[i];
      const existingStep = existingSteps.find((s) => s.id === formStep.id);

      if (existingStep) {
        // Update existing step
        await updateStepMutation.mutateAsync({
          stepId: existingStep.id,
          data: {
            stepName: formStep.stepName,
            description: formStep.description,
            stepOrder: i + 1,
            actionType: formStep.actionType,
            actionConfig: formStep.actionConfig,
            errorStrategy: formStep.errorStrategy,
            maxRetries: formStep.maxRetries,
            retryDelayMs: formStep.retryDelayMs,
            timeoutMs: formStep.timeoutMs,
          },
        });
      } else {
        // Add new step
        await addStepMutation.mutateAsync({
          workflowId,
          step: {
            stepCode: formStep.stepCode,
            stepName: formStep.stepName,
            description: formStep.description,
            stepOrder: i + 1,
            actionType: formStep.actionType,
            actionConfig: formStep.actionConfig,
            errorStrategy: formStep.errorStrategy,
            maxRetries: formStep.maxRetries,
            retryDelayMs: formStep.retryDelayMs,
            timeoutMs: formStep.timeoutMs,
          },
        });
      }
    }

    toast.success('Workflow saved successfully');
    refetch();
  };

  const handleCancel = () => {
    router.push('/admin/workflows');
  };

  const getStatusBadgeVariant = (
    status: string
  ): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'active':
        return 'default';
      case 'paused':
        return 'secondary';
      case 'archived':
        return 'outline';
      case 'draft':
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <p>Loading workflow...</p>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="container mx-auto py-10">
        <p>Workflow not found.</p>
        <Link href="/admin/workflows">
          <Button variant="link">Back to Workflows</Button>
        </Link>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to edit this workflow.</p>
      </div>
    );
  }

  const isEditable = workflow.status === 'draft';

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <Link href="/admin/workflows">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workflows
          </Button>
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{workflow.name}</h1>
            <Badge variant={getStatusBadgeVariant(workflow.status)}>
              {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Code: <code className="bg-muted px-1 py-0.5 rounded">{workflow.workflowCode}</code>
            {' | '}Version: v{workflow.version}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/admin/workflows/executions?workflowId=${workflowId}`)}
          >
            <History className="mr-2 h-4 w-4" />
            View Executions
          </Button>

          {workflow.status === 'draft' && (
            <Button
              onClick={() => publishMutation.mutate({ id: workflowId })}
              disabled={!workflow.steps || workflow.steps.length === 0}
            >
              <Play className="mr-2 h-4 w-4" />
              Publish
            </Button>
          )}

          {workflow.status === 'active' && (
            <Button variant="outline" onClick={() => pauseMutation.mutate({ id: workflowId })}>
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
          )}

          {workflow.status === 'paused' && (
            <Button onClick={() => resumeMutation.mutate({ id: workflowId })}>
              <Play className="mr-2 h-4 w-4" />
              Resume
            </Button>
          )}

          {workflow.status !== 'archived' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive Workflow</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to archive this workflow? Archived workflows cannot be
                    triggered but can be restored later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => archiveMutation.mutate({ id: workflowId })}>
                    Archive
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {!isEditable && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <span className="text-yellow-800">
            This workflow is {workflow.status}. Only draft workflows can be edited. Create a new
            version to make changes.
          </span>
        </div>
      )}

      <WorkflowForm
        initialData={{
          name: workflow.name,
          description: workflow.description || '',
          workflowCode: workflow.workflowCode,
          triggerType: workflow.triggerType,
          triggerConfig: workflow.triggerConfig as Record<string, unknown>,
          maxExecutionTimeMs: workflow.maxExecutionTimeMs || 3600000,
          maxRetries: workflow.maxRetries || 3,
          retryDelayMs: workflow.retryDelayMs || 60000,
          enableLogging: workflow.enableLogging,
          enableMetrics: workflow.enableMetrics,
          tags: (workflow.tags as string[]) || [],
          category: workflow.category || '',
          steps: workflow.steps?.map((step) => ({
            id: step.id,
            stepCode: step.stepCode,
            stepName: step.stepName,
            description: step.description || '',
            stepOrder: step.stepOrder,
            actionType: step.actionType,
            actionConfig: step.actionConfig as Record<string, unknown>,
            errorStrategy: step.errorStrategy,
            maxRetries: step.maxRetries || undefined,
            retryDelayMs: step.retryDelayMs || undefined,
            timeoutMs: step.timeoutMs || undefined,
          })),
        }}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={updateMutation.isPending}
        isEditing={true}
      />
    </div>
  );
}
