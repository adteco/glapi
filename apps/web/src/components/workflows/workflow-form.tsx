'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Settings,
  Zap,
  Clock,
  Webhook,
  MousePointer,
  Calendar,
} from 'lucide-react';

// ============================================================================
// Types and Schemas
// ============================================================================

const triggerConditionSchema = z.object({
  field: z.string().min(1, 'Field is required'),
  operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'contains', 'starts_with', 'ends_with', 'regex']),
  value: z.string().min(1, 'Value is required'),
});

const eventTriggerConfigSchema = z.object({
  eventType: z.string().min(1, 'Event type is required'),
  documentTypes: z.array(z.string()).optional(),
  conditions: z.array(triggerConditionSchema).optional(),
});

const scheduleTriggerConfigSchema = z.object({
  cronExpression: z.string().min(1, 'Cron expression is required'),
  timezone: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const webhookTriggerConfigSchema = z.object({
  secretKey: z.string().optional(),
  allowedIps: z.array(z.string()).optional(),
  requiredHeaders: z.record(z.string()).optional(),
});

const manualTriggerConfigSchema = z.object({
  allowedRoleIds: z.array(z.string()).optional(),
  allowedUserIds: z.array(z.string()).optional(),
});

const stepSchema = z.object({
  id: z.string().optional(),
  stepCode: z.string().min(1, 'Step code is required'),
  stepName: z.string().min(1, 'Step name is required'),
  description: z.string().optional(),
  stepOrder: z.number().int().min(1),
  actionType: z.enum([
    'webhook',
    'internal_action',
    'notification',
    'condition',
    'delay',
    'transform',
    'approval',
    'loop',
    'parallel',
    'sub_workflow',
  ]),
  actionConfig: z.record(z.unknown()),
  errorStrategy: z.enum(['stop', 'continue', 'retry', 'branch']).optional(),
  maxRetries: z.number().int().min(0).optional(),
  retryDelayMs: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
});

const workflowFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  workflowCode: z.string().min(1, 'Workflow code is required').max(100),
  triggerType: z.enum(['event', 'schedule', 'webhook', 'manual', 'api']),
  triggerConfig: z.union([
    eventTriggerConfigSchema,
    scheduleTriggerConfigSchema,
    webhookTriggerConfigSchema,
    manualTriggerConfigSchema,
    z.object({}),
  ]),
  maxExecutionTimeMs: z.number().int().positive().optional(),
  maxRetries: z.number().int().min(0).optional(),
  retryDelayMs: z.number().int().positive().optional(),
  enableLogging: z.boolean().optional(),
  enableMetrics: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  steps: z.array(stepSchema).optional(),
});

export type WorkflowFormValues = z.infer<typeof workflowFormSchema>;

