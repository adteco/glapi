import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Temporary hardcoded API keys for development
const VALID_API_KEYS: Record<string, {
  organizationId: string;
  name: string;
  scopes: string[];
}> = {
  'glapi_test_sk_1234567890abcdef': {
    organizationId: 'org_development',
    name: 'Development API Key',
    scopes: ['read', 'write']
  }
};

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3002',
  'https://web.glapi.net',
  'https://www.glapi.net',
  'https://glapi.net',
  'https://docs.glapi.net'
];

export function middleware(request: NextRequest) {
  // Handle CORS
  const origin = request.headers.get('origin');
  const response = NextResponse.next();
  
  // Set CORS headers
  if (!origin || allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-organization-id, x-user-id, x-stytch-organization-id');
  }
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: response.headers });
  }
  
  // Only apply auth to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const apiKey = request.headers.get('x-api-key');
    
    // Check API key authentication
    if (apiKey) {
      if (VALID_API_KEYS[apiKey]) {
        const keyData = VALID_API_KEYS[apiKey];
        
        // Add organization context to headers for API routes to use
        response.headers.set('x-organization-id', keyData.organizationId);
        response.headers.set('x-user-id', 'api-key-user');
        response.headers.set('x-api-key-name', keyData.name);
        
        return response;
      } else {
        return new Response(JSON.stringify({ error: 'Invalid API key' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(response.headers.entries())
          }
        });
      }
    }
    
    // If no API key, check for Clerk auth (you'll need to implement this)
    // For now, we'll use a development fallback
    response.headers.set('x-organization-id', 'org_development');
    response.headers.set('x-user-id', 'user_development');
  }
  
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};