'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  useStytchMemberSession,
  useStytchOrganization,
} from '@stytch/nextjs/b2b';
import CustomersWidget from '@/app/dashboard/customers-widget';
import SubsidiariesWidget from '@/app/dashboard/subsidiaries-widget';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const DashboardShadcn = () => {
  const { session, isInitialized } = useStytchMemberSession();
  const { organization } = useStytchOrganization();
  const router = useRouter();

  const role = useMemo(() => {
    return session?.roles.includes('stytch_admin') ? 'admin' : 'member';
  }, [session?.roles]);

  if (!isInitialized) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isInitialized && !session) {
    return router.replace("/")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome to GLAPI Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          You're logged into <strong>{organization?.organization_name}</strong> with <strong>{role}</strong> permissions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Customer Widget Card - We'll keep the widget content but wrap in shadcn Card */}
        <Card>
          <CustomersWidget />
        </Card>

        {/* Subsidiary Widget Card - We'll keep the widget content but wrap in shadcn Card */}
        <Card>
          <SubsidiariesWidget />
        </Card>

        {/* Recent Activity Card using shadcn components */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="border-l-4 border-green-500 pl-3 py-1">
              <div className="text-sm font-medium">New subsidiary added</div>
              <div className="text-xs text-muted-foreground">Today, 10:35 AM</div>
            </div>
            <div className="border-l-4 border-blue-500 pl-3 py-1">
              <div className="text-sm font-medium">Customer updated</div>
              <div className="text-xs text-muted-foreground">Yesterday, 2:15 PM</div>
            </div>
            <div className="border-l-4 border-purple-500 pl-3 py-1">
              <div className="text-sm font-medium">New user joined</div>
              <div className="text-xs text-muted-foreground">May 9, 2025</div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions Card using shadcn components */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button 
                onClick={() => router.push('/customers/new')}
              >
                Add New Customer
              </Button>
              <Button 
                variant="secondary"
                onClick={() => router.push('/subsidiaries/new')}
              >
                Add New Subsidiary
              </Button>
              <Button variant="outline">
                Generate Report
              </Button>
              <Button variant="outline">
                View Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardShadcn;