import express, { Request, Response, NextFunction, Router } from 'express';
import { SubsidiaryService, NewSubsidiarySchema, UpdateSubsidiarySchema } from '@glapi/api-service';

const router: Router = express.Router();

// Extend Request to include organizationContext
interface AuthenticatedRequest extends Request {
  organizationContext?: {
    organizationId: string;
    userId: string;
    clerkOrganizationId?: string;
  };
}

// Helper to get organization context from request
const getServiceContext = (req: AuthenticatedRequest) => {
  if (!req.organizationContext?.organizationId) {
    return null;
  }

  // Map the Clerk organization context to the service context format
  return {
    organizationId: req.organizationContext.organizationId,
    userId: req.organizationContext.userId,
    stytchOrganizationId: req.organizationContext.clerkOrganizationId || req.organizationContext.organizationId
  };
};

// POST /subsidiaries - Create a new subsidiary
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Get context from the request (set by auth middleware)
    const context = getServiceContext(req);
    
    if (!context) {
      return res.status(401).json({ error: 'Organization ID not found in session.' });
    }

    console.log('Creating subsidiary with context:', context);
    console.log('Request body:', req.body);

    // Validate request body against schema
    const parsedData = NewSubsidiarySchema.safeParse({
      ...req.body,
      organizationId: context.organizationId
    });

    if (!parsedData.success) {
      return res.status(400).json({
        message: 'Invalid subsidiary data',
        errors: parsedData.error.errors
      });
    }

    // Initialize the service with the context
    const subsidiaryService = new SubsidiaryService(context);

    // Create the subsidiary
    const result = await subsidiaryService.createSubsidiary(parsedData.data);

    // Return wrapped in 'subsidiary' property for consistency
    return res.status(201).json({ subsidiary: result });
  } catch (error) {
    console.error('Error creating subsidiary:', error);
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
      return res.status(500).json({ message: error.message });
    }
    next(error);
    return undefined; // To satisfy TypeScript
  }
});

// GET /subsidiaries - List all subsidiaries with pagination and filtering
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Get context from the request
    const context = getServiceContext(req);
    
    if (!context) {
      return res.status(401).json({ error: 'Organization ID not found in session.' });
    }

    // Initialize the subsidiary service
    const subsidiaryService = new SubsidiaryService(context);

    // Parse query parameters
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const orderBy = req.query.orderBy as 'name' | 'createdAt' || 'name';
    const orderDirection = req.query.orderDirection as 'asc' | 'desc' || 'asc';
    
    // Parse boolean and optional filters
    const isActive = req.query.isActive !== undefined ? 
      req.query.isActive === 'true' : undefined;
    
    const parentId = req.query.parentId === 'null' ? 
      null : 
      (req.query.parentId as string || undefined);

    // Enhanced logging for listing subsidiaries
    console.log('[SubsidiaryRoutes:List] Attempting to list subsidiaries with resolved context:', {
      organizationId: context.organizationId,
      stytchOrganizationId: context.stytchOrganizationId,
      userId: context.userId,
      headers: {
        stytchOrgId: req.headers['x-stytch-organization-id'],
        userId: req.headers['x-user-id']
      },
      parsedQueryParams: {
        page,
        limit,
        orderBy,
        orderDirection,
        isActive,
        parentId
      }
    });

    // Use the service to list subsidiaries
    const result = await subsidiaryService.listSubsidiaries(
      { page, limit },
      orderBy,
      orderDirection,
      { isActive, parentId }
    );

    console.log('Subsidiaries found:', result.data.length, 'total:', result.total);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error listing subsidiaries:', error);
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
      return res.status(500).json({ message: error.message });
    }
    next(error);
    return undefined; // To satisfy TypeScript
  }
});

// GET /subsidiaries/:id - Get a subsidiary by ID
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get context from the request
    const context = getServiceContext(req);
    
    if (!context) {
      return res.status(401).json({ error: 'Organization ID not found in session.' });
    }

    // Log full details for debugging
    console.log('SubsidiaryRoutes:getById - Request parameters:', {
      subsidiaryId: id,
      context: JSON.stringify(context),
      headers: {
        stytchOrgId: req.headers['x-stytch-organization-id'],
        userId: req.headers['x-user-id']
      },
      originalUrl: req.originalUrl
    });

    // Initialize the subsidiary service
    const subsidiaryService = new SubsidiaryService(context);

    // Get the subsidiary by ID
    const result = await subsidiaryService.getSubsidiaryById(id);

    // Log whether we found a result
    console.log(`SubsidiaryRoutes:getById - Result for ID "${id}":`, result ? 'Subsidiary found' : 'Subsidiary NOT found');

    // If the subsidiary doesn't exist, return 404
    if (!result) {
      return res.status(404).json({
        message: `Subsidiary with ID "${id}" not found`,
        debug: {
          requestedId: id,
          organizationId: context.organizationId,
          stytchOrgId: context.stytchOrganizationId
        }
      });
    }

    // Make sure to wrap the subsidiary in a 'subsidiary' property to match frontend expectations
    return res.status(200).json({ subsidiary: result });
  } catch (error) {
    console.error('Error getting subsidiary:', error);
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
      return res.status(500).json({ message: error.message });
    }
    next(error);
    return undefined; // To satisfy TypeScript
  }
});

// PUT /subsidiaries/:id - Update a subsidiary
router.put('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get context from the request
    const context = getServiceContext(req);
    
    if (!context) {
      return res.status(401).json({ error: 'Organization ID not found in session.' });
    }

    // Validate request body
    const parsedData = UpdateSubsidiarySchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({
        message: 'Invalid subsidiary data',
        errors: parsedData.error.errors
      });
    }

    // Initialize the subsidiary service
    const subsidiaryService = new SubsidiaryService(context);

    // Update the subsidiary
    const result = await subsidiaryService.updateSubsidiary(id, parsedData.data);

    // Return wrapped in 'subsidiary' property for consistency
    return res.status(200).json({ subsidiary: result });
  } catch (error) {
    console.error('Error updating subsidiary:', error);
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
      return res.status(500).json({ message: error.message });
    }
    next(error);
    return undefined; // To satisfy TypeScript
  }
});

// DELETE /subsidiaries/:id - Delete a subsidiary
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get context from the request
    const context = getServiceContext(req);
    
    if (!context) {
      return res.status(401).json({ error: 'Organization ID not found in session.' });
    }

    // Initialize the subsidiary service
    const subsidiaryService = new SubsidiaryService(context);

    // Delete the subsidiary
    await subsidiaryService.deleteSubsidiary(id);

    return res.status(200).json({
      success: true,
      message: 'Subsidiary deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting subsidiary:', error);
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
      return res.status(500).json({ message: error.message });
    }
    next(error);
    return undefined; // To satisfy TypeScript
  }
});

export default router;