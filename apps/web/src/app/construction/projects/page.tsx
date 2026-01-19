'use client';

import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCcw, Trash2, Users, ListTree } from 'lucide-react';
import type { ProjectTaskNode } from '@glapi/api-service';

const PROJECT_STATUSES = [
  'PLANNING',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CLOSED',
  'CANCELLED',
] as const;

const TASK_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
] as const;

const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const createProjectSchema = z.object({
  projectCode: z.string().min(1, 'Project code is required'),
  name: z.string().min(1, 'Project name is required'),
  status: z.enum(PROJECT_STATUSES).default('PLANNING'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().max(2000).optional(),
});

type CreateProjectFormValues = z.infer<typeof createProjectSchema>;

const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  taskCode: z.string().min(1, 'Task code is required'),
  name: z.string().min(1, 'Task name is required'),
  description: z.string().max(2000).optional(),
  status: z.enum(TASK_STATUSES).default('NOT_STARTED'),
  priority: z.enum(TASK_PRIORITIES).default('MEDIUM'),
  parentTaskId: z.string().uuid().nullable().optional(),
  projectCostCodeId: z.string().uuid().nullable().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  durationDays: z.number().int().min(0).optional(),
  percentComplete: z.string().regex(/^\d+(\.\d+)?$/, 'Enter a numeric percent').optional(),
  isMilestone: z.boolean().default(false),
  sortOrder: z.number().int().min(0).optional(),
  assignedEntityId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

type CreateTaskFormValues = z.infer<typeof createTaskSchema>;

const participantSchema = z.object({
  participantRole: z.string().min(1, 'Role is required'),
  entityId: z.string().uuid().nullable().optional(),
  isPrimary: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

type ParticipantFormValues = z.infer<typeof participantSchema>;

type FlattenedTask = ProjectTaskNode & { depth: number };

const flattenTasks = (nodes: ProjectTaskNode[] = [], depth = 0): FlattenedTask[] => {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenTasks(node.children ?? [], depth + 1),
  ]);
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleDateString();
};

const formatPercent = (value?: string | null) => {
  if (!value) return '0%';
  const num = Number(value);
  if (Number.isNaN(num)) {
    return value;
  }
  return `${num.toFixed(2)}%`;
};

export default function ProjectsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isParticipantDialogOpen, setIsParticipantDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<FlattenedTask | null>(null);
  const [participantToDelete, setParticipantToDelete] = useState<string | null>(null);

  const projectForm = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      status: 'PLANNING',
    },
  });

  const taskForm = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      projectId: '',
      status: 'NOT_STARTED',
      priority: 'MEDIUM',
      percentComplete: '0',
      isMilestone: false,
    },
  });

  const participantForm = useForm<ParticipantFormValues>({
    resolver: zodResolver(participantSchema),
    defaultValues: {
      participantRole: '',
      isPrimary: false,
    },
  });

  const projectsQuery = trpc.projects.list.useQuery(
    {
      page: 1,
      limit: 50,
      filters: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(searchTerm ? { search: searchTerm } : {}),
      },
    },
    { keepPreviousData: true }
  );

  const projects = projectsQuery.data?.data ?? [];

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    } else if (
      selectedProjectId &&
      projects.length > 0 &&
      !projects.find((p) => p.id === selectedProjectId)
    ) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  const tasksQuery = trpc.projectTasks.getTree.useQuery(
    {
      projectId: selectedProjectId ?? '',
      filters: taskStatusFilter ? { status: taskStatusFilter } : undefined,
    },
    {
      enabled: Boolean(selectedProjectId),
    }
  );

  const participantsQuery = trpc.projects.listParticipants.useQuery(
    { projectId: selectedProjectId ?? '' },
    { enabled: Boolean(selectedProjectId) }
  );

  const createProjectMutation = trpc.projects.create.useMutation({
    onSuccess: () => {
      toast.success('Project created');
      setIsCreateProjectOpen(false);
      projectForm.reset({ status: 'PLANNING' });
      projectsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create project');
    },
  });

  const createTaskMutation = trpc.projectTasks.create.useMutation({
    onSuccess: () => {
      toast.success('Task created');
      setIsCreateTaskOpen(false);
      taskForm.reset({
        projectId: selectedProjectId ?? '',
        status: 'NOT_STARTED',
        priority: 'MEDIUM',
        percentComplete: '0',
        isMilestone: false,
      });
      tasksQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create task');
    },
  });

  const deleteTaskMutation = trpc.projectTasks.delete.useMutation({
    onSuccess: () => {
      toast.success('Task deleted');
      setTaskToDelete(null);
      tasksQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete task');
    },
  });

  const upsertParticipantMutation = trpc.projects.upsertParticipant.useMutation({
    onSuccess: () => {
      toast.success('Participant saved');
      setIsParticipantDialogOpen(false);
      participantForm.reset({
        participantRole: '',
        isPrimary: false,
      });
      participantsQuery.refetch();
    },
    onError: (error) => toast.error(error.message || 'Failed to save participant'),
  });

  const removeParticipantMutation = trpc.projects.removeParticipant.useMutation({
    onSuccess: () => {
      toast.success('Participant removed');
      setParticipantToDelete(null);
      participantsQuery.refetch();
    },
    onError: (error) => toast.error(error.message || 'Failed to remove participant'),
  });

  const flattenedTasks = useMemo(
    () => flattenTasks(tasksQuery.data ?? []),
    [tasksQuery.data]
  );

  const handleCreateProject = (data: CreateProjectFormValues) => {
    createProjectMutation.mutate(data);
  };

  const handleCreateTask = (data: CreateTaskFormValues) => {
    if (!selectedProjectId) {
      toast.error('Select a project first');
      return;
    }
    createTaskMutation.mutate({
      ...data,
      projectId: selectedProjectId,
    });
  };

  const handleCreateParticipant = (data: ParticipantFormValues) => {
    if (!selectedProjectId) {
      toast.error('Select a project first');
      return;
    }

    upsertParticipantMutation.mutate({
      ...data,
      projectId: selectedProjectId,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name or code..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            {PROJECT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => projectsQuery.refetch()}
          disabled={projectsQuery.isRefetching}
        >
          <RefreshCcw className="h-4 w-4" />
          <span className="sr-only">Refresh projects</span>
        </Button>
        <Button onClick={() => setIsCreateProjectOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>
              Manage project master data and view key metadata
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectsQuery.isLoading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">
                        Loading projects...
                      </TableCell>
                    </TableRow>
                  )}
                  {!projectsQuery.isLoading && projects.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No projects found
                      </TableCell>
                    </TableRow>
                  )}
                  {projects.map((project) => (
                    <TableRow
                      key={project.id}
                      className={cn(
                        'cursor-pointer',
                        selectedProjectId === project.id && 'bg-muted'
                      )}
                      onClick={() => setSelectedProjectId(project.id)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{project.name}</p>
                          <p className="text-xs text-muted-foreground">{project.projectCode}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{project.status}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(project.startDate)}</TableCell>
                      <TableCell>{formatDate(project.endDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>
              View tasks, participants, and metadata for a selected project
            </CardDescription>
            <CardAction>
              {selectedProject && (
                <Button size="sm" onClick={() => setIsCreateTaskOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Task
                </Button>
              )}
            </CardAction>
          </CardHeader>
          <CardContent>
            {!selectedProject && (
              <div className="text-center text-muted-foreground">
                Select a project to view its details
              </div>
            )}

            {selectedProject && (
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="text-lg font-semibold">{selectedProject.status}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Job Number</p>
                      <p className="font-semibold">{selectedProject.jobNumber ?? '—'}</p>
                    </div>
                  </div>
                  {selectedProject.description && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {selectedProject.description}
                    </p>
                  )}
                </div>

                <Tabs defaultValue="tasks">
                  <TabsList className="w-full">
                    <TabsTrigger value="tasks" className="w-full">
                      <ListTree className="mr-2 h-4 w-4" />
                      Tasks
                    </TabsTrigger>
                    <TabsTrigger value="participants" className="w-full">
                      <Users className="mr-2 h-4 w-4" />
                      Participants
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="tasks">
                    <div className="flex items-center justify-between py-2">
                      <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All statuses</SelectItem>
                          {TASK_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => tasksQuery.refetch()}
                        disabled={tasksQuery.isRefetching}
                      >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {tasksQuery.isLoading && (
                        <p className="text-sm text-muted-foreground">Loading tasks...</p>
                      )}
                      {!tasksQuery.isLoading && flattenedTasks.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No tasks for this project yet.
                        </p>
                      )}
                      {flattenedTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start justify-between rounded-md border p-3"
                          style={{ marginLeft: task.depth * 16 }}
                        >
                          <div>
                            <p className="font-semibold">{task.name}</p>
                            <p className="text-xs text-muted-foreground">{task.taskCode}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                              <Badge variant="secondary">{task.status}</Badge>
                              <Badge variant="outline">{task.priority}</Badge>
                              <span className="text-muted-foreground">
                                {formatPercent(task.percentComplete)}
                              </span>
                              {task.isMilestone && (
                                <Badge variant="default">Milestone</Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setTaskToDelete(task)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="participants">
                    <div className="flex items-center justify-between py-2">
                      <p className="text-sm text-muted-foreground">
                        {participantsQuery.data?.length ?? 0} participant(s)
                      </p>
                      <Button size="sm" variant="outline" onClick={() => setIsParticipantDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Participant
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {participantsQuery.isLoading && (
                        <p className="text-sm text-muted-foreground">Loading participants...</p>
                      )}
                      {!participantsQuery.isLoading &&
                        (participantsQuery.data?.length ?? 0) === 0 && (
                          <p className="text-sm text-muted-foreground">
                            No participants are assigned to this project yet.
                          </p>
                        )}
                      {participantsQuery.data?.map((participant) => (
                        <div
                          key={participant.id}
                          className="flex items-center justify-between rounded-md border p-3"
                        >
                          <div>
                            <p className="font-semibold">{participant.participantRole}</p>
                            <p className="text-xs text-muted-foreground">
                              {participant.entityName ?? participant.entityId ?? 'Unassigned'}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setParticipantToDelete(participant.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Project Dialog */}
      <Dialog
        open={isCreateProjectOpen}
        onOpenChange={(open) => {
          setIsCreateProjectOpen(open);
          if (!open) {
            projectForm.reset({ status: 'PLANNING' });
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>Define basic project metadata</DialogDescription>
          </DialogHeader>
          <Form {...projectForm}>
            <form onSubmit={projectForm.handleSubmit(handleCreateProject)} className="space-y-4">
              <FormField
                control={projectForm.control}
                name="projectCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Code</FormLabel>
                    <FormControl>
                      <Input placeholder="PRJ-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={projectForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Downtown Buildout" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={projectForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROJECT_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={projectForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={projectForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={projectForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={4} placeholder="Describe the project scope..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateProjectOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createProjectMutation.isPending}>
                  {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog
        open={isCreateTaskOpen}
        onOpenChange={(open) => {
          setIsCreateTaskOpen(open);
          if (!open) {
            taskForm.reset({
              projectId: selectedProjectId ?? '',
              status: 'NOT_STARTED',
              priority: 'MEDIUM',
              percentComplete: '0',
              isMilestone: false,
            });
          } else if (selectedProjectId) {
            taskForm.reset({
              projectId: selectedProjectId,
              status: 'NOT_STARTED',
              priority: 'MEDIUM',
              percentComplete: '0',
              isMilestone: false,
            });
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>Add a task or milestone to the hierarchy</DialogDescription>
          </DialogHeader>
          <Form {...taskForm}>
            <form onSubmit={taskForm.handleSubmit(handleCreateTask)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={taskForm.control}
                  name="taskCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task Code</FormLabel>
                      <FormControl>
                        <Input placeholder="TASK-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={taskForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Mobilization" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={taskForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TASK_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={taskForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TASK_PRIORITIES.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              {priority}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={taskForm.control}
                name="parentTaskId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Task (optional)</FormLabel>
                    <Select
                      value={field.value ?? ''}
                      onValueChange={(value) => field.onChange(value || null)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Top-level task" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Top-level task</SelectItem>
                        {flattenedTasks.map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            {`${'— '.repeat(task.depth)}${task.name}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={taskForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={taskForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={taskForm.control}
                  name="durationDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          onChange={(event) =>
                            field.onChange(event.target.value ? Number(event.target.value) : undefined)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={taskForm.control}
                  name="percentComplete"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Percent Complete</FormLabel>
                      <FormControl>
                        <Input placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={taskForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={taskForm.control}
                name="isMilestone"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Milestone</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Mark task as a milestone for reporting
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateTaskOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTaskMutation.isPending}>
                  {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Participant Dialog */}
      <Dialog
        open={isParticipantDialogOpen}
        onOpenChange={(open) => {
          setIsParticipantDialogOpen(open);
          if (!open || !selectedProjectId) {
            participantForm.reset({
              participantRole: '',
              isPrimary: false,
            });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Participant</DialogTitle>
            <DialogDescription>Assign owners, architects, or partners</DialogDescription>
          </DialogHeader>
          <Form {...participantForm}>
            <form onSubmit={participantForm.handleSubmit(handleCreateParticipant)} className="space-y-4">
              <FormField
                control={participantForm.control}
                name="participantRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <Input placeholder="Owner, Architect, GC..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={participantForm.control}
                name="entityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entity ID (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Entity UUID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={participantForm.control}
                name="isPrimary"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Primary participant</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Highlight this participant for workflows
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsParticipantDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={upsertParticipantMutation.isPending}>
                  {upsertParticipantMutation.isPending ? 'Saving...' : 'Save Participant'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Task Dialog */}
      <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{taskToDelete?.name}" and any children tasks from the hierarchy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (taskToDelete) {
                  deleteTaskMutation.mutate({ id: taskToDelete.id });
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Participant Dialog */}
      <AlertDialog open={!!participantToDelete} onOpenChange={() => setParticipantToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove participant?</AlertDialogTitle>
            <AlertDialogDescription>
              This will detach the participant from the project but will not delete the entity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (participantToDelete) {
                  removeParticipantMutation.mutate({ participantId: participantToDelete });
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
