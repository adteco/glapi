'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ArrowLeft, Save, Shield, Users, Key, Check, X } from 'lucide-react';
import Link from 'next/link';

// Types
interface Permission {
  id: string;
  resourceType: string;
  action: string;
  description: string | null;
  isGranted: boolean;
}

interface RoleUser {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  grantedAt: string;
  grantedBy: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  createdAt: string;
  updatedAt: string;
  permissions: Permission[];
  users: RoleUser[];
}

interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: string[];
}

// Resource type groupings for display
const RESOURCE_GROUPS = {
  'General Ledger': ['GL_TRANSACTION', 'GL_ACCOUNT', 'GL_BALANCE', 'GL_PERIOD'],
  'Dimensions': ['CLASS', 'DEPARTMENT', 'LOCATION', 'SUBSIDIARY'],
  'Entities': ['CUSTOMER', 'VENDOR', 'EMPLOYEE', 'PROJECT'],
  'System': ['ROLE', 'USER', 'AUDIT_LOG', 'SETTINGS'],
};

// API functions
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3031';

async function fetchRole(roleId: string): Promise<Role> {
  const res = await fetch(`${API_URL}/api/admin/roles/${roleId}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    // Return mock data if API not available
    const mockPermissions: Permission[] = [
      { id: '1', resourceType: 'GL_TRANSACTION', action: 'CREATE', description: 'Create GL transactions', isGranted: true },
      { id: '2', resourceType: 'GL_TRANSACTION', action: 'READ', description: 'View GL transactions', isGranted: true },
      { id: '3', resourceType: 'GL_TRANSACTION', action: 'UPDATE', description: 'Update GL transactions', isGranted: true },
      { id: '4', resourceType: 'GL_TRANSACTION', action: 'DELETE', description: 'Delete GL transactions', isGranted: false },
      { id: '5', resourceType: 'GL_TRANSACTION', action: 'POST', description: 'Post GL transactions', isGranted: true },
      { id: '6', resourceType: 'GL_ACCOUNT', action: 'CREATE', description: 'Create GL accounts', isGranted: true },
      { id: '7', resourceType: 'GL_ACCOUNT', action: 'READ', description: 'View GL accounts', isGranted: true },
      { id: '8', resourceType: 'GL_ACCOUNT', action: 'UPDATE', description: 'Update GL accounts', isGranted: true },
      { id: '9', resourceType: 'GL_ACCOUNT', action: 'DELETE', description: 'Delete GL accounts', isGranted: false },
      { id: '10', resourceType: 'CLASS', action: 'CREATE', description: 'Create classes', isGranted: true },
      { id: '11', resourceType: 'CLASS', action: 'READ', description: 'View classes', isGranted: true },
      { id: '12', resourceType: 'CLASS', action: 'UPDATE', description: 'Update classes', isGranted: true },
      { id: '13', resourceType: 'DEPARTMENT', action: 'READ', description: 'View departments', isGranted: true },
      { id: '14', resourceType: 'AUDIT_LOG', action: 'READ', description: 'View audit logs', isGranted: true },
    ];

    const mockUsers: RoleUser[] = [
      { id: '1', userId: 'u1', userName: 'John Smith', userEmail: 'john@example.com', grantedAt: new Date().toISOString(), grantedBy: 'Admin' },
      { id: '2', userId: 'u2', userName: 'Jane Doe', userEmail: 'jane@example.com', grantedAt: new Date().toISOString(), grantedBy: 'Admin' },
    ];

    return {
      id: roleId,
      name: roleId === '1' ? 'Administrator' : roleId === '2' ? 'GL Manager' : 'Custom Role',
      description: 'Manage GL transactions and accounts',
      isSystemRole: roleId === '1' || roleId === '2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      permissions: mockPermissions,
      users: mockUsers,
    };
  }
  return res.json();
}

async function updateRole(roleId: string, data: UpdateRoleInput): Promise<Role> {
  const res = await fetch(`${API_URL}/api/admin/roles/${roleId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update role');
  return res.json();
}

export default function RoleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const roleId = params.id as string;

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [permissions, setPermissions] = React.useState<Map<string, boolean>>(new Map());
  const [hasChanges, setHasChanges] = React.useState(false);

  // Fetch role
  const { data: role, isLoading, error } = useQuery({
    queryKey: ['role', roleId],
    queryFn: () => fetchRole(roleId),
  });

  // Update local state when role data loads
  React.useEffect(() => {
    if (role) {
      setName(role.name);
      setDescription(role.description || '');
      const permMap = new Map<string, boolean>();
      role.permissions.forEach((p) => {
        permMap.set(p.id, p.isGranted);
      });
      setPermissions(permMap);
    }
  }, [role]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateRoleInput) => updateRole(roleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role', roleId] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setHasChanges(false);
    },
  });

  const handlePermissionToggle = (permissionId: string, checked: boolean) => {
    setPermissions((prev) => {
      const next = new Map(prev);
      next.set(permissionId, checked);
      return next;
    });
    setHasChanges(true);
  };

  const handleSave = () => {
    const grantedPermissions = Array.from(permissions.entries())
      .filter(([, granted]) => granted)
      .map(([id]) => id);

    updateMutation.mutate({
      name: name !== role?.name ? name : undefined,
      description: description !== role?.description ? description : undefined,
      permissions: grantedPermissions,
    });
  };

  // Group permissions by resource type
  const groupedPermissions = React.useMemo(() => {
    if (!role?.permissions) return {};
    const groups: Record<string, Permission[]> = {};
    role.permissions.forEach((perm) => {
      if (!groups[perm.resourceType]) {
        groups[perm.resourceType] = [];
      }
      groups[perm.resourceType].push(perm);
    });
    return groups;
  }, [role?.permissions]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center justify-center py-20">
          <div className="text-muted-foreground">Loading role...</div>
        </div>
      </div>
    );
  }

  if (error || !role) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <AlertDescription>Failed to load role details.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/roles">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Roles
          </Link>
        </Button>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">{role.name}</h1>
            {role.isSystemRole && <Badge>System Role</Badge>}
          </div>
          <p className="text-muted-foreground mt-1">
            {role.description || 'No description'}
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending || role.isSystemRole}
        >
          <Save className="w-4 h-4 mr-2" />
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {role.isSystemRole && (
        <Alert className="mb-6">
          <Shield className="w-4 h-4" />
          <AlertDescription>
            This is a system role. Permissions cannot be modified, but you can view the assigned permissions.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="permissions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Users ({role.users.length})
          </TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Permissions Tab */}
        <TabsContent value="permissions">
          <div className="grid gap-6">
            {Object.entries(groupedPermissions).map(([resourceType, perms]) => (
              <Card key={resourceType}>
                <CardHeader className="py-4">
                  <CardTitle className="text-lg">{resourceType.replace(/_/g, ' ')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-24 text-center">Granted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {perms.map((perm) => (
                        <TableRow key={perm.id}>
                          <TableCell className="font-medium">{perm.action}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {perm.description || '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={permissions.get(perm.id) ?? perm.isGranted}
                              onCheckedChange={(checked) =>
                                handlePermissionToggle(perm.id, checked)
                              }
                              disabled={role.isSystemRole}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Users with this Role</CardTitle>
              <CardDescription>
                Users who have been assigned this role
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Granted</TableHead>
                    <TableHead>Granted By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {role.users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.userName}</TableCell>
                      <TableCell className="text-muted-foreground">{user.userEmail}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(user.grantedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.grantedBy}</TableCell>
                    </TableRow>
                  ))}
                  {role.users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No users have been assigned this role yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Role Details</CardTitle>
              <CardDescription>
                Edit the role name and description
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Role Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setHasChanges(true);
                  }}
                  disabled={role.isSystemRole}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setHasChanges(true);
                  }}
                  disabled={role.isSystemRole}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="text-sm">
                    {new Date(role.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Last Updated</Label>
                  <p className="text-sm">
                    {new Date(role.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
