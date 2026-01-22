'use client';

import { useState } from 'react';
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
import type { RouterOutputs } from '@glapi/trpc';

// Use TRPC inferred types to prevent type drift
type Customer = RouterOutputs['customers']['list'][number];

// Client uses Customer directly - dates are handled as Date objects
type Client = Customer;

// Form-specific type for local state (not API shape)
interface FormData {
  name: string;
  displayName: string;
  code: string;
  email: string;
  phone: string;
  website: string;
  taxId: string;
  description: string;
  notes: string;
  status: string;
  parentClientId: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

interface ClientFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  clients: Client[];
  currentClientId?: string;
}

const ClientForm: React.FC<ClientFormProps> = ({ formData, setFormData, clients, currentClientId }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="name">Client Name*</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="displayName">Display Name</Label>
        <Input
          id="displayName"
          value={formData.displayName}
          onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="code">Client ID</Label>
        <Input
          id="code"
          value={formData.code}
          onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="taxId">Tax ID</Label>
        <Input
          id="taxId"
          value={formData.taxId}
          onChange={(e) => setFormData(prev => ({ ...prev, taxId: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          value={formData.website}
          onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={formData.status}
          onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="parentClient">Parent Client</Label>
      <Select
        value={formData.parentClientId}
        onValueChange={(value) => setFormData(prev => ({ ...prev, parentClientId: value }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select parent client (optional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {clients
            .filter(c => c.id !== currentClientId)
            .map(client => (
              <SelectItem key={client.id} value={client.id}>
                {client.companyName} {client.customerId ? `(${client.customerId})` : ''}
              </SelectItem>
            ))
          }
        </SelectContent>
      </Select>
    </div>

    <div className="space-y-2">
      <Label>Billing Address</Label>
      <div className="space-y-4">
        <Input
          placeholder="Street Address"
          value={formData.address.street}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            address: { ...prev.address, street: e.target.value }
          }))}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            placeholder="City"
            value={formData.address.city}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              address: { ...prev.address, city: e.target.value }
            }))}
          />
          <Input
            placeholder="State/Province"
            value={formData.address.state}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              address: { ...prev.address, state: e.target.value }
            }))}
          />
          <Input
            placeholder="Postal Code"
            value={formData.address.postalCode}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              address: { ...prev.address, postalCode: e.target.value }
            }))}
          />
          <Input
            placeholder="Country (e.g., United States)"
            value={formData.address.country}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              address: { ...prev.address, country: e.target.value }
            }))}
          />
        </div>
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="description">Description</Label>
      <Textarea
        id="description"
        value={formData.description}
        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
        rows={3}
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor="notes">Notes</Label>
      <Textarea
        id="notes"
        value={formData.notes}
        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
        rows={3}
      />
    </div>
  </div>
);

