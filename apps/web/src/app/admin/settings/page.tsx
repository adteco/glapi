'use client';

import { SeedAccountsButton } from '@/components/SeedAccountsButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminSettingsPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Admin Settings</h1>
      
      <Card className="w-full md:w-1/2">
        <CardHeader>
          <CardTitle>Chart of Accounts</CardTitle>
          <CardDescription>
            Initialize the default Chart of Accounts for your active organization.
            This action can only be performed once per organization if no accounts exist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SeedAccountsButton />
        </CardContent>
      </Card>
    </div>
  );
} 