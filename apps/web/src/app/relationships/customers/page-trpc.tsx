'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Eye, Pencil, Trash2, Plus } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface FormData {
  name: string;
  code: string;
  email: string;
  phone: string;
  billingAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  parentCustomerId: string;
  taxId: string;
  paymentTerms: string;
  creditLimit: number | null;
  isActive: boolean;
}

export default function CustomersPageWithTRPC() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    code: '',
    email: '',
    phone: '',
    billingAddress: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    },
    shippingAddress: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    },
    parentCustomerId: '',
    taxId: '',
    paymentTerms: '',
    creditLimit: null,
    isActive: true,
  });

  // tRPC queries and mutations
  const { data: customers, isLoading, refetch } = trpc.customers.list.useQuery({
    includeInactive: false,
  });

  const createCustomer = trpc.customers.create.useMutation({
    onSuccess: () => {
      toast.success('Customer created successfully');
      setIsOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create customer');
    },
  });

  const updateCustomer = trpc.customers.update.useMutation({
    onSuccess: () => {
      toast.success('Customer updated successfully');
      setIsOpen(false);
      setEditingCustomer(null);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update customer');
    },
  });

  const deleteCustomer = trpc.customers.delete.useMutation({
    onSuccess: () => {
      toast.success('Customer deleted successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete customer');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      email: '',
      phone: '',
      billingAddress: {
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      },
      shippingAddress: {
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      },
      parentCustomerId: '',
      taxId: '',
      paymentTerms: '',
      creditLimit: null,
      isActive: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const dataToSubmit = {
      ...formData,
      email: formData.email || null,
      phone: formData.phone || null,
      billingAddress: formData.billingAddress.street ? formData.billingAddress : null,
      shippingAddress: formData.shippingAddress.street ? formData.shippingAddress : null,
      parentCustomerId: formData.parentCustomerId || null,
      taxId: formData.taxId || null,
      paymentTerms: formData.paymentTerms || null,
      creditLimit: formData.creditLimit,
    };

    if (editingCustomer) {
      updateCustomer.mutate({
        id: editingCustomer,
        data: dataToSubmit,
      });
    } else {
      createCustomer.mutate(dataToSubmit);
    }
  };

  const handleEdit = (customer: any) => {
    setFormData({
      name: customer.name,
      code: customer.code,
      email: customer.email || '',
      phone: customer.phone || '',
      billingAddress: customer.billingAddress || {
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      },
      shippingAddress: customer.shippingAddress || {
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      },
      parentCustomerId: customer.parentCustomerId || '',
      taxId: customer.taxId || '',
      paymentTerms: customer.paymentTerms || '',
      creditLimit: customer.creditLimit || null,
      isActive: customer.isActive,
    });
    setEditingCustomer(customer.id);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      deleteCustomer.mutate({ id });
    }
  };

  const filteredCustomers = customers?.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Customers</CardTitle>
            <CardDescription>Manage your customer accounts</CardDescription>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setEditingCustomer(null); }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
                  <DialogDescription>
                    {editingCustomer ? 'Update customer information' : 'Enter the details for the new customer'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="code">Code *</Label>
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Add more form fields as needed */}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createCustomer.isPending || updateCustomer.isPending}>
                    {editingCustomer ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.code}</TableCell>
                  <TableCell>{customer.email || '-'}</TableCell>
                  <TableCell>{customer.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={customer.isActive ? 'default' : 'secondary'}>
                      {customer.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => router.push(`/relationships/customers/${customer.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(customer)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(customer.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}