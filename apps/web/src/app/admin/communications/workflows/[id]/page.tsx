'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  GripVertical,
  Mail,
  Clock,
  GitBranch,
  Webhook,
  Play,
  Pause,
  Settings,
  ChevronUp,
  ChevronDown,
  Check,
  X,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { cn } from '@/lib/utils';
import type { RouterOutputs } from '@glapi/trpc';

type Workflow = RouterOutputs['communicationWorkflows']['get'];
type WorkflowStep = NonNullable<Workflow['steps']>[number];

const TRIGGER_TYPE_OPTIONS = [
  { value: 'manual', label: 'Manual', description: 'Triggered manually via UI or API' },
  { value: 'entity_created', label: 'Entity Created', description: 'When a new entity is created' },
  { value: 'entity_updated', label: 'Entity Updated', description: 'When an entity is updated' },
  { value: 'event', label: 'Event', description: 'Triggered by a system event' },
  { value: 'schedule', label: 'Schedule', description: 'Run on a schedule (cron)' },
  { value: 'webhook', label: 'Webhook', description: 'Triggered via webhook' },
];

const STEP_TYPE_OPTIONS = [
  { value: 'send_email', label: 'Send Email', icon: Mail, description: 'Send an email using a template' },
  { value: 'wait_delay', label: 'Wait (Delay)', icon: Clock, description: 'Wait for a specified duration' },
  { value: 'wait_until', label: 'Wait Until', icon: Clock, description: 'Wait until a specific time' },
  { value: 'condition', label: 'Condition', icon: GitBranch, description: 'Branch based on a condition' },
  { value: 'webhook', label: 'Webhook', icon: Webhook, description: 'Call an external webhook' },
  { value: 'end', label: 'End', icon: X, description: 'End the workflow' },
];

const workflowFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(1000).optional(),
  triggerType: z.enum([
    'manual',
    'entity_created',
    'entity_updated',
    'event',
    'schedule',
    'webhook',
  ]),
  targetEntityType: z.string().optional(),
  isActive: z.boolean().default(false),
});

type WorkflowFormValues = z.infer<typeof workflowFormSchema>;

const stepFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  stepType: z.enum([
    'send_email',
    'wait_delay',
    'wait_until',
    'condition',
    'update_entity',
    'webhook',
    'end',
  ]),
  config: z.record(z.unknown()).optional(),
});

type StepFormValues = z.infer<typeof stepFormSchema>;

