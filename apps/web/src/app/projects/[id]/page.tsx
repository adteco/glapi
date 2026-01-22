'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Edit, Plus, Users } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';

type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'archived';

const statusOptions: { value: ProjectStatus; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' },
];

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { orgId } = useAuth();

  // Use tRPC queries
  const { data: project, isLoading: projectLoading } = trpc.projects.get.useQuery(
    { id },
    {
      enabled: !!orgId && !!id,
      retry: 1,
    }
  );

  const { data: participants, isLoading: participantsLoading } = trpc.projects.listParticipants.useQuery(
    { projectId: id },
    {
      enabled: !!orgId && !!id,
      retry: 1,
    }
  );

  // Fetch employees for participant selection
  const { data: employeesData } = trpc.employees.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: !!orgId }
  );
  const employees = employeesData?.data || [];

  // Add participant state and mutation
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [participantRole, setParticipantRole] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  const utils = trpc.useUtils();

  const addParticipantMutation = trpc.projects.addParticipant.useMutation({
    onSuccess: () => {
      utils.projects.listParticipants.invalidate({ projectId: id });
      setIsAddParticipantOpen(false);
      setSelectedEmployeeId('');
      setParticipantRole('');
      setIsPrimary(false);
    },
  });

  const handleAddParticipant = () => {
    if (!participantRole.trim() || !selectedEmployeeId) return;
    addParticipantMutation.mutate({
      projectId: id,
      data: {
        entityId: selectedEmployeeId,
        participantRole: participantRole.trim(),
        isPrimary,
      },
    });
  };

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view project details.</p>
      </div>
    );
  }

  if (projectLoading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Project Not Found</h1>
        </div>
        <p className="text-muted-foreground">The project you're looking for doesn't exist or you don't have access to it.</p>
      </div>
    );
  }

  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'planning':
        return 'bg-yellow-100 text-yellow-800';
      case 'on_hold':
        return 'bg-orange-100 text-orange-800';
      case 'cancelled':
      case 'archived':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    return statusOptions.find(s => s.value === status)?.label || status;
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/projects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <p className="text-muted-foreground">{project.projectCode}</p>
          </div>
          <Badge className={getStatusBadgeColor(project.status)}>
            {getStatusLabel(project.status)}
          </Badge>
        </div>
        <Button onClick={() => router.push(`/projects/${id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Project
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
            <CardDescription>Basic details about the project</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Project Code</dt>
              <dd className="mt-1 text-sm text-gray-900">{project.projectCode}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Project Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{project.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Project Type</dt>
              <dd className="mt-1 text-sm text-gray-900">{project.projectType || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Job Number</dt>
              <dd className="mt-1 text-sm text-gray-900">{project.jobNumber || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                <Badge className={getStatusBadgeColor(project.status)}>
                  {getStatusLabel(project.status)}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Currency</dt>
              <dd className="mt-1 text-sm text-gray-900">{project.currencyCode || 'USD'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Start Date</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(project.startDate)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">End Date</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(project.endDate)}</dd>
            </div>
            {project.retainagePercent && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Retainage</dt>
                <dd className="mt-1 text-sm text-gray-900">{project.retainagePercent}%</dd>
              </div>
            )}
            <div className="col-span-2">
              <dt className="text-sm font-medium text-gray-500">Description</dt>
              <dd className="mt-1 text-sm text-gray-900">{project.description || 'No description'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDateTime(project.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDateTime(project.updatedAt)}</dd>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Project Participants
                </CardTitle>
                <CardDescription>Team members and stakeholders assigned to this project</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => setIsAddParticipantOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Participant
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {participantsLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading participants...</p>
            ) : !participants || participants.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No participants assigned to this project</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Primary</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((participant) => (
                    <TableRow key={participant.id}>
                      <TableCell className="font-medium">{participant.participantRole}</TableCell>
                      <TableCell>
                        <Badge variant={participant.isPrimary ? 'default' : 'outline'}>
                          {participant.isPrimary ? 'Yes' : 'No'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" disabled>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Participant Dialog */}
      <Dialog open={isAddParticipantOpen} onOpenChange={setIsAddParticipantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Participant</DialogTitle>
            <DialogDescription>
              Add a team member or stakeholder to this project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="employee">Employee</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="participantRole">Role</Label>
              <Input
                id="participantRole"
                placeholder="e.g., Project Manager, Developer, Client"
                value={participantRole}
                onChange={(e) => setParticipantRole(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isPrimary"
                checked={isPrimary}
                onCheckedChange={(checked) => setIsPrimary(checked === true)}
              />
              <Label htmlFor="isPrimary" className="text-sm font-normal">
                Primary contact for this role
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddParticipantOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddParticipant}
              disabled={!participantRole.trim() || !selectedEmployeeId || addParticipantMutation.isPending}
            >
              {addParticipantMutation.isPending ? 'Adding...' : 'Add Participant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
