'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStytchMemberSession } from '@stytch/nextjs/b2b';
import { apiClient, Subsidiary } from '@/lib/db-adapter';

export default function SubsidiariesWidget() {
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { session } = useStytchMemberSession();

  useEffect(() => {
    if (!session) return;
    
    const fetchSubsidiaries = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.subsidiaries.list({ 
          limit: 5,
          orderBy: 'name',
          orderDirection: 'asc',
          isActive: true
        });
        setSubsidiaries(response.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subsidiaries');
        console.error('Error fetching subsidiaries for widget:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubsidiaries();
  }, [session]);

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-700">Subsidiaries</h3>
        <button
          onClick={() => router.push('/subsidiaries')}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          View all
        </button>
      </div>

      {isLoading ? (
        <div className="py-4 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading subsidiaries...</p>
        </div>
      ) : error ? (
        <div className="py-4 text-center text-red-500">
          <p>Error: {error}</p>
        </div>
      ) : subsidiaries.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-gray-500">No subsidiaries found</p>
          <button
            onClick={() => router.push('/subsidiaries/new')}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Add a Subsidiary
          </button>
        </div>
      ) : (
        <div>
          <ul className="divide-y divide-gray-200">
            {subsidiaries.map((subsidiary) => (
              <li key={subsidiary.id} className="py-2">
                <div className="flex justify-between">
                  <div className="hover:text-blue-600 cursor-pointer" onClick={() => router.push(`/subsidiaries/${subsidiary.id}`)}>
                    <span className="font-medium">{subsidiary.name}</span>
                    <span className="ml-2 text-xs text-gray-500">{subsidiary.code}</span>
                  </div>
                  {subsidiary.parentId && (
                    <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                      Has Parent
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}