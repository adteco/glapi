'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStytchMemberSession } from '@stytch/nextjs/b2b';

interface CustomerStats {
  total: number;
  active: number;
  inactive: number;
  recentlyAdded: number; // In the last 30 days
}

export default function CustomersWidget() {
  const { session } = useStytchMemberSession();
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      fetchCustomerStats();
    }
  }, [session]);

  const fetchCustomerStats = async () => {
    setLoading(true);
    try {
      // Get the Stytch organization ID from the session
      const stytchOrgId = session?.organization?.organization_id || '00000000-0000-0000-0000-000000000001';
      console.log('Using Stytch org ID for stats:', stytchOrgId);

      // Use direct fetch with explicit headers
      const response = await fetch('/api/v1/customers?limit=100', {
        headers: {
          'Content-Type': 'application/json',
          'x-stytch-organization-id': stytchOrgId
        }
      });

      if (!response.ok) {
        throw new Error(`Error fetching customers: ${response.status} ${response.statusText}`);
      }

      const allCustomers = await response.json();
      console.log('Fetched customer data for stats:', allCustomers);

      // Calculate stats from the customer data
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const stats: CustomerStats = {
        total: allCustomers.total,
        active: allCustomers.data.filter(c => c.status === 'active').length,
        inactive: allCustomers.data.filter(c => c.status !== 'active').length,
        recentlyAdded: allCustomers.data.filter(c => {
          const createdDate = new Date(c.createdAt);
          return createdDate >= thirtyDaysAgo;
        }).length
      };

      console.log('Calculated customer stats:', stats);
      setStats(stats);
    } catch (err) {
      console.error('Error fetching customer stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch customer statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-5 w-full h-48 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-5 w-full">
        <h3 className="text-lg font-semibold text-gray-700 mb-3">Customer Statistics</h3>
        <div className="text-red-500">Error loading customer data</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-5 w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-700">Customer Statistics</h3>
        <Link 
          href="/customers" 
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          View All
        </Link>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-xs text-blue-500 uppercase font-semibold">Total Customers</div>
          <div className="text-2xl font-bold">{stats?.total || 0}</div>
        </div>
        
        <div className="bg-green-50 rounded-lg p-3">
          <div className="text-xs text-green-500 uppercase font-semibold">Active</div>
          <div className="text-2xl font-bold">{stats?.active || 0}</div>
        </div>
        
        <div className="bg-yellow-50 rounded-lg p-3">
          <div className="text-xs text-yellow-500 uppercase font-semibold">Inactive/Archived</div>
          <div className="text-2xl font-bold">{stats?.inactive || 0}</div>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-3">
          <div className="text-xs text-purple-500 uppercase font-semibold">New (30 days)</div>
          <div className="text-2xl font-bold">{stats?.recentlyAdded || 0}</div>
        </div>
      </div>
      
      <div className="mt-4">
        <Link 
          href="/customers/new" 
          className="text-sm text-white bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded block text-center"
        >
          Add New Customer
        </Link>
      </div>
    </div>
  );
}