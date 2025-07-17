'use client';

import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Edit, Plus } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';

interface Customer {
  id: string;
  companyName: string;
  customerId?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  parentCustomerId?: string | null;
  status: string;
  billingAddress?: any;
  createdAt: string;
  updatedAt: string;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { orgId } = useAuth();

  // Use tRPC queries
  const { data: customer, isLoading: customerLoading } = trpc.customers.get.useQuery(
    { id },
    { 
      enabled: !!orgId && !!id,
      retry: 1,
    }
  );

  // For now, we'll just show the customer without child customers
  // This can be added later when the endpoint is available
  const childCustomers: Customer[] = [];

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view customer details.</p>
      </div>
    );
  }

  if (customerLoading) {
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

  if (!customer) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Customer Not Found</h1>
        </div>
        <p className="text-muted-foreground">The customer you're looking for doesn't exist or you don't have access to it.</p>
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

  const formatAddress = (address: any) => {
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
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">{customer.companyName}</h1>
          <Badge className={getStatusBadgeColor(customer.status)}>
            {customer.status}
          </Badge>
        </div>
        <Button onClick={() => router.push(`/relationships/customers/${id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Customer
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
            <CardDescription>Basic details about the customer</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Customer ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{customer.customerId || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Company Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{customer.companyName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-sm text-gray-900">{customer.contactEmail || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Phone</dt>
              <dd className="mt-1 text-sm text-gray-900">{customer.contactPhone || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                <Badge className={getStatusBadgeColor(customer.status)}>
                  {customer.status}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Billing Address</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatAddress(customer.billingAddress)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(customer.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(customer.updatedAt)}</dd>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Child Customers</CardTitle>
                <CardDescription>Customers that belong to this parent customer</CardDescription>
              </div>
              <Button size="sm" onClick={() => router.push(`/relationships/customers/new?parentId=${id}`)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Child Customer
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {childCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No child customers found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Customer ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {childCustomers.map((child) => (
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
                          onClick={() => router.push(`/relationships/customers/${child.id}`)}
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