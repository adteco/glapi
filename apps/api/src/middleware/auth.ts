import { Request, Response, NextFunction } from 'express';
import { OrganizationService } from '@glapi/api-service';

/**
 * Middleware to handle authentication and organization context
 * In a production environment, this would verify the JWT token from Stytch
 * and extract the organization ID from the payload.
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stytchOrgIdFromHeader = req.headers['x-stytch-organization-id'] as string;
    const userId = req.headers['x-user-id'] as string; // Keep userId if needed

    console.log(`[AuthMiddleware] Received x-stytch-organization-id: '${stytchOrgIdFromHeader}' for path: ${req.path}`);

    // For development purposes, use a default organization for unauthenticated requests
    // In production, this would verify the JWT token from Stytch
    if (!stytchOrgIdFromHeader || stytchOrgIdFromHeader === '00000000-0000-0000-0000-000000000001') {
      console.log('[AuthMiddleware] No valid organization ID received - using development fallback');

      // Set a development fallback organization context
      (req as any).organizationContext = {
        organizationId: 'organization-default-dev',  // Default org ID for development
        userId: userId || 'user-default-dev',        // Default user ID for development
        stytchOrganizationId: 'organization-test-6f0cd115-d208-4462-8b0a-d1e8df4568a7' // Test Stytch org ID
      };

      return next();
    }

    const orgService = new OrganizationService();
    let organization;

    try {
      organization = await orgService.getOrganizationByStytchId(stytchOrgIdFromHeader);
    } catch (serviceError) {
      console.error(`[AuthMiddleware] Error calling getOrganizationByStytchId for ID '${stytchOrgIdFromHeader}':`, serviceError);
      return res.status(500).json({
        message: 'Internal Server Error - Failed to query organization by Stytch ID.'
      });
    }

    if (!organization) {
      console.error(`[AuthMiddleware] No organization found for Stytch ID: '${stytchOrgIdFromHeader}'`);
      return res.status(500).json({
        message: `Internal Server Error - Organization not found for provided Stytch ID.`
      });
    }

    // console.log('[AuthMiddleware] Successfully resolved organization:', organization); // Optional: log resolved org

    // Set the organization context on the request
    (req as any).organizationContext = {
      organizationId: organization.id, // Use the ID from the found organization
      userId: userId || 'user-default', // Keep existing userId logic or refine
      stytchOrganizationId: organization.stytchOrgId // Use the Stytch ID from the found organization
    };
    
    next();

  } catch (error) { // Catch any other unexpected errors in the middleware itself
    console.error('[AuthMiddleware] Unexpected error:', error);
    return res.status(500).json({ 
      message: 'Internal Server Error - Unexpected issue in authentication middleware.' 
    });
  }
};