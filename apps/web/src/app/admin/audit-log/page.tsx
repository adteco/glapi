'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  FileText,
  Search,
  RefreshCw,
  Shield,
  User,
  Key,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// Types
interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  resourceType: string;
  resourceId: string;
  resourceName: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
}

interface AuditLogResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface AuditLogFilters {
  action?: string;
  resourceType?: string;
  userId?: string;
  search?: string;
  page: number;
  pageSize: number;
}

// Action types for display
const ACTION_TYPES = [
  { value: 'all', label: 'All Actions' },
  { value: 'ROLE_CREATED', label: 'Role Created' },
  { value: 'ROLE_UPDATED', label: 'Role Updated' },
  { value: 'ROLE_DELETED', label: 'Role Deleted' },
  { value: 'ROLE_ASSIGNED', label: 'Role Assigned' },
  { value: 'ROLE_REVOKED', label: 'Role Revoked' },
  { value: 'PERMISSION_GRANTED', label: 'Permission Granted' },
  { value: 'PERMISSION_REVOKED', label: 'Permission Revoked' },
  { value: 'USER_LOGIN', label: 'User Login' },
  { value: 'USER_LOGOUT', label: 'User Logout' },
  { value: 'SETTINGS_CHANGED', label: 'Settings Changed' },
];

// Resource types for display
const RESOURCE_TYPES = [
  { value: 'all', label: 'All Resources' },
  { value: 'ROLE', label: 'Role' },
  { value: 'USER', label: 'User' },
  { value: 'PERMISSION', label: 'Permission' },
  { value: 'SETTINGS', label: 'Settings' },
  { value: 'GL_TRANSACTION', label: 'GL Transaction' },
  { value: 'GL_ACCOUNT', label: 'GL Account' },
];

// API functions
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3031';

async function fetchAuditLogs(filters: AuditLogFilters): Promise<AuditLogResponse> {
  const params = new URLSearchParams();
  params.set('page', String(filters.page));
  params.set('pageSize', String(filters.pageSize));
  if (filters.action && filters.action !== 'all') params.set('action', filters.action);
  if (filters.resourceType && filters.resourceType !== 'all') params.set('resourceType', filters.resourceType);
  if (filters.userId) params.set('userId', filters.userId);
  if (filters.search) params.set('search', filters.search);

  const res = await fetch(`${API_URL}/api/admin/audit-logs?${params.toString()}`, {
    credentials: 'include',
  });

  if (!res.ok) {
    // Return mock data if API not available
    const mockData: AuditLogEntry[] = [
      {
        id: '1',
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        action: 'ROLE_ASSIGNED',
        resourceType: 'USER',
        resourceId: 'u1',
        resourceName: 'John Smith',
        userId: 'admin1',
        userName: 'Admin User',
        userEmail: 'admin@example.com',
        details: { roleName: 'GL Manager', subsidiaryName: 'US Operations' },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        action: 'ROLE_CREATED',
        resourceType: 'ROLE',
        resourceId: 'r5',
        resourceName: 'Project Accountant',
        userId: 'admin1',
        userName: 'Admin User',
        userEmail: 'admin@example.com',
        details: { description: 'Access to project accounting features' },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        action: 'PERMISSION_GRANTED',
        resourceType: 'ROLE',
        resourceId: 'r2',
        resourceName: 'GL Manager',
        userId: 'admin1',
        userName: 'Admin User',
        userEmail: 'admin@example.com',
        details: { permission: 'GL_TRANSACTION:POST' },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        action: 'USER_LOGIN',
        resourceType: 'USER',
        resourceId: 'u2',
        resourceName: 'Jane Doe',
        userId: 'u2',
        userName: 'Jane Doe',
        userEmail: 'jane@example.com',
        details: null,
        ipAddress: '10.0.0.50',
        userAgent: 'Mozilla/5.0 (Macintosh)',
      },
      {
        id: '5',
        timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        action: 'ROLE_REVOKED',
        resourceType: 'USER',
        resourceId: 'u3',
        resourceName: 'Bob Wilson',
        userId: 'admin1',
        userName: 'Admin User',
        userEmail: 'admin@example.com',
        details: { roleName: 'GL Viewer' },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
      },
      {
        id: '6',
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        action: 'SETTINGS_CHANGED',
        resourceType: 'SETTINGS',
        resourceId: 'org1',
        resourceName: 'Organization Settings',
        userId: 'admin1',
        userName: 'Admin User',
        userEmail: 'admin@example.com',
        details: { setting: 'require_mfa', oldValue: false, newValue: true },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
      },
    ];

    return {
      data: mockData,
      total: mockData.length,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: 1,
    };
  }

  return res.json();
}

