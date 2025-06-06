import { Router, Request, Response, NextFunction } from 'express';
import { OrganizationService } from '@glapi/api-service';

const router: Router = Router();

// Helper to get organization context from request
const getServiceContext = (req: Request) => {
  const context = (req as any).organizationContext;
  
  if (!context || !context.organizationId) {
    throw new Error('Organization context not found');
  }
  
  console.log('Using organization context:', context);
  return context;
};

/**
 * GET /api/v1/organizations/lookup
 * Lookup an organization by its Stytch organization ID
 */
router.get('/lookup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stytchOrgId = req.query.stytchOrgId as string;
    
    if (!stytchOrgId) {
      return res.status(400).json({
        message: 'Missing required parameter: stytchOrgId'
      });
    }
    
    // Initialize the organization service
    const orgService = new OrganizationService();
    
    // Look up the organization
    const organization = await orgService.getOrganizationByStytchId(stytchOrgId);
    
    if (!organization) {
      // If not found, create a new one
      console.log('Organization not found, creating a new one');
      try {
        const newOrg = await orgService.findOrCreateOrganization({
          organization_id: stytchOrgId,
          organization_name: 'New Organization',
          organization_slug: `org-${Date.now()}`
        });
        
        return res.status(200).json({ 
          organization: newOrg,
          isNew: true
        });
      } catch (createError) {
        console.error('Error creating organization:', createError);
        throw createError;
      }
    }
    
    return res.status(200).json({ organization });
  } catch (error) {
    console.error('Error looking up organization:', error);
    // Check if it's a ServiceError
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as any;
      return res.status(serviceError.statusCode).json({
        message: serviceError.message,
        code: serviceError.code,
        details: serviceError.details
      });
    }
    // Generic error handling
    if (error instanceof Error) {
      return res.status(500).json({ 
        message: error.message 
      });
    }
    next(error);
    return undefined; // To satisfy TypeScript
  }
});

/**
 * GET /api/v1/organizations/default
 * Get the default organization for development
 */
router.get('/default', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Initialize the organization service
    const orgService = new OrganizationService();
    
    // Create or get default organization
    const defaultOrg = await orgService.findOrCreateOrganization({
      organization_id: '00000000-0000-0000-0000-000000000001',
      organization_name: 'Default Organization',
      organization_slug: 'default-org'
    });
    
    return res.status(200).json({ organization: defaultOrg });
  } catch (error) {
    console.error('Error getting default organization:', error);
    // Check if it's a ServiceError
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as any;
      return res.status(serviceError.statusCode).json({
        message: serviceError.message,
        code: serviceError.code,
        details: serviceError.details
      });
    }
    // Generic error handling
    if (error instanceof Error) {
      return res.status(500).json({ 
        message: error.message 
      });
    }
    next(error);
    return undefined; // To satisfy TypeScript
  }
});

/**
 * GET /api/v1/organizations
 * Get all organizations (requires admin role)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Use just the service directly without requiring context
    // In a real app, we'd check for admin role here
    const orgService = new OrganizationService();
    
    // This is a sample implementation - in a real app, we'd query the database
    // For now we'll just return organization by ID
    const context = getServiceContext(req);
    const organization = await orgService.getOrganizationById(context.organizationId);
    
    const organizations = organization ? [organization] : [];
    
    return res.status(200).json({
      organizations,
      total: organizations.length,
      page: 1,
      limit: 10,
      totalPages: 1
    });
  } catch (error) {
    console.error('Error getting organizations:', error);
    // Check if it's a ServiceError
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as any;
      return res.status(serviceError.statusCode).json({
        message: serviceError.message,
        code: serviceError.code,
        details: serviceError.details
      });
    }
    // Generic error handling
    if (error instanceof Error) {
      return res.status(500).json({ 
        message: error.message 
      });
    }
    next(error);
    return undefined; // To satisfy TypeScript
  }
});

export default router;