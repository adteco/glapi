'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Settings2,
  GripVertical,
  X,
  Eye,
  Globe,
  Users,
  Briefcase,
  FolderKanban,
  UserCircle,
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  List,
  ListChecks,
  Link2,
  Mail,
  Phone,
  DollarSign,
  AlignLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { RouterOutputs } from '@glapi/trpc';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// =============================================================================
// Types
// =============================================================================

type TaskFieldDefinition = RouterOutputs['taskFields']['list'][number];

// Entity types for tabs
const ENTITY_TYPES = [
  { key: null, label: 'Global Fields', icon: Globe, description: 'Apply to all task types' },
  { key: 'customer', label: 'Customer Tasks', icon: Users, description: 'Customer-specific fields' },
  { key: 'project', label: 'Project Tasks', icon: FolderKanban, description: 'Project-specific fields' },
  { key: 'employee', label: 'Employee Tasks', icon: UserCircle, description: 'Employee-specific fields' },
  { key: 'vendor', label: 'Vendor Tasks', icon: Briefcase, description: 'Vendor-specific fields' },
] as const;

// Field types with icons and descriptions
const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: Type, description: 'Single line text input' },
  { value: 'textarea', label: 'Text Area', icon: AlignLeft, description: 'Multi-line text input' },
  { value: 'number', label: 'Number', icon: Hash, description: 'Numeric value' },
  { value: 'currency', label: 'Currency', icon: DollarSign, description: 'Monetary value' },
  { value: 'date', label: 'Date', icon: Calendar, description: 'Date picker' },
  { value: 'datetime', label: 'Date & Time', icon: Clock, description: 'Date and time picker' },
  { value: 'boolean', label: 'Toggle', icon: ToggleLeft, description: 'On/off switch' },
  { value: 'select', label: 'Single Select', icon: List, description: 'Dropdown selection' },
  { value: 'multiselect', label: 'Multi Select', icon: ListChecks, description: 'Multiple selections' },
  { value: 'user', label: 'User', icon: UserCircle, description: 'User reference' },
  { value: 'url', label: 'URL', icon: Link2, description: 'Web address' },
  { value: 'email', label: 'Email', icon: Mail, description: 'Email address' },
  { value: 'phone', label: 'Phone', icon: Phone, description: 'Phone number' },
] as const;

type FieldType = typeof FIELD_TYPES[number]['value'];

// =============================================================================
// Form Schemas
// =============================================================================

const selectOptionSchema = z.object({
  value: z.string().min(1, 'Value is required'),
  label: z.string().min(1, 'Label is required'),
  color: z.string().optional(),
});

const fieldFormSchema = z.object({
  fieldKey: z
    .string()
    .min(1, 'Field key is required')
    .max(100)
    .regex(
      /^[a-z][a-z0-9_]*$/,
      'Must start with lowercase letter and contain only lowercase letters, numbers, and underscores'
    ),
  fieldLabel: z.string().min(1, 'Label is required').max(255),
  fieldType: z.enum([
    'text',
    'textarea',
    'number',
    'currency',
    'date',
    'datetime',
    'boolean',
    'select',
    'multiselect',
    'user',
    'url',
    'email',
    'phone',
  ]),
  entityType: z.string().nullable().optional(),
  isRequired: z.boolean().default(false),
  defaultValue: z.any().nullable().optional(),
  placeholder: z.string().max(255).nullable().optional(),
  helpText: z.string().nullable().optional(),
  // Field options based on type
  options: z.array(selectOptionSchema).optional(),
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
  precision: z.number().int().min(0).max(10).nullable().optional(),
  currencyCode: z.string().length(3).nullable().optional(),
  minLength: z.number().int().min(0).nullable().optional(),
  maxLength: z.number().int().min(1).nullable().optional(),
});

type FieldFormValues = z.infer<typeof fieldFormSchema>;

// =============================================================================
// Helper Functions
// =============================================================================

function generateFieldKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^[0-9]/, 'f$&')
    .substring(0, 100);
}

