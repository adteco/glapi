'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStytchMemberSession } from '@stytch/nextjs/b2b';
import Link from 'next/link';
import { apiClient, useAuthHeaders } from '@/lib/db-adapter';

interface NewCustomerData {
  companyName: string;
  customerId: string;
  contactEmail?: string;
  contactPhone?: string;
  status: 'active' | 'inactive' | 'archived';
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export default function NewCustomerPage() {
  const { session, isInitialized } = useStytchMemberSession();
  const headers = useAuthHeaders(); // Get authenticated headers
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Store organization ID to use in form submission
  const [organizationId, setOrganizationId] = useState('');
  
  // Effect to set organization ID immediately
  useEffect(() => {
    // Use our hardcoded mock organization ID for development
    const mockOrgId = 'org-123456789';
    console.log('Setting hardcoded organization ID:', mockOrgId);
    setOrganizationId(mockOrgId);

    // Store in localStorage for other components
    if (typeof window !== 'undefined') {
      localStorage.setItem('db_org_id', mockOrgId);
    }

    // Also store Stytch ID if available
    if (session?.organization?.organization_id) {
      const stytchOrgId = session.organization.organization_id;
      console.log('Got Stytch organization ID from session:', stytchOrgId);

      // Store Stytch ID in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('stytch_org_id', stytchOrgId);
      }
    }
  }, [session]);
  
  const [formData, setFormData] = useState<NewCustomerData>({
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

      // Use the real organization ID from the server
      const orgId = '3a089ae1-8d1a-4e55-af27-9f9c164d3db9';

      // Only include billingAddress if it has properties
      const dataToSubmit = {
        ...formData,
        organizationId: orgId,
        billingAddress: Object.keys(billingAddress || {}).length > 0 ? billingAddress : undefined
      };
      
      // Log what we're sending for debugging
      console.log('Submitting customer data:', dataToSubmit);
      console.log('Using headers:', headers);

      // Use direct fetch for more control over the request
      const response = await fetch('/api/v1/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-stytch-organization-id': '00000000-0000-0000-0000-000000000001'
        },
        body: JSON.stringify(dataToSubmit)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create customer');
      }

      const result = await response.json();
      
      // Redirect to customers list
      router.push('/customers');
      router.refresh();
    } catch (error) {
      console.error('Error creating customer:', error);
      setError(error instanceof Error ? error.message : 'Failed to create customer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Add New Customer</h1>
        <Link 
          href="/customers" 
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Cancel
        </Link>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Debug information - Remove in production */}
      <div className="bg-gray-100 p-3 mb-4 rounded text-xs font-mono overflow-auto">
        <p>Organization ID: {organizationId || 'Not set'}</p>
        <p>Headers: {JSON.stringify(headers)}</p>
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
                value={formData.billingAddress?.street}
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
                value={formData.billingAddress?.city}
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
                value={formData.billingAddress?.state}
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
                value={formData.billingAddress?.postalCode}
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
              value={formData.billingAddress?.country}
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
            {isLoading ? 'Creating...' : 'Create Customer'}
          </button>
        </div>
      </form>
    </div>
  );
}