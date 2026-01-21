'use client';

import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Edit, Plus } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';

interface Client {
  id: string;
  companyName: string;
  customerId?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  parentCustomerId?: string | null;
  status: string;
  billingAddress?: {
    street?: string | null;
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    stateProvince?: string | null;
    postalCode?: string | null;
    country?: string | null;
    countryCode?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export default function ClientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { orgId } = useAuth();

  // Use tRPC queries - reusing customers endpoint
  const { data: client, isLoading: clientLoading } = trpc.customers.get.useQuery(
    { id },
    {
      enabled: !!orgId && !!id,
      retry: 1,
    }
  );

  // For now, we'll just show the client without child clients
  const childClients: Client[] = [];

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view client details.</p>
      </div>
    );
  }

  if (clientLoading) {
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

  if (!client) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Client Not Found</h1>
        </div>
        <p className="text-muted-foreground">The client you're looking for doesn't exist or you don't have access to it.</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAddress = (address: Client['billingAddress']) => {
    if (!address) return 'N/A';
    const parts = [];
    if (address.street || address.line1) parts.push(address.street || address.line1);
    if (address.line2) parts.push(address.line2);
    if (address.city) parts.push(address.city);
    if (address.state || address.stateProvince) parts.push(address.state || address.stateProvince);
    if (address.postalCode) parts.push(address.postalCode);
    if (address.country || address.countryCode) parts.push(address.country || address.countryCode);
    return parts.length > 0 ? parts.join(', ') : 'N/A';
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'archived':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/clients')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">{client.companyName}</h1>
          <Badge className={getStatusBadgeColor(client.status)}>
            {client.status}
          </Badge>
        </div>
        <Button onClick={() => router.push(`/clients/${id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Client
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
            <CardDescription>Basic details about the client</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Client ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{client.customerId || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Client Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{client.companyName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-sm text-gray-900">{client.contactEmail || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Phone</dt>
              <dd className="mt-1 text-sm text-gray-900">{client.contactPhone || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                <Badge className={getStatusBadgeColor(client.status)}>
                  {client.status}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Billing Address</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatAddress(client.billingAddress)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">{client.createdAt ? formatDate(String(client.createdAt)) : 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
              <dd className="mt-1 text-sm text-gray-900">{client.updatedAt ? formatDate(String(client.updatedAt)) : 'N/A'}</dd>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Child Clients</CardTitle>
                <CardDescription>Clients that belong to this parent client</CardDescription>
              </div>
              <Button size="sm" onClick={() => router.push(`/clients/new?parentId=${id}`)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Child Client
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {childClients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No child clients found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Client ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {childClients.map((child) => (
                    <TableRow key={child.id}>
                      <TableCell className="font-medium">{child.companyName}</TableCell>
                      <TableCell>{child.customerId || 'N/A'}</TableCell>
                      <TableCell>{child.contactEmail || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(child.status)}>
                          {child.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/clients/${child.id}`)}
                        >
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
    </div>
  );
}
