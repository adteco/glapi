'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import type { RouterOutputs } from '@glapi/trpc';
import { Eye, Pencil, Trash2, Plus, Clock, Check, X, FileText } from 'lucide-react';
import { toast } from 'sonner';

// Use TRPC inferred types to prevent type drift
type Project = RouterOutputs['projects']['list']['data'][number];
type ProjectStatus = Project['status'];

// Input status type for mutations (must match TRPC input schema)
type ProjectStatusInput = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'archived';
type ProjectBillingModel = 'fixed_fee' | 'time_and_materials';

interface FormData {
  projectCode: string;
  name: string;
  status: ProjectStatusInput;
  startDate: string;
  endDate: string;
  jobNumber: string;
  projectType: string;
  billingModel: ProjectBillingModel;
  description: string;
}

interface ProjectFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

interface EditingCell {
  projectId: string;
  field: string;
  value: string;
}

const statusOptions: { value: ProjectStatusInput; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' },
];

const billingModelOptions: { value: ProjectBillingModel; label: string }[] = [
  { value: 'time_and_materials', label: 'Time & Materials' },
  { value: 'fixed_fee', label: 'Fixed Fee' },
];

const ProjectForm: React.FC<ProjectFormProps> = ({ formData, setFormData }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="projectCode">Project Code*</Label>
        <Input
          id="projectCode"
          value={formData.projectCode}
          onChange={(e) => setFormData(prev => ({ ...prev, projectCode: e.target.value }))}
          placeholder="e.g., PRJ-001"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Project Name*</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={formData.status}
          onValueChange={(value: ProjectStatusInput) => setFormData(prev => ({ ...prev, status: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="projectType">Project Type</Label>
        <Input
          id="projectType"
          value={formData.projectType}
          onChange={(e) => setFormData(prev => ({ ...prev, projectType: e.target.value }))}
          placeholder="e.g., Construction, Consulting"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="billingModel">Billing Model</Label>
        <Select
          value={formData.billingModel}
          onValueChange={(value: ProjectBillingModel) => setFormData(prev => ({ ...prev, billingModel: value }))}
        >
          <SelectTrigger id="billingModel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {billingModelOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="jobNumber">Job Number</Label>
        <Input
          id="jobNumber"
          value={formData.jobNumber}
          onChange={(e) => setFormData(prev => ({ ...prev, jobNumber: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="startDate">Start Date</Label>
        <Input
          id="startDate"
          type="date"
          value={formData.startDate}
          onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="endDate">End Date</Label>
        <Input
          id="endDate"
          type="date"
          value={formData.endDate}
          onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
        />
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="description">Description</Label>
      <Textarea
        id="description"
        value={formData.description}
        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
        rows={3}
        placeholder="Project description..."
      />
    </div>
  </div>
);

// Inline editable cell component
interface EditableCellProps {
  value: string;
  projectId: string;
  field: string;
  editingCell: EditingCell | null;
  onStartEdit: (projectId: string, field: string, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'currency' | 'percent' | 'date';
  formatter?: (value: string) => string;
  className?: string;
}

function EditableCell({
  value,
  projectId,
  field,
  editingCell,
  onStartEdit,
  onSave,
  onCancel,
  onChange,
  type = 'text',
  formatter,
  className = '',
}: EditableCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing = editingCell?.projectId === projectId && editingCell?.field === field;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const displayValue = formatter ? formatter(value) : value || '-';
  const inputType = type === 'date' ? 'date' : type === 'number' || type === 'currency' || type === 'percent' ? 'number' : 'text';

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type={inputType}
          value={editingCell?.value || ''}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 w-full min-w-[80px]"
          step={type === 'currency' ? '0.01' : type === 'percent' ? '1' : undefined}
        />
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onSave}>
          <Check className="h-3 w-3 text-green-600" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancel}>
          <X className="h-3 w-3 text-red-600" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded -mx-1 ${className}`}
      onClick={() => onStartEdit(projectId, field, value || '')}
      title="Click to edit"
    >
      {displayValue}
    </div>
  );
}

// Inline status select component
interface EditableStatusCellProps {
  value: ProjectStatusInput;
  projectId: string;
  editingCell: EditingCell | null;
  onStartEdit: (projectId: string, field: string, value: string) => void;
  onSave: (value: string) => void;
  onCancel: () => void;
}

function EditableStatusCell({
  value,
  projectId,
  editingCell,
  onStartEdit,
  onSave,
  onCancel,
}: EditableStatusCellProps) {
  const isEditing = editingCell?.projectId === projectId && editingCell?.field === 'status';

  const getStatusBadgeVariant = (status: ProjectStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'active':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'cancelled':
      case 'archived':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Select
          value={editingCell?.value || value}
          onValueChange={(newValue) => onSave(newValue)}
        >
          <SelectTrigger className="h-7 w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancel}>
          <X className="h-3 w-3 text-red-600" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className="cursor-pointer"
      onClick={() => onStartEdit(projectId, 'status', value)}
      title="Click to edit"
    >
      <Badge variant={getStatusBadgeVariant(value)}>
        {statusOptions.find(s => s.value === value)?.label || value}
      </Badge>
    </div>
  );
}

export default function ProjectsPage() {
  const { orgId } = useAuth();
  const router = useRouter();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [formData, setFormData] = useState<FormData>({
    projectCode: '',
    name: '',
    status: 'planning',
    startDate: '',
    endDate: '',
    jobNumber: '',
    projectType: '',
    billingModel: 'time_and_materials',
    description: '',
  });

  // TRPC queries and mutations
  const utils = trpc.useUtils();
  const { data: projectsData, isLoading, refetch } = trpc.projects.list.useQuery({}, {
    enabled: !!orgId,
  });

  const createProjectMutation = trpc.projects.create.useMutation({
    onSuccess: () => {
      toast.success('Project created successfully');
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create project');
    },
  });

  const updateProjectMutation = trpc.projects.update.useMutation({
    onSuccess: () => {
      toast.success('Project updated successfully');
      setIsEditOpen(false);
      setEditingCell(null);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update project');
      refetch(); // Refresh to reset any optimistic updates
    },
  });

  const deleteProjectMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      toast.success('Project deleted successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete project');
    },
  });

  const projects = (projectsData?.data || []).map(project => ({
    ...project,
    createdAt: project.createdAt?.toString() || new Date().toISOString(),
    updatedAt: project.updatedAt?.toString() || new Date().toISOString(),
  })) as Project[];

  const handleCreate = async () => {
    if (!formData.projectCode || !formData.name) {
      toast.error('Project code and name are required');
      return;
    }

    createProjectMutation.mutate({
      projectCode: formData.projectCode,
      name: formData.name,
      status: formData.status,
      startDate: formData.startDate || undefined,
      endDate: formData.endDate || undefined,
      jobNumber: formData.jobNumber || undefined,
      projectType: formData.projectType || undefined,
      billingModel: formData.billingModel,
      description: formData.description || undefined,
    });
  };

  const handleUpdate = async () => {
    if (!selectedProject) return;

    updateProjectMutation.mutate({
      id: selectedProject.id,
      data: {
        projectCode: formData.projectCode || undefined,
        name: formData.name || undefined,
        status: formData.status,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        jobNumber: formData.jobNumber || null,
        projectType: formData.projectType || null,
        billingModel: formData.billingModel,
        description: formData.description || null,
      },
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    deleteProjectMutation.mutate({ id });
  };

  // Inline editing handlers
  const handleStartEdit = useCallback((projectId: string, field: string, value: string) => {
    setEditingCell({ projectId, field, value });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingCell) return;

    const { projectId, field, value } = editingCell;

    // Build update data based on field
    const updateData: Record<string, any> = {};

    switch (field) {
      case 'name':
        updateData.name = value || undefined;
        break;
      case 'budgetRevenue':
        updateData.budgetRevenue = value || null;
        break;
      case 'budgetCost':
        updateData.budgetCost = value || null;
        break;
      case 'percentComplete':
        updateData.percentComplete = value || null;
        break;
      case 'startDate':
        updateData.startDate = value || null;
        break;
      case 'endDate':
        updateData.endDate = value || null;
        break;
      case 'status':
        updateData.status = value as ProjectStatusInput;
        break;
      default:
        return;
    }

    updateProjectMutation.mutate({
      id: projectId,
      data: updateData,
    });
  }, [editingCell, updateProjectMutation]);

  const handleStatusSave = useCallback((projectId: string, value: string) => {
    updateProjectMutation.mutate({
      id: projectId,
      data: { status: value as ProjectStatusInput },
    });
    setEditingCell(null);
  }, [updateProjectMutation]);

  const handleEditingValueChange = useCallback((value: string) => {
    setEditingCell(prev => prev ? { ...prev, value } : null);
  }, []);

  const openEditDialog = (project: Project) => {
    setSelectedProject(project);
    setFormData({
      projectCode: project.projectCode || '',
      name: project.name || '',
      status: (project.status || 'planning') as ProjectStatusInput,
      startDate: project.startDate || '',
      endDate: project.endDate || '',
      jobNumber: project.jobNumber || '',
      projectType: project.projectType || '',
      billingModel: (project.billingModel || 'time_and_materials') as ProjectBillingModel,
      description: project.description || '',
    });
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setFormData({
      projectCode: '',
      name: '',
      status: 'planning',
      startDate: '',
      endDate: '',
      jobNumber: '',
      projectType: '',
      billingModel: 'time_and_materials',
      description: '',
    });
    setSelectedProject(null);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return '-';
    const num = parseFloat(value);
    if (isNaN(num)) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatPercent = (value: string | null | undefined) => {
    if (!value) return '-';
    const num = parseFloat(value);
    if (isNaN(num)) return '-';
    return `${num.toFixed(0)}%`;
  };

  const formatBillingModel = (value: string | null | undefined) => {
    if (value === 'fixed_fee') return 'Fixed Fee';
    if (value === 'time_and_materials') return 'Time & Materials';
    return '-';
  };

  if (isLoading) {
    return <div className="h-full p-6"><p>Loading projects...</p></div>;
  }

  if (!orgId) {
    return <div className="h-full p-6"><p>Please select an organization to view projects.</p></div>;
  }

  return (
    <div className="h-full p-6 flex flex-col">
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Projects</CardTitle>
              <CardDescription>Manage your projects and track work scope. Click any cell to edit inline.</CardDescription>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Project
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                  <DialogDescription>
                    Add a new project to your organization
                  </DialogDescription>
                </DialogHeader>
                <ProjectForm formData={formData} setFormData={setFormData} />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={createProjectMutation.isPending}>
                    {createProjectMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead className="text-right">Budget Revenue</TableHead>
                  <TableHead className="text-right">Budget Cost</TableHead>
                  <TableHead className="text-right">% Complete</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.projectCode}</TableCell>
                    <TableCell>
                      <EditableCell
                        value={project.name}
                        projectId={project.id}
                        field="name"
                        editingCell={editingCell}
                        onStartEdit={handleStartEdit}
                        onSave={handleSaveEdit}
                        onCancel={handleCancelEdit}
                        onChange={handleEditingValueChange}
                      />
                    </TableCell>
                    <TableCell>{project.customerName || '-'}</TableCell>
                    <TableCell>
                      <EditableStatusCell
                        value={(project.status || 'planning') as ProjectStatusInput}
                        projectId={project.id}
                        editingCell={editingCell}
                        onStartEdit={handleStartEdit}
                        onSave={(value) => handleStatusSave(project.id, value)}
                        onCancel={handleCancelEdit}
                      />
                    </TableCell>
                    <TableCell>{formatBillingModel(project.billingModel)}</TableCell>
                    <TableCell className="text-right">
                      <EditableCell
                        value={project.budgetRevenue || ''}
                        projectId={project.id}
                        field="budgetRevenue"
                        editingCell={editingCell}
                        onStartEdit={handleStartEdit}
                        onSave={handleSaveEdit}
                        onCancel={handleCancelEdit}
                        onChange={handleEditingValueChange}
                        type="currency"
                        formatter={formatCurrency}
                        className="font-mono text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <EditableCell
                        value={project.budgetCost || ''}
                        projectId={project.id}
                        field="budgetCost"
                        editingCell={editingCell}
                        onStartEdit={handleStartEdit}
                        onSave={handleSaveEdit}
                        onCancel={handleCancelEdit}
                        onChange={handleEditingValueChange}
                        type="currency"
                        formatter={formatCurrency}
                        className="font-mono text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <EditableCell
                        value={project.percentComplete || ''}
                        projectId={project.id}
                        field="percentComplete"
                        editingCell={editingCell}
                        onStartEdit={handleStartEdit}
                        onSave={handleSaveEdit}
                        onCancel={handleCancelEdit}
                        onChange={handleEditingValueChange}
                        type="percent"
                        formatter={formatPercent}
                        className="font-mono text-right"
                      />
                    </TableCell>
                    <TableCell>
                      <EditableCell
                        value={project.startDate || ''}
                        projectId={project.id}
                        field="startDate"
                        editingCell={editingCell}
                        onStartEdit={handleStartEdit}
                        onSave={handleSaveEdit}
                        onCancel={handleCancelEdit}
                        onChange={handleEditingValueChange}
                        type="date"
                        formatter={formatDate}
                      />
                    </TableCell>
                    <TableCell>
                      <EditableCell
                        value={project.endDate || ''}
                        projectId={project.id}
                        field="endDate"
                        editingCell={editingCell}
                        onStartEdit={handleStartEdit}
                        onSave={handleSaveEdit}
                        onCancel={handleCancelEdit}
                        onChange={handleEditingValueChange}
                        type="date"
                        formatter={formatDate}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/projects/${project.id}`)}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/projects/time?projectId=${project.id}`)}
                          title="Time tracking"
                        >
                          <Clock className="h-4 w-4" />
                          <span className="sr-only">Time</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/transactions/sales/estimates?projectId=${project.id}`)}
                          title="View estimates"
                        >
                          <FileText className="h-4 w-4" />
                          <span className="sr-only">Estimates</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(project)}
                          title="Edit project"
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(project.id)}
                          title="Delete project"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {projects.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              No projects found. Create your first project to get started.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update project information
            </DialogDescription>
          </DialogHeader>
          <ProjectForm formData={formData} setFormData={setFormData} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateProjectMutation.isPending}>
              {updateProjectMutation.isPending ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
