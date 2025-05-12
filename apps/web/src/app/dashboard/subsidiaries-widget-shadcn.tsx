'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStytchMemberSession } from '@stytch/nextjs/b2b';
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, PlusCircle } from "lucide-react";

interface SubsidiaryStats {
  total: number;
  active: number;
  inactive: number;
  recentlyAdded: number; // In the last 30 days
}

export default function SubsidiariesWidgetShadcn() {
  const { session } = useStytchMemberSession();
  const [stats, setStats] = useState<SubsidiaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      fetchSubsidiaryStats();
    }
  }, [session]);

  const fetchSubsidiaryStats = async () => {
    setLoading(true);
    try {
      // Get the Stytch organization ID from the session
      const stytchOrgId = session?.organization?.organization_id || '00000000-0000-0000-0000-000000000001';
      
      // Use direct fetch with explicit headers
      const response = await fetch('/api/v1/subsidiaries?limit=100', {
        headers: {
          'Content-Type': 'application/json',
          'x-stytch-organization-id': stytchOrgId
        }
      });

      if (!response.ok) {
        throw new Error(`Error fetching subsidiaries: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Calculate stats
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const stats: SubsidiaryStats = {
        total: data.total || 0,
        active: data.data?.filter(s => s.isActive).length || 0,
        inactive: data.data?.filter(s => !s.isActive).length || 0,
        recentlyAdded: data.data?.filter(s => {
          const createdDate = new Date(s.createdAt);
          return createdDate >= thirtyDaysAgo;
        }).length || 0
      };

      setStats(stats);
    } catch (err) {
      console.error('Error fetching subsidiary stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch subsidiary statistics');
      // Set default stats for UI
      setStats({
        total: 0,
        active: 0,
        inactive: 0,
        recentlyAdded: 0
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <CardHeader>
          <CardTitle>Subsidiaries</CardTitle>
          <CardDescription>Overview of your company subsidiaries</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[120px] w-full" />
        </CardContent>
      </>
    );
  }

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div>
          <CardTitle>Subsidiaries</CardTitle>
          <CardDescription>Overview of your company structure</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/subsidiaries">View All</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-primary/10 rounded-lg p-3">
            <div className="text-xs font-semibold text-primary/80 uppercase">Total</div>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </div>
          
          <div className="bg-green-500/10 rounded-lg p-3">
            <div className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase">Active</div>
            <div className="text-2xl font-bold">{stats?.active || 0}</div>
          </div>
        </div>
        
        <div className="flex items-center justify-center py-3">
          <Building2 className="h-16 w-16 text-muted-foreground/30" />
        </div>
        
        {stats?.total === 0 ? (
          <div className="text-center text-muted-foreground">
            No subsidiaries found. Add your first subsidiary to organize your company structure.
          </div>
        ) : null}
      </CardContent>
      
      <CardFooter>
        <Button variant="outline" asChild className="w-full">
          <Link href="/subsidiaries/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Subsidiary
          </Link>
        </Button>
      </CardFooter>
    </>
  );
}