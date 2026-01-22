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
  parentCustomerId: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

interface CustomerFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  customers: Customer[];
  currentCustomerId?: string;
}

// Move CustomerForm outside of the main component
const CustomerForm: React.FC<CustomerFormProps> = ({ formData, setFormData, customers, currentCustomerId }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="name">Company Name*</Label>
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
        <Label htmlFor="code">Customer Code</Label>
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
      <Label htmlFor="parentCustomer">Parent Customer</Label>
      <Select
        value={formData.parentCustomerId}
        onValueChange={(value) => setFormData(prev => ({ ...prev, parentCustomerId: value }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select parent customer (optional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {customers
            .filter(c => c.id !== currentCustomerId) // Don't show current customer as its own parent
            .map(customer => (
              <SelectItem key={customer.id} value={customer.id}>
                {customer.companyName} {customer.customerId ? `(${customer.customerId})` : ''}
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

export default function CustomersPage() {
  const { orgId, isLoaded } = useAuth();
  const router = useRouter();
  
  console.log('[CustomersPage] Auth state:', { orgId, isLoaded });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
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
    parentCustomerId: 'none',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    }
  });

  // TRPC queries and mutations
  const { data: customersData, isLoading, refetch } = trpc.customers.list.useQuery({}, {
    enabled: !!orgId,
    onError: (error) => {
      console.error('[CustomersPage] Query error:', error);
    },
    onSuccess: (data) => {
      console.log('[CustomersPage] Query success:', data);
    }
  });
  
  const createCustomerMutation = trpc.customers.create.useMutation({
    onSuccess: () => {
      toast.success('Customer created successfully');
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create customer');
    },
  });
  
  const updateCustomerMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      toast.success('Customer updated successfully');
      setIsEditOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update customer');
    },
  });
  
  const deleteCustomerMutation = trpc.customers.delete.useMutation({
    onSuccess: () => {
      toast.success('Customer deleted successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete customer');
    },
  });

  const customers = (customersData || []).map(customer => ({
    ...customer,
    id: customer.id || '',
    createdAt: customer.createdAt?.toString() || new Date().toISOString(),
    updatedAt: customer.updatedAt?.toString() || new Date().toISOString(),
  }));

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error('Company name is required');
      return;
    }

    createCustomerMutation.mutate({
      companyName: formData.name,
      customerId: formData.code || undefined,
      contactEmail: formData.email || undefined,
      contactPhone: formData.phone || undefined,
      status: formData.status,
      parentCustomerId: formData.parentCustomerId && formData.parentCustomerId !== 'none' ? formData.parentCustomerId : undefined,
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
    if (!selectedCustomer) return;
    
    updateCustomerMutation.mutate({
      id: selectedCustomer.id,
      data: {
        companyName: formData.name,
        customerId: formData.code || undefined,
        contactEmail: formData.email || undefined,
        contactPhone: formData.phone || undefined,
        website: formData.website || undefined,
        taxId: formData.taxId || undefined,
        description: formData.description || undefined,
        notes: formData.notes || undefined,
        status: formData.status,
        parentCustomerId: formData.parentCustomerId && formData.parentCustomerId !== 'none' ? formData.parentCustomerId : undefined,
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
    if (!confirm('Are you sure you want to delete this customer?')) return;
    
    deleteCustomerMutation.mutate({ id });
  };

  const openEditDialog = (customer: any) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.companyName || '',
      displayName: customer.displayName || '',
      code: customer.customerId || '',
      email: customer.contactEmail || '',
      phone: customer.contactPhone || '',
      website: customer.website || '',
      taxId: customer.taxId || '',
      description: customer.description || '',
      notes: customer.notes || '',
      status: customer.status || 'active',
      parentCustomerId: customer.parentCustomerId || 'none',
      address: {
        street: customer.billingAddress?.street || '',
        city: customer.billingAddress?.city || '',
        state: customer.billingAddress?.state || '',
        postalCode: customer.billingAddress?.postalCode || '',
        country: customer.billingAddress?.country || '',
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
      parentCustomerId: 'none',
      address: {
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      }
    });
    setSelectedCustomer(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Remove the CustomerForm definition from here since it's now outside

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading customers...</p></div>;
  }

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view customers.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Customers</CardTitle>
              <CardDescription>Manage your customer relationships</CardDescription>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Customer</DialogTitle>
                  <DialogDescription>
                    Add a new customer to your organization
                  </DialogDescription>
                </DialogHeader>
                <CustomerForm formData={formData} setFormData={setFormData} customers={customers} />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={createCustomerMutation.isPending}>
                    {createCustomerMutation.isPending ? 'Creating...' : 'Create'}
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
                <TableHead>Code</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer: any) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    {customer.companyName}
                  </TableCell>
                  <TableCell>{customer.customerId || '-'}</TableCell>
                  <TableCell>
                    {customer.parentCustomerId ? 
                      customers.find(c => c.id === customer.parentCustomerId)?.companyName || '-' 
                      : '-'
                    }
                  </TableCell>
                  <TableCell>{customer.contactEmail || '-'}</TableCell>
                  <TableCell>{customer.contactPhone || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                      {customer.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(customer.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => router.push(`/relationships/customers/${customer.id}`)}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => openEditDialog(customer)}
                        title="Edit customer"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDelete(customer.id)}
                        title="Delete customer"
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
          
          {customers.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              No customers found. Create your first customer to get started.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Update customer information
            </DialogDescription>
          </DialogHeader>
          <CustomerForm formData={formData} setFormData={setFormData} customers={customers} currentCustomerId={selectedCustomer?.id} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateCustomerMutation.isPending}>
              {updateCustomerMutation.isPending ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}