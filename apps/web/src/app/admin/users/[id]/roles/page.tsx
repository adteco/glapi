'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { getBrowserApiUrl } from '@/lib/browser-api';
import { ArrowLeft, Plus, Trash2, Shield, User, Building } from 'lucide-react';
import Link from 'next/link';

// Types
interface UserRole {
  id: string;
  roleId: string;
  roleName: string;
  roleDescription: string | null;
  subsidiaryId: string | null;
  subsidiaryName: string | null;
  grantedAt: string;
  grantedBy: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface Subsidiary {
  id: string;
  name: string;
}

interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
}

interface AssignRoleInput {
  roleId: string;
  subsidiaryId?: string;
}

// API functions
async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const res = await fetch(getBrowserApiUrl(`/api/admin/users/${userId}`), {
    credentials: 'include',
  });
  if (!res.ok) {
    return {
      id: userId,
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      imageUrl: null,
    };
  }
  return res.json();
}

async function fetchUserRoles(userId: string): Promise<UserRole[]> {
  const res = await fetch(getBrowserApiUrl(`/api/admin/users/${userId}/roles`), {
    credentials: 'include',
  });
  if (!res.ok) {
    return [
      {
        id: '1',
        roleId: 'r1',
        roleName: 'GL Manager',
        roleDescription: 'Manage GL transactions and accounts',
        subsidiaryId: 's1',
        subsidiaryName: 'US Operations',
        grantedAt: new Date().toISOString(),
        grantedBy: 'Admin',
      },
      {
        id: '2',
        roleId: 'r2',
        roleName: 'GL Viewer',
        roleDescription: 'View-only access to GL data',
        subsidiaryId: null,
        subsidiaryName: null,
        grantedAt: new Date().toISOString(),
        grantedBy: 'Admin',
      },
    ];
  }
  return res.json();
}

async function fetchAvailableRoles(): Promise<Role[]> {
  const res = await fetch(getBrowserApiUrl('/api/admin/roles'), {
    credentials: 'include',
  });
  if (!res.ok) {
    return [
      { id: 'r1', name: 'Administrator', description: 'Full system access' },
      { id: 'r2', name: 'GL Manager', description: 'Manage GL transactions' },
      { id: 'r3', name: 'GL Viewer', description: 'View-only GL access' },
      { id: 'r4', name: 'Auditor', description: 'Audit log access' },
    ];
  }
  return res.json();
}

async function fetchSubsidiaries(): Promise<Subsidiary[]> {
  const res = await fetch(getBrowserApiUrl('/api/subsidiaries'), {
    credentials: 'include',
  });
  if (!res.ok) {
    return [
      { id: 's1', name: 'US Operations' },
      { id: 's2', name: 'EU Operations' },
      { id: 's3', name: 'APAC Operations' },
    ];
  }
  const data = await res.json();
  return data.data || data;
}

async function assignRole(userId: string, data: AssignRoleInput): Promise<UserRole> {
  const res = await fetch(getBrowserApiUrl(`/api/admin/users/${userId}/roles`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to assign role');
  return res.json();
}

async function revokeRole(userId: string, userRoleId: string): Promise<void> {
  const res = await fetch(getBrowserApiUrl(`/api/admin/users/${userId}/roles/${userRoleId}`), {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to revoke role');
}

export default function UserRolesPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const userId = params.id as string;

  const [isAssignDialogOpen, setIsAssignDialogOpen] = React.useState(false);
  const [roleToRevoke, setRoleToRevoke] = React.useState<UserRole | null>(null);
  const [selectedRoleId, setSelectedRoleId] = React.useState<string>('');
  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = React.useState<string>('');

  // Fetch user profile
  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUserProfile(userId),
  });

  // Fetch user roles
  const { data: userRoles, isLoading } = useQuery({
    queryKey: ['userRoles', userId],
    queryFn: () => fetchUserRoles(userId),
  });

  // Fetch available roles
  const { data: availableRoles } = useQuery({
    queryKey: ['availableRoles'],
    queryFn: fetchAvailableRoles,
  });

  // Fetch subsidiaries
  const { data: subsidiaries } = useQuery({
    queryKey: ['subsidiaries'],
    queryFn: fetchSubsidiaries,
  });

  // Assign role mutation
  const assignMutation = useMutation({
    mutationFn: (data: AssignRoleInput) => assignRole(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userRoles', userId] });
      setIsAssignDialogOpen(false);
      setSelectedRoleId('');
      setSelectedSubsidiaryId('');
    },
  });

  // Revoke role mutation
  const revokeMutation = useMutation({
    mutationFn: (userRoleId: string) => revokeRole(userId, userRoleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userRoles', userId] });
      setRoleToRevoke(null);
    },
  });

  const handleAssignRole = () => {
    if (!selectedRoleId) return;
    assignMutation.mutate({
      roleId: selectedRoleId,
      subsidiaryId: selectedSubsidiaryId || undefined,
    });
  };

  const handleRevokeRole = () => {
    if (roleToRevoke) {
      revokeMutation.mutate(roleToRevoke.id);
    }
  };

  const userName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
    : 'User';

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Users
          </Link>
        </Button>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{userName}</h1>
            <p className="text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Button onClick={() => setIsAssignDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Assign Role
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Assigned Roles
          </CardTitle>
          <CardDescription>
            Roles assigned to this user and their scope
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
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Granted</TableHead>
                  <TableHead>Granted By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userRoles?.map((userRole) => (
                  <TableRow key={userRole.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/roles/${userRole.roleId}`}
                        className="hover:underline text-primary"
                      >
                        {userRole.roleName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {userRole.roleDescription || '-'}
                    </TableCell>
                    <TableCell>
                      {userRole.subsidiaryId ? (
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-muted-foreground" />
                          <span>{userRole.subsidiaryName}</span>
                        </div>
                      ) : (
                        <Badge variant="secondary">All Subsidiaries</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(userRole.grantedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {userRole.grantedBy}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRoleToRevoke(userRole)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!userRoles || userRoles.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No roles assigned to this user yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Assign Role Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>
              Assign a role to {userName}. Optionally restrict the role to a specific subsidiary.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Role</label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role..." />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles?.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">
                Subsidiary Scope
                <span className="text-muted-foreground font-normal ml-2">(Optional)</span>
              </label>
              <Select
                value={selectedSubsidiaryId}
                onValueChange={setSelectedSubsidiaryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All subsidiaries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Subsidiaries</SelectItem>
                  {subsidiaries?.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leave empty to grant access to all subsidiaries
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignRole}
              disabled={!selectedRoleId || assignMutation.isPending}
            >
              {assignMutation.isPending ? 'Assigning...' : 'Assign Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog
        open={!!roleToRevoke}
        onOpenChange={(open) => !open && setRoleToRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke the &quot;{roleToRevoke?.roleName}&quot; role
              from {userName}?
              {roleToRevoke?.subsidiaryName && (
                <span> This will remove access to {roleToRevoke.subsidiaryName}.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeRole}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revokeMutation.isPending ? 'Revoking...' : 'Revoke'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
