'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { WorkflowForm, WorkflowFormValues } from '@/components/workflows/workflow-form';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function NewWorkflowPage() {
  const { orgId } = useAuth();
  const router = useRouter();

  const createMutation = trpc.workflows.create.useMutation({
    onSuccess: (data) => {
      toast.success('Workflow created successfully');
      router.push(`/admin/workflows/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create workflow');
    },
  });

  const handleSubmit = async (data: WorkflowFormValues) => {
    // Create the workflow first
    const workflow = await createMutation.mutateAsync({
      name: data.name,
      description: data.description,
      workflowCode: data.workflowCode,
      triggerType: data.triggerType,
      triggerConfig: data.triggerConfig,
      maxExecutionTimeMs: data.maxExecutionTimeMs,
      maxRetries: data.maxRetries,
      retryDelayMs: data.retryDelayMs,
      enableLogging: data.enableLogging,
      enableMetrics: data.enableMetrics,
      tags: data.tags,
      category: data.category,
    });

    // Steps will be added in the edit page after creation
  };

  const handleCancel = () => {
    router.push('/admin/workflows');
  };

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to create a workflow.</p>
      </div>
    );
  }

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

      <h1 className="text-3xl font-bold mb-6">Create New Workflow</h1>

      <WorkflowForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={createMutation.isPending}
      />
    </div>
  );
}
