'use client';

import { useState } from 'react';
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
import { Eye, Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

// Use TRPC inferred types to prevent type drift
type Project = RouterOutputs['projects']['list']['data'][number];
type ProjectStatus = Project['status'];

// Input status type for mutations (must match TRPC input schema)
type ProjectStatusInput = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'archived';

interface FormData {
  projectCode: string;
  name: string;
  status: ProjectStatusInput;
  startDate: string;
  endDate: string;
  jobNumber: string;
  projectType: string;
  description: string;
}

interface ProjectFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

const statusOptions: { value: ProjectStatusInput; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' },
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

export default function ProjectsPage() {
  const { orgId } = useAuth();
  const router = useRouter();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<FormData>({
    projectCode: '',
    name: '',
    status: 'planning',
    startDate: '',
    endDate: '',
    jobNumber: '',
    projectType: '',
    description: '',
  });

  // TRPC queries and mutations
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
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update project');
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
        description: formData.description || null,
      },
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    deleteProjectMutation.mutate({ id });
  };

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
      description: '',
    });
    setSelectedProject(null);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

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

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading projects...</p></div>;
  }

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view projects.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Projects</CardTitle>
              <CardDescription>Manage your projects and track work scope</CardDescription>
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
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">{project.projectCode}</TableCell>
                  <TableCell>{project.name}</TableCell>
                  <TableCell>{project.projectType || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(project.status)}>
                      {statusOptions.find(s => s.value === project.status)?.label || project.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(project.startDate)}</TableCell>
                  <TableCell>{formatDate(project.endDate)}</TableCell>
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
