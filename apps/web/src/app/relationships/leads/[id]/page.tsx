'use client';

import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Mail, Phone, Globe, TrendingUp, DollarSign, Users, ArrowRight } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { EntityContactsList } from '@/components/contacts';

export default function LeadDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { orgId } = useAuth();

  // Use tRPC query
  const { data: lead, isLoading: leadLoading } = trpc.leads.get.useQuery(
    { id },
    { 
      enabled: !!orgId && !!id,
      retry: 1,
    }
  );

  const convertToCustomerMutation = trpc.leads.convertToCustomer.useMutation({
    onSuccess: () => {
      toast.success('Lead converted to customer successfully');
      router.push('/relationships/customers');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to convert lead');
    },
  });

  const handleConvertToCustomer = () => {
    if (confirm('Convert this lead to a customer? This action cannot be undone.')) {
      convertToCustomerMutation.mutate({ id });
    }
  };

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view lead details.</p>
      </div>
    );
  }

  if (leadLoading) {
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

  if (!lead) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Lead Not Found</h1>
        </div>
        <p className="text-muted-foreground">The lead you're looking for doesn't exist or you don't have access to it.</p>
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

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-50';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">{lead.displayName || lead.name}</h1>
          <Badge className={getStatusBadgeColor(lead.status)}>
            {lead.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push(`/relationships/leads/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Lead
          </Button>
          <Button 
            variant="default" 
            onClick={handleConvertToCustomer}
            disabled={convertToCustomerMutation.isPending}
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            {convertToCustomerMutation.isPending ? 'Converting...' : 'Convert to Customer'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Lead Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold p-3 rounded-lg text-center ${getScoreColor(lead.metadata?.leadScore || 0)}`}>
                {lead.metadata?.leadScore || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Annual Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {lead.metadata?.annualRevenue ? formatCurrency(lead.metadata.annualRevenue) : 'N/A'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Employees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {lead.metadata?.numberOfEmployees || 'N/A'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lead Information</CardTitle>
            <CardDescription>Basic details about the lead</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Company Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{lead.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Display Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{lead.displayName || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Lead Source</dt>
                <dd className="mt-1 text-sm text-gray-900">{lead.metadata?.source || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Industry</dt>
                <dd className="mt-1 text-sm text-gray-900">{lead.metadata?.industry || 'N/A'}</dd>
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
                      {lead.email ? (
                        <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">
                          {lead.email}
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
                      {lead.phone ? (
                        <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">
                          {lead.phone}
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
                      {lead.website ? (
                        <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {lead.website}
                        </a>
                      ) : (
                        'N/A'
                      )}
                    </dd>
                  </div>
                </div>
              </div>
            </div>

            {lead.metadata?.assignedTo && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Assignment</h3>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Assigned To</dt>
                  <dd className="mt-1 text-sm text-gray-900">{lead.metadata.assignedTo}</dd>
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(lead.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(lead.updatedAt)}</dd>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contacts associated with this lead */}
        <EntityContactsList
          entityId={lead.id}
          entityName="lead"
        />
      </div>
    </div>
  );
}