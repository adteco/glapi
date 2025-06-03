import express, { Request, Response, NextFunction, Router } from 'express';
import { CustomerService, NewCustomerSchema } from '@glapi/api-service';

const router: Router = express.Router();

// Helper to get organization context from request
const getServiceContext = (req: Request) => {
  const context = (req as any).organizationContext;

  if (!context || !context.organizationId) {
    console.warn('Organization context not found in request - using development fallback');

    // Return a development fallback context when none is available
    return {
      organizationId: 'org_development', // Match clerk-auth middleware fallback
      userId: 'user_development', // Match clerk-auth middleware fallback
      clerkOrganizationId: 'org_development'
    };
  }

  console.log('Using organization context:', context);
  return context;
};

// POST /customers - Create a new customer
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get context from the request (set by auth middleware)
    const context = getServiceContext(req);

    console.log('Creating customer with context:', context);
    console.log('Request body:', req.body);

    // Validate request body against schema
    const parsedData = NewCustomerSchema.safeParse({
      ...req.body,
      organizationId: context.organizationId
    });

    if (!parsedData.success) {
      return res.status(400).json({
        message: 'Invalid customer data',
        errors: parsedData.error.errors
      });
    }

    // Initialize the service with the context
    const customerService = new CustomerService(context);

    // Create the customer
    const result = await customerService.createCustomer(parsedData.data);

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error creating customer:', error);
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

// GET /customers - List all customers with pagination and filtering
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get context from the request
    const context = getServiceContext(req);

    // Initialize the customer service
    const customerService = new CustomerService(context);

    // Parse query parameters
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const orderBy = req.query.orderBy as 'companyName' | 'createdAt' || 'companyName';
    const orderDirection = req.query.orderDirection as 'asc' | 'desc' || 'asc';
    const status = req.query.status as string;

    // Enhanced logging for listing customers
    console.log('[CustomerRoutes:List] Attempting to list customers with resolved context:', {
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
        status
      }
    });

    // Use the service to list customers
    const result = await customerService.listCustomers(
      { page, limit },
      orderBy,
      orderDirection,
      { status }
    );

    console.log('Customers found:', result.data.length, 'total:', result.total);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error listing customers:', error);
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

// GET /customers/:id - Get a customer by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get context from the request
    const context = getServiceContext(req);

    // Log full details for debugging
    console.log('CustomerRoutes:getById - Request parameters:', {
      customerId: id,
      context: JSON.stringify(context),
      headers: {
        stytchOrgId: req.headers['x-stytch-organization-id'],
        userId: req.headers['x-user-id']
      },
      originalUrl: req.originalUrl
    });

    // Initialize the customer service
    const customerService = new CustomerService(context);

    // Get the customer by ID
    const result = await customerService.getCustomerById(id);

    // Log whether we found a result
    console.log(`CustomerRoutes:getById - Result for ID "${id}":`, result ? 'Customer found' : 'Customer NOT found');

    // If the customer doesn't exist, return 404
    if (!result) {
      return res.status(404).json({
        message: `Customer with ID "${id}" not found`,
        debug: {
          requestedId: id,
          organizationId: context.organizationId,
          stytchOrgId: context.stytchOrganizationId
        }
      });
    }

    // Make sure to wrap the customer in a 'customer' property to match frontend expectations
    return res.status(200).json({ customer: result });
  } catch (error) {
    console.error('Error getting customer:', error);
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

// PUT /customers/:id - Update a customer
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get context from the request
    const context = getServiceContext(req);

    // Initialize the customer service
    const customerService = new CustomerService(context);

    // Get the customer to ensure it exists
    const existingCustomer = await customerService.getCustomerById(id);
    if (!existingCustomer) {
      return res.status(404).json({
        message: `Customer with ID "${id}" not found`
      });
    }

    // Update the customer
    const result = await customerService.updateCustomer(id, req.body);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error updating customer:', error);
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

// DELETE /customers/:id - Delete a customer
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get context from the request
    const context = getServiceContext(req);

    // Initialize the customer service
    const customerService = new CustomerService(context);

    // Delete the customer
    await customerService.deleteCustomer(id);

    return res.status(200).json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
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