export default function WorkflowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === 'new';

  const [showStepDialog, setShowStepDialog] = useState(false);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [deleteStep, setDeleteStep] = useState<WorkflowStep | null>(null);

  const utils = trpc.useUtils();

  const { data: workflow, isLoading } = trpc.communicationWorkflows.get.useQuery(
    { id: params.id as string },
    { enabled: !isNew }
  );

  const { data: templates } = trpc.emailTemplates.listActive.useQuery({});

  const createMutation = trpc.communicationWorkflows.create.useMutation({
    onSuccess: (data) => {
      toast.success('Workflow created');
      router.push(`/admin/communications/workflows/${data.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to create workflow: ${error.message}`);
    },
  });

  const updateMutation = trpc.communicationWorkflows.update.useMutation({
    onSuccess: () => {
      toast.success('Workflow saved');
      utils.communicationWorkflows.get.invalidate({ id: params.id as string });
    },
    onError: (error) => {
      toast.error(`Failed to save workflow: ${error.message}`);
    },
  });

  const addStepMutation = trpc.communicationWorkflows.addStep.useMutation({
    onSuccess: () => {
      toast.success('Step added');
      utils.communicationWorkflows.get.invalidate({ id: params.id as string });
      setShowStepDialog(false);
      stepForm.reset();
    },
    onError: (error) => {
      toast.error(`Failed to add step: ${error.message}`);
    },
  });

  const updateStepMutation = trpc.communicationWorkflows.updateStep.useMutation({
    onSuccess: () => {
      toast.success('Step updated');
      utils.communicationWorkflows.get.invalidate({ id: params.id as string });
      setShowStepDialog(false);
      setEditingStep(null);
      stepForm.reset();
    },
    onError: (error) => {
      toast.error(`Failed to update step: ${error.message}`);
    },
  });

  const deleteStepMutation = trpc.communicationWorkflows.deleteStep.useMutation({
    onSuccess: () => {
      toast.success('Step deleted');
      utils.communicationWorkflows.get.invalidate({ id: params.id as string });
      setDeleteStep(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete step: ${error.message}`);
    },
  });

  const reorderStepsMutation = trpc.communicationWorkflows.reorderSteps.useMutation({
    onSuccess: () => {
      utils.communicationWorkflows.get.invalidate({ id: params.id as string });
    },
    onError: (error) => {
      toast.error(`Failed to reorder steps: ${error.message}`);
    },
  });

  const activateMutation = trpc.communicationWorkflows.activate.useMutation({
    onSuccess: () => {
      toast.success('Workflow activated');
      utils.communicationWorkflows.get.invalidate({ id: params.id as string });
    },
    onError: (error) => {
      toast.error(`Failed to activate: ${error.message}`);
    },
  });

  const deactivateMutation = trpc.communicationWorkflows.deactivate.useMutation({
    onSuccess: () => {
      toast.success('Workflow deactivated');
      utils.communicationWorkflows.get.invalidate({ id: params.id as string });
    },
    onError: (error) => {
      toast.error(`Failed to deactivate: ${error.message}`);
    },
  });

  const form = useForm<WorkflowFormValues>({
    resolver: zodResolver(workflowFormSchema),
    defaultValues: {
      name: '',
      description: '',
      triggerType: 'manual',
      targetEntityType: '',
      isActive: false,
    },
  });

  const stepForm = useForm<StepFormValues>({
    resolver: zodResolver(stepFormSchema),
    defaultValues: {
      name: '',
      stepType: 'send_email',
      config: {},
    },
  });

  // Reset form when workflow loads
  useEffect(() => {
    if (workflow && !isNew) {
      form.reset({
        name: workflow.name,
        description: workflow.description ?? '',
        triggerType: workflow.triggerType as WorkflowFormValues['triggerType'],
        targetEntityType: workflow.targetEntityType ?? '',
        isActive: workflow.isActive,
      });
    }
  }, [workflow, isNew, form]);

  const handleSubmit = useCallback(
    (values: WorkflowFormValues) => {
      if (isNew) {
        createMutation.mutate(values);
      } else {
        updateMutation.mutate({
          id: params.id as string,
          data: values,
        });
      }
    },
    [isNew, params.id, createMutation, updateMutation]
  );

  const handleAddStep = useCallback(() => {
    setEditingStep(null);
    stepForm.reset({
      name: '',
      stepType: 'send_email',
      config: {},
    });
    setShowStepDialog(true);
  }, [stepForm]);

  const handleEditStep = useCallback(
    (step: WorkflowStep) => {
      setEditingStep(step);
      stepForm.reset({
        name: step.name,
        stepType: step.stepType as StepFormValues['stepType'],
        config: (step.config as Record<string, unknown>) ?? {},
      });
      setShowStepDialog(true);
    },
    [stepForm]
  );

  const handleStepSubmit = useCallback(
    (values: StepFormValues) => {
      if (editingStep) {
        updateStepMutation.mutate({
          workflowId: params.id as string,
          stepId: editingStep.id,
          data: values,
        });
      } else {
        addStepMutation.mutate({
          workflowId: params.id as string,
          data: {
            ...values,
            sortOrder: (workflow?.steps?.length ?? 0) + 1,
          },
        });
      }
    },
    [editingStep, params.id, workflow?.steps?.length, addStepMutation, updateStepMutation]
  );

  const handleMoveStep = useCallback(
    (stepId: string, direction: 'up' | 'down') => {
      if (!workflow?.steps) return;

      const currentIndex = workflow.steps.findIndex((s) => s.id === stepId);
      if (currentIndex === -1) return;

      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= workflow.steps.length) return;

      const newOrder = workflow.steps.map((s) => s.id);
      [newOrder[currentIndex], newOrder[newIndex]] = [
        newOrder[newIndex],
        newOrder[currentIndex],
      ];

      reorderStepsMutation.mutate({
        workflowId: params.id as string,
        stepIds: newOrder,
      });
    },
    [workflow?.steps, params.id, reorderStepsMutation]
  );

  const toggleActive = useCallback(() => {
    if (workflow?.isActive) {
      deactivateMutation.mutate({ id: params.id as string });
    } else {
      activateMutation.mutate({ id: params.id as string });
    }
  }, [workflow?.isActive, params.id, activateMutation, deactivateMutation]);

  const getStepIcon = (stepType: string) => {
    const option = STEP_TYPE_OPTIONS.find((o) => o.value === stepType);
    const Icon = option?.icon || Settings;
    return <Icon className="h-4 w-4" />;
  };

  if (!isNew && isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Skeleton className="h-[600px]" />
          </div>
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/communications/workflows">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {isNew ? 'New Workflow' : workflow?.name}
            </h1>
            {!isNew && workflow && (
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={workflow.isActive ? 'default' : 'secondary'}>
                  {workflow.isActive ? 'Active' : 'Inactive'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {workflow.steps?.length ?? 0} steps
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && workflow && (
            <Button
              variant="outline"
              onClick={toggleActive}
              disabled={activateMutation.isPending || deactivateMutation.isPending}
            >
              {workflow.isActive ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Deactivate
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Activate
                </>
              )}
            </Button>
          )}
          <Button
            onClick={form.handleSubmit(handleSubmit)}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {createMutation.isPending || updateMutation.isPending
              ? 'Saving...'
              : 'Save'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content - Steps */}
        <div className="lg:col-span-2 space-y-6">
          {/* Workflow Steps */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Workflow Steps</CardTitle>
                  <CardDescription>
                    Define the sequence of actions in your workflow
                  </CardDescription>
                </div>
                {!isNew && (
                  <Button onClick={handleAddStep}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Step
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isNew ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Save the workflow first to add steps</p>
                </div>
              ) : !workflow?.steps || workflow.steps.length === 0 ? (
                <div className="text-center py-8">
                  <GitBranch className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No steps yet</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Add steps to define your workflow&apos;s actions
                  </p>
                  <Button onClick={handleAddStep} className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Step
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {workflow.steps
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((step, index) => (
                      <div
                        key={step.id}
                        className="flex items-center gap-3 p-4 border rounded-lg"
                      >
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoveStep(step.id, 'up')}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoveStep(step.id, 'down')}
                            disabled={index === workflow.steps!.length - 1}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                        <div
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-full',
                            step.stepType === 'send_email'
                              ? 'bg-blue-100 text-blue-600'
                              : step.stepType === 'wait_delay' ||
                                  step.stepType === 'wait_until'
                                ? 'bg-yellow-100 text-yellow-600'
                                : step.stepType === 'condition'
                                  ? 'bg-purple-100 text-purple-600'
                                  : step.stepType === 'end'
                                    ? 'bg-gray-100 text-gray-600'
                                    : 'bg-green-100 text-green-600'
                          )}
                        >
                          {getStepIcon(step.stepType)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{step.name}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {step.stepType.replace('_', ' ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditStep(step)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteStep(step)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Settings */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Welcome Email Sequence" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Describe what this workflow does"
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="triggerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trigger Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select trigger" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TRIGGER_TYPE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <div>
                                  <p>{opt.label}</p>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {
                            TRIGGER_TYPE_OPTIONS.find(
                              (o) => o.value === field.value
                            )?.description
                          }
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {(form.watch('triggerType') === 'entity_created' ||
                    form.watch('triggerType') === 'entity_updated') && (
                    <FormField
                      control={form.control}
                      name="targetEntityType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Entity Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select entity type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="customer">Customer</SelectItem>
                              <SelectItem value="vendor">Vendor</SelectItem>
                              <SelectItem value="employee">Employee</SelectItem>
                              <SelectItem value="lead">Lead</SelectItem>
                              <SelectItem value="prospect">Prospect</SelectItem>
                              <SelectItem value="project">Project</SelectItem>
                              <SelectItem value="invoice">Invoice</SelectItem>
                              <SelectItem value="sales_order">
                                Sales Order
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Execution Stats */}
          {!isNew && workflow && (
            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Total Executions
                  </span>
                  <span className="font-medium">
                    {workflow.totalExecutions ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Successful
                  </span>
                  <span className="font-medium text-green-600">
                    {workflow.successfulExecutions ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Failed</span>
                  <span className="font-medium text-red-600">
                    {workflow.failedExecutions ?? 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add/Edit Step Dialog */}
      <Dialog open={showStepDialog} onOpenChange={setShowStepDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingStep ? 'Edit Step' : 'Add Step'}
            </DialogTitle>
            <DialogDescription>
              Configure the step&apos;s action and settings
            </DialogDescription>
          </DialogHeader>
          <Form {...stepForm}>
            <form
              onSubmit={stepForm.handleSubmit(handleStepSubmit)}
              className="space-y-4"
            >
              <FormField
                control={stepForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Step Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Send Welcome Email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={stepForm.control}
                name="stepType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Step Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select step type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STEP_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              <opt.icon className="h-4 w-4" />
                              {opt.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {
                        STEP_TYPE_OPTIONS.find(
                          (o) => o.value === field.value
                        )?.description
                      }
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Step-specific configuration */}
              {stepForm.watch('stepType') === 'send_email' && (
                <div className="space-y-4 border-t pt-4">
                  <div>
                    <Label>Email Template</Label>
                    <Select
                      value={
                        (stepForm.watch('config') as Record<string, unknown>)
                          ?.templateId as string
                      }
                      onValueChange={(value) =>
                        stepForm.setValue('config', {
                          ...stepForm.watch('config'),
                          templateId: value,
                        })
                      }
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates?.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {stepForm.watch('stepType') === 'wait_delay' && (
                <div className="space-y-4 border-t pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Duration</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="1"
                        className="mt-1.5"
                        value={
                          (stepForm.watch('config') as Record<string, unknown>)
                            ?.delayValue as number
                        }
                        onChange={(e) =>
                          stepForm.setValue('config', {
                            ...stepForm.watch('config'),
                            delayValue: parseInt(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Unit</Label>
                      <Select
                        value={
                          ((stepForm.watch('config') as Record<string, unknown>)
                            ?.delayUnit as string) ?? 'days'
                        }
                        onValueChange={(value) =>
                          stepForm.setValue('config', {
                            ...stepForm.watch('config'),
                            delayUnit: value,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minutes">Minutes</SelectItem>
                          <SelectItem value="hours">Hours</SelectItem>
                          <SelectItem value="days">Days</SelectItem>
                          <SelectItem value="weeks">Weeks</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {stepForm.watch('stepType') === 'webhook' && (
                <div className="space-y-4 border-t pt-4">
                  <div>
                    <Label>Webhook URL</Label>
                    <Input
                      type="url"
                      placeholder="https://api.example.com/webhook"
                      className="mt-1.5"
                      value={
                        (stepForm.watch('config') as Record<string, unknown>)
                          ?.webhookUrl as string
                      }
                      onChange={(e) =>
                        stepForm.setValue('config', {
                          ...stepForm.watch('config'),
                          webhookUrl: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>HTTP Method</Label>
                    <Select
                      value={
                        ((stepForm.watch('config') as Record<string, unknown>)
                          ?.httpMethod as string) ?? 'POST'
                      }
                      onValueChange={(value) =>
                        stepForm.setValue('config', {
                          ...stepForm.watch('config'),
                          httpMethod: value,
                        })
                      }
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="PATCH">PATCH</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowStepDialog(false);
                    setEditingStep(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    addStepMutation.isPending || updateStepMutation.isPending
                  }
                >
                  {addStepMutation.isPending || updateStepMutation.isPending
                    ? 'Saving...'
                    : editingStep
                      ? 'Update Step'
                      : 'Add Step'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Step Confirmation */}
      <AlertDialog
        open={!!deleteStep}
        onOpenChange={(open) => !open && setDeleteStep(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Step</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteStep?.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteStep &&
                deleteStepMutation.mutate({
                  workflowId: params.id as string,
                  stepId: deleteStep.id,
                })
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteStepMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
