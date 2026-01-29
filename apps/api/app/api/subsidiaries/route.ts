import { NextRequest, NextResponse } from 'next/server';
import { SubsidiaryService, NewSubsidiarySchema } from '@glapi/api-service';
import { getServiceContext } from '../utils/auth';
import { isServiceError } from '../utils/errors';

// POST /api/subsidiaries - Create a new subsidiary
export async function POST(request: NextRequest) {
  try {
    const context = await getServiceContext();
    const body = await request.json() as any;
    
    console.log('Creating subsidiary with context:', context);
    console.log('Request body:', body);
    
    // Validate request body against schema
    const parsedData = NewSubsidiarySchema.safeParse({
      ...(typeof body === 'object' && body !== null ? body : {}),
      organizationId: context.organizationId
    });
    
    if (!parsedData.success) {
      return NextResponse.json(
        {
          message: 'Invalid subsidiary data',
          errors: parsedData.error.errors
        },
        { status: 400 }
      );
    }
    
    // Initialize the service with the context
    const subsidiaryService = new SubsidiaryService(context);
    
    // Create the subsidiary
    const result = await subsidiaryService.createSubsidiary(parsedData.data);
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating subsidiary:', error);
    
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

// GET /api/subsidiaries - List all subsidiaries with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const context = await getServiceContext();
    const subsidiaryService = new SubsidiaryService(context);
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;
    const orderBy = (searchParams.get('orderBy') as 'name' | 'createdAt') || 'name';
    const orderDirection = (searchParams.get('orderDirection') as 'asc' | 'desc') || 'asc';
    const isActive = searchParams.get('isActive') === 'true' ? true : 
                     searchParams.get('isActive') === 'false' ? false : undefined;
    const parentId = searchParams.get('parentId') || undefined;
    
    // Use the service to list subsidiaries
    const result = await subsidiaryService.listSubsidiaries(
      { page, limit },
      orderBy,
      orderDirection,
      { isActive, parentId }
    );
    
    console.log('Subsidiaries found:', result.data.length, 'total:', result.total);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing subsidiaries:', error);
    
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