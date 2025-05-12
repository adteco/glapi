'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStytchMemberSession } from '@stytch/nextjs/b2b';
import Link from 'next/link';
import { apiClient, Subsidiary } from '@/lib/db-adapter';

type FormState = Omit<Subsidiary, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>;

export default function EditSubsidiaryPage({ params }: { params: { id: string } }) {
  const { session, isInitialized } = useStytchMemberSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormState>({
    name: '',
    code: '',
    description: '',
    parentId: null,
    isActive: true
  });

  // For parent subsidiary selection
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [loadingSubsidiaries, setLoadingSubsidiaries] = useState(true);

  // Fetch subsidiary data on component mount
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
      fetchSubsidiary(orgIdFromSession);
      fetchAllSubsidiaries(orgIdFromSession);
    } else {
      if (!orgIdFromSession || orgIdFromSession.trim() === '') {
        console.error('[EditSubsidiaryPage] useEffect: organization_id is missing or empty in session.', session);
        setError('Organization information is missing from your session.');
        setIsFetching(false);
      } else if (orgIdFromSession === '00000000-0000-0000-0000-000000000001') {
        console.warn('[EditSubsidiaryPage] useEffect: session.organization_id is the placeholder. Waiting for a valid ID from session refresh...');
        setIsFetching(true);
      }
    }
  }, [isInitialized, session, session?.organization_id, router, params.id]);

  const fetchSubsidiary = async (orgIdToUse: string) => {
    setIsFetching(true);
    setError(null);
    
    console.log('[EditSubsidiaryPage] fetchSubsidiary: Proceeding with validated Stytch org ID:', orgIdToUse);

    try {
      const response = await apiClient.subsidiaries.getById(params.id, orgIdToUse);
      
      if (response && response.subsidiary) {
        console.log('[EditSubsidiaryPage] Successfully fetched and found subsidiary, setting form data.');
        setFormData({
          name: response.subsidiary.name,
          code: response.subsidiary.code,
          description: response.subsidiary.description || '',
          parentId: response.subsidiary.parentId,
          isActive: response.subsidiary.isActive
        });
      } else {
        console.error('[EditSubsidiaryPage] Condition (response && response.subsidiary) was false. Response:', response);
        setError(`Subsidiary data not found in API response for ID "${params.id}".`);
      }
    } catch (err) {
      console.error('[EditSubsidiaryPage] Error during apiClient.subsidiaries.getById call:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch subsidiary');
    } finally {
      setIsFetching(false);
    }
  };

  const fetchAllSubsidiaries = async (orgIdToUse: string) => {
    setLoadingSubsidiaries(true);
    try {
      // Get all subsidiaries to populate the parent dropdown
      const response = await apiClient.subsidiaries.list({}, orgIdToUse);
      if (response && response.data) {
        // Filter out the current subsidiary to prevent circular references
        setSubsidiaries(response.data.filter(sub => sub.id !== params.id));
      }
    } catch (err) {
      console.error('[EditSubsidiaryPage] Error fetching subsidiaries for parent selection:', err);
      // Don't set an error on the form for this, just log it
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

    const orgIdFromSession = session?.organization_id;

    if (!isInitialized || !orgIdFromSession || orgIdFromSession.trim() === '' || orgIdFromSession === '00000000-0000-0000-0000-000000000001') {
      console.error('[EditSubsidiaryPage] handleSubmit: Stytch not initialized, organization_id missing, empty, or placeholder.');
      setError('Cannot save subsidiary: session or organization information is not ready or invalid.');
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
      
      // Pass the Stytch organization ID from the session
      await apiClient.subsidiaries.update(params.id, dataToSubmit, orgIdFromSession);
      
      // Redirect to subsidiary details page
      router.push(`/subsidiaries/${params.id}`);
    } catch (err) {
      console.error('Error updating subsidiary:', err);
      setError(err instanceof Error ? err.message : 'Failed to update subsidiary');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Loading subsidiary data...</p>
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
          href="/subsidiaries" 
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Back to Subsidiaries
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Edit Subsidiary</h1>
        <Link 
          href={`/subsidiaries/${params.id}`} 
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Cancel
        </Link>
      </div>

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
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}