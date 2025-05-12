'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStytchMemberSession } from '@stytch/nextjs/b2b';
import Link from 'next/link';
import { apiClient } from '@/lib/db-adapter';

interface Department {
  id: string;
  organizationId: string;
  subsidiaryId: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Subsidiary {
  id: string;
  name: string;
}

type FormState = Omit<Department, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>;

export default function EditDepartmentPage({ params }: { params: { id: string } }) {
  const { session, isInitialized } = useStytchMemberSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormState>({
    name: '',
    code: '',
    description: '',
    subsidiaryId: '',
    isActive: true
  });

  // Fetch department data on component mount
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
      fetchDepartment(orgIdFromSession);
      fetchSubsidiaries(orgIdFromSession);
    } else {
      if (!orgIdFromSession || orgIdFromSession.trim() === '') {
        console.error('[EditDepartmentPage] useEffect: organization_id is missing or empty in session.', session);
        setError('Organization information is missing from your session.');
        setIsFetching(false);
      } else if (orgIdFromSession === '00000000-0000-0000-0000-000000000001') {
        console.warn('[EditDepartmentPage] useEffect: session.organization_id is the placeholder. Waiting for a valid ID from session refresh...');
        setIsFetching(true);
      }
    }
  }, [isInitialized, session, session?.organization_id, router, params.id]);

  const fetchDepartment = async (orgIdToUse: string) => {
    setIsFetching(true);
    setError(null);
    
    console.log('[EditDepartmentPage] fetchDepartment: Proceeding with validated Stytch org ID:', orgIdToUse);

    try {
      const response = await fetch(`/api/v1/departments/${params.id}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-stytch-organization-id': orgIdToUse
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching department: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data && data.department) {
        console.log('[EditDepartmentPage] Successfully fetched and found department, setting form data.');
        setFormData({
          name: data.department.name,
          code: data.department.code || '',
          description: data.department.description || '',
          subsidiaryId: data.department.subsidiaryId,
          isActive: data.department.isActive
        });
      } else {
        console.error('[EditDepartmentPage] Condition (data && data.department) was false. Response:', data);
        setError(`Department data not found in API response for ID "${params.id}".`);
      }
    } catch (err) {
      console.error('[EditDepartmentPage] Error during fetchDepartment call:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch department');
    } finally {
      setIsFetching(false);
    }
  };
  
  const fetchSubsidiaries = async (orgIdToUse: string) => {
    try {
      const response = await fetch('/api/v1/subsidiaries', {
        headers: {
          'Content-Type': 'application/json',
          'x-stytch-organization-id': orgIdToUse
        }
      });
      
      if (!response.ok) {
        console.error(`Error fetching subsidiaries: ${response.status} ${response.statusText}`);
        return;
      }
      
      const data = await response.json();
      if (data && data.data) {
        setSubsidiaries(data.data);
      }
    } catch (err) {
      console.error('Error fetching subsidiaries:', err);
    }
  };

  // Redirect if not authenticated
  if (isInitialized && !session) {
    router.replace('/');
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
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
      console.error('[EditDepartmentPage] handleSubmit: Stytch not initialized, organization_id missing, empty, or placeholder.');
      setError('Cannot save department: session or organization information is not ready or invalid.');
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      // Pass the Stytch organization ID from the session
      const response = await fetch(`/api/v1/departments/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-stytch-organization-id': orgIdFromSession
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Error updating department: ${response.status} ${response.statusText}`);
      }
      
      // Redirect to department details page
      router.push(`/departments/${params.id}`);
    } catch (err) {
      console.error('Error updating department:', err);
      setError(err instanceof Error ? err.message : 'Failed to update department');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Loading department data...</p>
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
          href="/departments" 
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Back to Departments
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Edit Department</h1>
        <Link 
          href={`/departments/${params.id}`} 
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Cancel
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Department Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="code">
                Code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                value={formData.code}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
              <p className="text-xs text-gray-500 mt-1">
                Unique identifier for this department (e.g., DEP001)
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="subsidiaryId">
            Subsidiary <span className="text-red-500">*</span>
          </label>
          <select
            id="subsidiaryId"
            name="subsidiaryId"
            required
            value={formData.subsidiaryId}
            onChange={handleChange}
            className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          >
            <option value="">Select a subsidiary</option>
            {subsidiaries.map(sub => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            value={formData.description}
            onChange={handleChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>

        <div className="mb-6">
          <div className="flex items-center">
            <input
              id="isActive"
              name="isActive"
              type="checkbox"
              checked={formData.isActive}
              onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isActive" className="ml-2 block text-gray-700">
              Active
            </label>
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