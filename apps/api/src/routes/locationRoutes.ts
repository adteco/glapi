import express, { Request, Response, NextFunction, Router } from 'express';
import { LocationService, NewLocationSchema } from '@glapi/api-service';

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

// POST /locations - Create a new location
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Get context from the request (set by auth middleware)
    const context = getServiceContext(req);
    
    if (!context) {
      return res.status(401).json({ error: 'Organization ID not found in session.' });
    }

    console.log('Creating location with context:', context);
    console.log('Request body:', req.body);

    // Validate request body against schema
    const parsedData = NewLocationSchema.safeParse({
      ...req.body,
      organizationId: context.organizationId
    });

    if (!parsedData.success) {
      return res.status(400).json({
        message: 'Invalid location data',
        errors: parsedData.error.errors
      });
    }

    // Initialize the service with the context
    const locationService = new LocationService(context);

    // Create the location
    const result = await locationService.createLocation(parsedData.data);

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error creating location:', error);
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

// GET /locations - List all locations with pagination and filtering
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Get context from the request
    const context = getServiceContext(req);
    
    if (!context) {
      return res.status(401).json({ error: 'Organization ID not found in session.' });
    }

    // Initialize the location service
    const locationService = new LocationService(context);

    // Parse query parameters
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const sortField = req.query.sortField as string || 'name';
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'asc';
    const subsidiaryId = req.query.subsidiaryId as string;
    const countryCode = req.query.countryCode as string;

    // Enhanced logging for listing locations
    console.log('[LocationRoutes:List] Attempting to list locations with resolved context:', {
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
        sortField,
        sortOrder,
        subsidiaryId,
        countryCode
      }
    });

    // Use the service to list locations
    const result = await locationService.listLocations(
      { page, limit },
      sortField,
      sortOrder,
      { subsidiaryId, countryCode }
    );

    console.log('Locations found:', result.data.length, 'total:', result.total);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error listing locations:', error);
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

// GET /locations/:id - Get a location by ID
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get context from the request
    const context = getServiceContext(req);
    
    if (!context) {
      return res.status(401).json({ error: 'Organization ID not found in session.' });
    }

    // Log full details for debugging
    console.log('LocationRoutes:getById - Request parameters:', {
      locationId: id,
      context: JSON.stringify(context),
      headers: {
        stytchOrgId: req.headers['x-stytch-organization-id'],
        userId: req.headers['x-user-id']
      },
      originalUrl: req.originalUrl
    });

    // Initialize the location service
    const locationService = new LocationService(context);

    // Get the location by ID
    const result = await locationService.getLocationById(id);

    // Log whether we found a result
    console.log(`LocationRoutes:getById - Result for ID "${id}":`, result ? 'Location found' : 'Location NOT found');

    // If the location doesn't exist, return 404
    if (!result) {
      return res.status(404).json({
        message: `Location with ID "${id}" not found`,
        debug: {
          requestedId: id,
          organizationId: context.organizationId,
          stytchOrgId: context.stytchOrganizationId
        }
      });
    }

    // Make sure to wrap the location in a 'location' property to match frontend expectations
    return res.status(200).json({ location: result });
  } catch (error) {
    console.error('Error getting location:', error);
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

// PUT /locations/:id - Update a location
router.put('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get context from the request
    const context = getServiceContext(req);
    
    if (!context) {
      return res.status(401).json({ error: 'Organization ID not found in session.' });
    }

    // Initialize the location service
    const locationService = new LocationService(context);

    // Get the location to ensure it exists
    const existingLocation = await locationService.getLocationById(id);
    if (!existingLocation) {
      return res.status(404).json({
        message: `Location with ID "${id}" not found`
      });
    }

    // Update the location
    const result = await locationService.updateLocation(id, req.body);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error updating location:', error);
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

// DELETE /locations/:id - Delete a location
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get context from the request
    const context = getServiceContext(req);
    
    if (!context) {
      return res.status(401).json({ error: 'Organization ID not found in session.' });
    }

    // Initialize the location service
    const locationService = new LocationService(context);

    // Delete the location
    await locationService.deleteLocation(id);

    return res.status(200).json({
      success: true,
      message: 'Location deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting location:', error);
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