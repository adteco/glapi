import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_DEBUG_LOGS = process.env.AUTH_DEBUG_LOGS === 'true';

function summarizeValue(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function authDebug(event: string, payload: Record<string, unknown>) {
  if (!AUTH_DEBUG_LOGS) return;
  console.info(`[auth-debug][middleware] ${event}`, payload);
}

// Temporary hardcoded API keys for development
const VALID_API_KEYS: Record<string, {
  organizationId: string;
  actorEntityId: string;
  name: string;
  scopes: string[];
}> = {
  'glapi_test_sk_1234567890abcdef': {
    organizationId: 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2', // Adteco org UUID
    // Must be a UUID because many tables store audit fields as uuid.
    // In dev we use a stable "system actor" UUID; it does not need to exist in `entities`.
    actorEntityId: '00000000-0000-0000-0000-000000000001',
    name: 'Development API Key (Adteco)',
    scopes: ['read', 'write']
  },
  'glapi_test_sk_orgb_0987654321fedcba': {
    organizationId: '456c2475-2277-4d90-929b-ae694a2a8577', // CJD-Consulting org UUID
    actorEntityId: '00000000-0000-0000-0000-000000000002',
    name: 'Development API Key (CJD-Consulting)',
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
  const isProduction = process.env.NODE_ENV === 'production';

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
    const hasAuthorization = Boolean(
      request.headers.get('authorization') || request.headers.get('Authorization'),
    );
    let authSource: 'none' | 'api_key' | 'bearer_token' = 'none';

    authDebug('incoming_request', {
      method: request.method,
      path: request.nextUrl.pathname,
      hasAuthorization: Boolean(
        request.headers.get('authorization') || request.headers.get('Authorization'),
      ),
      hasApiKey: Boolean(apiKey),
      hasXOrganizationId: Boolean(request.headers.get('x-organization-id')),
      hasXUserId: Boolean(request.headers.get('x-user-id')),
      hasXClerkOrganizationId: Boolean(request.headers.get('x-clerk-organization-id')),
      hasXClerkUserId: Boolean(request.headers.get('x-clerk-user-id')),
      xOrganizationId: summarizeValue(request.headers.get('x-organization-id')),
      xUserId: summarizeValue(request.headers.get('x-user-id')),
      origin: origin || null,
    });

    // Check API key authentication
    if (apiKey) {
      if (VALID_API_KEYS[apiKey]) {
        const keyData = VALID_API_KEYS[apiKey];

        // Add organization context to request headers for API routes to use
        requestHeaders.set('x-organization-id', keyData.organizationId);
        requestHeaders.set('x-user-id', keyData.actorEntityId);
        requestHeaders.set('x-api-key-name', keyData.name);
        authSource = 'api_key';
      } else {
        authDebug('invalid_api_key', {
          path: request.nextUrl.pathname,
        });
        return new Response(JSON.stringify({ error: 'Invalid API key' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      // Browser-supplied identity headers are never trusted as the source of truth.
      // End-user requests must be derived from a verified bearer token downstream.
      if (hasAuthorization || isProduction) {
        requestHeaders.delete('x-organization-id');
        requestHeaders.delete('x-user-id');
        requestHeaders.delete('x-clerk-organization-id');
        requestHeaders.delete('x-clerk-user-id');
      }

      if (hasAuthorization) {
        authSource = 'bearer_token';
      }
    }

    authDebug('normalized_headers', {
      path: request.nextUrl.pathname,
      authSource,
      hasAuthorization: Boolean(
        requestHeaders.get('authorization') || requestHeaders.get('Authorization'),
      ),
      hasXOrganizationId: Boolean(requestHeaders.get('x-organization-id')),
      hasXUserId: Boolean(requestHeaders.get('x-user-id')),
      xOrganizationId: summarizeValue(requestHeaders.get('x-organization-id')),
      xUserId: summarizeValue(requestHeaders.get('x-user-id')),
      apiKeyName: requestHeaders.get('x-api-key-name') || null,
    });
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
