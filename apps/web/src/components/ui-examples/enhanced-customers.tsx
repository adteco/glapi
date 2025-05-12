'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStytchMemberSession } from '@stytch/nextjs/b2b';
import Link from 'next/link';
import { apiClient } from '@/lib/db-adapter';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, Check, Edit, FilePlus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Address {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

interface Customer {
  id: string;
  organizationId: string;
  companyName: string;
  customerId: string;
  contactEmail?: string;
  contactPhone?: string;
  billingAddress?: Address;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResult {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function EnhancedCustomersPage() {
  const { session, isInitialized } = useStytchMemberSession();
  const router = useRouter();
  const [customerData, setCustomerData] = useState<PaginatedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isInitialized && !session) {
      router.replace('/');
    } else if (session && session.organization_id) {
      fetchCustomers(currentPage, pageSize);
    }
  }, [session, session?.organization_id, isInitialized, router, currentPage, pageSize]);

  const fetchCustomers = async (page = 1, limit = 10) => {
    setLoading(true);
    setError(null);

    if (!session?.organization_id || session.organization_id.trim() === '') {
      console.error('[CustomersPage] Stytch organization ID not found or is empty in session.');
      setError('Stytch organization ID not available in session. Cannot fetch customers.');
      setCustomerData(null);
      setLoading(false);
      return;
    }

    const currentOrgId = session.organization_id;

    try {
      console.log('[CustomersPage] Using Stytch org ID for customer list:', currentOrgId);

      const response = await fetch(`/api/v1/customers?page=${page}&limit=${limit}&orderBy=companyName&orderDirection=asc`, {
        headers: {
          'Content-Type': 'application/json',
          'x-stytch-organization-id': currentOrgId
        }
      });

      if (!response.ok) {
        throw new Error(`Error fetching customers: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Fetched customer data:', data);

      setCustomerData(data);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleDeleteCustomer = async (id: string) => {
    try {
      await apiClient.customers.delete(id);
      setConfirmDialogOpen(false);
      setCustomerToDelete(null);
      
      // Refresh the customer list
      fetchCustomers(currentPage, pageSize);
    } catch (err) {
      console.error('Error deleting customer:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete customer');
    }
  };

  const confirmDelete = (customer: Customer) => {
    setCustomerToDelete(customer);
    setConfirmDialogOpen(true);
  };

  const filteredCustomers = customerData?.data.filter(customer => 
    customer.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    customer.customerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.contactEmail && customer.contactEmail.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading && !customerData) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-full max-w-[360px]" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, index) => (
                <div key={index} className="grid grid-cols-6 gap-4">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Customers</h1>
        <Button asChild>
          <Link href="/customers/new">
            <FilePlus className="mr-2 h-4 w-4" />
            Add New Customer
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Customer List</CardTitle>
            <div className="w-72">
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </div>
          <CardDescription>
            Manage your customer information and records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Customer ID</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers && filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.companyName}</TableCell>
                    <TableCell>{customer.customerId}</TableCell>
                    <TableCell>{customer.contactEmail || 'N/A'}</TableCell>
                    <TableCell>
                      <div className={`flex items-center ${
                        customer.status === 'active' ? 'text-green-600' : 
                        customer.status === 'inactive' ? 'text-yellow-600' :
                        'text-gray-500'
                      }`}>
                        {customer.status === 'active' && <Check className="h-4 w-4 mr-1" />}
                        <span className="capitalize">{customer.status}</span>
                      </div>
                    </TableCell>
                    <TableCell>{new Date(customer.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/customers/${customer.id}`}>
                            View
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/customers/${customer.id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => confirmDelete(customer)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No customers found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {customerData && customerData.totalPages > 1 && (
          <CardFooter className="flex justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {(customerData.page - 1) * customerData.limit + 1} to{' '}
              {Math.min(customerData.page * customerData.limit, customerData.total)}{' '}
              of {customerData.total} customers
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              {[...Array(customerData.totalPages)].map((_, index) => (
                <Button
                  key={index + 1}
                  variant={currentPage === index + 1 ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(index + 1)}
                >
                  {index + 1}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === customerData.totalPages}
              >
                Next
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {customerToDelete?.companyName}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => customerToDelete && handleDeleteCustomer(customerToDelete.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}