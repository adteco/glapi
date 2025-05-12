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

type FormState = Omit<Customer, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>;

export default function EditCustomerPage({ params }: { params: { id: string } }) {
  const { session, isInitialized } = useStytchMemberSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormState>({
    companyName: '',
    customerId: '',
    contactEmail: '',
    contactPhone: '',
    status: 'active',
    billingAddress: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'US'
    }
  });

  // Fetch customer data on component mount
  useEffect(() => {
    if (!isInitialized) {
      setIsFetching(true); 
      return;
    }

    if (!session) { 
      router.replace('/');
      return;
    }

    const orgIdFromSession = session.organization_id;

    if (orgIdFromSession && orgIdFromSession.trim() !== '' && orgIdFromSession !== '00000000-0000-0000-0000-000000000001') {
      fetchCustomer(orgIdFromSession); 
    } else {
      if (!orgIdFromSession || orgIdFromSession.trim() === '') {
        console.error('[EditCustomerPage] useEffect: organization_id is missing or empty in session.', session);
        setError('Organization information is missing from your session.');
        setIsFetching(false);
      } else if (orgIdFromSession === '00000000-0000-0000-0000-000000000001') {
        console.warn('[EditCustomerPage] useEffect: session.organization_id is the placeholder. Waiting for a valid ID from session refresh...');
        // We are still fetching because isInitialized and session are true, but orgId is placeholder.
        // This implies Stytch SDK might update session.organization_id soon. Do not set error, keep loading.
        setIsFetching(true);
      }
    }
  }, [isInitialized, session, session?.organization_id, router, params.id]); // session.organization_id is key here

  const fetchCustomer = async (orgIdToUse: string) => { // Renamed for clarity
    // This function is now only called if orgIdToUse is valid and not the placeholder.
    setIsFetching(true);
    setError(null);
    
    console.log('[EditCustomerPage] fetchCustomer: Proceeding with validated Stytch org ID:', orgIdToUse);

    try {
      const response = await apiClient.customers.getById(params.id, orgIdToUse);
      
      if (response && response.customer) {
        console.log('[EditCustomerPage] Successfully fetched and found customer, setting form data.');
        setFormData({
          companyName: response.customer.companyName,
          customerId: response.customer.customerId,
          contactEmail: response.customer.contactEmail || '',
          contactPhone: response.customer.contactPhone || '',
          status: response.customer.status,
          billingAddress: response.customer.billingAddress || {
            street: '',
            city: '',
            state: '',
            postalCode: '',
            country: 'US'
          }
        });
      } else {
        console.error('[EditCustomerPage] Condition (response && response.customer) was false. Response:', response);
        setError(`Customer data not found in API response for ID "${params.id}".`);
      }
    } catch (err) {
      console.error('[EditCustomerPage] Error during apiClient.customers.getById call:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch customer');
    } finally {
      setIsFetching(false);
    }
  };

  // Redirect if not authenticated
  if (isInitialized && !session) {
    router.replace('/');
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof typeof prev] as Record<string, any>,
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const orgIdFromSession = session?.organization_id;

    if (!isInitialized || !orgIdFromSession || orgIdFromSession.trim() === '' || orgIdFromSession === '00000000-0000-0000-0000-000000000001') {
      console.error('[EditCustomerPage] handleSubmit: Stytch not initialized, organization_id missing, empty, or placeholder.');
      setError('Cannot save customer: session or organization information is not ready or invalid.');
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      // Clean up empty fields in billingAddress
      const billingAddress = formData.billingAddress 
        ? Object.entries(formData.billingAddress).reduce((acc, [key, value]) => {
            if (value && value.trim() !== '') {
              acc[key as keyof typeof formData.billingAddress] = value;
            }
            return acc;
          }, {} as Record<string, string>)
        : undefined;
        
      // Only include billingAddress if it has properties
      const dataToSubmit = {
        ...formData,
        billingAddress: Object.keys(billingAddress || {}).length > 0 ? billingAddress : undefined
      };
      
      // Pass the Stytch organization ID from the session
      await apiClient.customers.update(params.id, dataToSubmit, orgIdFromSession);
      
      // Redirect to customer details page
      router.push(`/customers/${params.id}`);
    } catch (err) {
      console.error('Error updating customer:', err);
      setError(err instanceof Error ? err.message : 'Failed to update customer');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Loading customer data...</p>
        </div>
      </div>
    );
  }

  // Only show error if not fetching and error is present
  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Error</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
        <Link 
          href="/customers" 
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Back to Customers
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Edit Customer</h1>
        <Link 
          href={`/customers/${params.id}`} 
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Cancel
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Customer Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="companyName">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                id="companyName"
                name="companyName"
                type="text"
                required
                value={formData.companyName}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="customerId">
                Customer ID <span className="text-red-500">*</span>
              </label>
              <input
                id="customerId"
                name="customerId"
                type="text"
                required
                value={formData.customerId}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
              <p className="text-xs text-gray-500 mt-1">
                Unique identifier for this customer (e.g., ACME001)
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Status</h2>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Contact Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="contactEmail">
                Email Address
              </label>
              <input
                id="contactEmail"
                name="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="contactPhone">
                Phone Number
              </label>
              <input
                id="contactPhone"
                name="contactPhone"
                type="tel"
                value={formData.contactPhone}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Billing Address</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="billingAddress.street">
                Street Address
              </label>
              <input
                id="billingAddress.street"
                name="billingAddress.street"
                type="text"
                value={formData.billingAddress?.street || ''}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="billingAddress.city">
                City
              </label>
              <input
                id="billingAddress.city"
                name="billingAddress.city"
                type="text"
                value={formData.billingAddress?.city || ''}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="billingAddress.state">
                State/Province
              </label>
              <input
                id="billingAddress.state"
                name="billingAddress.state"
                type="text"
                value={formData.billingAddress?.state || ''}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="billingAddress.postalCode">
                Postal Code
              </label>
              <input
                id="billingAddress.postalCode"
                name="billingAddress.postalCode"
                type="text"
                value={formData.billingAddress?.postalCode || ''}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="billingAddress.country">
              Country
            </label>
            <input
              id="billingAddress.country"
              name="billingAddress.country"
              type="text"
              value={formData.billingAddress?.country || ''}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
        </div>

        <div className="flex items-center justify-end mt-6">
          <button
            type="submit"
            disabled={isLoading}
            className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}