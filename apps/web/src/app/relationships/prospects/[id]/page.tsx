'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/lib/trpc';
import { ArrowLeft, Pencil, Trash2, ArrowRight, Globe, Mail, Phone, Calendar, Building } from 'lucide-react';
import { toast } from 'sonner';

export default function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: prospect, isLoading } = trpc.prospects.getById.useQuery({ id });

  const deleteMutation = trpc.prospects.delete.useMutation({
    onSuccess: () => {
      toast.success('Prospect deleted successfully');
      router.push('/relationships/prospects');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete prospect');
    },
  });

  const convertToLeadMutation = trpc.prospects.convertToLead.useMutation({
    onSuccess: () => {
      toast.success('Successfully converted prospect to lead');
      router.push('/relationships/leads');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to convert prospect to lead');
    },
  });

  const convertToCustomerMutation = trpc.prospects.convertToCustomer.useMutation({
    onSuccess: () => {
      toast.success('Successfully converted prospect to customer');
      router.push('/relationships/customers');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to convert prospect to customer');
    },
  });

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this prospect?')) {
      deleteMutation.mutate({ id });
    }
  };

  const handleConvert = (convertTo: 'lead' | 'customer') => {
    const confirmMsg = convertTo === 'lead' 
      ? 'Convert this prospect to a lead?' 
      : 'Convert this prospect directly to a customer?';
      
    if (!confirm(confirmMsg)) return;
    
    if (convertTo === 'lead') {
      convertToLeadMutation.mutate({ id });
    } else {
      convertToCustomerMutation.mutate({ id });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) return <div>Loading...</div>;
  if (!prospect) return <div>Prospect not found</div>;

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/relationships/prospects')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Prospects
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">{prospect.name}</CardTitle>
                <CardDescription>
                  {prospect.legalName && prospect.legalName !== prospect.name && (
                    <span>Legal Name: {prospect.legalName}</span>
                  )}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/relationships/prospects/${id}/edit`)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleConvert('lead')}
                  disabled={convertToLeadMutation.isPending}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Convert to Lead
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleConvert('customer')}
                  disabled={convertToCustomerMutation.isPending}
                >
                  <ArrowRight className="h-4 w-4 mr-2 rotate-45" />
                  Convert to Customer
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Badge variant={prospect.isActive ? 'default' : 'secondary'}>
                {prospect.isActive ? 'Active' : 'Inactive'}
              </Badge>
              {prospect.entityId && (
                <span className="text-sm text-muted-foreground">
                  ID: {prospect.entityId}
                </span>
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold">Contact Information</h3>
                
                {prospect.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${prospect.email}`} className="text-primary hover:underline">
                      {prospect.email}
                    </a>
                  </div>
                )}

                {prospect.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${prospect.phone}`} className="text-primary hover:underline">
                      {prospect.phone}
                    </a>
                  </div>
                )}

                {prospect.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a 
                      href={prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {prospect.website}
                    </a>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Prospect Details</h3>
                
                {prospect.metadata?.prospect_source && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Source:</span> {prospect.metadata.prospect_source}
                  </div>
                )}

                {prospect.metadata?.industry && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    {prospect.metadata.industry}
                  </div>
                )}

                {prospect.metadata?.annualRevenue && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Annual Revenue:</span> {formatCurrency(prospect.metadata.annualRevenue)}
                  </div>
                )}

                {prospect.metadata?.numberOfEmployees && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Employees:</span> {prospect.metadata.numberOfEmployees}
                  </div>
                )}

                {prospect.metadata?.qualification_score !== undefined && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Qualification Score:</span> {prospect.metadata.qualification_score}/100
                  </div>
                )}
              </div>
            </div>

            {(prospect.notes || prospect.metadata?.next_action || prospect.metadata?.follow_up_date) && (
              <>
                <Separator />
                <div className="space-y-4">
                  {prospect.notes && (
                    <div>
                      <h3 className="font-semibold mb-2">Notes</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{prospect.notes}</p>
                    </div>
                  )}

                  {prospect.metadata?.next_action && (
                    <div>
                      <h3 className="font-semibold mb-2">Next Action</h3>
                      <p className="text-sm text-muted-foreground">{prospect.metadata.next_action}</p>
                    </div>
                  )}

                  {prospect.metadata?.follow_up_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Follow-up Date:</span> {formatDate(prospect.metadata.follow_up_date)}
                    </div>
                  )}
                </div>
              </>
            )}

            <Separator />

            <div className="text-sm text-muted-foreground">
              <p>Created: {formatDate(prospect.createdAt)}</p>
              <p>Updated: {formatDate(prospect.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}