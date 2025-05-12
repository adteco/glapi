'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStytchMemberSession } from '@stytch/nextjs/b2b';
import Link from 'next/link';
import { apiClient } from '@/lib/db-adapter';

interface Class {
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

export default function ClassDetailPage({ params }: { params: { id: string } }) {
  const { session, isInitialized } = useStytchMemberSession();
  const router = useRouter();
  const [classData, setClassData] = useState<Class | null>(null);
  const [subsidiary, setSubsidiary] = useState<Subsidiary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isInitialized && !session) {
      router.replace('/');
    } else if (session) {
      fetchClass();
    }
  }, [session, isInitialized, router, params.id]);

  const fetchClass = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get the Stytch organization ID from the session
      const stytchOrgId = session?.organization_id;
      console.log('ClassDetail - Using Stytch org ID:', stytchOrgId);
      console.log('ClassDetail - Full session:', JSON.stringify(session, null, 2));

      if (!stytchOrgId) {
        throw new Error('No organization ID found in session');
      }

      // Use direct fetch with explicit headers
      const response = await fetch(`/api/v1/classes/${params.id}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-stytch-organization-id': stytchOrgId
        }
      });

      if (!response.ok) {
        throw new Error(`Error fetching class: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Fetched class data:', data);

      setClassData(data.class);
      
      // Fetch subsidiary information if we have a subsidiaryId
      if (data.class?.subsidiaryId) {
        fetchSubsidiary(data.class.subsidiaryId, stytchOrgId);
      }
    } catch (err) {
      console.error('Error fetching class:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch class');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchSubsidiary = async (subsidiaryId: string, orgId: string) => {
    try {
      const response = await fetch(`/api/v1/subsidiaries/${subsidiaryId}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-stytch-organization-id': orgId
        }
      });
      
      if (!response.ok) {
        console.error(`Error fetching subsidiary: ${response.status} ${response.statusText}`);
        return;
      }
      
      const data = await response.json();
      setSubsidiary(data.subsidiary);
    } catch (err) {
      console.error('Error fetching subsidiary:', err);
    }
  };

  const handleDeleteClass = async () => {
    if (!confirm('Are you sure you want to delete this class?')) {
      return;
    }

    try {
      // Get the Stytch organization ID from the session
      const stytchOrgId = session?.organization_id;
      console.log('ClassDetail (Delete) - Using Stytch org ID:', stytchOrgId);

      if (!stytchOrgId) {
        throw new Error('No organization ID found in session');
      }

      // Use direct fetch with explicit headers
      const response = await fetch(`/api/v1/classes/${params.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-stytch-organization-id': stytchOrgId
        }
      });

      if (!response.ok) {
        throw new Error(`Error deleting class: ${response.status} ${response.statusText}`);
      }

      router.push('/classes');
    } catch (err) {
      console.error('Error deleting class:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete class');
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
            <Link href="/classes" className="text-blue-600 hover:underline">
              Back to Classes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="p-6">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p className="font-bold">Class not found</p>
          <p>The requested class could not be found.</p>
          <div className="mt-4">
            <Link href="/classes" className="text-blue-600 hover:underline">
              Back to Classes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const createdDate = new Date(classData.createdAt).toLocaleDateString();
  const updatedDate = new Date(classData.updatedAt).toLocaleDateString();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Class Details</h1>
        <div className="flex space-x-3">
          <Link 
            href="/classes" 
            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
          >
            Back to List
          </Link>
          <Link 
            href={`/classes/${params.id}/edit`} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Edit Class
          </Link>
          <button 
            onClick={handleDeleteClass}
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
                Class Information
              </h2>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-500 text-sm">Name</span>
                  <p className="font-medium">{classData.name}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Code</span>
                  <p className="font-medium">{classData.code || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Status</span>
                  <p>
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      classData.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {classData.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Subsidiary</span>
                  <p className="font-medium">
                    {subsidiary ? (
                      <Link href={`/subsidiaries/${classData.subsidiaryId}`} className="text-blue-600 hover:underline">
                        {subsidiary.name}
                      </Link>
                    ) : (
                      classData.subsidiaryId
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-gray-200">
                Description
              </h2>
              <p className="text-gray-700">
                {classData.description || 'No description provided'}
              </p>
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
                  <p className="font-mono text-xs text-gray-600">{classData.id}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Organization ID</span>
                  <p className="font-mono text-xs text-gray-600">{classData.organizationId}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}