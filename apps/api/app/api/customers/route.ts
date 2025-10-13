import { NextRequest, NextResponse } from 'next/server';
import { CustomerService, NewCustomerSchema } from '@glapi/api-service';
import { getServiceContext } from '../utils/auth';
import { handleApiError } from '../utils/errors';

// POST /api/customers - Create a new customer
export async function POST(request: NextRequest) {
  try {
    const context = getServiceContext();
    const body = await request.json() as any;
    
    console.log('Creating customer with context:', context);
    console.log('Request body:', body);
    
    // Validate request body against schema
    const parsedData = NewCustomerSchema.safeParse({
      ...(typeof body === 'object' && body !== null ? body : {}),
      organizationId: context.organizationId
    });
    
    if (!parsedData.success) {
      return NextResponse.json(
        {
          message: 'Invalid customer data',
          errors: parsedData.error.errors
        },
        { status: 400 }
      );
    }
    
    // Initialize the service with the context
    const customerService = new CustomerService(context);
    
    // Create the customer
    const result = await customerService.createCustomer(parsedData.data);
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

// GET /api/customers - List all customers with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const context = getServiceContext();
    const customerService = new CustomerService(context);
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;
    const orderBy = (searchParams.get('orderBy') as 'companyName' | 'createdAt') || 'companyName';
    const orderDirection = (searchParams.get('orderDirection') as 'asc' | 'desc') || 'asc';
    const status = searchParams.get('status') || undefined;
    
    console.log('[CustomerRoutes:List] Attempting to list customers with resolved context:', {
      organizationId: context.organizationId,
      userId: context.userId,
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
    
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}