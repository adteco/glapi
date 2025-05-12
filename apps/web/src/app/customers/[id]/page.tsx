'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStytchMemberSession } from '@stytch/nextjs/b2b';
import Link from 'next/link';
import { apiClient } from '@/lib/db-adapter';

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

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const { session, isInitialized } = useStytchMemberSession();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isInitialized && !session) {
      router.replace('/');
    } else if (session) {
      fetchCustomer();
    }
  }, [session, isInitialized, router, params.id]);

  const fetchCustomer = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get the Stytch organization ID from the session
      // Make sure to match the same path as the customers list page
      const stytchOrgId = session?.organization_id;
      console.log('CustomerDetail - Using Stytch org ID:', stytchOrgId);
      console.log('CustomerDetail - Full session:', JSON.stringify(session, null, 2));

      if (!stytchOrgId) {
        throw new Error('No organization ID found in session');
      }

      // Use direct fetch with explicit headers
      const response = await fetch(`/api/v1/customers/${params.id}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-stytch-organization-id': stytchOrgId
        }
      });

      if (!response.ok) {
        throw new Error(`Error fetching customer: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Fetched customer data:', data);

      setCustomer(data.customer);
    } catch (err) {
      console.error('Error fetching customer:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch customer');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!confirm('Are you sure you want to delete this customer?')) {
      return;
    }

    try {
      // Get the Stytch organization ID from the session
      // Make sure to match the same path as the customers list page
      const stytchOrgId = session?.organization_id;
      console.log('CustomerDetail (Delete) - Using Stytch org ID:', stytchOrgId);

      if (!stytchOrgId) {
        throw new Error('No organization ID found in session');
      }

      // Use direct fetch with explicit headers
      const response = await fetch(`/api/v1/customers/${params.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-stytch-organization-id': stytchOrgId
        }
      });

      if (!response.ok) {
        throw new Error(`Error deleting customer: ${response.status} ${response.statusText}`);
      }

      router.push('/customers');
    } catch (err) {
      console.error('Error deleting customer:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete customer');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
          <div className="mt-4">
            <Link href="/customers" className="text-blue-600 hover:underline">
              Back to Customers
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p className="font-bold">Customer not found</p>
          <p>The requested customer could not be found.</p>
          <div className="mt-4">
            <Link href="/customers" className="text-blue-600 hover:underline">
              Back to Customers
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const createdDate = new Date(customer.createdAt).toLocaleDateString();
  const updatedDate = new Date(customer.updatedAt).toLocaleDateString();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Customer Details</h1>
        <div className="flex space-x-3">
          <Link 
            href="/customers" 
            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
          >
            Back to List
          </Link>
          <Link 
            href={`/customers/${params.id}/edit`} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Edit Customer
          </Link>
          <button 
            onClick={handleDeleteCustomer}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-gray-200">
                Company Information
              </h2>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-500 text-sm">Company Name</span>
                  <p className="font-medium">{customer.companyName}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Customer ID</span>
                  <p className="font-medium">{customer.customerId}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Status</span>
                  <p>
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      customer.status === 'active' ? 'bg-green-100 text-green-800' : 
                      customer.status === 'inactive' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {customer.status}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-gray-200">
                Contact Information
              </h2>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-500 text-sm">Email</span>
                  <p className="font-medium">{customer.contactEmail || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Phone</span>
                  <p className="font-medium">{customer.contactPhone || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-gray-200">
                Billing Address
              </h2>
              {customer.billingAddress ? (
                <div className="space-y-2">
                  {customer.billingAddress.street && (
                    <p>{customer.billingAddress.street}</p>
                  )}
                  <p>
                    {[
                      customer.billingAddress.city,
                      customer.billingAddress.state,
                      customer.billingAddress.postalCode
                    ].filter(Boolean).join(', ')}
                  </p>
                  {customer.billingAddress.country && (
                    <p>{customer.billingAddress.country}</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No billing address provided</p>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-gray-200">
                System Information
              </h2>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-500 text-sm">Created At</span>
                  <p className="font-medium">{createdDate}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Last Updated</span>
                  <p className="font-medium">{updatedDate}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">ID</span>
                  <p className="font-mono text-xs text-gray-600">{customer.id}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}