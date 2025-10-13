import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@glapi/trpc';
import type { AuthContext } from '../mcp/types';
import superjson from 'superjson';

/**
 * Create tRPC client for backend communication
 */
export function createBackendClient(apiUrl: string, authContext: AuthContext) {
  const trpcUrl = `${apiUrl}/api/trpc`;
  console.log('[tRPC Client] Connecting to:', trpcUrl);
  
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: trpcUrl,
        transformer: superjson,
        headers() {
          return {
            authorization: `Bearer ${authContext.token}`,
            'x-organization-id': authContext.organizationId,
            'x-user-id': authContext.userId,
            'x-clerk-user-id': authContext.userId,
            'x-clerk-organization-id': authContext.organizationId,
          };
        },
        fetch: async (input, init) => {
          console.log('[tRPC Client] Fetching:', input, init);
          const response = await fetch(input, init);
          console.log('[tRPC Client] Response status:', response.status);
          console.log('[tRPC Client] Response headers:', Object.fromEntries(response.headers.entries()));
          
          // Clone response to read body for debugging
          const cloned = response.clone();
          const text = await cloned.text();
          console.log('[tRPC Client] Response body (first 200 chars):', text.substring(0, 200));
          
          return response;
        },
      }),
    ],
  });
}

/**
 * Helper to handle tRPC errors
 */
export function handleAPIError(error: any): never {
  console.error('tRPC error:', error);
  console.error('Error details:', {
    code: error.code,
    message: error.message,
    cause: error.cause,
    data: error.data,
    shape: error.shape,
  });
  
  // Handle TRPCClientError
  if (error.data?.code) {
    const code = error.data.code;
    const message = error.message || error.data.message;
    
    if (code === 'UNAUTHORIZED') {
      throw new Error('Authentication failed');
    }
    
    if (code === 'FORBIDDEN') {
      throw new Error('Insufficient permissions');
    }
    
    if (code === 'NOT_FOUND') {
      throw new Error('Resource not found');
    }
    
    if (code === 'BAD_REQUEST') {
      throw new Error(`Validation error: ${message}`);
    }
    
    if (code === 'PRECONDITION_FAILED') {
      throw new Error(`Precondition failed: ${message}`);
    }
    
    if (code === 'CONFLICT') {
      throw new Error(`Conflict: ${message}`);
    }
  }
  
  // Handle Zod validation errors
  if (error.cause?.issues || error.data?.zodError) {
    const issues = (error.cause?.issues || error.data.zodError.fieldErrors);
    const errorMessages = Object.entries(issues)
      .map(([field, errors]: [string, any]) => 
        `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`
      ).join('; ');
    throw new Error(`Validation error: ${errorMessages}`);
  }
  
  // Handle fetch errors
  if (error.cause?.code === 'ECONNREFUSED') {
    throw new Error('Cannot connect to backend API. Is the API server running?');
  }
  
  throw new Error(`Backend error: ${error.message || 'Unknown error'}`);
}