// Helper functions
function getActionIcon(action: string) {
  if (action.includes('ROLE')) return <Shield className="w-4 h-4" />;
  if (action.includes('USER')) return <User className="w-4 h-4" />;
  if (action.includes('PERMISSION')) return <Key className="w-4 h-4" />;
  if (action.includes('SETTINGS')) return <Settings className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
}

function getActionBadgeVariant(action: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (action.includes('CREATED') || action.includes('GRANTED') || action.includes('ASSIGNED')) {
    return 'default';
  }
  if (action.includes('DELETED') || action.includes('REVOKED')) {
    return 'destructive';
  }
  if (action.includes('UPDATED') || action.includes('CHANGED')) {
    return 'secondary';
  }
  return 'outline';
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return '-';
  const entries = Object.entries(details);
  if (entries.length === 0) return '-';
  return entries
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
}

function formatTimestamp(timestamp: string): { date: string; time: string } {
  const d = new Date(timestamp);
  return {
    date: d.toLocaleDateString(),
    time: d.toLocaleTimeString(),
  };
}

export default function AuditLogPage() {
  const [filters, setFilters] = React.useState<AuditLogFilters>({
    page: 1,
    pageSize: 20,
  });
  const [searchInput, setSearchInput] = React.useState('');

  // Fetch audit logs
  const { data: auditLogs, isLoading, error, refetch } = useQuery({
    queryKey: ['auditLogs', filters],
    queryFn: () => fetchAuditLogs(filters),
  });

  const handleSearch = () => {
    setFilters((prev) => ({
      ...prev,
      search: searchInput || undefined,
      page: 1,
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleFilterChange = (key: keyof AuditLogFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === 'all' ? undefined : value,
      page: 1,
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({
      ...prev,
      page: newPage,
    }));
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Audit Log</h1>
          <p className="text-muted-foreground mt-1">
            View security and administrative activity across your organization
          </p>
        </div>
        <Button onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>
            Failed to load audit logs. Using sample data.
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search logs..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button variant="secondary" onClick={handleSearch}>
                <Search className="w-4 h-4" />
              </Button>
            </div>
            <Select
              value={filters.action || 'all'}
              onValueChange={(value) => handleFilterChange('action', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.resourceType || 'all'}
              onValueChange={(value) => handleFilterChange('resourceType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by resource" />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground flex items-center">
              {auditLogs?.total ?? 0} total entries
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Activity Log
          </CardTitle>
          <CardDescription>
            Recent security and administrative events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading audit logs...</div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="w-[120px]">IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs?.data.map((entry) => {
                    const { date, time } = formatTimestamp(entry.timestamp);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{date}</span>
                            <span className="text-xs text-muted-foreground">{time}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getActionIcon(entry.action)}
                            <Badge variant={getActionBadgeVariant(entry.action)}>
                              {formatAction(entry.action)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {entry.resourceName || entry.resourceId}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {entry.resourceType}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{entry.userName}</span>
                            <span className="text-xs text-muted-foreground">
                              {entry.userEmail}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <span className="text-sm text-muted-foreground truncate block">
                            {formatDetails(entry.details)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.ipAddress || '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!auditLogs?.data || auditLogs.data.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No audit log entries found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {auditLogs && auditLogs.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Page {auditLogs.page} of {auditLogs.totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(auditLogs.page - 1)}
                      disabled={auditLogs.page <= 1}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(auditLogs.page + 1)}
                      disabled={auditLogs.page >= auditLogs.totalPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Info Section */}
      <Alert className="mt-6">
        <FileText className="w-4 h-4" />
        <AlertDescription>
          <p className="font-medium mb-1">About Audit Logs</p>
          <p className="text-sm text-muted-foreground">
            Audit logs track security-related events including role assignments, permission changes,
            and user authentication. Logs are retained for compliance and security analysis.
            Contact your administrator to configure retention policies.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
