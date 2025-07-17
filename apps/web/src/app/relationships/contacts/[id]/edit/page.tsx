'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/lib/trpc';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: contact, isLoading } = trpc.contacts.getById.useQuery({ id });
  const { data: customersData } = trpc.customers.list.useQuery({});
  const { data: vendorsData } = trpc.vendors.list.useQuery({});

  const updateMutation = trpc.contacts.update.useMutation({
    onSuccess: () => {
      toast.success('Contact updated successfully');
      router.push(`/relationships/contacts/${id}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update contact');
    },
  });

  const companies = [
    ...(customersData?.data || []),
    ...(vendorsData?.data || [])
  ];

  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    entityId: '',
    email: '',
    phone: '',
    website: '',
    notes: '',
    taxIdNumber: '',
    isActive: true,
    parentEntityId: '',
    metadata: {
      first_name: '',
      last_name: '',
      title: '',
      department: '',
      mobilePhone: '',
      workPhone: '',
      preferred_communication: 'email',
      contact_type: 'Individual',
    }
  });

  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name || '',
        legalName: contact.legalName || '',
        entityId: contact.entityId || '',
        email: contact.email || '',
        phone: contact.phone || '',
        website: contact.website || '',
        notes: contact.notes || '',
        taxIdNumber: contact.taxIdNumber || '',
        isActive: contact.isActive ?? true,
        parentEntityId: contact.metadata?.company || contact.parentEntityId || '',
        metadata: {
          first_name: contact.metadata?.first_name || '',
          last_name: contact.metadata?.last_name || '',
          title: contact.metadata?.title || '',
          department: contact.metadata?.department || '',
          mobilePhone: contact.metadata?.mobilePhone || '',
          workPhone: contact.metadata?.workPhone || '',
          preferred_communication: contact.metadata?.preferred_communication || 'email',
          contact_type: contact.metadata?.contact_type || 'Individual',
        }
      });
    }
  }, [contact]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error('Full name is required');
      return;
    }

    updateMutation.mutate({
      id,
      data: {
        name: formData.name,
        legalName: formData.legalName || undefined,
        entityId: formData.entityId || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        website: formData.website || undefined,
        notes: formData.notes || undefined,
        taxIdNumber: formData.taxIdNumber || undefined,
        isActive: formData.isActive,
        metadata: {
          first_name: formData.metadata.first_name || undefined,
          last_name: formData.metadata.last_name || undefined,
          title: formData.metadata.title || undefined,
          company: formData.parentEntityId === 'none' ? undefined : formData.parentEntityId || undefined,
          department: formData.metadata.department || undefined,
          mobilePhone: formData.metadata.mobilePhone || undefined,
          workPhone: formData.metadata.workPhone || undefined,
          preferred_communication: formData.metadata.preferred_communication || undefined,
          contact_type: formData.metadata.contact_type || undefined,
        },
      },
    });
  };

  if (isLoading) return <div>Loading...</div>;
  if (!contact) return <div>Contact not found</div>;

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push(`/relationships/contacts/${id}`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Contact
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Edit Contact</CardTitle>
            <CardDescription>Update contact information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name*</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalName">Legal Name</Label>
                <Input
                  id="legalName"
                  value={formData.legalName}
                  onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parentEntityId">Company</Label>
                <Select
                  value={formData.parentEntityId}
                  onValueChange={(value) => setFormData({ ...formData, parentEntityId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Company (Independent)</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name} {company.entityTypes ? `(${company.entityTypes.join(', ')})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="entityId">Entity ID</Label>
                <Input
                  id="entityId"
                  value={formData.entityId}
                  onChange={(e) => setFormData({ ...formData, entityId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Primary Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.metadata.first_name}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, first_name: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.metadata.last_name}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, last_name: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Job Title</Label>
                <Input
                  id="title"
                  value={formData.metadata.title}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, title: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.metadata.department}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, department: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobilePhone">Mobile Phone</Label>
                <Input
                  id="mobilePhone"
                  value={formData.metadata.mobilePhone}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, mobilePhone: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workPhone">Work Phone</Label>
                <Input
                  id="workPhone"
                  value={formData.metadata.workPhone}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, workPhone: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredContactMethod">Preferred Contact Method</Label>
                <Select
                  value={formData.metadata.preferred_communication}
                  onValueChange={(value) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, preferred_communication: value }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this contact"
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/relationships/contacts/${id}`)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}