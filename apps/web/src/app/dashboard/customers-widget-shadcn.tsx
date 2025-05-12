'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStytchMemberSession } from '@stytch/nextjs/b2b';
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UsersIcon, UserPlusIcon, Clock } from "lucide-react";

interface CustomerStats {
  total: number;
  active: number;
  inactive: number;
  recentlyAdded: number; // In the last 30 days
}

export default function CustomersWidgetShadcn() {
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
      <>
        <CardHeader>
          <CardTitle>Customer Statistics</CardTitle>
          <CardDescription>Overview of your customer data</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </>
    );
  }

  if (error) {
    return (
      <>
        <CardHeader>
          <CardTitle>Customer Statistics</CardTitle>
          <CardDescription className="text-destructive">Error loading customer data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
        </CardContent>
      </>
    );
  }

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div>
          <CardTitle>Customer Statistics</CardTitle>
          <CardDescription>Overview of your customer base</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/customers">View All</Link>
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <div className="bg-primary/10 rounded-lg p-3 flex flex-col">
          <div className="text-xs font-semibold text-primary/80 uppercase">Total Customers</div>
          <div className="text-2xl font-bold mt-1">{stats?.total || 0}</div>
          <UsersIcon className="text-primary/50 h-6 w-6 self-end mt-auto" />
        </div>
        
        <div className="bg-green-500/10 rounded-lg p-3 flex flex-col">
          <div className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase">Active</div>
          <div className="text-2xl font-bold mt-1">{stats?.active || 0}</div>
          <UsersIcon className="text-green-500/50 h-6 w-6 self-end mt-auto" />
        </div>
        
        <div className="bg-yellow-500/10 rounded-lg p-3 flex flex-col">
          <div className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase">Inactive/Archived</div>
          <div className="text-2xl font-bold mt-1">{stats?.inactive || 0}</div>
          <UsersIcon className="text-yellow-500/50 h-6 w-6 self-end mt-auto" />
        </div>
        
        <div className="bg-purple-500/10 rounded-lg p-3 flex flex-col">
          <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase">New (30 days)</div>
          <div className="text-2xl font-bold mt-1">{stats?.recentlyAdded || 0}</div>
          <Clock className="text-purple-500/50 h-6 w-6 self-end mt-auto" />
        </div>
      </CardContent>
      
      <CardFooter>
        <Button asChild className="w-full">
          <Link href="/customers/new">
            <UserPlusIcon className="mr-2 h-4 w-4" />
            Add New Customer
          </Link>
        </Button>
      </CardFooter>
    </>
  );
}