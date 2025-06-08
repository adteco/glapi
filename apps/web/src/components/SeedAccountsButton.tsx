'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button'; // Assuming you have a Button component from Shadcn/ui
import { toast } from 'sonner'; // Assuming you use sonner for toasts

interface SeedAccountsButtonProps {
  onSuccess?: () => void;
}

export function SeedAccountsButton({ onSuccess }: SeedAccountsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { getToken, orgId } = useAuth(); // Get token and current orgId

  const handleSeedAccounts = async () => {
    if (!orgId) {
      toast.error('No active organization selected. Please select or create an organization.');
      return;
    }

    setIsLoading(true);
    try {
      const token = await getToken(); // Get the default Clerk JWT token
      if (!token) {
        toast.error('Authentication token not available. Please try again.');
        setIsLoading(false);
        return;
      }

      // Adjust the API URL based on your setup (e.g., if API is on a different port/domain)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'; 
      const response = await fetch(`${apiUrl}/api/gl/accounts/seed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          // The orgId is already part of the JWT claim and used by the backend
        },
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message || 'Default accounts seeded successfully!');
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(result.message || result.error || 'Failed to seed accounts.');
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