'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { RouterOutputs } from '@glapi/trpc';

// Entity types enum
const entityTypeEnum = z.enum([
  'project',
  'customer',
  'employee',
  'vendor',
  'lead',
  'prospect',
  'contact',
]);

const priorityEnum = z.enum(['critical', 'high', 'medium', 'low']);
const statusEnum = z.enum([
  'not_started',
  'in_progress',
  'pending_review',
  'completed',
  'blocked',
  'cancelled',
]);

// Form schema
const taskFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().optional(),
  priority: priorityEnum.default('medium'),
  status: statusEnum.optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  reviewerId: z.string().uuid().nullable().optional(),
  estimatedStartDate: z.string().nullable().optional(),
  estimatedEndDate: z.string().nullable().optional(),
  estimatedHours: z.string().nullable().optional(),
  estimatedBudget: z.string().nullable().optional(),
  isBillable: z.boolean().default(false),
  billingRate: z.string().nullable().optional(),
  customFieldValues: z.record(z.unknown()).optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

type EntityTask = RouterOutputs['entityTasks']['get'];
type TaskFieldDefinition = RouterOutputs['taskFields']['list'][number];

interface TaskFormProps {
  entityType: z.infer<typeof entityTypeEnum>;
  entityId: string;
  task?: EntityTask | null;
  parentTaskId?: string | null;
  onSuccess?: (task: EntityTask) => void;
  onCancel?: () => void;
}

