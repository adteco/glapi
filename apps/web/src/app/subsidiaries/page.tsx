'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStytchMemberSession } from '@stytch/nextjs/b2b';
import Link from 'next/link';
import { apiClient, Subsidiary, PaginatedResult } from '@/lib/db-adapter';

export default function SubsidiariesPage() {
  const { session, isInitialized } = useStytchMemberSession();
  const router = useRouter();
  const [subsidiaryData, setSubsidiaryData] = useState<PaginatedResult<Subsidiary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showInactive, setShowInactive] = useState(false);
  const [parentFilter, setParentFilter] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (isInitialized && !session) {
      router.replace('/');
    } else if (session && session.organization_id) {
      fetchSubsidiaries(currentPage, pageSize);
    }
  }, [session, session?.organization_id, isInitialized, router, currentPage, pageSize, showInactive, parentFilter]);

  const fetchSubsidiaries = async (page = 1, limit = 10) => {
    setLoading(true);
    setError(null);

    if (!session?.organization_id || session.organization_id.trim() === '') {
      console.error('[SubsidiariesPage] Stytch organization ID not found or is empty in session.');
      console.log('[SubsidiariesPage] Full session:', JSON.stringify(session, null, 2));
      setError('Stytch organization ID not available in session. Cannot fetch subsidiaries.');
      setSubsidiaryData(null);
      setLoading(false);
      return;
    }

    const currentOrgId = session.organization_id;

    try {
      console.log('[SubsidiariesPage] Using Stytch org ID:', currentOrgId);

      // Use the API client to fetch subsidiaries with filtering
      const data = await apiClient.subsidiaries.list({
        page,
        limit,
        orderBy: 'name',
        orderDirection: 'asc',
        isActive: showInactive ? undefined : true,
        parentId: parentFilter
      }, currentOrgId);

      console.log('Fetched subsidiary data:', data);
      setSubsidiaryData(data);
    } catch (err) {
      console.error('Error fetching subsidiaries:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch subsidiaries');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleDeleteSubsidiary = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subsidiary?')) {
      return;
    }
    
    try {
      await apiClient.subsidiaries.delete(id);
      
      // Refresh the subsidiary list
      fetchSubsidiaries(currentPage, pageSize);
    } catch (err) {
      console.error('Error deleting subsidiary:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete subsidiary');
    }
  };

  // Toggle active/inactive filter
  const toggleInactiveFilter = () => {
    setCurrentPage(1); // Reset to first page when changing filter
    setShowInactive(!showInactive);
  };

  // Toggle parent filter
  const handleParentFilterChange = (value: string | null | undefined) => {
    setCurrentPage(1); // Reset to first page when changing filter
    setParentFilter(value);
  };

  if (loading && !subsidiaryData) {
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
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Subsidiaries</h1>
        <Link 
          href="/subsidiaries/new" 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Add New Subsidiary
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4 flex space-x-4 items-center">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="show-inactive"
            checked={showInactive}
            onChange={toggleInactiveFilter}
            className="mr-2"
          />
          <label htmlFor="show-inactive" className="text-sm text-gray-700">Show Inactive</label>
        </div>
        
        <div className="flex items-center">
          <label htmlFor="parent-filter" className="text-sm text-gray-700 mr-2">Parent:</label>
          <select
            id="parent-filter"
            value={parentFilter === undefined ? 'all' : parentFilter === null ? 'none' : parentFilter}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'all') handleParentFilterChange(undefined);
              else if (value === 'none') handleParentFilterChange(null);
              else handleParentFilterChange(value);
            }}
            className="px-2 py-1 border rounded"
          >
            <option value="all">All Subsidiaries</option>
            <option value="none">Top-Level Only</option>
            {subsidiaryData?.data.map(sub => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {subsidiaryData && subsidiaryData.data.length > 0 ? (
              subsidiaryData.data.map((subsidiary) => {
                // Find parent name if it exists
                const parentName = subsidiary.parentId 
                  ? subsidiaryData.data.find(sub => sub.id === subsidiary.parentId)?.name || 'Unknown'
                  : '-';
                
                return (
                  <tr key={subsidiary.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{subsidiary.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{subsidiary.code}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{parentName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        subsidiary.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {subsidiary.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(subsidiary.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link 
                        href={`/subsidiaries/${subsidiary.id}`}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        View
                      </Link>
                      <Link 
                        href={`/subsidiaries/${subsidiary.id}/edit`}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDeleteSubsidiary(subsidiary.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  No subsidiaries found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {subsidiaryData && subsidiaryData.totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{(subsidiaryData.page - 1) * subsidiaryData.limit + 1}</span> to{' '}
            <span className="font-medium">
              {Math.min(subsidiaryData.page * subsidiaryData.limit, subsidiaryData.total)}
            </span>{' '}
            of <span className="font-medium">{subsidiaryData.total}</span> results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded-md ${
                currentPage === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-blue-600 hover:bg-blue-50'
              }`}
            >
              Previous
            </button>
            {[...Array(subsidiaryData.totalPages)].map((_, index) => (
              <button
                key={index + 1}
                onClick={() => handlePageChange(index + 1)}
                className={`px-3 py-1 rounded-md ${
                  currentPage === index + 1
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-blue-600 hover:bg-blue-50'
                }`}
              >
                {index + 1}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === subsidiaryData.totalPages}
              className={`px-3 py-1 rounded-md ${
                currentPage === subsidiaryData.totalPages
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-blue-600 hover:bg-blue-50'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}