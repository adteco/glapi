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
import { apiEndpoints } from '@/lib/api';
import { Eye, Pencil, Trash2, Plus } from 'lucide-react';

interface ContactMetadata {
  title?: string;
  department?: string;
  mobilePhone?: string;
  workPhone?: string;
  preferredContactMethod?: 'email' | 'phone' | 'mobile';
}

interface Contact {
  id: string;
  name: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  parentEntityId?: string | null;
  metadata?: ContactMetadata | null;
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Entity {
  id: string;
  name: string;
  entityTypes: string[];
}

export default function ContactsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    email: '',
    phone: '',
    parentEntityId: '',
    status: 'active',
    metadata: {
      title: '',
      department: '',
      mobilePhone: '',
      workPhone: '',
      preferredContactMethod: 'email' as 'email' | 'phone' | 'mobile',
    }
  });

  useEffect(() => {
    fetchContacts();
    fetchCompanies();
  }, []);

  const fetchContacts = async () => {
    try {
      const token = await getToken();
      const response = await fetch(apiEndpoints.contacts, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        console.error('Fetch contacts failed:', response.status, response.statusText);
        throw new Error(`Failed to fetch contacts: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setContacts(data.data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const token = await getToken();
      // Fetch all customers and vendors to use as parent companies
      const [customersRes, vendorsRes] = await Promise.all([
        fetch(apiEndpoints.customers, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(apiEndpoints.vendors, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);
      
      const customers = await customersRes.json();
      const vendors = await vendorsRes.json();
      
      const allCompanies = [
        ...(customers.data || []),
        ...(vendors.data || [])
      ];
      
      setCompanies(allCompanies);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleCreate = async () => {
    try {
      const token = await getToken();
      const response = await fetch(apiEndpoints.contacts, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          displayName: formData.displayName || undefined,
          entityTypes: ['Contact'],
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          parentEntityId: formData.parentEntityId === 'none' ? undefined : formData.parentEntityId || undefined,
          status: formData.status,
          isActive: true,
          metadata: {
            title: formData.metadata.title || undefined,
            department: formData.metadata.department || undefined,
            mobilePhone: formData.metadata.mobilePhone || undefined,
            workPhone: formData.metadata.workPhone || undefined,
            preferredContactMethod: formData.metadata.preferredContactMethod || undefined,
          },
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Create contact error:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to create contact');
      }
      
      await fetchContacts();
      setIsCreateOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error creating contact:', error);
      alert(error instanceof Error ? error.message : 'Failed to create contact');
    }
  };

  const handleUpdate = async () => {
    if (!selectedContact) return;
    
    try {
      const token = await getToken();
      const response = await fetch(`${apiEndpoints.contacts}/${selectedContact.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          displayName: formData.displayName || undefined,
          entityTypes: ['Contact'],
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          parentEntityId: formData.parentEntityId === 'none' ? undefined : formData.parentEntityId || undefined,
          status: formData.status,
          isActive: true,
          metadata: {
            title: formData.metadata.title || undefined,
            department: formData.metadata.department || undefined,
            mobilePhone: formData.metadata.mobilePhone || undefined,
            workPhone: formData.metadata.workPhone || undefined,
            preferredContactMethod: formData.metadata.preferredContactMethod || undefined,
          },
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Update contact error:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to update contact');
      }
      
      await fetchContacts();
      setIsEditOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error updating contact:', error);
      alert(error instanceof Error ? error.message : 'Failed to update contact');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    
    try {
      const token = await getToken();
      const response = await fetch(`${apiEndpoints.contacts}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to delete contact');
      
      await fetchContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
    }
  };

  const openEditDialog = (contact: Contact) => {
    setSelectedContact(contact);
    setFormData({
      name: contact.name,
      displayName: contact.displayName || '',
      email: contact.email || '',
      phone: contact.phone || '',
      parentEntityId: contact.parentEntityId || '',
      status: contact.status,
      metadata: {
        title: contact.metadata?.title || '',
        department: contact.metadata?.department || '',
        mobilePhone: contact.metadata?.mobilePhone || '',
        workPhone: contact.metadata?.workPhone || '',
        preferredContactMethod: (contact.metadata?.preferredContactMethod || 'email') as 'email' | 'phone' | 'mobile',
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
      status: 'active',
      metadata: {
        title: '',
        department: '',
        mobilePhone: '',
        workPhone: '',
        preferredContactMethod: 'email',
      }
    });
    setSelectedContact(null);
  };

  const getCompanyName = (parentId: string | null | undefined) => {
    if (!parentId) return 'Independent';
    const company = companies.find(c => c.id === parentId);
    return company?.name || 'Unknown';
  };

  const getContactMethodIcon = (method: string) => {
    switch (method) {
      case 'email': return '✉️';
      case 'phone': return '📞';
      case 'mobile': return '📱';
      default: return '✉️';
    }
  };

  if (loading) return <div>Loading...</div>;

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
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name} {company.entityTypes ? `(${company.entityTypes.join(', ')})` : '(Customer)'}
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
                        value={formData.metadata.preferredContactMethod}
                        onValueChange={(value: 'email' | 'phone' | 'mobile') => setFormData({ 
                          ...formData, 
                          metadata: { ...formData.metadata, preferredContactMethod: value }
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
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate}>Create</Button>
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
                  <TableCell>{getCompanyName(contact.parentEntityId)}</TableCell>
                  <TableCell>{contact.metadata?.title || '-'}</TableCell>
                  <TableCell>{contact.metadata?.department || '-'}</TableCell>
                  <TableCell>{contact.email || '-'}</TableCell>
                  <TableCell>
                    {contact.phone || contact.metadata?.workPhone || contact.metadata?.mobilePhone || '-'}
                  </TableCell>
                  <TableCell>
                    <span title={contact.metadata?.preferredContactMethod || 'email'}>
                      {getContactMethodIcon(contact.metadata?.preferredContactMethod || 'email')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={contact.status === 'active' ? 'default' : 'secondary'}>
                      {contact.status}
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
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name} {company.entityTypes ? `(${company.entityTypes.join(', ')})` : '(Customer)'}
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
                  value={formData.metadata.preferredContactMethod}
                  onValueChange={(value: 'email' | 'phone' | 'mobile') => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, preferredContactMethod: value }
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}