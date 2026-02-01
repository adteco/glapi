'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

function NewContactPageContent() {
  const { orgId } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  const { data: customersData } = trpc.customers.list.useQuery({}, {
    enabled: !!orgId,
  });

  const { data: vendorsData } = trpc.vendors.list.useQuery({}, {
    enabled: !!orgId,
  });

  const createContactMutation = trpc.contacts.create.useMutation({
    onSuccess: () => {
      toast.success('Contact created successfully');
      if (returnTo) {
        router.push(returnTo);
      } else {
        router.push('/relationships/contacts');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create contact');
    },
  });

  const companies = [
    ...(Array.isArray(customersData) ? customersData : customersData?.data || []),
    ...(Array.isArray(vendorsData) ? vendorsData : vendorsData?.data || [])
  ];

  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    email: '',
    phone: '',
    parentEntityId: '',
    notes: '',
    metadata: {
      first_name: '',
      last_name: '',
      title: '',
      department: '',
      mobilePhone: '',
      workPhone: '',
      preferred_communication: 'email' as string,
    }
  });

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error('Full name is required');
      return;
    }

    createContactMutation.mutate({
      name: formData.name,
      legalName: formData.displayName || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      notes: formData.notes || undefined,
      isActive: true,
      metadata: {
        first_name: formData.metadata.first_name || undefined,
        last_name: formData.metadata.last_name || undefined,
        title: formData.metadata.title || undefined,
        company: formData.parentEntityId === 'none' ? undefined : formData.parentEntityId || undefined,
        contact_type: 'Individual',
        preferred_communication: formData.metadata.preferred_communication || undefined,
      },
    });
  };

  const handleCancel = () => {
    if (returnTo) {
      router.push(returnTo);
    } else {
      router.push('/relationships/contacts');
    }
  };

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to create contacts.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Contact</h1>
          <p className="text-muted-foreground">Add a new contact person</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>Enter the details for the new contact</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                required
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
                  {companies.filter(c => c.id).map((company) => (
                    <SelectItem key={company.id} value={company.id!}>
                      {'companyName' in company ? company.companyName : company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Primary Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
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
                placeholder="Sales Manager"
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
                placeholder="Sales"
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
                placeholder="+1 (555) 000-0001"
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
                placeholder="+1 (555) 000-0002"
              />
            </div>
            <div className="space-y-2 col-span-2">
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about this contact"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createContactMutation.isPending}>
              {createContactMutation.isPending ? 'Creating...' : 'Create Contact'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Wrap in Suspense for useSearchParams() compatibility with Next.js 15 static generation
export default function NewContactPage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-10">Loading...</div>}>
      <NewContactPageContent />
    </Suspense>
  );
}
