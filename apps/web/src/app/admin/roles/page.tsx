'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Plus, Pencil, Trash2, Shield, Users } from 'lucide-react';
import Link from 'next/link';

// Types
interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  createdAt: string;
  updatedAt: string;
  permissionCount?: number;
  userCount?: number;
}

interface CreateRoleInput {
  name: string;
  description?: string;
}

// API functions
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3031';

async function fetchRoles(): Promise<Role[]> {
  const res = await fetch(`${API_URL}/api/admin/roles`, {
    credentials: 'include',
  });
  if (!res.ok) {
    // Return mock data if API not available
    return [
      {
        id: '1',
        name: 'Administrator',
        description: 'Full system access',
        isSystemRole: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        permissionCount: 25,
        userCount: 2,
      },
      {
        id: '2',
        name: 'GL Manager',
        description: 'Manage GL transactions and accounts',
        isSystemRole: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        permissionCount: 12,
        userCount: 5,
      },
      {
        id: '3',
        name: 'GL Viewer',
        description: 'View-only access to GL data',
        isSystemRole: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        permissionCount: 6,
        userCount: 10,
      },
      {
        id: '4',
        name: 'Auditor',
        description: 'Read access with audit log viewing',
        isSystemRole: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        permissionCount: 8,
        userCount: 3,
      },
    ];
  }
  return res.json();
}

async function createRole(data: CreateRoleInput): Promise<Role> {
  const res = await fetch(`${API_URL}/api/admin/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create role');
  return res.json();
}

async function deleteRole(roleId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/roles/${roleId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to delete role');
}

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [roleToDelete, setRoleToDelete] = React.useState<Role | null>(null);
  const [newRoleName, setNewRoleName] = React.useState('');
  const [newRoleDescription, setNewRoleDescription] = React.useState('');

  // Fetch roles
  const { data: roles, isLoading, error } = useQuery({
    queryKey: ['roles'],
    queryFn: fetchRoles,
  });

  // Create role mutation
  const createMutation = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setIsCreateDialogOpen(false);
      setNewRoleName('');
      setNewRoleDescription('');
    },
  });

  // Delete role mutation
  const deleteMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setRoleToDelete(null);
    },
  });

  const handleCreateRole = () => {
    if (!newRoleName.trim()) return;
    createMutation.mutate({
      name: newRoleName.trim(),
      description: newRoleDescription.trim() || undefined,
    });
  };

  const handleDeleteRole = () => {
    if (roleToDelete) {
      deleteMutation.mutate(roleToDelete.id);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Role Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage roles and their permissions for your organization
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Role
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>
            Failed to load roles. Using sample data.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Roles
          </CardTitle>
          <CardDescription>
            Roles define sets of permissions that can be assigned to users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading roles...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Permissions</TableHead>
                  <TableHead className="text-center">Users</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles?.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/roles/${role.id}`}
                        className="hover:underline text-primary"
                      >
                        {role.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {role.description || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {role.permissionCount ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        {role.userCount ?? 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      {role.isSystemRole ? (
                        <Badge>System</Badge>
                      ) : (
                        <Badge variant="outline">Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <Link href={`/admin/roles/${role.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRoleToDelete(role)}
                          disabled={role.isSystemRole}
                          className={cn(
                            role.isSystemRole && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!roles || roles.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No roles found. Create your first role to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Role Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Create a custom role with specific permissions for your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Role Name</Label>
              <Input
                id="name"
                placeholder="e.g., Project Manager"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this role can do..."
                value={newRoleDescription}
                onChange={(e) => setNewRoleDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateRole}
              disabled={!newRoleName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!roleToDelete}
        onOpenChange={(open) => !open && setRoleToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role &quot;{roleToDelete?.name}&quot;?
              This will remove the role from all users who have it assigned.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRole}
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
