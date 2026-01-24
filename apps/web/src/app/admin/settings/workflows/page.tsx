'use client';

import { useState, useCallback } from 'react';
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
// Separator available for future use: import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Settings2,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Copy,
  LayoutTemplate,
  List,
  X,
  Check,
  Layers,
  Package,
  Clock,
  HardHat,
  FileText,
  Folder,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useForm } from 'react-hook-form';
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
  DragOverEvent,
  UniqueIdentifier,
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

type Workflow = RouterOutputs['workflows']['list'][number];
type WorkflowGroup = NonNullable<Workflow['groups']>[number];
type WorkflowComponent = NonNullable<Workflow['components']>[number];

// =============================================================================
// Available Components Configuration
// =============================================================================

type ComponentCategory = 'lists' | 'transactions' | 'time_tracking' | 'construction';

interface AvailableComponent {
  key: string;
  displayName: string;
  route: string;
  icon?: string;
  category: ComponentCategory;
}

const AVAILABLE_COMPONENTS: AvailableComponent[] = [
  // Lists
  { key: 'customers', displayName: 'Customers', route: '/relationships/customers', category: 'lists' },
  { key: 'vendors', displayName: 'Vendors', route: '/relationships/vendors', category: 'lists' },
  { key: 'employees', displayName: 'Employees', route: '/relationships/employees', category: 'lists' },
  { key: 'leads', displayName: 'Leads', route: '/relationships/leads', category: 'lists' },
  { key: 'prospects', displayName: 'Prospects', route: '/relationships/prospects', category: 'lists' },
  { key: 'contacts', displayName: 'Contacts', route: '/relationships/contacts', category: 'lists' },
  { key: 'items', displayName: 'Items', route: '/lists/items', category: 'lists' },
  { key: 'categories', displayName: 'Categories', route: '/lists/item-categories', category: 'lists' },
  { key: 'units_of_measure', displayName: 'Units of Measure', route: '/lists/units-of-measure', category: 'lists' },
  { key: 'warehouses', displayName: 'Warehouses', route: '/lists/warehouses', category: 'lists' },
  { key: 'price_lists', displayName: 'Price Lists', route: '/lists/price-lists', category: 'lists' },
  { key: 'accounts', displayName: 'Accounts', route: '/lists/accounts', category: 'lists' },
  { key: 'classes', displayName: 'Classes', route: '/lists/classes', category: 'lists' },
  { key: 'departments', displayName: 'Departments', route: '/lists/departments', category: 'lists' },
  { key: 'locations', displayName: 'Locations', route: '/lists/locations', category: 'lists' },
  { key: 'subsidiaries', displayName: 'Subsidiaries', route: '/lists/subsidiaries', category: 'lists' },
  { key: 'payment_terms', displayName: 'Payment Terms', route: '/lists/payment-terms', category: 'lists' },
  { key: 'payment_methods', displayName: 'Payment Methods', route: '/lists/payment-methods', category: 'lists' },
  { key: 'charge_types', displayName: 'Charge Types', route: '/lists/charge-types', category: 'lists' },

  // Transactions
  { key: 'estimates', displayName: 'Estimates', route: '/transactions/estimates', category: 'transactions' },
  { key: 'sales_orders', displayName: 'Sales Orders', route: '/transactions/sales-orders', category: 'transactions' },
  { key: 'opportunities', displayName: 'Opportunities', route: '/transactions/opportunities', category: 'transactions' },
  { key: 'fulfillment', displayName: 'Fulfillment', route: '/transactions/fulfillment', category: 'transactions' },
  { key: 'invoices', displayName: 'Invoices', route: '/transactions/invoices', category: 'transactions' },
  { key: 'journal', displayName: 'Journal', route: '/transactions/journal', category: 'transactions' },
  { key: 'budgets', displayName: 'Budgets', route: '/transactions/budgets', category: 'transactions' },
  { key: 'adjustments', displayName: 'Adjustments', route: '/transactions/adjustments', category: 'transactions' },
  { key: 'transfers', displayName: 'Transfers', route: '/transactions/transfers', category: 'transactions' },
  { key: 'receipts', displayName: 'Receipts', route: '/transactions/receipts', category: 'transactions' },
  { key: 'purchase_orders', displayName: 'Purchase Orders', route: '/transactions/purchase-orders', category: 'transactions' },
  { key: 'contracts', displayName: 'Contracts', route: '/transactions/contracts', category: 'transactions' },
  { key: 'performance_obligations', displayName: 'Performance Obligations', route: '/transactions/performance-obligations', category: 'transactions' },
  { key: 'revenue_recognition', displayName: 'Revenue Recognition', route: '/transactions/revenue-recognition', category: 'transactions' },

  // Time Tracking
  { key: 'projects', displayName: 'Projects', route: '/projects', category: 'time_tracking' },
  { key: 'time_entries', displayName: 'Time Entries', route: '/projects/time-entries', category: 'time_tracking' },

  // Construction
  { key: 'schedule_of_values', displayName: 'Schedule of Values', route: '/construction/schedule-of-values', category: 'construction' },
  { key: 'pay_applications', displayName: 'Pay Applications', route: '/construction/pay-applications', category: 'construction' },
];

