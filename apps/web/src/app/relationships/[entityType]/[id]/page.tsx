'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Building2, Mail, Phone, Globe } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useApiClient } from '@/lib/api-client.client';
import { toast } from 'sonner';

interface EntityDetails {
  id: string;
  name?: string;
  companyName?: string;
  displayName?: string | null;
  code?: string | null;
  email?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  status: string;
  entityTypes?: string[];
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

interface Contact {
  id: string;
  name: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  metadata?: {
    title?: string;
    department?: string;
    preferredContactMethod?: string;
  };
  status: string;
}

export default function EntityDashboard() {
  const params = useParams();
  const router = useRouter();
  const { orgId } = useAuth();
  const { apiGet, apiPost } = useApiClient();
  const [entity, setEntity] = useState<EntityDetails | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [contactFormData, setContactFormData] = useState({
    name: '',
    displayName: '',
    email: '',
    phone: '',
    title: '',
    department: '',
    preferredContactMethod: 'email',
  });
  const previousOrgIdRef = useRef<string | null>(null);

  const entityType = params.entityType as string;
  const entityId = params.id as string;

  // Map entity types to API endpoints
  const getApiEndpoint = (type: string) => {
    const endpoints: Record<string, string> = {
      'customers': '/api/customers',
      'vendors': '/api/vendors',
      'leads': '/api/leads',
      'prospects': '/api/prospects',
    };
    return endpoints[type];
  };

  // Get display name for entity type
  const getEntityTypeName = (type: string) => {
    const names: Record<string, string> = {
      'customers': 'Customer',
      'vendors': 'Vendor',
      'leads': 'Lead',
      'prospects': 'Prospect',
    };
    return names[type] || type;
  };

  const fetchEntityDetails = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    
    try {
      const endpoint = getApiEndpoint(entityType);
      const data = await apiGet<any>(`${endpoint}/${entityId}`);
      
      // Handle different response formats
      setEntity(data.customer || data.vendor || data.lead || data.prospect || data);
    } catch (error) {
      console.error('Error fetching entity details:', error);
      toast.error('Failed to fetch entity details');
    } finally {
      setLoading(false);
    }
  }, [orgId, entityType, entityId, apiGet]);

  const fetchContacts = useCallback(async () => {
    if (!orgId) {
      return;
    }
    
    try {
      // First fetch all contacts, then filter by parentEntityId
      // This is a temporary solution until the API supports filtering
      const data = await apiGet<{ data: Contact[] }>('/api/contacts');
      
      // Filter contacts that belong to this entity
      const entityContacts = (data.data || []).filter(
        (contact: any) => contact.parentEntityId === entityId
      );
      setContacts(entityContacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Failed to fetch contacts');
    }
  }, [orgId, entityId, apiGet]);

  // Clear data and refetch when organization changes
  useEffect(() => {
    if (orgId && orgId !== previousOrgIdRef.current) {
      // Clear existing data immediately when org changes
      setEntity(null);
      setContacts([]);
      previousOrgIdRef.current = orgId;
    }
    fetchEntityDetails();
    fetchContacts();
  }, [orgId, fetchEntityDetails, fetchContacts]);

  const handleAddContact = async () => {
    try {
      if (!orgId) {
        toast.error('Organization not selected.');
        return;
      }

      await apiPost('/api/contacts', {
        name: contactFormData.name,
        displayName: contactFormData.displayName || undefined,
        entityTypes: ['Contact'],
        email: contactFormData.email || undefined,
        phone: contactFormData.phone || undefined,
        parentEntityId: entityId,
        status: 'active',
        isActive: true,
        metadata: {
          title: contactFormData.title || undefined,
          department: contactFormData.department || undefined,
          preferredContactMethod: contactFormData.preferredContactMethod,
        },
      });
      
      toast.success('Contact added successfully');
      await fetchContacts();
      setIsAddContactOpen(false);
      resetContactForm();
    } catch (error) {
      console.error('Error adding contact:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add contact');
    }
  };

  const resetContactForm = () => {
    setContactFormData({
      name: '',
      displayName: '',
      email: '',
      phone: '',
      title: '',
      department: '',
      preferredContactMethod: 'email',
    });
  };

  if (loading) {
    return <div className="container mx-auto py-10">Loading...</div>;
  }

  if (!entity) {
    return <div className="container mx-auto py-10">Entity not found</div>;
  }

  const displayName = entity.name || entity.companyName || 'Unknown';
  const displayEmail = entity.email || entity.contactEmail || '-';
  const displayPhone = entity.phone || entity.contactPhone || '-';

  return (
    <div className="w-full max-w-full py-6">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/relationships/${entityType}`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to {getEntityTypeName(entityType)}s
        </Button>
        
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Building2 className="h-6 w-6" />
                  {displayName}
                </CardTitle>
                <CardDescription className="mt-2">
                  <div className="flex gap-4 flex-wrap">
                    <Badge variant={entity.status === 'active' ? 'default' : 'secondary'}>
                      {entity.status}
                    </Badge>
                    <Badge variant="outline">
                      {entity.entityTypes ? entity.entityTypes.join(', ') : getEntityTypeName(entityType)}
                    </Badge>
                    {entity.code && (
                      <span className="text-sm text-muted-foreground">
                        Code: {entity.code}
                      </span>
                    )}
                  </div>
                </CardDescription>
              </div>
              <div className="text-right space-y-1">
                {displayEmail !== '-' && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4" />
                    <a href={`mailto:${displayEmail}`} className="hover:underline">
                      {displayEmail}
                    </a>
                  </div>
                )}
                {displayPhone !== '-' && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4" />
                    <a href={`tel:${displayPhone}`} className="hover:underline">
                      {displayPhone}
                    </a>
                  </div>
                )}
                {entity.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4" />
                    <a href={entity.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {entity.website}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="contacts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Contacts</CardTitle>
                  <CardDescription>
                    Manage contacts for {displayName}
                  </CardDescription>
                </div>
                <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Contact
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Contact</DialogTitle>
                      <DialogDescription>
                        Add a contact person for {displayName}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="contact-name">Name*</Label>
                        <Input
                          id="contact-name"
                          value={contactFormData.name}
                          onChange={(e) => setContactFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contact-title">Title</Label>
                        <Input
                          id="contact-title"
                          value={contactFormData.title}
                          onChange={(e) => setContactFormData(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Sales Manager"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contact-department">Department</Label>
                        <Input
                          id="contact-department"
                          value={contactFormData.department}
                          onChange={(e) => setContactFormData(prev => ({ ...prev, department: e.target.value }))}
                          placeholder="Sales"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contact-email">Email</Label>
                        <Input
                          id="contact-email"
                          type="email"
                          value={contactFormData.email}
                          onChange={(e) => setContactFormData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="john@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contact-phone">Phone</Label>
                        <Input
                          id="contact-phone"
                          value={contactFormData.phone}
                          onChange={(e) => setContactFormData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="+1 234 567 8900"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contact-method">Preferred Contact Method</Label>
                        <Select
                          value={contactFormData.preferredContactMethod}
                          onValueChange={(value) => setContactFormData(prev => ({ ...prev, preferredContactMethod: value }))}
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
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddContactOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddContact}>Add Contact</Button>
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
                    <TableHead>Title</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No contacts found. Add a contact to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">
                          {contact.displayName || contact.name}
                        </TableCell>
                        <TableCell>{contact.metadata?.title || '-'}</TableCell>
                        <TableCell>{contact.metadata?.department || '-'}</TableCell>
                        <TableCell>{contact.email || '-'}</TableCell>
                        <TableCell>{contact.phone || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={contact.status === 'active' ? 'default' : 'secondary'}>
                            {contact.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab (Placeholder) */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>
                Transaction history for {displayName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg mb-2">Transactions coming soon</p>
                <p className="text-sm">This feature is under development</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}