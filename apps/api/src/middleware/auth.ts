import { Request, Response, NextFunction } from 'express';
import { OrganizationService } from '@glapi/api-service';

/**
 * Middleware to handle authentication and organization context
 * In a production environment, this would verify the JWT token from Stytch
 * and extract the organization ID from the payload.
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get the organization ID and Stytch ID from the header
    const orgId = req.headers['x-organization-id'] as string;
    const stytchOrgId = req.headers['x-stytch-organization-id'] as string;
    const userId = req.headers['x-user-id'] as string;
    
    // // Log the headers for debugging - EXTREMELY VERBOSE AND CLEAR
    // console.log('================================================================');
    // console.log('AUTH MIDDLEWARE - RECEIVED HEADERS:');
    // console.log('STYTCH ORGANIZATION ID FROM HEADER:', stytchOrgId || 'NOT PROVIDED');
    // console.log('ORGANIZATION ID FROM HEADER:', orgId || 'NOT PROVIDED');
    // console.log('USER ID FROM HEADER:', userId || 'NOT PROVIDED');
    // console.log('REQUEST PATH:', req.path);
    // console.log('REQUEST METHOD:', req.method);
    // console.log('ALL HEADERS:', req.headers);
    // console.log('================================================================');
    
    // Use a fixed organization ID for development
    // This simplifies testing and development
    const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
    
    // Create the organization service
    const orgService = new OrganizationService();
    
    // Find or create a default organization
    try {
      const defaultOrg = await orgService.findOrCreateOrganization({
        organization_id: stytchOrgId || '00000000-0000-0000-0000-000000000001',
        organization_name: 'Default Organization',
        organization_slug: 'default-org'
      });
      
      // console.log('================================================================');
      // console.log('AUTH MIDDLEWARE - ORGANIZATION CONTEXT SET:');
      // console.log('ORGANIZATION ID:', defaultOrg.id);
      // console.log('STYTCH ORGANIZATION ID:', defaultOrg.stytchOrgId);
      // console.log('ORGANIZATION NAME:', defaultOrg.name);
      // console.log('ORGANIZATION SLUG:', defaultOrg.slug);
      // console.log('================================================================');
      
      // Set the organization context on the request
      (req as any).organizationContext = {
        organizationId: defaultOrg.id,
        userId: userId || 'user-default',
        stytchOrganizationId: stytchOrgId || defaultOrg.stytchOrgId
      };
      
      // Continue to the next middleware/route handler
      next();
    } catch (error) {
      console.error('Error finding/creating organization:', error);
      
      if (isDevelopment) {
        // In development, use a mock context
        console.log('Using default mock organization context');
        (req as any).organizationContext = {
          organizationId: 'org-12345678',
          userId: userId || 'user-default',
          stytchOrganizationId: stytchOrgId || '00000000-0000-0000-0000-000000000001'
        };
        next();
      } else {
        // In production, return an error
        return res.status(401).json({
          message: 'Unauthorized - Organization context required'
        });
      }
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      message: 'Authentication error' 
    });
  }
};