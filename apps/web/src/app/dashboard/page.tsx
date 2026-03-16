'use client';

import React from 'react';
import { useAuth } from '@clerk/nextjs';
import { DashboardManager } from '@/components/dashboard/DashboardManager';

const DashboardPage = () => {
  const { orgId } = useAuth();

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <DashboardManager />
    </div>
  );
};

export default DashboardPage;