export default function ClientsPage() {
  const { orgId, isLoaded } = useAuth();
  const router = useRouter();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    code: '',
    email: '',
    phone: '',
    website: '',
    taxId: '',
    description: '',
    notes: '',
    status: 'active',
    parentClientId: 'none',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    }
  });

  // TRPC queries and mutations - reusing customers endpoint
  const { data: clientsData, isLoading, refetch } = trpc.customers.list.useQuery({}, {
    enabled: !!orgId,
  });

  const createClientMutation = trpc.customers.create.useMutation({
    onSuccess: () => {
      toast.success('Client created successfully');
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create client');
    },
  });

  const updateClientMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      toast.success('Client updated successfully');
      setIsEditOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update client');
    },
  });

  const deleteClientMutation = trpc.customers.delete.useMutation({
    onSuccess: () => {
      toast.success('Client deleted successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete client');
    },
  });

  const clients = (clientsData || []).map(client => ({
    ...client,
    id: client.id || '',
    createdAt: client.createdAt?.toString() || new Date().toISOString(),
    updatedAt: client.updatedAt?.toString() || new Date().toISOString(),
  }));

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error('Client name is required');
      return;
    }

    createClientMutation.mutate({
      companyName: formData.name,
      customerId: formData.code || undefined,
      contactEmail: formData.email || undefined,
      contactPhone: formData.phone || undefined,
      status: formData.status as 'active' | 'inactive' | 'archived',
      parentCustomerId: formData.parentClientId && formData.parentClientId !== 'none' ? formData.parentClientId : undefined,
      billingAddress: formData.address.street || formData.address.city ? {
        street: formData.address.street || undefined,
        city: formData.address.city || undefined,
        state: formData.address.state || undefined,
        postalCode: formData.address.postalCode || undefined,
        country: formData.address.country || undefined,
      } : undefined,
    });
  };

  const handleUpdate = async () => {
    if (!selectedClient) return;

    updateClientMutation.mutate({
      id: selectedClient.id,
      data: {
        companyName: formData.name,
        customerId: formData.code || undefined,
        contactEmail: formData.email || undefined,
        contactPhone: formData.phone || undefined,
        taxId: formData.taxId || undefined,
        status: formData.status as 'active' | 'inactive' | 'archived',
        parentCustomerId: formData.parentClientId && formData.parentClientId !== 'none' ? formData.parentClientId : undefined,
        billingAddress: formData.address.street || formData.address.city ? {
          street: formData.address.street || undefined,
          city: formData.address.city || undefined,
          state: formData.address.state || undefined,
          postalCode: formData.address.postalCode || undefined,
          country: formData.address.country || undefined,
        } : undefined,
      },
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return;

    deleteClientMutation.mutate({ id });
  };

  const openEditDialog = (client: Client) => {
    setSelectedClient(client);
    setFormData({
      name: client.companyName || '',
      displayName: '',
      code: client.customerId || '',
      email: client.contactEmail || '',
      phone: client.contactPhone || '',
      website: '',
      taxId: '',
      description: '',
      notes: '',
      status: client.status || 'active',
      parentClientId: client.parentCustomerId || 'none',
      address: {
        street: client.billingAddress?.street || '',
        city: client.billingAddress?.city || '',
        state: client.billingAddress?.state || '',
        postalCode: client.billingAddress?.postalCode || '',
        country: client.billingAddress?.country || '',
      }
    });
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      code: '',
      email: '',
      phone: '',
      website: '',
      taxId: '',
      description: '',
      notes: '',
      status: 'active',
      parentClientId: 'none',
      address: {
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      }
    });
    setSelectedClient(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading clients...</p></div>;
  }

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view clients.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Clients</CardTitle>
              <CardDescription>Manage your client relationships</CardDescription>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Client
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Client</DialogTitle>
                  <DialogDescription>
                    Add a new client to your organization
                  </DialogDescription>
                </DialogHeader>
                <ClientForm formData={formData} setFormData={setFormData} clients={clients} />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={createClientMutation.isPending}>
                    {createClientMutation.isPending ? 'Creating...' : 'Create'}
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
                <TableHead>Client ID</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">
                    {client.companyName}
                  </TableCell>
                  <TableCell>{client.customerId || '-'}</TableCell>
                  <TableCell>
                    {client.parentCustomerId ?
                      clients.find(c => c.id === client.parentCustomerId)?.companyName || '-'
                      : '-'
                    }
                  </TableCell>
                  <TableCell>{client.contactEmail || '-'}</TableCell>
                  <TableCell>{client.contactPhone || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                      {client.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(client.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/clients/${client.id}`)}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(client)}
                        title="Edit client"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(client.id)}
                        title="Delete client"
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

          {clients.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              No clients found. Create your first client to get started.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>
              Update client information
            </DialogDescription>
          </DialogHeader>
          <ClientForm formData={formData} setFormData={setFormData} clients={clients} currentClientId={selectedClient?.id} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateClientMutation.isPending}>
              {updateClientMutation.isPending ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
