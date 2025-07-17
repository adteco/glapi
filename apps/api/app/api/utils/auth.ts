import { headers } from 'next/headers';

export interface OrganizationContext {
  organizationId: string;
  userId: string;
  clerkOrganizationId?: string;
  apiKeyName?: string;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export function getServiceContext(): OrganizationContext {
  const headersList = headers();
  
  const organizationId = headersList.get('x-organization-id');
  const userId = headersList.get('x-user-id');
  const apiKeyName = headersList.get('x-api-key-name');
  
  // TEMPORARY: For testing, use provided headers or fall back to development
  console.log('Auth context - orgId:', organizationId, 'userId:', userId);
  
  if (organizationId && userId) {
    return {
      organizationId,
      userId,
      clerkOrganizationId: organizationId,
      apiKeyName: apiKeyName || undefined
    };
  }
  
  // Fallback for development
  console.log('No org/user in headers - using development context');
  return {
    organizationId: 'org_development',
    userId: 'user_development',
    clerkOrganizationId: 'org_development'
  };
  
  /*
  if (!organizationId || !userId) {
    // Only allow fallback in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('Organization context not found in request - using development fallback with UUID');
      
      return {
        organizationId: 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2', // Development fallback UUID
        userId: 'user_development',
        clerkOrganizationId: 'org_development'
      };
    }
    
    // In production, throw an error
    const missing = [];
    if (!organizationId) missing.push('x-organization-id');
    if (!userId) missing.push('x-user-id');
    
    throw new AuthenticationError(
      `Missing required authentication headers: ${missing.join(', ')}`
    );
  }
  
  return {
    organizationId,
    userId,
    clerkOrganizationId: organizationId,
    apiKeyName: apiKeyName || undefined
  };
  */
}

// For routes that might be partially public (like health checks)
export function getOptionalServiceContext(): OrganizationContext | null {
  const headersList = headers();
  
  const organizationId = headersList.get('x-organization-id');
  const userId = headersList.get('x-user-id');
  const apiKeyName = headersList.get('x-api-key-name');
  
  if (!organizationId || !userId) {
    return null;
  }
  
  return {
    organizationId,
    userId,
    clerkOrganizationId: organizationId,
    apiKeyName: apiKeyName || undefined
  };
}