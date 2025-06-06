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
    console.warn('Organization context not found in request - using development fallback');
    
    return {
      organizationId: 'org_development',
      userId: 'user_development',
      clerkOrganizationId: 'org_development'
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