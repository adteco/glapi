import { verifyToken } from '@clerk/backend';
import type { AuthContext } from './types';

export class AuthenticationError extends Error {
  constructor(message: string, public code: number = -32000) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string, public code: number = -32001) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Extract and validate authentication from request headers
 */
export async function authenticateRequest(
  request: Request,
  env: Env
): Promise<AuthContext> {
  console.log('[Auth] Headers:', Object.fromEntries(request.headers.entries()));
  
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[Auth] Missing auth header. Got:', authHeader);
    throw new AuthenticationError('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);
  console.log('[Auth] Token length:', token.length);
  
  // Development mode: accept test tokens
  if (token === 'test-dev-token' && (!env.CLERK_SECRET_KEY || env.CLERK_SECRET_KEY.includes('test'))) {
    console.log('[Auth] Using development test token');
    return {
      userId: 'user_development',
      organizationId: 'org_development', // Matches API server
      permissions: [
        'read',
        'write',
        'customers:read',
        'customers:create',
        'customers:update',
        'customers:delete',
        'invoices:read',
        'invoices:create',
        'invoices:update',
        'invoices:delete',
      ],
      token,
      env,
      user: {
        id: 'user_development',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      },
    };
  }
  
  try {
    // Verify the Clerk JWT token
    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });

    if (!payload.sub) {
      throw new AuthenticationError('Invalid token: missing user ID');
    }

    // Extract organization from token or custom claims
    const organizationId = payload.org_id || payload.organization_id;
    
    if (!organizationId) {
      throw new AuthenticationError('No organization context found in token');
    }

    // Extract user information
    const user = {
      id: payload.sub,
      email: payload.email as string,
      firstName: payload.given_name as string,
      lastName: payload.family_name as string,
    };

    // Extract permissions (this could be expanded based on your permission model)
    // For now, grant all permissions to authenticated users with an org context
    const permissions = payload.permissions as string[] || [
      'read',
      'write',
      'customers:read',
      'customers:create',
      'customers:update',
      'customers:delete',
      'invoices:read',
      'invoices:create',
      'invoices:update',
      'invoices:delete',
    ];

    return {
      userId: payload.sub,
      organizationId: organizationId as string,
      permissions,
      token, // Include the original token for forwarding
      env, // Include the environment for access to variables
      user,
    };
  } catch (error) {
    console.error('Authentication error:', error);
    throw new AuthenticationError('Token validation failed');
  }
}

/**
 * Check if user has required permission for operation
 */
export function checkPermission(
  context: AuthContext, 
  requiredPermission: string
): void {
  if (!context.permissions.includes(requiredPermission) && 
      !context.permissions.includes('admin')) {
    throw new AuthorizationError(
      `Insufficient permissions. Required: ${requiredPermission}`
    );
  }
}

/**
 * Rate limiting middleware
 */
export class RateLimiter {
  private requests = new Map<string, number[]>();

  constructor(
    private maxRequests: number = 60,
    private windowMs: number = 60 * 1000 // 1 minute
  ) {}

  checkLimit(organizationId: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Get existing requests for this organization
    const orgRequests = this.requests.get(organizationId) || [];
    
    // Filter out requests outside the current window
    const recentRequests = orgRequests.filter(time => time > windowStart);
    
    // Check if limit exceeded
    if (recentRequests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(organizationId, recentRequests);
    
    return true;
  }

  cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    
    for (const [org, requests] of this.requests.entries()) {
      const recent = requests.filter(time => time > cutoff);
      if (recent.length === 0) {
        this.requests.delete(org);
      } else {
        this.requests.set(org, recent);
      }
    }
  }
}

// Environment interface for Cloudflare Worker
export interface Env {
  CLERK_SECRET_KEY: string;
  GLAPI_API_URL: string;
  OPENAI_API_KEY?: string;
  RATE_LIMIT_REQUESTS_PER_MINUTE?: string;
  RATE_LIMIT_BURST?: string;
}