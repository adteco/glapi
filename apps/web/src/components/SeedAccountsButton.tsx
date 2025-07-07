'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button'; // Assuming you have a Button component from Shadcn/ui
import { toast } from 'sonner'; // Assuming you use sonner for toasts
import { useApiClient } from '@/lib/api-client.client';

interface SeedAccountsButtonProps {
  onSuccess?: () => void;
}

export function SeedAccountsButton({ onSuccess }: SeedAccountsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { orgId } = useAuth(); // Get current orgId
  const { apiPost } = useApiClient();

  const handleSeedAccounts = async () => {
    if (!orgId) {
      toast.error('No active organization selected. Please select or create an organization.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await apiPost<{ message?: string; error?: string }>('/api/gl/accounts/seed', {});
      
      toast.success(result.message || 'Default accounts seeded successfully!');
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error seeding accounts:', error);
      toast.error('An unexpected error occurred while seeding accounts.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleSeedAccounts} disabled={isLoading || !orgId}>
      {isLoading ? 'Seeding...' : 'Seed Default Chart of Accounts'}
    </Button>
  );
} 