'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStytchMemberSession } from '@stytch/nextjs/b2b';
import Link from 'next/link';
import { apiClient, Subsidiary, PaginatedResult } from '@/lib/db-adapter';

export default function SubsidiaryDetailPage({ params }: { params: { id: string } }) {
  const { session, isInitialized } = useStytchMemberSession();
  const router = useRouter();
  const [subsidiary, setSubsidiary] = useState<Subsidiary | null>(null);
  const [parentSubsidiary, setParentSubsidiary] = useState<Subsidiary | null>(null);
  const [childSubsidiaries, setChildSubsidiaries] = useState<Subsidiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isInitialized && !session) {
      router.replace('/');
    } else if (session) {
      fetchSubsidiary();
    }
  }, [session, isInitialized, router, params.id]);

  const fetchSubsidiary = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get the Stytch organization ID from the session
      const stytchOrgId = session?.organization_id;
      console.log('SubsidiaryDetail - Using Stytch org ID:', stytchOrgId);

      if (!stytchOrgId) {
        throw new Error('No organization ID found in session');
      }

      // Fetch the main subsidiary
      const data = await apiClient.subsidiaries.getById(params.id, stytchOrgId);
      console.log('Fetched subsidiary data:', data);

      if (!data.subsidiary) {
        throw new Error('Subsidiary not found');
      }

      setSubsidiary(data.subsidiary);

      // Fetch all subsidiaries to get parent and children
      const allSubsidiaries = await apiClient.subsidiaries.list({}, stytchOrgId);
      
      // Find parent if this subsidiary has a parentId
      if (data.subsidiary.parentId) {
        const parent = allSubsidiaries.data.find(sub => sub.id === data.subsidiary.parentId);
        if (parent) {
          setParentSubsidiary(parent);
        }
      }

      // Find child subsidiaries
      const children = allSubsidiaries.data.filter(sub => sub.parentId === data.subsidiary.id);
      setChildSubsidiaries(children);
    } catch (err) {
      console.error('Error fetching subsidiary:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch subsidiary');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubsidiary = async () => {
    if (!confirm('Are you sure you want to delete this subsidiary?')) {
      return;
    }

    try {
      // Get the Stytch organization ID from the session
      const stytchOrgId = session?.organization_id;

      if (!stytchOrgId) {
        throw new Error('No organization ID found in session');
      }

      await apiClient.subsidiaries.delete(params.id, stytchOrgId);
      router.push('/subsidiaries');
    } catch (err) {
      console.error('Error deleting subsidiary:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete subsidiary');
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
            <Link href="/subsidiaries" className="text-blue-600 hover:underline">
              Back to Subsidiaries
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!subsidiary) {
    return (
      <div className="p-6">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p className="font-bold">Subsidiary not found</p>
          <p>The requested subsidiary could not be found.</p>
          <div className="mt-4">
            <Link href="/subsidiaries" className="text-blue-600 hover:underline">
              Back to Subsidiaries
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const createdDate = new Date(subsidiary.createdAt).toLocaleDateString();
  const updatedDate = new Date(subsidiary.updatedAt).toLocaleDateString();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Subsidiary Details</h1>
        <div className="flex space-x-3">
          <Link 
            href="/subsidiaries" 
            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
          >
            Back to List
          </Link>
          <Link 
            href={`/subsidiaries/${params.id}/edit`} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Edit Subsidiary
          </Link>
          <button 
            onClick={handleDeleteSubsidiary}
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
                Subsidiary Information
              </h2>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-500 text-sm">Name</span>
                  <p className="font-medium">{subsidiary.name}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Code</span>
                  <p className="font-medium">{subsidiary.code}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Status</span>
                  <p>
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      subsidiary.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {subsidiary.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                </div>
                {subsidiary.description && (
                  <div>
                    <span className="text-gray-500 text-sm">Description</span>
                    <p className="font-medium">{subsidiary.description}</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-gray-200">
                Hierarchy Information
              </h2>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-500 text-sm">Parent Subsidiary</span>
                  {parentSubsidiary ? (
                    <p className="font-medium">
                      <Link 
                        href={`/subsidiaries/${parentSubsidiary.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {parentSubsidiary.name} ({parentSubsidiary.code})
                      </Link>
                    </p>
                  ) : (
                    <p className="text-gray-500">None (This is a top-level subsidiary)</p>
                  )}
                </div>
                
                <div>
                  <span className="text-gray-500 text-sm">Child Subsidiaries</span>
                  {childSubsidiaries.length > 0 ? (
                    <ul className="list-disc list-inside pl-4">
                      {childSubsidiaries.map(child => (
                        <li key={child.id}>
                          <Link
                            href={`/subsidiaries/${child.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {child.name} ({child.code})
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">None</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
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
                  <p className="font-mono text-xs text-gray-600">{subsidiary.id}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Organization ID</span>
                  <p className="font-mono text-xs text-gray-600">{subsidiary.organizationId}</p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-gray-200">
                Related Entities
              </h2>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-500 text-sm">Customers</span>
                  <p className="text-gray-500">None</p> {/* This would be populated in a real implementation */}
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Jobs</span>
                  <p className="text-gray-500">None</p> {/* This would be populated in a real implementation */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}