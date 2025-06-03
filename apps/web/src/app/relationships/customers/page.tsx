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

interface Address {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
  countryCode?: string | null;
}

interface Customer {
  id: string;
  companyName: string;
  customerId?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status: string;
  billingAddress?: Address | null;
  createdAt: string;
  updatedAt: string;
}

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
  address: {
    line1: string;
    line2: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    countryCode: string;
  };
}

interface CustomerFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

// Move CustomerForm outside of the main component
const CustomerForm: React.FC<CustomerFormProps> = ({ formData, setFormData }) => (
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
      <Label>Billing Address</Label>
      <div className="grid grid-cols-2 gap-4">
        <Input
          placeholder="Address Line 1"
          value={formData.address.line1}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            address: { ...prev.address, line1: e.target.value }
          }))}
        />
        <Input
          placeholder="Address Line 2"
          value={formData.address.line2}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            address: { ...prev.address, line2: e.target.value }
          }))}
        />
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
          value={formData.address.stateProvince}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            address: { ...prev.address, stateProvince: e.target.value }
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
          placeholder="Country Code (e.g., US)"
          value={formData.address.countryCode}
          maxLength={2}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            address: { ...prev.address, countryCode: e.target.value.toUpperCase() }
          }))}
        />
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
  const { getToken } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
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
    address: {
      line1: '',
      line2: '',
      city: '',
      stateProvince: '',
      postalCode: '',
      countryCode: '',
    }
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const token = await getToken();
      const response = await fetch(apiEndpoints.customers, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch customers');
      
      const data = await response.json();
      console.log('Fetched customers:', data);
      setCustomers(data.data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const token = await getToken();
      const response = await fetch(apiEndpoints.customers, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: formData.name,
          customerId: formData.code || undefined,
          contactEmail: formData.email || undefined,
          contactPhone: formData.phone || undefined,
          status: formData.status,
          billingAddress: formData.address.line1 || formData.address.city ? {
            line1: formData.address.line1,
            line2: formData.address.line2,
            city: formData.address.city,
            state: formData.address.stateProvince,
            postalCode: formData.address.postalCode,
            country: formData.address.countryCode,
          } : undefined,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Create customer error:', errorData);
        throw new Error(errorData.message || 'Failed to create customer');
      }
      
      await fetchCustomers();
      setIsCreateOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error creating customer:', error);
    }
  };

  const handleUpdate = async () => {
    if (!selectedCustomer) return;
    
    try {
      const token = await getToken();
      const response = await fetch(`${apiEndpoints.customers}/${selectedCustomer.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: formData.name,
          customerId: formData.code || undefined,
          contactEmail: formData.email || undefined,
          contactPhone: formData.phone || undefined,
          status: formData.status,
          billingAddress: formData.address.line1 || formData.address.city ? {
            line1: formData.address.line1,
            line2: formData.address.line2,
            city: formData.address.city,
            state: formData.address.stateProvince,
            postalCode: formData.address.postalCode,
            country: formData.address.countryCode,
          } : undefined,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to update customer');
      
      await fetchCustomers();
      setIsEditOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error updating customer:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    
    try {
      const token = await getToken();
      const response = await fetch(`${apiEndpoints.customers}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to delete customer');
      
      await fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  };

  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.companyName,
      displayName: '',
      code: customer.customerId || '',
      email: customer.contactEmail || '',
      phone: customer.contactPhone || '',
      website: '',
      taxId: '',
      description: '',
      notes: '',
      status: customer.status,
      address: {
        line1: customer.billingAddress?.line1 || '',
        line2: customer.billingAddress?.line2 || '',
        city: customer.billingAddress?.city || '',
        stateProvince: customer.billingAddress?.stateProvince || customer.billingAddress?.state || '',
        postalCode: customer.billingAddress?.postalCode || '',
        countryCode: customer.billingAddress?.countryCode || customer.billingAddress?.country || '',
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
      address: {
        line1: '',
        line2: '',
        city: '',
        stateProvince: '',
        postalCode: '',
        countryCode: '',
      }
    });
    setSelectedCustomer(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Remove the CustomerForm definition from here since it's now outside

  if (loading) {
    return <div>Loading...</div>;
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
                <CustomerForm formData={formData} setFormData={setFormData} />
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
                <TableHead>Code</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    {customer.companyName}
                  </TableCell>
                  <TableCell>{customer.customerId || '-'}</TableCell>
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
          <CustomerForm />
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