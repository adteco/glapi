import express, { Request, Response, NextFunction, Router } from 'express';
import { ClassService, NewClassSchema } from '@glapi/api-service';

const router: Router = express.Router();

// Helper to get organization context from request
const getServiceContext = (req: Request) => {
  const context = (req as any).organizationContext;

  if (!context || !context.organizationId) {
    console.warn('Organization context not found in request - using development fallback');

    // Return a development fallback context when none is available
    return {
      organizationId: 'organization-default-dev',
      userId: 'user-default-dev',
      stytchOrganizationId: 'organization-test-6f0cd115-d208-4462-8b0a-d1e8df4568a7'
    };
  }

  console.log('Using organization context:', context);
  return context;
};

// POST /classes - Create a new class
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get context from the request (set by auth middleware)
    const context = getServiceContext(req);

    console.log('Creating class with context:', context);
    console.log('Request body:', req.body);

    // Validate request body against schema
    const parsedData = NewClassSchema.safeParse({
      ...req.body,
      organizationId: context.organizationId
    });

    if (!parsedData.success) {
      return res.status(400).json({
        message: 'Invalid class data',
        errors: parsedData.error.errors
      });
    }

    // Initialize the service with the context
    const classService = new ClassService(context);

    // Create the class
    const result = await classService.createClass(parsedData.data);

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error creating class:', error);
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

// GET /classes - List all classes with pagination and filtering
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get context from the request
    const context = getServiceContext(req);

    // Initialize the class service
    const classService = new ClassService(context);

    // Parse query parameters
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const sortField = req.query.sortField as string || 'name';
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'asc';
    const subsidiaryId = req.query.subsidiaryId as string;

    // Enhanced logging for listing classes
    console.log('[ClassRoutes:List] Attempting to list classes with resolved context:', {
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
        subsidiaryId
      }
    });

    // Use the service to list classes
    const result = await classService.listClasses(
      { page, limit },
      sortField,
      sortOrder,
      { subsidiaryId }
    );

    console.log('Classes found:', result.data.length, 'total:', result.total);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error listing classes:', error);
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

// GET /classes/:id - Get a class by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get context from the request
    const context = getServiceContext(req);

    // Log full details for debugging
    console.log('ClassRoutes:getById - Request parameters:', {
      classId: id,
      context: JSON.stringify(context),
      headers: {
        stytchOrgId: req.headers['x-stytch-organization-id'],
        userId: req.headers['x-user-id']
      },
      originalUrl: req.originalUrl
    });

    // Initialize the class service
    const classService = new ClassService(context);

    // Get the class by ID
    const result = await classService.getClassById(id);

    // Log whether we found a result
    console.log(`ClassRoutes:getById - Result for ID "${id}":`, result ? 'Class found' : 'Class NOT found');

    // If the class doesn't exist, return 404
    if (!result) {
      return res.status(404).json({
        message: `Class with ID "${id}" not found`,
        debug: {
          requestedId: id,
          organizationId: context.organizationId,
          stytchOrgId: context.stytchOrganizationId
        }
      });
    }

    // Make sure to wrap the class in a 'class' property to match frontend expectations
    return res.status(200).json({ class: result });
  } catch (error) {
    console.error('Error getting class:', error);
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

// PUT /classes/:id - Update a class
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get context from the request
    const context = getServiceContext(req);

    // Initialize the class service
    const classService = new ClassService(context);

    // Get the class to ensure it exists
    const existingClass = await classService.getClassById(id);
    if (!existingClass) {
      return res.status(404).json({
        message: `Class with ID "${id}" not found`
      });
    }

    // Update the class
    const result = await classService.updateClass(id, req.body);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error updating class:', error);
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

// DELETE /classes/:id - Delete a class
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get context from the request
    const context = getServiceContext(req);

    // Initialize the class service
    const classService = new ClassService(context);

    // Delete the class
    await classService.deleteClass(id);

    return res.status(200).json({
      success: true,
      message: 'Class deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting class:', error);
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