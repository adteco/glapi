'use client';

import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Mail, Phone, Globe } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import { EntityContactsList } from '@/components/contacts';

type VendorMetadataValues = {
  paymentTerms?: string;
  terms?: string;
  vendorType?: string;
  vendor_type?: string;
  ein?: string;
  w9OnFile?: boolean;
  defaultExpenseAccount?: string;
};

type VendorAddress = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
};

export default function VendorDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { orgId } = useAuth();

  // Use tRPC query
  const { data: vendor, isLoading: vendorLoading } = trpc.vendors.get.useQuery(
    { id },
    { 
      enabled: !!orgId && !!id,
      retry: 1,
    }
  );

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view vendor details.</p>
      </div>
    );
  }

  if (vendorLoading) {
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

  if (!vendor) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Vendor Not Found</h1>
        </div>
        <p className="text-muted-foreground">The vendor you're looking for doesn't exist or you don't have access to it.</p>
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

  const metadata = vendor.metadata as VendorMetadataValues | null | undefined;
  const paymentTerms = metadata?.paymentTerms || metadata?.terms;
  const vendorType = metadata?.vendorType || metadata?.vendor_type;

  const formatAddress = (address?: VendorAddress | null) => {
    if (!address) return 'N/A';
    const parts = [];
    if (address.line1) parts.push(address.line1);
    if (address.line2) parts.push(address.line2);
    if (address.city) parts.push(address.city);
    if (address.stateProvince) parts.push(address.stateProvince);
    if (address.postalCode) parts.push(address.postalCode);
    if (address.countryCode) parts.push(address.countryCode);
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
          <h1 className="text-3xl font-bold">{vendor.displayName || vendor.name}</h1>
          <Badge className={getStatusBadgeColor(vendor.status)}>
            {vendor.status}
          </Badge>
        </div>
        <Button onClick={() => router.push(`/relationships/vendors/${id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Vendor
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Vendor Information</CardTitle>
            <CardDescription>Basic details about the vendor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Vendor Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{vendor.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Display Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{vendor.displayName || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Vendor Code</dt>
                <dd className="mt-1 text-sm text-gray-900">{vendor.code || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Tax ID</dt>
                <dd className="mt-1 text-sm text-gray-900">{vendor.taxId || 'N/A'}</dd>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Contact Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {vendor.email ? (
                        <a href={`mailto:${vendor.email}`} className="text-blue-600 hover:underline">
                          {vendor.email}
                        </a>
                      ) : (
                        'N/A'
                      )}
                    </dd>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Phone</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {vendor.phone ? (
                        <a href={`tel:${vendor.phone}`} className="text-blue-600 hover:underline">
                          {vendor.phone}
                        </a>
                      ) : (
                        'N/A'
                      )}
                    </dd>
                  </div>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <Globe className="h-4 w-4 text-gray-400" />
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Website</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {vendor.website ? (
                        <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {vendor.website}
                        </a>
                      ) : (
                        'N/A'
                      )}
                    </dd>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Address</h3>
              <dd className="mt-1 text-sm text-gray-900">{formatAddress(vendor.address)}</dd>
            </div>

            {metadata && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Additional Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  {paymentTerms && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Payment Terms</dt>
                      <dd className="mt-1 text-sm text-gray-900">{paymentTerms}</dd>
                    </div>
                  )}
                  {vendorType && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Vendor Type</dt>
                      <dd className="mt-1 text-sm text-gray-900">{vendorType}</dd>
                    </div>
                  )}
                  {metadata.ein && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">EIN</dt>
                      <dd className="mt-1 text-sm text-gray-900">{metadata.ein}</dd>
                    </div>
                  )}
                  {metadata.defaultExpenseAccount && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Default Expense Account</dt>
                      <dd className="mt-1 text-sm text-gray-900">{metadata.defaultExpenseAccount}</dd>
                    </div>
                  )}
                  {metadata.w9OnFile !== undefined && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">W9 on File</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        <Badge variant={metadata.w9OnFile ? 'default' : 'secondary'}>
                          {metadata.w9OnFile ? 'Yes' : 'No'}
                        </Badge>
                      </dd>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(vendor.description || vendor.notes) && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Notes</h3>
                {vendor.description && (
                  <div className="mb-3">
                    <dt className="text-sm font-medium text-gray-500">Description</dt>
                    <dd className="mt-1 text-sm text-gray-900">{vendor.description}</dd>
                  </div>
                )}
                {vendor.notes && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Internal Notes</dt>
                    <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{vendor.notes}</dd>
                  </div>
                )}
              </div>
            )}

            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(vendor.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(vendor.updatedAt)}</dd>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contacts associated with this vendor */}
        <EntityContactsList
          entityId={vendor.id}
          entityName="vendor"
        />
      </div>
    </div>
  );
}
