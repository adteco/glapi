import { headers } from 'next/headers';

export interface OrganizationContext {
  organizationId: string;
  userId: string;
  clerkOrganizationId?: string;
  stytchOrganizationId?: string;
  apiKeyName?: string;
}

export function getServiceContext(): OrganizationContext {
  const headersList = headers();
  
  const organizationId = headersList.get('x-organization-id');
  const userId = headersList.get('x-user-id');
  const apiKeyName = headersList.get('x-api-key-name');
  
  if (!organizationId || !userId) {
    console.warn('Organization context not found in request - using development fallback with UUID');
    
    return {
      organizationId: 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2', // Use existing Adteco org for development  
      userId: 'user_development',
      clerkOrganizationId: 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2'
    };
  }
  
  return {
    organizationId,
    userId,
    clerkOrganizationId: organizationId,
    stytchOrganizationId: organizationId,
    apiKeyName: apiKeyName || undefined
  };
}