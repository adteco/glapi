import { NextRequest, NextResponse } from 'next/server';
import { ContactService, CreateEntitySchema } from '@glapi/api-service';
import { getServiceContext } from '../utils/auth';
import { isServiceError } from '../utils/errors';

// POST /api/contacts - Create a new contact
export async function POST(request: NextRequest) {
  try {
    const context = getServiceContext();
    const body = await request.json() as any;
    
    console.log('Creating contact with context:', context);
    console.log('Request body:', body);
    
    // Validate request body against schema
    const parsedData = CreateEntitySchema.safeParse({
      ...(typeof body === 'object' && body !== null ? body : {}),
      entityTypes: ['Contact'],
      organizationId: context.organizationId
    });
    
    if (!parsedData.success) {
      return NextResponse.json(
        {
          message: 'Invalid contact data',
          errors: parsedData.error.errors
        },
        { status: 400 }
      );
    }
    
    // Initialize the service with the context
    const contactService = new ContactService();
    
    // Create the contact
    const result = await contactService.create(
      context.organizationId,
      ['Contact'],
      parsedData.data
    );
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating contact:', error);
    
    // Check if it's a ServiceError
    if (isServiceError(error)) {
      return NextResponse.json(
        {
          message: error.message,
          code: error.code,
          details: error.details
        },
        { status: error.statusCode }
      );
    }
    
    // Generic error handling
    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/contacts - List all contacts with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const context = getServiceContext();
    const contactService = new ContactService();
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;
    const orderDirection = (searchParams.get('orderDirection') as 'asc' | 'desc') || 'asc';
    const status = searchParams.get('status') || undefined;
    
    // Use the service to list contacts
    const result = await contactService.listContacts(
      context.organizationId,
      {
        page,
        limit,
        orderBy: 'name',
        orderDirection,
        status,
      }
    );
    
    console.log('Contacts found:', result.data.length, 'total:', result.total);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing contacts:', error);
    
    // Check if it's a ServiceError
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as any;
      return NextResponse.json(
        {
          message: serviceError.message,
          code: serviceError.code,
          details: serviceError.details
        },
        { status: serviceError.statusCode }
      );
    }
    
    // Generic error handling
    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}