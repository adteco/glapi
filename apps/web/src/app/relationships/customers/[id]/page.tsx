'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Edit, Plus } from 'lucide-react';
import { apiEndpoints } from '@/lib/api';

interface Customer {
  id: string;
  companyName: string;
  customerId?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  parentCustomerId?: string | null;
  status: string;
  billingAddress?: any;
  createdAt: string;
  updatedAt: string;
}

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [childCustomers, setChildCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomerData();
  }, [params.id]);

  const fetchCustomerData = async () => {
    try {
      const token = await getToken();
      
      // Fetch customer details
      const customerResponse = await fetch(`${apiEndpoints.customers}/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!customerResponse.ok) throw new Error('Failed to fetch customer');
      
      const customerData = await customerResponse.json();
      setCustomer(customerData);
      
      // Fetch child customers
      const childrenResponse = await fetch(`${apiEndpoints.customers}/${params.id}/children`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (childrenResponse.ok) {
        const childrenData = await childrenResponse.json();
        setChildCustomers(childrenData.data || []);
      }
    } catch (error) {
      console.error('Error fetching customer data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!customer) {
    return <div>Customer not found</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/relationships/customers')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Customers
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>{customer.companyName}</CardTitle>
                <CardDescription>Customer Details</CardDescription>
              </div>
              <Button
                onClick={() => router.push(`/relationships/customers?edit=${customer.id}`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Customer
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Customer Code</p>
                <p className="mt-1">{customer.customerId || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <Badge variant={customer.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                  {customer.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Email</p>
                <p className="mt-1">{customer.contactEmail || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Phone</p>
                <p className="mt-1">{customer.contactPhone || '-'}</p>
              </div>
              {customer.billingAddress && (
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500">Billing Address</p>
                  <div className="mt-1">
                    {customer.billingAddress.street && <p>{customer.billingAddress.street}</p>}
                    {(customer.billingAddress.city || customer.billingAddress.state || customer.billingAddress.postalCode) && (
                      <p>
                        {[
                          customer.billingAddress.city,
                          customer.billingAddress.state,
                          customer.billingAddress.postalCode
                        ].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {customer.billingAddress.country && <p>{customer.billingAddress.country}</p>}
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Created</p>
                <p className="mt-1">{new Date(customer.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Updated</p>
                <p className="mt-1">{new Date(customer.updatedAt).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Child Customers</CardTitle>
                <CardDescription>Customers under {customer.companyName}</CardDescription>
              </div>
              <Button
                onClick={() => router.push(`/relationships/customers?parent=${customer.id}`)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Child Customer
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {childCustomers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {childCustomers.map((child) => (
                    <TableRow 
                      key={child.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => router.push(`/relationships/customers/${child.id}`)}
                    >
                      <TableCell className="font-medium">
                        {child.companyName}
                      </TableCell>
                      <TableCell>{child.customerId || '-'}</TableCell>
                      <TableCell>{child.contactEmail || '-'}</TableCell>
                      <TableCell>{child.contactPhone || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={child.status === 'active' ? 'default' : 'secondary'}>
                          {child.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-10 text-gray-500">
                No child customers found
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}