const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  lists: 'Lists',
  transactions: 'Transactions',
  time_tracking: 'Time Tracking',
  construction: 'Construction',
};

const CATEGORY_ICONS: Record<ComponentCategory, React.ReactNode> = {
  lists: <List className="h-4 w-4" />,
  transactions: <FileText className="h-4 w-4" />,
  time_tracking: <Clock className="h-4 w-4" />,
  construction: <HardHat className="h-4 w-4" />,
};

// =============================================================================
// Form Schemas
// =============================================================================

const workflowFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  isTemplate: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

type WorkflowFormValues = z.infer<typeof workflowFormSchema>;

const groupFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
});

type GroupFormValues = z.infer<typeof groupFormSchema>;

const duplicateTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
});

type DuplicateTemplateValues = z.infer<typeof duplicateTemplateSchema>;

// =============================================================================
// Main Page Component
// =============================================================================

export default function WorkflowsPage() {
  const { orgId } = useAuth();
  const [activeTab, setActiveTab] = useState<'workflows' | 'templates'>('workflows');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [deleteWorkflowId, setDeleteWorkflowId] = useState<string | null>(null);

  // tRPC queries
  const { data: workflows = [], isLoading, refetch } = trpc.workflows.list.useQuery(
    { includeInactive: true, templatesOnly: false },
    { enabled: !!orgId }
  );

  const { data: templates = [] } = trpc.workflows.list.useQuery(
    { includeInactive: true, templatesOnly: true },
    { enabled: !!orgId }
  );

  // Filter workflows and templates
  const regularWorkflows = workflows.filter(w => !w.isTemplate);

  // Get selected workflow
  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId);

  // tRPC mutations
  const createMutation = trpc.workflows.create.useMutation({
    onSuccess: () => {
      toast.success('Workflow created successfully');
      setIsCreateDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create workflow');
    },
  });

  const updateMutation = trpc.workflows.update.useMutation({
    onSuccess: () => {
      toast.success('Workflow updated successfully');
      setIsEditDialogOpen(false);
      setEditingWorkflow(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update workflow');
    },
  });

  const deleteMutation = trpc.workflows.delete.useMutation({
    onSuccess: () => {
      toast.success('Workflow deleted successfully');
      setDeleteWorkflowId(null);
      if (selectedWorkflowId === deleteWorkflowId) {
        setSelectedWorkflowId(null);
      }
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete workflow');
    },
  });

  // Forms
  const createForm = useForm<WorkflowFormValues>({
    resolver: zodResolver(workflowFormSchema),
    defaultValues: {
      name: '',
      description: '',
      isTemplate: false,
      isActive: true,
    },
  });

  const editForm = useForm<WorkflowFormValues>({
    resolver: zodResolver(workflowFormSchema),
    defaultValues: {
      name: '',
      description: '',
      isTemplate: false,
      isActive: true,
    },
  });

  // Handlers
  const handleCreateWorkflow = (values: WorkflowFormValues) => {
    createMutation.mutate(values);
  };

  const handleEditWorkflow = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    editForm.reset({
      name: workflow.name,
      description: workflow.description || '',
      isTemplate: workflow.isTemplate,
      isActive: workflow.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateWorkflow = (values: WorkflowFormValues) => {
    if (!editingWorkflow) return;
    updateMutation.mutate({
      id: editingWorkflow.id,
      data: values,
    });
  };

  const handleDeleteWorkflow = () => {
    if (!deleteWorkflowId) return;
    deleteMutation.mutate({ id: deleteWorkflowId });
  };

  const handleSelectWorkflow = (workflowId: string) => {
    setSelectedWorkflowId(workflowId);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading workflows...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings2 className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Workflow Builder</h1>
        </div>
        <p className="text-muted-foreground">
          Create and manage workflows to customize navigation and feature access for your organization.
        </p>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Workflow List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Workflows</CardTitle>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      New
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Workflow</DialogTitle>
                      <DialogDescription>
                        Create a new workflow to organize navigation components.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...createForm}>
                      <form onSubmit={createForm.handleSubmit(handleCreateWorkflow)} className="space-y-4">
                        <FormField
                          control={createForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input placeholder="My Workflow" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Optional description..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createForm.control}
                          name="isTemplate"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-3">
                              <div className="space-y-0.5">
                                <FormLabel>Save as Template</FormLabel>
                                <FormDescription className="text-xs">
                                  Templates can be duplicated to create new workflows.
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createForm.control}
                          name="isActive"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-3">
                              <div className="space-y-0.5">
                                <FormLabel>Active</FormLabel>
                                <FormDescription className="text-xs">
                                  Active workflows are available for use.
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'Creating...' : 'Create'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'workflows' | 'templates')}>
                <TabsList className="w-full">
                  <TabsTrigger value="workflows" className="flex-1">
                    Workflows ({regularWorkflows.length})
                  </TabsTrigger>
                  <TabsTrigger value="templates" className="flex-1">
                    Templates ({templates.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="workflows" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    {regularWorkflows.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No workflows yet.</p>
                        <p className="text-xs">Create one to get started.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {regularWorkflows.map((workflow) => (
                          <WorkflowListItem
                            key={workflow.id}
                            workflow={workflow}
                            isSelected={selectedWorkflowId === workflow.id}
                            onSelect={() => handleSelectWorkflow(workflow.id)}
                            onEdit={() => handleEditWorkflow(workflow)}
                            onDelete={() => setDeleteWorkflowId(workflow.id)}
                          />
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="templates" className="mt-4">
                  <TemplateGallery
                    templates={templates}
                    onDuplicate={() => refetch()}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Workflow Editor */}
        <div className="lg:col-span-2">
          {selectedWorkflow ? (
            <WorkflowEditor
              workflow={selectedWorkflow}
              onUpdate={() => refetch()}
            />
          ) : (
            <Card className="h-full min-h-[500px]">
              <CardContent className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Select a workflow to edit</p>
                  <p className="text-sm">or create a new one to get started</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Workflow Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Workflow</DialogTitle>
            <DialogDescription>
              Update workflow details.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdateWorkflow)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
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
              <FormField
                control={editForm.control}
                name="isTemplate"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Template</FormLabel>
                      <FormDescription className="text-xs">
                        Mark as template for duplication.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription className="text-xs">
                        Active workflows are available for use.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteWorkflowId} onOpenChange={() => setDeleteWorkflowId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this workflow? This action cannot be undone.
              All groups and components within this workflow will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorkflow}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// Workflow List Item Component
// =============================================================================

interface WorkflowListItemProps {
  workflow: Workflow;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function WorkflowListItem({ workflow, isSelected, onSelect, onEdit, onDelete }: WorkflowListItemProps) {
  return (
    <div
      className={`group flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
        isSelected ? 'border-primary bg-accent' : 'border-transparent hover:bg-accent/50'
      }`}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{workflow.name}</span>
          {!workflow.isActive && (
            <Badge variant="secondary" className="text-xs">Inactive</Badge>
          )}
        </div>
        {workflow.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {workflow.description}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {workflow.groups?.length || 0} groups, {workflow.components?.length || 0} components
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Template Gallery Component
// =============================================================================

interface TemplateGalleryProps {
  templates: Workflow[];
  onDuplicate: () => void;
}

function TemplateGallery({ templates, onDuplicate }: TemplateGalleryProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Workflow | null>(null);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);

  const duplicateMutation = trpc.workflows.duplicateFromTemplate.useMutation({
    onSuccess: () => {
      toast.success('Workflow created from template');
      setIsDuplicateOpen(false);
      setSelectedTemplate(null);
      onDuplicate();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to duplicate template');
    },
  });

  const form = useForm<DuplicateTemplateValues>({
    resolver: zodResolver(duplicateTemplateSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const handleDuplicate = (values: DuplicateTemplateValues) => {
    if (!selectedTemplate) return;
    duplicateMutation.mutate({
      templateId: selectedTemplate.id,
      ...values,
    });
  };

  const openDuplicateDialog = (template: Workflow) => {
    setSelectedTemplate(template);
    form.reset({
      name: `${template.name} (Copy)`,
      description: template.description || '',
    });
    setIsDuplicateOpen(true);
  };

  if (templates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <LayoutTemplate className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No templates available.</p>
        <p className="text-xs">Create a workflow and mark it as a template.</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium truncate">{template.name}</span>
                </div>
                {template.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5 ml-6">
                    {template.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  {template.groups?.length || 0} groups, {template.components?.length || 0} components
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openDuplicateDialog(template)}
              >
                <Copy className="h-4 w-4 mr-1" />
                Use
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={isDuplicateOpen} onOpenChange={setIsDuplicateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create from Template</DialogTitle>
            <DialogDescription>
              Create a new workflow based on &quot;{selectedTemplate?.name}&quot;.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleDuplicate)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workflow Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDuplicateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={duplicateMutation.isPending}>
                  {duplicateMutation.isPending ? 'Creating...' : 'Create Workflow'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// =============================================================================
// Workflow Editor Component
// =============================================================================

interface WorkflowEditorProps {
  workflow: Workflow;
  onUpdate: () => void;
}

function WorkflowEditor({ workflow, onUpdate }: WorkflowEditorProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<WorkflowGroup | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [isComponentPickerOpen, setIsComponentPickerOpen] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);
  const [deleteComponentId, setDeleteComponentId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [activeType, setActiveType] = useState<'group' | 'component' | null>(null);

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

  // Group mutations
  const addGroupMutation = trpc.workflows.addGroup.useMutation({
    onSuccess: () => {
      toast.success('Group added');
      setIsAddGroupOpen(false);
      groupForm.reset();
      onUpdate();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add group');
    },
  });

  const updateGroupMutation = trpc.workflows.updateGroup.useMutation({
    onSuccess: () => {
      toast.success('Group updated');
      setEditingGroup(null);
      editGroupForm.reset();
      onUpdate();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update group');
    },
  });

  const deleteGroupMutation = trpc.workflows.deleteGroup.useMutation({
    onSuccess: () => {
      toast.success('Group deleted');
      setDeleteGroupId(null);
      onUpdate();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete group');
    },
  });

  // Component mutations
  const addComponentMutation = trpc.workflows.addComponent.useMutation({
    onSuccess: () => {
      toast.success('Component added');
      onUpdate();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add component');
    },
  });

  const deleteComponentMutation = trpc.workflows.deleteComponent.useMutation({
    onSuccess: () => {
      toast.success('Component removed');
      setDeleteComponentId(null);
      onUpdate();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to remove component');
    },
  });

  // Reorder mutations
  const reorderComponentsMutation = trpc.workflows.reorderComponents.useMutation({
    onSuccess: () => {
      onUpdate();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reorder');
    },
  });

  const reorderGroupsMutation = trpc.workflows.updateGroup.useMutation({
    onError: (error) => {
      toast.error(error.message || 'Failed to reorder groups');
    },
  });

  // Forms
  const groupForm = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: { name: '' },
  });

  const editGroupForm = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: { name: '' },
  });

  // Handlers
  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleAddGroup = (values: GroupFormValues) => {
    const maxOrder = Math.max(0, ...(workflow.groups?.map(g => g.displayOrder) || []));
    addGroupMutation.mutate({
      workflowId: workflow.id,
      name: values.name,
      displayOrder: maxOrder + 1,
    });
  };

  const handleEditGroup = (group: WorkflowGroup) => {
    setEditingGroup(group);
    editGroupForm.reset({ name: group.name });
  };

  const handleUpdateGroup = (values: GroupFormValues) => {
    if (!editingGroup) return;
    updateGroupMutation.mutate({
      id: editingGroup.id,
      data: { name: values.name },
    });
  };

  const handleDeleteGroup = () => {
    if (!deleteGroupId) return;
    deleteGroupMutation.mutate({ id: deleteGroupId });
  };

  const handleAddComponent = (component: AvailableComponent) => {
    const groupComponents = workflow.components?.filter(c => c.groupId === targetGroupId) || [];
    const maxOrder = Math.max(0, ...groupComponents.map(c => c.displayOrder));

    addComponentMutation.mutate({
      workflowId: workflow.id,
      groupId: targetGroupId,
      componentType: component.category,
      componentKey: component.key,
      displayName: component.displayName,
      route: component.route,
      displayOrder: maxOrder + 1,
      isEnabled: true,
    });
  };

  const handleDeleteComponent = () => {
    if (!deleteComponentId) return;
    deleteComponentMutation.mutate({ id: deleteComponentId });
  };

  const openComponentPicker = (groupId: string | null) => {
    setTargetGroupId(groupId);
    setIsComponentPickerOpen(true);
  };

  // Get components not yet added to this workflow
  const usedComponentKeys = new Set(workflow.components?.map(c => c.componentKey) || []);

  // Get ungrouped components
  const ungroupedComponents = workflow.components?.filter(c => !c.groupId) || [];

  // Sort groups by displayOrder
  const sortedGroups = [...(workflow.groups || [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const groupIds = sortedGroups.map(g => g.id);

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id);
    // Determine if dragging a group or component
    const isGroup = sortedGroups.some(g => g.id === active.id);
    setActiveType(isGroup ? 'group' : 'component');
  }, [sortedGroups]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveType(null);

    if (!over || active.id === over.id) return;

    // Handle group reordering
    if (activeType === 'group') {
      const oldIndex = sortedGroups.findIndex(g => g.id === active.id);
      const newIndex = sortedGroups.findIndex(g => g.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedGroups = arrayMove(sortedGroups, oldIndex, newIndex);
        // Update each group's displayOrder
        reorderedGroups.forEach((group, index) => {
          if (group.displayOrder !== index) {
            reorderGroupsMutation.mutate({
              id: group.id,
              data: { displayOrder: index },
            });
          }
        });
        onUpdate();
      }
    } else {
      // Handle component reordering
      const activeComponent = workflow.components?.find(c => c.id === active.id);
      const overComponent = workflow.components?.find(c => c.id === over.id);

      if (activeComponent && overComponent) {
        // Get components in the same group as the target
        const targetGroupId = overComponent.groupId;
        const componentsInGroup = (workflow.components || [])
          .filter(c => c.groupId === targetGroupId)
          .sort((a, b) => a.displayOrder - b.displayOrder);

        const oldIndex = componentsInGroup.findIndex(c => c.id === active.id);
        const newIndex = componentsInGroup.findIndex(c => c.id === over.id);

        // If moving within the same group
        if (activeComponent.groupId === targetGroupId && oldIndex !== -1 && newIndex !== -1) {
          const reorderedComponents = arrayMove(componentsInGroup, oldIndex, newIndex);
          const updates = reorderedComponents.map((comp, index) => ({
            id: comp.id,
            displayOrder: index,
            groupId: targetGroupId,
          }));
          reorderComponentsMutation.mutate({
            workflowId: workflow.id,
            components: updates,
          });
        } else {
          // Moving to a different group
          const allComponents = workflow.components || [];
          const updatedComponents = allComponents.map(c => {
            if (c.id === activeComponent.id) {
              return { id: c.id, displayOrder: newIndex >= 0 ? newIndex : 0, groupId: targetGroupId };
            }
            return { id: c.id, displayOrder: c.displayOrder, groupId: c.groupId };
          });
          reorderComponentsMutation.mutate({
            workflowId: workflow.id,
            components: updatedComponents,
          });
        }
      }
    }
  }, [activeType, sortedGroups, workflow, reorderGroupsMutation, reorderComponentsMutation, onUpdate]);

  // Get active item for drag overlay
  const activeGroup = activeType === 'group' ? sortedGroups.find(g => g.id === activeId) : null;
  const activeComponent = activeType === 'component' ? workflow.components?.find(c => c.id === activeId) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {workflow.name}
              {workflow.isTemplate && <Badge variant="secondary">Template</Badge>}
              {!workflow.isActive && <Badge variant="outline">Inactive</Badge>}
            </CardTitle>
            {workflow.description && (
              <CardDescription className="mt-1">{workflow.description}</CardDescription>
            )}
          </div>
          <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
            <DialogTrigger asChild>
              <Button>
                <FolderPlus className="h-4 w-4 mr-2" />
                Add Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Group</DialogTitle>
                <DialogDescription>
                  Create a new group to organize components.
                </DialogDescription>
              </DialogHeader>
              <Form {...groupForm}>
                <form onSubmit={groupForm.handleSubmit(handleAddGroup)} className="space-y-4">
                  <FormField
                    control={groupForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Group Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Sales, Operations" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddGroupOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addGroupMutation.isPending}>
                      {addGroupMutation.isPending ? 'Adding...' : 'Add Group'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
          <div className="space-y-3">
            {/* Groups */}
            <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
            {sortedGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.id);
              const groupComponents = (workflow.components?.filter(c => c.groupId === group.id) || [])
                .sort((a, b) => a.displayOrder - b.displayOrder);
              const componentIds = groupComponents.map(c => c.id);

              return (
                <SortableGroup
                  key={group.id}
                  group={group}
                  isExpanded={isExpanded}
                  componentCount={groupComponents.length}
                  onToggleExpand={() => toggleGroupExpanded(group.id)}
                  onAddComponent={() => openComponentPicker(group.id)}
                  onEdit={() => handleEditGroup(group)}
                  onDelete={() => setDeleteGroupId(group.id)}
                >
                  {/* Group Components */}
                  {isExpanded && (
                    <div className="border-t px-3 py-2 bg-muted/30">
                      {groupComponents.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          No components in this group.
                          <Button
                            variant="link"
                            size="sm"
                            className="px-1"
                            onClick={() => openComponentPicker(group.id)}
                          >
                            Add one
                          </Button>
                        </div>
                      ) : (
                        <SortableContext items={componentIds} strategy={verticalListSortingStrategy}>
                          <div className="space-y-1">
                            {groupComponents.map((component) => (
                              <SortableComponentItem
                                key={component.id}
                                component={component}
                                onDelete={() => setDeleteComponentId(component.id)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      )}
                    </div>
                  )}
                </SortableGroup>
              );
            })}
            </SortableContext>

            {/* Ungrouped Components */}
            {ungroupedComponents.length > 0 && (
              <div className="border rounded-lg border-dashed">
                <div className="flex items-center justify-between p-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-muted-foreground">Ungrouped</span>
                    <Badge variant="outline">{ungroupedComponents.length}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openComponentPicker(null)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="px-3 py-2">
                  <SortableContext
                    items={ungroupedComponents.map(c => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1">
                      {ungroupedComponents
                        .sort((a, b) => a.displayOrder - b.displayOrder)
                        .map((component) => (
                          <SortableComponentItem
                            key={component.id}
                            component={component}
                            onDelete={() => setDeleteComponentId(component.id)}
                          />
                        ))}
                    </div>
                  </SortableContext>
                </div>
              </div>
            )}

            {/* Empty State */}
            {(!workflow.groups || workflow.groups.length === 0) && ungroupedComponents.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Layers className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No groups or components yet.</p>
                <p className="text-sm">Add a group to organize your workflow.</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => openComponentPicker(null)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Component
                </Button>
              </div>
            )}
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeGroup && (
              <div className="border rounded-lg bg-background shadow-lg p-3">
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{activeGroup.name}</span>
                </div>
              </div>
            )}
            {activeComponent && (
              <div className="flex items-center justify-between p-2 rounded bg-background border shadow-lg">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline" className="text-xs">
                    {CATEGORY_LABELS[activeComponent.componentType as ComponentCategory] || activeComponent.componentType}
                  </Badge>
                  <span className="text-sm">{activeComponent.displayName}</span>
                </div>
              </div>
            )}
          </DragOverlay>
          </DndContext>
        </ScrollArea>
      </CardContent>

      {/* Edit Group Dialog */}
      <Dialog open={!!editingGroup} onOpenChange={() => setEditingGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
          </DialogHeader>
          <Form {...editGroupForm}>
            <form onSubmit={editGroupForm.handleSubmit(handleUpdateGroup)} className="space-y-4">
              <FormField
                control={editGroupForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingGroup(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateGroupMutation.isPending}>
                  {updateGroupMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Group Dialog */}
      <AlertDialog open={!!deleteGroupId} onOpenChange={() => setDeleteGroupId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this group? Components in this group will become ungrouped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteGroupMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Component Dialog */}
      <AlertDialog open={!!deleteComponentId} onOpenChange={() => setDeleteComponentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Component</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this component from the workflow?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteComponent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteComponentMutation.isPending ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Component Picker Dialog */}
      <ComponentPickerDialog
        open={isComponentPickerOpen}
        onOpenChange={setIsComponentPickerOpen}
        usedKeys={usedComponentKeys}
        onSelect={handleAddComponent}
        isAdding={addComponentMutation.isPending}
      />
    </Card>
  );
}

// =============================================================================
// Sortable Group Component
// =============================================================================

interface SortableGroupProps {
  group: WorkflowGroup;
  isExpanded: boolean;
  componentCount: number;
  onToggleExpand: () => void;
  onAddComponent: () => void;
  onEdit: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

function SortableGroup({
  group,
  isExpanded,
  componentCount,
  onToggleExpand,
  onAddComponent,
  onEdit,
  onDelete,
  children,
}: SortableGroupProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg">
      {/* Group Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-2">
          <button
            className="cursor-grab active:cursor-grabbing touch-none"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Folder className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{group.name}</span>
          <Badge variant="outline" className="ml-2">
            {componentCount}
          </Badge>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onAddComponent}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onEdit}
          >
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

      {/* Group Content (children) */}
      {children}
    </div>
  );
}

// =============================================================================
// Sortable Component Item
// =============================================================================

interface SortableComponentItemProps {
  component: WorkflowComponent;
  onDelete: () => void;
}

function SortableComponentItem({ component, onDelete }: SortableComponentItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: component.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-2 rounded bg-background border group"
    >
      <div className="flex items-center gap-2">
        <button
          className="cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100" />
        </button>
        <Badge variant="outline" className="text-xs">
          {CATEGORY_LABELS[component.componentType as ComponentCategory] || component.componentType}
        </Badge>
        <span className="text-sm">{component.displayName}</span>
        {!component.isEnabled && (
          <Badge variant="secondary" className="text-xs">Disabled</Badge>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Component Picker Dialog
// =============================================================================

interface ComponentPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usedKeys: Set<string>;
  onSelect: (component: AvailableComponent) => void;
  isAdding: boolean;
}

function ComponentPickerDialog({ open, onOpenChange, usedKeys, onSelect, isAdding }: ComponentPickerDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ComponentCategory | 'all'>('all');

  const filteredComponents = AVAILABLE_COMPONENTS.filter(component => {
    const matchesSearch = component.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      component.key.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || component.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedComponents = filteredComponents.reduce((acc, component) => {
    if (!acc[component.category]) {
      acc[component.category] = [];
    }
    acc[component.category].push(component);
    return acc;
  }, {} as Record<ComponentCategory, AvailableComponent[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add Component</DialogTitle>
          <DialogDescription>
            Select a component to add to your workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search and Filter */}
          <div className="flex gap-2">
            <Input
              placeholder="Search components..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* Category Tabs */}
          <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as ComponentCategory | 'all')}>
            <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
              <TabsTrigger value="lists" className="flex-1">
                <List className="h-4 w-4 mr-1" />
                Lists
              </TabsTrigger>
              <TabsTrigger value="transactions" className="flex-1">
                <FileText className="h-4 w-4 mr-1" />
                Transactions
              </TabsTrigger>
              <TabsTrigger value="time_tracking" className="flex-1">
                <Clock className="h-4 w-4 mr-1" />
                Time
              </TabsTrigger>
              <TabsTrigger value="construction" className="flex-1">
                <HardHat className="h-4 w-4 mr-1" />
                Construction
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Component List */}
          <ScrollArea className="h-[350px]">
            <div className="space-y-4">
              {Object.entries(groupedComponents).map(([category, components]) => (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1">
                    {CATEGORY_ICONS[category as ComponentCategory]}
                    <span className="font-medium text-sm">{CATEGORY_LABELS[category as ComponentCategory]}</span>
                    <Badge variant="outline" className="ml-auto">{components.length}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {components.map((component) => {
                      const isUsed = usedKeys.has(component.key);
                      return (
                        <Button
                          key={component.key}
                          variant={isUsed ? 'secondary' : 'outline'}
                          className="justify-start h-auto py-2 px-3"
                          disabled={isUsed || isAdding}
                          onClick={() => onSelect(component)}
                        >
                          <div className="flex items-center gap-2 w-full">
                            {isUsed ? (
                              <Check className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                            <span className="truncate">{component.displayName}</span>
                            {isUsed && (
                              <Badge variant="outline" className="ml-auto text-xs">Added</Badge>
                            )}
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {filteredComponents.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No components found.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
