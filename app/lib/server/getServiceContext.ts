import { type NextRequest } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';

// Define the shape of the context object
export interface ServiceContext {
  organizationId: string;
  userId?: string;
  clerkOrganizationId?: string;
}

/**
 * Extracts organization and user context from incoming API requests.
 * It checks for Clerk session, API key, and other custom headers.
 *
 * @param {NextRequest} req - The incoming Next.js request object.
 * @returns {Promise<ServiceContext>} The service context.
 * @throws {Error} If no authentication method is provided or is invalid.
 */
export async function getServiceContext(req: NextRequest): Promise<ServiceContext> {
  const headers = req.headers;

  // Priority 1: Check for Clerk JWT authentication
  const authHeader = headers.get('authorization');
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = await clerkClient.verifyToken(token);
      if (decoded && decoded.org_id && decoded.sub) {
        return {
          organizationId: decoded.org_id,
          userId: decoded.sub,
          clerkOrganizationId: decoded.org_id,
        };
      }
    } catch (error) {
      console.warn('Clerk JWT verification failed:', error);
      // Fall through to other methods
    }
  }

  // Priority 2: Check for API Key + Organization ID headers
  const apiKey = headers.get('x-api-key');
  const orgId = headers.get('x-organization-id');

  if (apiKey && orgId) {
    // Here you would typically validate the API key against a database
    // For now, we'll assume if it exists, it's valid for the given org.
    // In a real app: const isValid = await validateApiKey(apiKey, orgId);
    // if (!isValid) throw new Error('Invalid API Key for the provided organization');
    
    return {
      organizationId: orgId,
      userId: headers.get('x-user-id') || undefined, // Optional user ID
    };
  }
  
  // Development fallback
  if (process.env.NODE_ENV === 'development') {
    return {
      organizationId: 'org_development_fallback',
      userId: 'user_development_fallback',
    };
  }

  throw new Error('Unauthorized: Missing API Key and Organization ID, or a valid token.');
} 