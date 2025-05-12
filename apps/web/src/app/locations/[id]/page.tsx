'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStytchMemberSession } from '@stytch/nextjs/b2b';
import Link from 'next/link';
import { apiClient } from '@/lib/db-adapter';

interface Location {
  id: string;
  organizationId: string;
  subsidiaryId: string;
  name: string;
  code: string;
  description: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  countryCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Subsidiary {
  id: string;
  name: string;
}

export default function LocationDetailPage({ params }: { params: { id: string } }) {
  const { session, isInitialized } = useStytchMemberSession();
  const router = useRouter();
  const [location, setLocation] = useState<Location | null>(null);
  const [subsidiary, setSubsidiary] = useState<Subsidiary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isInitialized && !session) {
      router.replace('/');
    } else if (session) {
      fetchLocation();
    }
  }, [session, isInitialized, router, params.id]);

  const fetchLocation = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get the Stytch organization ID from the session
      const stytchOrgId = session?.organization_id;
      console.log('LocationDetail - Using Stytch org ID:', stytchOrgId);
      console.log('LocationDetail - Full session:', JSON.stringify(session, null, 2));

      if (!stytchOrgId) {
        throw new Error('No organization ID found in session');
      }

      // Use direct fetch with explicit headers
      const response = await fetch(`/api/v1/locations/${params.id}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-stytch-organization-id': stytchOrgId
        }
      });

      if (!response.ok) {
        throw new Error(`Error fetching location: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Fetched location data:', data);

      setLocation(data.location);
      
      // Fetch subsidiary information if we have a subsidiaryId
      if (data.location?.subsidiaryId) {
        fetchSubsidiary(data.location.subsidiaryId, stytchOrgId);
      }
    } catch (err) {
      console.error('Error fetching location:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch location');
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

  const handleDeleteLocation = async () => {
    if (!confirm('Are you sure you want to delete this location?')) {
      return;
    }

    try {
      // Get the Stytch organization ID from the session
      const stytchOrgId = session?.organization_id;
      console.log('LocationDetail (Delete) - Using Stytch org ID:', stytchOrgId);

      if (!stytchOrgId) {
        throw new Error('No organization ID found in session');
      }

      // Use direct fetch with explicit headers
      const response = await fetch(`/api/v1/locations/${params.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-stytch-organization-id': stytchOrgId
        }
      });

      if (!response.ok) {
        throw new Error(`Error deleting location: ${response.status} ${response.statusText}`);
      }

      router.push('/locations');
    } catch (err) {
      console.error('Error deleting location:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete location');
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
            <Link href="/locations" className="text-blue-600 hover:underline">
              Back to Locations
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="p-6">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p className="font-bold">Location not found</p>
          <p>The requested location could not be found.</p>
          <div className="mt-4">
            <Link href="/locations" className="text-blue-600 hover:underline">
              Back to Locations
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const createdDate = new Date(location.createdAt).toLocaleDateString();
  const updatedDate = new Date(location.updatedAt).toLocaleDateString();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Location Details</h1>
        <div className="flex space-x-3">
          <Link 
            href="/locations" 
            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
          >
            Back to List
          </Link>
          <Link 
            href={`/locations/${params.id}/edit`} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Edit Location
          </Link>
          <button 
            onClick={handleDeleteLocation}
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
                Location Information
              </h2>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-500 text-sm">Name</span>
                  <p className="font-medium">{location.name}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Code</span>
                  <p className="font-medium">{location.code || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Status</span>
                  <p>
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      location.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {location.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Subsidiary</span>
                  <p className="font-medium">
                    {subsidiary ? (
                      <Link href={`/subsidiaries/${location.subsidiaryId}`} className="text-blue-600 hover:underline">
                        {subsidiary.name}
                      </Link>
                    ) : (
                      location.subsidiaryId
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
                {location.description || 'No description provided'}
              </p>
            </div>
          </div>

          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-gray-200">
                Address
              </h2>
              <div className="space-y-1">
                {location.addressLine1 && <p className="text-gray-700">{location.addressLine1}</p>}
                {location.addressLine2 && <p className="text-gray-700">{location.addressLine2}</p>}
                {(location.city || location.stateProvince || location.postalCode) && (
                  <p className="text-gray-700">
                    {[
                      location.city,
                      location.stateProvince,
                      location.postalCode
                    ].filter(Boolean).join(', ')}
                  </p>
                )}
                {location.countryCode && <p className="text-gray-700">{location.countryCode}</p>}
                {!location.addressLine1 && !location.addressLine2 && !location.city && 
                  !location.stateProvince && !location.postalCode && !location.countryCode && (
                  <p className="text-gray-500">No address information provided</p>
                )}
              </div>
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
                  <p className="font-mono text-xs text-gray-600">{location.id}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Organization ID</span>
                  <p className="font-mono text-xs text-gray-600">{location.organizationId}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}