interface WorkflowFormProps {
  initialData?: Partial<WorkflowFormValues>;
  onSubmit: (data: WorkflowFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  isEditing?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function WorkflowForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  isEditing = false,
}: WorkflowFormProps) {
  const [activeTab, setActiveTab] = useState('general');
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const form = useForm<WorkflowFormValues>({
    resolver: zodResolver(workflowFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      workflowCode: initialData?.workflowCode || '',
      triggerType: initialData?.triggerType || 'manual',
      triggerConfig: initialData?.triggerConfig || {},
      maxExecutionTimeMs: initialData?.maxExecutionTimeMs || 3600000,
      maxRetries: initialData?.maxRetries || 3,
      retryDelayMs: initialData?.retryDelayMs || 60000,
      enableLogging: initialData?.enableLogging ?? true,
      enableMetrics: initialData?.enableMetrics ?? true,
      tags: initialData?.tags || [],
      category: initialData?.category || '',
      steps: initialData?.steps || [],
    },
  });

  const {
    fields: stepFields,
    append: appendStep,
    remove: removeStep,
    move: moveStep,
  } = useFieldArray({
    control: form.control,
    name: 'steps',
  });

  const watchedTriggerType = form.watch('triggerType');

  const handleSubmit = (data: WorkflowFormValues) => {
    onSubmit(data);
  };

  const addStep = () => {
    const newOrder = stepFields.length + 1;
    appendStep({
      stepCode: `step_${newOrder}`,
      stepName: `Step ${newOrder}`,
      description: '',
      stepOrder: newOrder,
      actionType: 'notification',
      actionConfig: {},
      errorStrategy: 'stop',
    });
    setExpandedStep(stepFields.length);
  };

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'event':
        return <Zap className="h-4 w-4" />;
      case 'schedule':
        return <Calendar className="h-4 w-4" />;
      case 'webhook':
        return <Webhook className="h-4 w-4" />;
      case 'manual':
        return <MousePointer className="h-4 w-4" />;
      case 'api':
        return <Clock className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getActionTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      notification: 'bg-blue-100 text-blue-800',
      internal_action: 'bg-purple-100 text-purple-800',
      condition: 'bg-yellow-100 text-yellow-800',
      delay: 'bg-gray-100 text-gray-800',
      transform: 'bg-green-100 text-green-800',
      webhook: 'bg-orange-100 text-orange-800',
      approval: 'bg-red-100 text-red-800',
      loop: 'bg-indigo-100 text-indigo-800',
      parallel: 'bg-pink-100 text-pink-800',
      sub_workflow: 'bg-cyan-100 text-cyan-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="trigger">Trigger</TabsTrigger>
            <TabsTrigger value="steps">
              Steps ({stepFields.length})
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Configure the basic details of your workflow
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="My Workflow" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="workflowCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workflow Code *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="my_workflow"
                          {...field}
                          disabled={isEditing}
                        />
                      </FormControl>
                      <FormDescription>
                        Unique identifier for this workflow. Cannot be changed after creation.
                      </FormDescription>
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
                          placeholder="Describe what this workflow does..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., finance, operations" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>
                  Configure workflow execution settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="maxRetries"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Retries</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="retryDelayMs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Retry Delay (ms)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1000}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 60000)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxExecutionTimeMs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Execution Time (ms)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1000}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 3600000)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-6">
                  <FormField
                    control={form.control}
                    name="enableLogging"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">Enable Logging</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="enableMetrics"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">Enable Metrics</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trigger Tab */}
          <TabsContent value="trigger" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Trigger Configuration</CardTitle>
                <CardDescription>
                  Define how this workflow should be triggered
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="triggerType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trigger Type *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select trigger type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="manual">
                            <div className="flex items-center gap-2">
                              <MousePointer className="h-4 w-4" />
                              Manual - Triggered by user
                            </div>
                          </SelectItem>
                          <SelectItem value="event">
                            <div className="flex items-center gap-2">
                              <Zap className="h-4 w-4" />
                              Event - Triggered by system events
                            </div>
                          </SelectItem>
                          <SelectItem value="schedule">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Schedule - Triggered on a schedule
                            </div>
                          </SelectItem>
                          <SelectItem value="webhook">
                            <div className="flex items-center gap-2">
                              <Webhook className="h-4 w-4" />
                              Webhook - Triggered by external webhook
                            </div>
                          </SelectItem>
                          <SelectItem value="api">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              API - Triggered via API call
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Event Trigger Config */}
                {watchedTriggerType === 'event' && (
                  <div className="space-y-4 pt-4 border-t">
                    <FormField
                      control={form.control}
                      name="triggerConfig.eventType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Type *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., document.created, invoice.paid"
                              {...field}
                              value={field.value as string || ''}
                            />
                          </FormControl>
                          <FormDescription>
                            The event that will trigger this workflow
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Schedule Trigger Config */}
                {watchedTriggerType === 'schedule' && (
                  <div className="space-y-4 pt-4 border-t">
                    <FormField
                      control={form.control}
                      name="triggerConfig.cronExpression"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cron Expression *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="0 0 * * * (daily at midnight)"
                              {...field}
                              value={field.value as string || ''}
                            />
                          </FormControl>
                          <FormDescription>
                            Standard cron expression for scheduling
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="triggerConfig.timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timezone</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="UTC"
                              {...field}
                              value={field.value as string || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Webhook Trigger Config */}
                {watchedTriggerType === 'webhook' && (
                  <div className="space-y-4 pt-4 border-t">
                    <FormField
                      control={form.control}
                      name="triggerConfig.secretKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secret Key</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="For webhook signature validation"
                              {...field}
                              value={field.value as string || ''}
                            />
                          </FormControl>
                          <FormDescription>
                            Optional secret for validating webhook signatures
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Manual/API Trigger - No additional config needed */}
                {(watchedTriggerType === 'manual' || watchedTriggerType === 'api') && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      {watchedTriggerType === 'manual'
                        ? 'This workflow will be triggered manually by users.'
                        : 'This workflow will be triggered via API calls.'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Steps Tab */}
          <TabsContent value="steps" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Workflow Steps</CardTitle>
                    <CardDescription>
                      Define the actions that will be executed in this workflow
                    </CardDescription>
                  </div>
                  <Button type="button" onClick={addStep}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Step
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {stepFields.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No steps defined yet. Click &quot;Add Step&quot; to create your first step.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stepFields.map((step, index) => (
                      <div
                        key={step.id}
                        className="border rounded-lg overflow-hidden"
                      >
                        <div
                          className="flex items-center gap-4 p-4 bg-muted/50 cursor-pointer"
                          onClick={() =>
                            setExpandedStep(expandedStep === index ? null : index)
                          }
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {form.watch(`steps.${index}.stepName`) || `Step ${index + 1}`}
                              </span>
                              <Badge className={getActionTypeBadge(form.watch(`steps.${index}.actionType`))}>
                                {form.watch(`steps.${index}.actionType`)}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {form.watch(`steps.${index}.description`) || 'No description'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (index > 0) {
                                  moveStep(index, index - 1);
                                }
                              }}
                              disabled={index === 0}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (index < stepFields.length - 1) {
                                  moveStep(index, index + 1);
                                }
                              }}
                              disabled={index === stepFields.length - 1}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeStep(index);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>

                        {expandedStep === index && (
                          <div className="p-4 space-y-4 border-t">
                            <div className="grid grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name={`steps.${index}.stepCode`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Step Code *</FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name={`steps.${index}.stepName`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Step Name *</FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <FormField
                              control={form.control}
                              name={`steps.${index}.description`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Description</FormLabel>
                                  <FormControl>
                                    <Textarea {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name={`steps.${index}.actionType`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Action Type *</FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      value={field.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select action type" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="notification">Notification</SelectItem>
                                        <SelectItem value="internal_action">Internal Action</SelectItem>
                                        <SelectItem value="condition">Condition</SelectItem>
                                        <SelectItem value="delay">Delay</SelectItem>
                                        <SelectItem value="transform">Transform</SelectItem>
                                        <SelectItem value="webhook">Webhook</SelectItem>
                                        <SelectItem value="approval">Approval</SelectItem>
                                        <SelectItem value="loop">Loop</SelectItem>
                                        <SelectItem value="parallel">Parallel</SelectItem>
                                        <SelectItem value="sub_workflow">Sub-Workflow</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name={`steps.${index}.errorStrategy`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Error Strategy</FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      value={field.value || 'stop'}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="stop">Stop Workflow</SelectItem>
                                        <SelectItem value="continue">Continue</SelectItem>
                                        <SelectItem value="retry">Retry</SelectItem>
                                        <SelectItem value="branch">Error Branch</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            {/* Action-specific configuration */}
                            {form.watch(`steps.${index}.actionType`) === 'notification' && (
                              <div className="space-y-4 pt-4 border-t">
                                <h4 className="font-medium">Notification Configuration</h4>
                                <FormField
                                  control={form.control}
                                  name={`steps.${index}.actionConfig.subjectTemplate`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Subject Template</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="e.g., Invoice {{invoice.number}} is overdue"
                                          {...field}
                                          value={field.value as string || ''}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name={`steps.${index}.actionConfig.bodyTemplate`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Body Template</FormLabel>
                                      <FormControl>
                                        <Textarea
                                          placeholder="Enter the notification body..."
                                          {...field}
                                          value={field.value as string || ''}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}

                            {form.watch(`steps.${index}.actionType`) === 'delay' && (
                              <div className="space-y-4 pt-4 border-t">
                                <h4 className="font-medium">Delay Configuration</h4>
                                <FormField
                                  control={form.control}
                                  name={`steps.${index}.actionConfig.durationMs`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Duration (ms)</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          placeholder="e.g., 60000 (1 minute)"
                                          {...field}
                                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                          value={field.value as number || ''}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}

                            {form.watch(`steps.${index}.actionType`) === 'internal_action' && (
                              <div className="space-y-4 pt-4 border-t">
                                <h4 className="font-medium">Internal Action Configuration</h4>
                                <FormField
                                  control={form.control}
                                  name={`steps.${index}.actionConfig.actionName`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Action Name *</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="e.g., updateDocumentStatus"
                                          {...field}
                                          value={field.value as string || ''}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Form Actions */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Workflow'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
