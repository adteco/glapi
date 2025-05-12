import express, { Request, Response, NextFunction, Router } from 'express';
import { DepartmentService, NewDepartmentSchema } from '@glapi/api-service';

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

// POST /departments - Create a new department
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get context from the request (set by auth middleware)
    const context = getServiceContext(req);

    console.log('Creating department with context:', context);
    console.log('Request body:', req.body);

    // Validate request body against schema
    const parsedData = NewDepartmentSchema.safeParse({
      ...req.body,
      organizationId: context.organizationId
    });

    if (!parsedData.success) {
      return res.status(400).json({
        message: 'Invalid department data',
        errors: parsedData.error.errors
      });
    }

    // Initialize the service with the context
    const departmentService = new DepartmentService(context);

    // Create the department
    const result = await departmentService.createDepartment(parsedData.data);

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error creating department:', error);
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

// GET /departments - List all departments with pagination and filtering
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get context from the request
    const context = getServiceContext(req);

    // Initialize the department service
    const departmentService = new DepartmentService(context);

    // Parse query parameters
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const sortField = req.query.sortField as string || 'name';
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'asc';
    const subsidiaryId = req.query.subsidiaryId as string;

    // Enhanced logging for listing departments
    console.log('[DepartmentRoutes:List] Attempting to list departments with resolved context:', {
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

    // Use the service to list departments
    const result = await departmentService.listDepartments(
      { page, limit },
      sortField,
      sortOrder,
      { subsidiaryId }
    );

    console.log('Departments found:', result.data.length, 'total:', result.total);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error listing departments:', error);
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

// GET /departments/:id - Get a department by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get context from the request
    const context = getServiceContext(req);

    // Log full details for debugging
    console.log('DepartmentRoutes:getById - Request parameters:', {
      departmentId: id,
      context: JSON.stringify(context),
      headers: {
        stytchOrgId: req.headers['x-stytch-organization-id'],
        userId: req.headers['x-user-id']
      },
      originalUrl: req.originalUrl
    });

    // Initialize the department service
    const departmentService = new DepartmentService(context);

    // Get the department by ID
    const result = await departmentService.getDepartmentById(id);

    // Log whether we found a result
    console.log(`DepartmentRoutes:getById - Result for ID "${id}":`, result ? 'Department found' : 'Department NOT found');

    // If the department doesn't exist, return 404
    if (!result) {
      return res.status(404).json({
        message: `Department with ID "${id}" not found`,
        debug: {
          requestedId: id,
          organizationId: context.organizationId,
          stytchOrgId: context.stytchOrganizationId
        }
      });
    }

    // Make sure to wrap the department in a 'department' property to match frontend expectations
    return res.status(200).json({ department: result });
  } catch (error) {
    console.error('Error getting department:', error);
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

// PUT /departments/:id - Update a department
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get context from the request
    const context = getServiceContext(req);

    // Initialize the department service
    const departmentService = new DepartmentService(context);

    // Get the department to ensure it exists
    const existingDepartment = await departmentService.getDepartmentById(id);
    if (!existingDepartment) {
      return res.status(404).json({
        message: `Department with ID "${id}" not found`
      });
    }

    // Update the department
    const result = await departmentService.updateDepartment(id, req.body);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error updating department:', error);
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

// DELETE /departments/:id - Delete a department
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get context from the request
    const context = getServiceContext(req);

    // Initialize the department service
    const departmentService = new DepartmentService(context);

    // Delete the department
    await departmentService.deleteDepartment(id);

    return res.status(200).json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting department:', error);
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