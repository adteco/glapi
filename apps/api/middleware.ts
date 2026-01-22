import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Temporary hardcoded API keys for development
const VALID_API_KEYS: Record<string, {
  organizationId: string;
  name: string;
  scopes: string[];
}> = {
  'glapi_test_sk_1234567890abcdef': {
    organizationId: 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2', // Use existing Adteco org UUID
    name: 'Development API Key',
    scopes: ['read', 'write']
  }
};

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:3020',
  'http://localhost:3030',  // Web app on port 3030
  'http://localhost:8787',  // MCP server
  'https://web.glapi.net',
  'https://www.glapi.net',
  'https://glapi.net',
  'https://docs.glapi.net'
];

export function middleware(request: NextRequest): NextResponse | Response {
  // Handle CORS
  const origin = request.headers.get('origin');

  // Build modified request headers that will be passed to route handlers
  const requestHeaders = new Headers(request.headers);

  // Handle preflight requests first
  if (request.method === 'OPTIONS') {
    const preflightResponse = new Response(null, { status: 200 });
    if (!origin || allowedOrigins.includes(origin)) {
      preflightResponse.headers.set('Access-Control-Allow-Origin', origin || '*');
      preflightResponse.headers.set('Access-Control-Allow-Credentials', 'true');
      preflightResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      preflightResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-organization-id, x-user-id, x-clerk-organization-id, x-clerk-user-id');
    }
    return preflightResponse;
  }

  // Only apply auth to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const apiKey = request.headers.get('x-api-key');

    // Check API key authentication
    if (apiKey) {
      if (VALID_API_KEYS[apiKey]) {
        const keyData = VALID_API_KEYS[apiKey];

        // Add organization context to request headers for API routes to use
        requestHeaders.set('x-organization-id', keyData.organizationId);
        requestHeaders.set('x-user-id', 'api-key-user');
        requestHeaders.set('x-api-key-name', keyData.name);
      } else {
        return new Response(JSON.stringify({ error: 'Invalid API key' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      // If no API key, check for x-organization-id header from client
      const clientOrgId = request.headers.get('x-organization-id') || request.headers.get('x-clerk-organization-id');
      const clientUserId = request.headers.get('x-user-id') || request.headers.get('x-clerk-user-id');

      if (clientOrgId) {
        // Normalize header names for route handlers
        requestHeaders.set('x-organization-id', clientOrgId);
        if (clientUserId) {
          requestHeaders.set('x-user-id', clientUserId);
        }
      }
      // No fallback - if no org ID is provided, the request should fail at the route handler level
    }
  }

  // Create response with modified request headers that get passed to route handlers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Set CORS headers on response
  if (!origin || allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-organization-id, x-user-id, x-clerk-organization-id, x-clerk-user-id');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};