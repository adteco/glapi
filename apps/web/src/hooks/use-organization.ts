import { useOrganization } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';

export function useCurrentOrganization() {
  const { organization } = useOrganization();
  
  // If Clerk organization is available, use it
  if (organization) {
    return {
      organizationId: organization.id,
      organizationName: organization.name,
      isLoading: false,
    };
  }
  
  // Otherwise, fetch the default organization from the API
  const { data, isLoading } = trpc.organizations.getDefault.useQuery();
  
  return {
    organizationId: data?.id || null,
    organizationName: data?.name || null,
    isLoading,
  };
}