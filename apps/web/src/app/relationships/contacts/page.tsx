'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import { Eye, Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface ContactMetadata {
  first_name?: string;
  last_name?: string;
  title?: string;
  company?: string;
  contact_type?: string;
  preferred_communication?: string;
  department?: string;
  mobilePhone?: string;
  workPhone?: string;
}

interface Contact {
  id: string;
  name: string;
  displayName?: string | null;
  entityId?: string | null;
  email?: string | null;
  phone?: string | null;
  parentEntityId?: string | null;
  metadata?: ContactMetadata | null;
  status?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Entity {
  id: string;
  name: string;
  entityTypes?: string[];
}

export default function ContactsPage() {
  const { orgId } = useAuth();
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // TRPC queries and mutations
  const { data: contactsData, isLoading, refetch } = trpc.contacts.list.useQuery({}, {
    enabled: !!orgId,
  });

  const { data: customersData } = trpc.customers.list.useQuery({}, {
    enabled: !!orgId,
  });

  const { data: vendorsData } = trpc.vendors.list.useQuery({}, {
    enabled: !!orgId,
  });

  const createContactMutation = trpc.contacts.create.useMutation({
    onSuccess: () => {
      toast.success('Contact created successfully');
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create contact');
    },
  });

  const updateContactMutation = trpc.contacts.update.useMutation({
    onSuccess: () => {
      toast.success('Contact updated successfully');
      setIsEditOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update contact');
    },
  });

  const deleteContactMutation = trpc.contacts.delete.useMutation({
    onSuccess: () => {
      toast.success('Contact deleted successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete contact');
    },
  });

  const contacts = contactsData?.data || [];
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

  const handleUpdate = async () => {
    if (!selectedContact) return;

    updateContactMutation.mutate({
      id: selectedContact.id,
      data: {
        name: formData.name,
        legalName: formData.displayName || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        isActive: true,
        metadata: {
          first_name: formData.metadata.first_name || undefined,
          last_name: formData.metadata.last_name || undefined,
          title: formData.metadata.title || undefined,
          company: formData.parentEntityId === 'none' ? undefined : formData.parentEntityId || undefined,
          contact_type: 'Individual',
          preferred_communication: formData.metadata.preferred_communication || undefined,
        },
      },
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    deleteContactMutation.mutate({ id });
  };

  const openEditDialog = (contact: Contact) => {
    setSelectedContact(contact);
    setFormData({
      name: contact.name,
      displayName: contact.displayName || '',
      email: contact.email || '',
      phone: contact.phone || '',
      parentEntityId: (contact.metadata as Record<string, string | undefined>)?.company || contact.parentEntityId || '',
      notes: '',  // notes field removed from Contact type
      metadata: {
        first_name: (contact.metadata as Record<string, string | undefined>)?.first_name || '',
        last_name: (contact.metadata as Record<string, string | undefined>)?.last_name || '',
        title: (contact.metadata as Record<string, string | undefined>)?.title || '',
        department: '',
        mobilePhone: '',
        workPhone: '',
        preferred_communication: (contact.metadata as Record<string, string | undefined>)?.preferred_communication || 'email',
      }
    });
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setFormData({
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
        preferred_communication: 'email',
      }
    });
    setSelectedContact(null);
  };

  const getCompanyName = (contact: Contact) => {
    const companyId = (contact.metadata as Record<string, string | undefined>)?.company || contact.parentEntityId;
    if (!companyId) return 'Independent';
    const company = companies.find(c => c.id === companyId);
    if (!company) return 'Unknown';
    // Handle both customer (companyName) and vendor (name) types
    return 'companyName' in company ? company.companyName : company.name;
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

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Contacts</CardTitle>
              <CardDescription>Manage contacts for your customers and vendors</CardDescription>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Contact</DialogTitle>
                  <DialogDescription>Add a new contact person</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
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
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={createContactMutation.isPending}>
                    {createContactMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Preferred</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">
                    {contact.displayName || contact.name}
                  </TableCell>
                  <TableCell>{getCompanyName(contact)}</TableCell>
                  <TableCell>{contact.metadata?.title || '-'}</TableCell>
                  <TableCell>{contact.metadata?.department || '-'}</TableCell>
                  <TableCell>{contact.email || '-'}</TableCell>
                  <TableCell>
                    {contact.phone || contact.metadata?.workPhone || contact.metadata?.mobilePhone || '-'}
                  </TableCell>
                  <TableCell>
                    <span title={contact.metadata?.preferred_communication || 'email'}>
                      {getContactMethodIcon(contact.metadata?.preferred_communication || 'email')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={contact.isActive ? 'default' : 'secondary'}>
                      {contact.isActive ? 'active' : 'inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => router.push(`/relationships/contacts/${contact.id}`)}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => openEditDialog(contact)}
                        title="Edit contact"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDelete(contact.id)}
                        disabled={deleteContactMutation.isPending}
                        title="Delete contact"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {contacts.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              No contacts found. Add contacts to track key people at customer and vendor companies.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>Update contact information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name*</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-parentEntityId">Company</Label>
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
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Primary Phone</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-title">Job Title</Label>
                <Input
                  id="edit-title"
                  value={formData.metadata.title}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, title: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-department">Department</Label>
                <Input
                  id="edit-department"
                  value={formData.metadata.department}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, department: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-mobilePhone">Mobile Phone</Label>
                <Input
                  id="edit-mobilePhone"
                  value={formData.metadata.mobilePhone}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, mobilePhone: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-workPhone">Work Phone</Label>
                <Input
                  id="edit-workPhone"
                  value={formData.metadata.workPhone}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, workPhone: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-preferredContactMethod">Preferred Contact Method</Label>
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
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this contact"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateContactMutation.isPending}>
              {updateContactMutation.isPending ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}