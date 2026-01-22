'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/lib/trpc';
import { ArrowLeft, Pencil, Trash2, Mail, Phone, Building, User, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: contact, isLoading } = trpc.contacts.getById.useQuery({ id });
  const { data: customersData } = trpc.customers.list.useQuery({});
  const { data: vendorsData } = trpc.vendors.list.useQuery({});

  const deleteMutation = trpc.contacts.delete.useMutation({
    onSuccess: () => {
      toast.success('Contact deleted successfully');
      router.push('/relationships/contacts');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete contact');
    },
  });

  const companies = [
    ...(customersData || []),
    ...(vendorsData || [])
  ];

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this contact?')) {
      deleteMutation.mutate({ id });
    }
  };

  const getCompanyName = () => {
    const companyId = contact?.metadata?.company || contact?.parentEntityId;
    if (!companyId) return null;
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Unknown Company';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getContactMethodIcon = (method: string) => {
    switch (method) {
      case 'email': return '✉️';
      case 'phone': return '📞';
      case 'mobile': return '📱';
      default: return '✉️';
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (!contact) return <div>Contact not found</div>;

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/relationships/contacts')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Contacts
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">{contact.name}</CardTitle>
                <CardDescription>
                  {contact.legalName && contact.legalName !== contact.name && (
                    <span>Legal Name: {contact.legalName}</span>
                  )}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/relationships/contacts/${id}/edit`)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
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
              <Badge variant={contact.isActive ? 'default' : 'secondary'}>
                {contact.isActive ? 'Active' : 'Inactive'}
              </Badge>
              {contact.entityId && (
                <span className="text-sm text-muted-foreground">
                  ID: {contact.entityId}
                </span>
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold">Contact Information</h3>
                
                {contact.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                      {contact.email}
                    </a>
                  </div>
                )}

                {contact.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${contact.phone}`} className="text-primary hover:underline">
                      {contact.phone}
                    </a>
                  </div>
                )}

                {contact.metadata?.mobilePhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${contact.metadata.mobilePhone}`} className="text-primary hover:underline">
                      {contact.metadata.mobilePhone} (Mobile)
                    </a>
                  </div>
                )}

                {contact.metadata?.workPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${contact.metadata.workPhone}`} className="text-primary hover:underline">
                      {contact.metadata.workPhone} (Work)
                    </a>
                  </div>
                )}

                {contact.metadata?.preferred_communication && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Preferred Contact Method:</span>{' '}
                    {getContactMethodIcon(contact.metadata.preferred_communication)}{' '}
                    {contact.metadata.preferred_communication.charAt(0).toUpperCase() + contact.metadata.preferred_communication.slice(1)}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Professional Details</h3>
                
                {getCompanyName() && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    {getCompanyName()}
                  </div>
                )}

                {contact.metadata?.title && (
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    {contact.metadata.title}
                  </div>
                )}

                {contact.metadata?.department && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Department:</span> {contact.metadata.department}
                  </div>
                )}

                {(contact.metadata?.first_name || contact.metadata?.last_name) && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {contact.metadata.first_name} {contact.metadata.last_name}
                  </div>
                )}

                {contact.metadata?.contact_type && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Contact Type:</span> {contact.metadata.contact_type}
                  </div>
                )}
              </div>
            </div>

            {contact.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.notes}</p>
                </div>
              </>
            )}

            <Separator />

            <div className="text-sm text-muted-foreground">
              <p>Created: {formatDate(contact.createdAt)}</p>
              <p>Updated: {formatDate(contact.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}