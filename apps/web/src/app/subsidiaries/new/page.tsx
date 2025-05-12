'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStytchMemberSession } from '@stytch/nextjs/b2b';
import Link from 'next/link';
import { apiClient, Subsidiary, useAuthHeaders } from '@/lib/db-adapter';

type NewSubsidiaryData = Omit<Subsidiary, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>;

export default function NewSubsidiaryPage() {
  const { session, isInitialized } = useStytchMemberSession();
  const headers = useAuthHeaders();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [loadingSubsidiaries, setLoadingSubsidiaries] = useState(true);
  
  // Store organization ID to use in form submission
  const [organizationId, setOrganizationId] = useState('');
  
  const [formData, setFormData] = useState<NewSubsidiaryData>({
    name: '',
    code: '',
    description: '',
    parentId: null,
    isActive: true
  });

  // Effect to set organization ID and load parent subsidiaries
  useEffect(() => {
    if (!isInitialized || !session) {
      return;
    }

    const stytchOrgId = session.organization_id;
    if (stytchOrgId && stytchOrgId !== '00000000-0000-0000-0000-000000000001') {
      // Load existing subsidiaries for parent selection
      fetchSubsidiaries(stytchOrgId);
    }
  }, [isInitialized, session]);

  const fetchSubsidiaries = async (stytchOrgId: string) => {
    setLoadingSubsidiaries(true);
    try {
      const response = await apiClient.subsidiaries.list({}, stytchOrgId);
      if (response && response.data) {
        setSubsidiaries(response.data);
      }
    } catch (err) {
      console.error('Error fetching subsidiaries:', err);
      // Don't set error on form for this, just log it
    } finally {
      setLoadingSubsidiaries(false);
    }
  };

  // Redirect if not authenticated
  if (isInitialized && !session) {
    router.replace('/');
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox' && 'checked' in e.target) {
      setFormData(prev => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked
      }));
    } else if (name === 'parentId') {
      setFormData(prev => ({
        ...prev,
        [name]: value === 'null' ? null : value
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
    
    if (!session || !session.organization_id || session.organization_id === '00000000-0000-0000-0000-000000000001') {
      setError('Cannot create subsidiary: session or organization information is not ready or invalid.');
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      // Clean up empty description
      const dataToSubmit = {
        ...formData,
        description: formData.description?.trim() ? formData.description : null
      };
      
      // Log what we're sending for debugging
      console.log('Submitting subsidiary data:', dataToSubmit);
      
      const result = await apiClient.subsidiaries.create(dataToSubmit, session.organization_id);
      
      // Redirect to subsidiaries list
      router.push('/subsidiaries');
      router.refresh();
    } catch (error) {
      console.error('Error creating subsidiary:', error);
      setError(error instanceof Error ? error.message : 'Failed to create subsidiary. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Add New Subsidiary</h1>
        <Link 
          href="/subsidiaries" 
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

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Subsidiary Information</h2>
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
                Code <span className="text-red-500">*</span>
              </label>
              <input
                id="code"
                name="code"
                type="text"
                required
                value={formData.code}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
              <p className="text-xs text-gray-500 mt-1">
                Unique identifier for this subsidiary (e.g., SUB001)
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Parent Subsidiary</h2>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="parentId">
              Parent
            </label>
            <select
              id="parentId"
              name="parentId"
              value={formData.parentId === null ? 'null' : formData.parentId}
              onChange={handleChange}
              className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              disabled={loadingSubsidiaries}
            >
              <option value="null">None (Top-level subsidiary)</option>
              {subsidiaries.map(sub => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} ({sub.code})
                </option>
              ))}
            </select>
            {loadingSubsidiaries && (
              <p className="text-xs text-gray-500 mt-1">Loading subsidiaries...</p>
            )}
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Description</h2>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description || ''}
              onChange={handleChange}
              rows={4}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Status</h2>
          <div className="flex items-center">
            <input
              id="isActive"
              name="isActive"
              type="checkbox"
              checked={formData.isActive}
              onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
              Active
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Inactive subsidiaries will not appear in active lists
          </p>
        </div>

        <div className="flex items-center justify-end mt-6">
          <button
            type="submit"
            disabled={isLoading}
            className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? 'Creating...' : 'Create Subsidiary'}
          </button>
        </div>
      </form>
    </div>
  );
}