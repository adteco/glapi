import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface ClerkJWTPayload {
  azp?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  nbf?: number;
  sid?: string;
  sub?: string;
  org_id?: string;
  org_role?: string;
  org_slug?: string;
  org_permissions?: string[];
  email?: string;
}

interface AuthenticatedRequest extends Request {
  organizationContext?: {
    organizationId: string;
    userId: string;
    clerkOrganizationId?: string;
  };
}

/**
 * Middleware to handle Clerk authentication and organization context
 */
export const clerkAuthMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[ClerkAuthMiddleware] No Bearer token provided - using development fallback');
      
      // Set a development fallback organization context
      req.organizationContext = {
        organizationId: 'org_development',
        userId: 'user_development',
      };
      
      return next();
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Decode the JWT without verification for now (in production, you should verify with Clerk's public key)
    const decoded = jwt.decode(token) as ClerkJWTPayload;
    
    if (!decoded) {
      console.error('[ClerkAuthMiddleware] Failed to decode JWT token');
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    console.log(`[ClerkAuthMiddleware] Decoded JWT - org_id: ${decoded.org_id}, user_id: ${decoded.sub}`);

    // Check if org_id is a template string that wasn't resolved
    if (decoded.org_id && decoded.org_id.includes('{{')) {
      console.error(`[ClerkAuthMiddleware] JWT contains unresolved template: ${decoded.org_id}`);
      return res.status(400).json({ 
        error: 'Invalid JWT token configuration. Please check your Clerk JWT template.' 
      });
    }

    // If no organization ID in the token, return error (orgs are required)
    if (!decoded.org_id) {
      console.error('[ClerkAuthMiddleware] No organization ID in token');
      return res.status(403).json({ 
        error: 'No organization selected. Please select an organization to continue.' 
      });
    }

    // Use Clerk's org_id directly as the organizationId
    req.organizationContext = {
      organizationId: decoded.org_id,
      userId: decoded.sub || 'user_unknown',
      clerkOrganizationId: decoded.org_id,
    };
    
    console.log(`[ClerkAuthMiddleware] Set organization context - org: ${decoded.org_id}, user: ${decoded.sub}`);
    
    next();

  } catch (error) {
    console.error('[ClerkAuthMiddleware] Unexpected error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error - Authentication middleware error' 
    });
  }
};