function getFieldTypeIcon(type: string): React.ElementType {
  const fieldType = FIELD_TYPES.find((ft) => ft.value === type);
  return fieldType?.icon || Type;
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function TaskFieldsPage() {
  const { orgId } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('global');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<TaskFieldDefinition | null>(null);
  const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);

  // Get the current entity type based on active tab
  const currentEntityType = activeTab === 'global' ? null : activeTab;

  // tRPC queries
  const {
    data: allFields = [],
    isLoading,
    refetch,
  } = trpc.taskFields.list.useQuery({ includeInactive: true }, { enabled: !!orgId });

  // Filter fields by entity type for current tab
  const filteredFields = useMemo(() => {
    if (activeTab === 'global') {
      return allFields.filter((f) => f.entityType === null);
    }
    return allFields.filter((f) => f.entityType === activeTab);
  }, [allFields, activeTab]);

  // Sort fields by display order
  const sortedFields = useMemo(() => {
    return [...filteredFields].sort((a, b) => a.displayOrder - b.displayOrder);
  }, [filteredFields]);

  // tRPC mutations
  const createMutation = trpc.taskFields.create.useMutation({
    onSuccess: () => {
      toast.success('Field created successfully');
      setIsDialogOpen(false);
      setEditingField(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create field');
    },
  });

  const updateMutation = trpc.taskFields.update.useMutation({
    onSuccess: () => {
      toast.success('Field updated successfully');
      setIsDialogOpen(false);
      setEditingField(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update field');
    },
  });

  const deleteMutation = trpc.taskFields.delete.useMutation({
    onSuccess: () => {
      toast.success('Field deactivated successfully');
      setDeleteFieldId(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to deactivate field');
    },
  });

  const reorderMutation = trpc.taskFields.reorder.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reorder fields');
    },
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handlers
  const handleAddField = () => {
    setEditingField(null);
    setIsDialogOpen(true);
  };

  const handleEditField = (field: TaskFieldDefinition) => {
    setEditingField(field);
    setIsDialogOpen(true);
  };

  const handleDeleteField = () => {
    if (!deleteFieldId) return;
    deleteMutation.mutate({ id: deleteFieldId });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDragActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragActiveId(null);
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = sortedFields.findIndex((f) => f.id === active.id);
    const newIndex = sortedFields.findIndex((f) => f.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedFields = arrayMove(sortedFields, oldIndex, newIndex);
      const updates = reorderedFields.map((field, index) => ({
        id: field.id,
        displayOrder: index,
      }));
      reorderMutation.mutate({ fields: updates });
    }
  };

  const activeField = dragActiveId
    ? sortedFields.find((f) => f.id === dragActiveId)
    : null;

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading task fields...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings2 className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold">Task Field Configuration</h1>
              <p className="text-muted-foreground">
                Define custom fields for tasks across different entity types
              </p>
            </div>
          </div>
          <Button onClick={handleAddField}>
            <Plus className="h-4 w-4 mr-2" />
            Add Field
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* Tab Navigation */}
            <div className="border-b">
              <TabsList className="w-full justify-start h-auto p-0 bg-transparent rounded-none">
                {ENTITY_TYPES.map((entityType) => {
                  const Icon = entityType.icon;
                  const tabKey = entityType.key === null ? 'global' : entityType.key;
                  const fieldCount = allFields.filter(
                    (f) => f.entityType === entityType.key
                  ).length;

                  return (
                    <TabsTrigger
                      key={tabKey}
                      value={tabKey}
                      className="flex items-center gap-2 px-6 py-4 border-b-2 border-transparent data-[state=active]:border-primary rounded-none data-[state=active]:bg-transparent"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{entityType.label}</span>
                      {fieldCount > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                          {fieldCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {/* Tab Content */}
            {ENTITY_TYPES.map((entityType) => {
              const tabKey = entityType.key === null ? 'global' : entityType.key;

              return (
                <TabsContent key={tabKey} value={tabKey} className="m-0">
                  <div className="p-6">
                    {/* Tab Description */}
                    <div className="mb-6">
                      <p className="text-sm text-muted-foreground">
                        {entityType.description}
                        {entityType.key === null && (
                          <span className="ml-1">
                            Global fields are available on all task types.
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Fields List */}
                    {sortedFields.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p className="font-medium">No fields defined yet</p>
                        <p className="text-sm mt-1 mb-4">
                          Add custom fields to capture additional task information
                        </p>
                        <Button variant="outline" onClick={handleAddField}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add First Field
                        </Button>
                      </div>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={sortedFields.map((f) => f.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {sortedFields.map((field) => (
                              <SortableFieldItem
                                key={field.id}
                                field={field}
                                onEdit={() => handleEditField(field)}
                                onDelete={() => setDeleteFieldId(field.id)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                        <DragOverlay>
                          {activeField && (
                            <div className="bg-background border rounded-lg p-4 shadow-lg opacity-90">
                              <FieldItemContent field={activeField} />
                            </div>
                          )}
                        </DragOverlay>
                      </DndContext>
                    )}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* Add/Edit Field Dialog */}
      <FieldFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingField={editingField}
        currentEntityType={currentEntityType}
        onSubmit={(data) => {
          if (editingField) {
            updateMutation.mutate({
              id: editingField.id,
              data: {
                fieldLabel: data.fieldLabel,
                fieldOptions: buildFieldOptions(data),
                isRequired: data.isRequired,
                defaultValue: data.defaultValue,
                placeholder: data.placeholder,
                helpText: data.helpText,
              },
            });
          } else {
            createMutation.mutate({
              fieldKey: data.fieldKey,
              fieldLabel: data.fieldLabel,
              fieldType: data.fieldType,
              fieldOptions: buildFieldOptions(data),
              entityType: data.entityType,
              isRequired: data.isRequired,
              defaultValue: data.defaultValue,
              placeholder: data.placeholder,
              helpText: data.helpText,
              displayOrder: filteredFields.length,
            });
          }
        }}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteFieldId} onOpenChange={() => setDeleteFieldId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Field</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the field, hiding it from task forms. Existing data
              will be preserved. You can reactivate the field later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteField}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deactivating...' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// Field Form Dialog
// =============================================================================

interface FieldFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingField: TaskFieldDefinition | null;
  currentEntityType: string | null;
  onSubmit: (data: FieldFormValues) => void;
  isSubmitting: boolean;
}

function FieldFormDialog({
  open,
  onOpenChange,
  editingField,
  currentEntityType,
  onSubmit,
  isSubmitting,
}: FieldFormDialogProps) {
  const isEditing = !!editingField;

  const form = useForm<FieldFormValues>({
    resolver: zodResolver(fieldFormSchema),
    defaultValues: {
      fieldKey: '',
      fieldLabel: '',
      fieldType: 'text',
      entityType: currentEntityType,
      isRequired: false,
      defaultValue: null,
      placeholder: '',
      helpText: '',
      options: [],
      min: null,
      max: null,
      precision: null,
      currencyCode: null,
      minLength: null,
      maxLength: null,
    },
  });

  const { fields: optionFields, append, remove } = useFieldArray({
    control: form.control,
    name: 'options',
  });

  const watchFieldType = form.watch('fieldType');
  const watchFieldLabel = form.watch('fieldLabel');

  // Reset form when dialog opens/closes or editing field changes
  useEffect(() => {
    if (open) {
      if (editingField) {
        const options = (editingField.fieldOptions as any)?.options || [];
        form.reset({
          fieldKey: editingField.fieldKey,
          fieldLabel: editingField.fieldLabel,
          fieldType: editingField.fieldType as FieldType,
          entityType: editingField.entityType,
          isRequired: editingField.isRequired,
          defaultValue: editingField.defaultValue,
          placeholder: editingField.placeholder,
          helpText: editingField.helpText,
          options: options,
          min: (editingField.fieldOptions as any)?.min ?? null,
          max: (editingField.fieldOptions as any)?.max ?? null,
          precision: (editingField.fieldOptions as any)?.precision ?? null,
          currencyCode: (editingField.fieldOptions as any)?.currencyCode ?? null,
          minLength: (editingField.fieldOptions as any)?.minLength ?? null,
          maxLength: (editingField.fieldOptions as any)?.maxLength ?? null,
        });
      } else {
        form.reset({
          fieldKey: '',
          fieldLabel: '',
          fieldType: 'text',
          entityType: currentEntityType,
          isRequired: false,
          defaultValue: null,
          placeholder: '',
          helpText: '',
          options: [],
          min: null,
          max: null,
          precision: null,
          currencyCode: null,
          minLength: null,
          maxLength: null,
        });
      }
    }
  }, [open, editingField, currentEntityType, form]);

  // Auto-generate field key from label (only when creating)
  useEffect(() => {
    if (!isEditing && watchFieldLabel) {
      const generatedKey = generateFieldKey(watchFieldLabel);
      form.setValue('fieldKey', generatedKey, { shouldValidate: true });
    }
  }, [watchFieldLabel, isEditing, form]);

  const handleSubmit = form.handleSubmit((data) => {
    onSubmit(data);
  });

  const needsOptions = watchFieldType === 'select' || watchFieldType === 'multiselect';
  const isNumberType = watchFieldType === 'number' || watchFieldType === 'currency';
  const isTextType = watchFieldType === 'text' || watchFieldType === 'textarea';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Field' : 'Add Field'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the field configuration. Field key and type cannot be changed.'
              : 'Define a new custom field for tasks.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6 pb-4">
                {/* Basic Info */}
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="fieldLabel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Field Label *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Priority Level" {...field} />
                        </FormControl>
                        <FormDescription>Display name shown to users</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fieldKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Field Key *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., priority_level"
                            {...field}
                            disabled={isEditing}
                          />
                        </FormControl>
                        <FormDescription>
                          {isEditing
                            ? 'Cannot be changed after creation'
                            : 'Unique identifier (auto-generated)'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Field Type */}
                <FormField
                  control={form.control}
                  name="fieldType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Field Type *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isEditing}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a field type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {FIELD_TYPES.map((ft) => {
                            const Icon = ft.icon;
                            return (
                              <SelectItem key={ft.value} value={ft.value}>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4 text-muted-foreground" />
                                  <span>{ft.label}</span>
                                  <span className="text-muted-foreground text-xs">
                                    - {ft.description}
                                  </span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {isEditing && (
                        <FormDescription>Cannot be changed after creation</FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Entity Type (only when creating) */}
                {!isEditing && (
                  <FormField
                    control={form.control}
                    name="entityType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entity Type</FormLabel>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(value === 'global' ? null : value)
                          }
                          value={field.value === null ? 'global' : field.value || 'global'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select entity type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ENTITY_TYPES.map((et) => {
                              const Icon = et.icon;
                              const value = et.key === null ? 'global' : et.key;
                              return (
                                <SelectItem key={value} value={value}>
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                    <span>{et.label}</span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose which task type this field applies to
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <Separator />

                {/* Select/Multiselect Options */}
                {needsOptions && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Options *</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => append({ value: '', label: '', color: '' })}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Option
                      </Button>
                    </div>
                    {optionFields.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground border-2 border-dashed rounded-lg text-sm">
                        No options defined. Add at least one option.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {optionFields.map((optField, index) => (
                          <div key={optField.id} className="flex items-center gap-2">
                            <FormField
                              control={form.control}
                              name={`options.${index}.label`}
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormControl>
                                    <Input placeholder="Label" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`options.${index}.value`}
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormControl>
                                    <Input placeholder="Value" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`options.${index}.color`}
                              render={({ field }) => (
                                <FormItem className="w-24">
                                  <FormControl>
                                    <Input
                                      type="color"
                                      className="h-9 p-1"
                                      {...field}
                                      value={field.value || '#6b7280'}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              className="text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Number/Currency Options */}
                {isNumberType && (
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="min"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minimum</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="No minimum"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? Number(e.target.value) : null
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="max"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="No maximum"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? Number(e.target.value) : null
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="precision"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Decimal Places</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="10"
                              placeholder="Auto"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? Number(e.target.value) : null
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {watchFieldType === 'currency' && (
                      <FormField
                        control={form.control}
                        name="currencyCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Currency Code</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="USD">USD - US Dollar</SelectItem>
                                <SelectItem value="EUR">EUR - Euro</SelectItem>
                                <SelectItem value="GBP">GBP - British Pound</SelectItem>
                                <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                                <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                )}

                {/* Text Options */}
                {isTextType && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="minLength"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minimum Length</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              placeholder="No minimum"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? Number(e.target.value) : null
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="maxLength"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum Length</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              placeholder="No maximum"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? Number(e.target.value) : null
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <Separator />

                {/* Required Toggle */}
                <FormField
                  control={form.control}
                  name="isRequired"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Required Field</FormLabel>
                        <FormDescription>
                          Users must fill in this field to save the task
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Placeholder and Help Text */}
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="placeholder"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Placeholder Text</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Enter value..."
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>Hint shown in empty field</FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="helpText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Help Text</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Additional instructions..."
                            rows={2}
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>Guidance shown below the field</FormDescription>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Field Preview */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Field Preview</span>
                  </div>
                  <FieldPreview
                    fieldType={watchFieldType}
                    fieldLabel={form.watch('fieldLabel') || 'Field Label'}
                    placeholder={form.watch('placeholder') || ''}
                    helpText={form.watch('helpText') || ''}
                    isRequired={form.watch('isRequired')}
                    options={form.watch('options') || []}
                  />
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? isEditing
                    ? 'Saving...'
                    : 'Creating...'
                  : isEditing
                  ? 'Save Changes'
                  : 'Create Field'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Field Preview Component
// =============================================================================

interface FieldPreviewProps {
  fieldType: FieldType;
  fieldLabel: string;
  placeholder: string;
  helpText: string;
  isRequired: boolean;
  options: Array<{ value: string; label: string; color?: string }>;
}

function FieldPreview({
  fieldType,
  fieldLabel,
  placeholder,
  helpText,
  isRequired,
  options,
}: FieldPreviewProps) {
  const renderInput = () => {
    switch (fieldType) {
      case 'text':
      case 'url':
      case 'email':
      case 'phone':
        return <Input placeholder={placeholder || 'Enter text...'} disabled />;
      case 'textarea':
        return <Textarea placeholder={placeholder || 'Enter text...'} rows={3} disabled />;
      case 'number':
      case 'currency':
        return (
          <Input
            type="number"
            placeholder={placeholder || '0'}
            disabled
            className={fieldType === 'currency' ? 'pl-8' : ''}
          />
        );
      case 'date':
      case 'datetime':
        return <Input type={fieldType === 'datetime' ? 'datetime-local' : 'date'} disabled />;
      case 'boolean':
        return <Switch disabled />;
      case 'select':
        return (
          <Select disabled>
            <SelectTrigger>
              <SelectValue
                placeholder={options.length > 0 ? options[0].label : 'Select...'}
              />
            </SelectTrigger>
          </Select>
        );
      case 'multiselect':
        return (
          <div className="flex flex-wrap gap-1 min-h-[36px] p-2 border rounded-md bg-muted/50">
            {options.slice(0, 2).map((opt, i) => (
              <Badge
                key={i}
                variant="secondary"
                style={{ backgroundColor: opt.color }}
              >
                {opt.label}
              </Badge>
            ))}
            {options.length > 2 && (
              <Badge variant="outline">+{options.length - 2} more</Badge>
            )}
          </div>
        );
      case 'user':
        return (
          <Select disabled>
            <SelectTrigger>
              <SelectValue placeholder="Select user..." />
            </SelectTrigger>
          </Select>
        );
      default:
        return <Input placeholder={placeholder} disabled />;
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">
        {fieldLabel}
        {isRequired && <span className="text-destructive">*</span>}
      </Label>
      {fieldType === 'currency' && (
        <div className="relative">
          <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          {renderInput()}
        </div>
      )}
      {fieldType !== 'currency' && renderInput()}
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

// =============================================================================
// Sortable Field Item Component
// =============================================================================

interface SortableFieldItemProps {
  field: TaskFieldDefinition;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableFieldItem({ field, onEdit, onDelete }: SortableFieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-background border rounded-lg p-4">
      <div className="flex items-start gap-3">
        <button
          className="cursor-grab active:cursor-grabbing touch-none mt-1"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <FieldItemContent field={field} />
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Field Item Content Component
// =============================================================================

function FieldItemContent({ field }: { field: TaskFieldDefinition }) {
  const Icon = getFieldTypeIcon(field.fieldType);
  const fieldTypeInfo = FIELD_TYPES.find((ft) => ft.value === field.fieldType);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{field.fieldLabel}</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {fieldTypeInfo?.label || field.fieldType}
        </Badge>
        {field.isRequired && (
          <Badge variant="secondary" className="text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Required
          </Badge>
        )}
        {!field.isActive && (
          <Badge variant="destructive" className="text-xs">
            <AlertCircle className="h-3 w-3 mr-1" />
            Inactive
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
          {field.fieldKey}
        </span>
        {field.placeholder && <span>Placeholder: {field.placeholder}</span>}
        {(field.fieldType === 'select' || field.fieldType === 'multiselect') && (
          <span>
            {((field.fieldOptions as any)?.options || []).length} options
          </span>
        )}
      </div>
      {field.helpText && (
        <p className="text-xs text-muted-foreground line-clamp-1">{field.helpText}</p>
      )}
    </div>
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

function buildFieldOptions(data: FieldFormValues): Record<string, unknown> {
  const options: Record<string, unknown> = {};

  if (data.fieldType === 'select' || data.fieldType === 'multiselect') {
    options.options = data.options?.filter((o) => o.value && o.label) || [];
  }

  if (data.fieldType === 'number' || data.fieldType === 'currency') {
    if (data.min !== null) options.min = data.min;
    if (data.max !== null) options.max = data.max;
    if (data.precision !== null) options.precision = data.precision;
    if (data.currencyCode) options.currencyCode = data.currencyCode;
  }

  if (data.fieldType === 'text' || data.fieldType === 'textarea') {
    if (data.minLength !== null) options.minLength = data.minLength;
    if (data.maxLength !== null) options.maxLength = data.maxLength;
  }

  return options;
}