export function TaskForm({
  entityType,
  entityId,
  task,
  parentTaskId,
  onSuccess,
  onCancel,
}: TaskFormProps) {
  const utils = trpc.useUtils();
  const isEditing = !!task;

  // Fetch employees for assignee/reviewer selection
  const { data: employeesData, isLoading: isLoadingEmployees } = trpc.employees.list.useQuery({});

  // Fetch custom fields for this entity type
  const { data: fieldsData, isLoading: isLoadingFields } = trpc.taskFields.getForEntity.useQuery({
    entityType,
  });

  const employees = employeesData?.data ?? [];
  const customFields = fieldsData?.all ?? [];

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      priority: (task?.priority as TaskFormValues['priority']) ?? 'medium',
      status: task?.status as TaskFormValues['status'],
      assigneeId: task?.assigneeId ?? null,
      reviewerId: task?.reviewerId ?? null,
      estimatedStartDate: task?.estimatedStartDate ?? null,
      estimatedEndDate: task?.estimatedEndDate ?? null,
      estimatedHours: task?.estimatedHours ?? null,
      estimatedBudget: task?.estimatedBudget ?? null,
      isBillable: task?.isBillable ?? false,
      billingRate: task?.billingRate ?? null,
      customFieldValues: (task?.customFieldValues as Record<string, unknown>) ?? {},
    },
  });

  const watchIsBillable = form.watch('isBillable');

  // Create mutation
  const createMutation = trpc.entityTasks.create.useMutation({
    onSuccess: (data) => {
      utils.entityTasks.list.invalidate();
      utils.entityTasks.getByEntity.invalidate({ entityType, entityId });
      onSuccess?.(data as EntityTask);
    },
  });

  // Update mutation
  const updateMutation = trpc.entityTasks.update.useMutation({
    onSuccess: (data) => {
      utils.entityTasks.list.invalidate();
      utils.entityTasks.get.invalidate({ id: task!.id });
      utils.entityTasks.getByEntity.invalidate({ entityType, entityId });
      onSuccess?.(data as EntityTask);
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: TaskFormValues) => {
    if (isEditing && task) {
      updateMutation.mutate({
        id: task.id,
        data: {
          title: values.title,
          description: values.description ?? null,
          priority: values.priority,
          status: values.status,
          assigneeId: values.assigneeId,
          reviewerId: values.reviewerId,
          estimatedStartDate: values.estimatedStartDate,
          estimatedEndDate: values.estimatedEndDate,
          estimatedHours: values.estimatedHours,
          estimatedBudget: values.estimatedBudget,
          isBillable: values.isBillable,
          billingRate: values.billingRate,
          customFieldValues: values.customFieldValues,
        },
      });
    } else {
      createMutation.mutate({
        entityType,
        entityId,
        title: values.title,
        description: values.description,
        priority: values.priority,
        assigneeId: values.assigneeId,
        reviewerId: values.reviewerId,
        parentTaskId: parentTaskId ?? null,
        estimatedStartDate: values.estimatedStartDate,
        estimatedEndDate: values.estimatedEndDate,
        estimatedHours: values.estimatedHours,
        estimatedBudget: values.estimatedBudget,
        isBillable: values.isBillable,
        billingRate: values.billingRate,
        customFieldValues: values.customFieldValues ?? {},
      });
    }
  };

  // Render a custom field based on its type
  const renderCustomField = (field: TaskFieldDefinition) => {
    const fieldKey = `customFieldValues.${field.fieldKey}`;

    switch (field.fieldType) {
      case 'text':
        return (
          <FormField
            key={field.id}
            control={form.control}
            name={fieldKey as keyof TaskFormValues}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {field.fieldLabel}
                  {field.isRequired && <span className="text-destructive ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={field.placeholder ?? undefined}
                    {...formField}
                    value={(formField.value as string) ?? ''}
                  />
                </FormControl>
                {field.helpText && <FormDescription>{field.helpText}</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'textarea':
        return (
          <FormField
            key={field.id}
            control={form.control}
            name={fieldKey as keyof TaskFormValues}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {field.fieldLabel}
                  {field.isRequired && <span className="text-destructive ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={field.placeholder ?? undefined}
                    {...formField}
                    value={(formField.value as string) ?? ''}
                  />
                </FormControl>
                {field.helpText && <FormDescription>{field.helpText}</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'number':
      case 'currency':
        return (
          <FormField
            key={field.id}
            control={form.control}
            name={fieldKey as keyof TaskFormValues}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {field.fieldLabel}
                  {field.isRequired && <span className="text-destructive ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step={field.fieldType === 'currency' ? '0.01' : '1'}
                    placeholder={field.placeholder ?? undefined}
                    {...formField}
                    value={(formField.value as string) ?? ''}
                    onChange={(e) => formField.onChange(e.target.value || null)}
                  />
                </FormControl>
                {field.helpText && <FormDescription>{field.helpText}</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'date':
      case 'datetime':
        return (
          <FormField
            key={field.id}
            control={form.control}
            name={fieldKey as keyof TaskFormValues}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {field.fieldLabel}
                  {field.isRequired && <span className="text-destructive ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    type={field.fieldType === 'datetime' ? 'datetime-local' : 'date'}
                    {...formField}
                    value={(formField.value as string) ?? ''}
                  />
                </FormControl>
                {field.helpText && <FormDescription>{field.helpText}</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'boolean':
        return (
          <FormField
            key={field.id}
            control={form.control}
            name={fieldKey as keyof TaskFormValues}
            render={({ field: formField }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">{field.fieldLabel}</FormLabel>
                  {field.helpText && <FormDescription>{field.helpText}</FormDescription>}
                </div>
                <FormControl>
                  <Switch
                    checked={!!formField.value}
                    onCheckedChange={formField.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        );

      case 'select':
        {
          const options = (field.fieldOptions as { options?: Array<{ value: string; label: string }> })?.options ?? [];
          return (
            <FormField
              key={field.id}
              control={form.control}
              name={fieldKey as keyof TaskFormValues}
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>
                    {field.fieldLabel}
                    {field.isRequired && <span className="text-destructive ml-1">*</span>}
                  </FormLabel>
                  <Select
                    onValueChange={formField.onChange}
                    value={(formField.value as string) ?? undefined}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={field.placeholder ?? 'Select...'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {field.helpText && <FormDescription>{field.helpText}</FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        }

      default:
        return null;
    }
  };

  if (isLoadingEmployees || isLoadingFields) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Basic Information</CardTitle>
            <CardDescription>Task title and description</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Task title" {...field} />
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
                      placeholder="Task description..."
                      className="min-h-[100px]"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isEditing && (
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="not_started">Not Started</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="pending_review">Pending Review</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Assignment */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Assignment</CardTitle>
            <CardDescription>Assign task to team members</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assignee</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val === '_none' ? null : val)}
                      value={field.value ?? '_none'}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select assignee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_none">Unassigned</SelectItem>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reviewerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reviewer</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val === '_none' ? null : val)}
                      value={field.value ?? '_none'}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select reviewer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_none">No Reviewer</SelectItem>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Schedule</CardTitle>
            <CardDescription>Dates and time estimates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="estimatedStartDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estimatedEndDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="estimatedHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Hours</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        placeholder="0"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estimatedBudget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Budget</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Billing */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Billing</CardTitle>
            <CardDescription>Billable settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="isBillable"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Billable</FormLabel>
                    <FormDescription>This task is billable to the client</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {watchIsBillable && (
              <FormField
                control={form.control}
                name="billingRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Rate</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Hourly rate"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormDescription>Override default billing rate</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        {/* Custom Fields */}
        {customFields.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Additional Fields</CardTitle>
              <CardDescription>Custom fields for this task type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {customFields.map((field) => renderCustomField(field))}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditing ? 'Update Task' : 'Create Task'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
