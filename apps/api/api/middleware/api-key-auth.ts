import { Request, Response, NextFunction } from 'express';

// Temporary hardcoded API keys for development
// TODO: Replace with Clerk's API key solution when available
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

interface AuthenticatedRequest extends Request {
  organizationContext?: {
    organizationId: string;
    userId: string;
    apiKeyName?: string;
  };
}

/**
 * Middleware to handle API key authentication
 * This is a temporary stub implementation with hardcoded keys
 * Will be replaced with Clerk's solution when available
 */
export const apiKeyAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check for API key in X-API-Key header
    const apiKey = req.headers['x-api-key'] as string;
    
    if (apiKey && VALID_API_KEYS[apiKey]) {
      const keyData = VALID_API_KEYS[apiKey];
      
      console.log(`[APIKeyAuth] Valid API key used: ${keyData.name}`);
      
      // Set organization context from API key
      req.organizationContext = {
        organizationId: keyData.organizationId,
        userId: 'api-key-user', // Generic user for API key access
        apiKeyName: keyData.name
      };
      
      return next();
    }
    
    // If no API key, continue to next middleware (Clerk auth)
    return next();
  } catch (error) {
    console.error('[APIKeyAuth] Unexpected error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error - API key authentication error' 
    });
  }
};

/**
 * Combined authentication middleware that tries API key first, then Clerk
 */
export const combinedAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  // If API key is provided, it must be valid
  if (apiKey) {
    if (VALID_API_KEYS[apiKey]) {
      const keyData = VALID_API_KEYS[apiKey];
      console.log(`[APIKeyAuth] Valid API key used: ${keyData.name}`);
      
      req.organizationContext = {
        organizationId: keyData.organizationId,
        userId: 'api-key-user',
        apiKeyName: keyData.name
      };
      
      return next();
    } else {
      console.error(`[APIKeyAuth] Invalid API key provided: ${apiKey}`);
      return res.status(401).json({ 
        error: 'Invalid API key' 
      });
    }
  }
  
  // No API key provided, try Clerk auth
  const { clerkAuthMiddleware } = require('./clerk-auth');
  return clerkAuthMiddleware(req, res, next);
};