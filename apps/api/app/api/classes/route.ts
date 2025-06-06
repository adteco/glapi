import { NextRequest, NextResponse } from 'next/server';
import { ClassService, NewClassSchema } from '@glapi/api-service';
import { getServiceContext } from '../utils/auth';

// POST /api/classes - Create a new class
export async function POST(request: NextRequest) {
  try {
    const context = getServiceContext();
    const body = await request.json();
    
    console.log('Creating class with context:', context);
    console.log('Request body:', body);
    
    // Validate request body against schema
    const parsedData = NewClassSchema.safeParse({
      ...body,
      organizationId: context.organizationId
    });
    
    if (!parsedData.success) {
      return NextResponse.json(
        {
          message: 'Invalid class data',
          errors: parsedData.error.errors
        },
        { status: 400 }
      );
    }
    
    // Initialize the service with the context
    const classService = new ClassService(context);
    
    // Create the class
    const result = await classService.createClass(parsedData.data);
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating class:', error);
    
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

// GET /api/classes - List all classes with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const context = getServiceContext();
    const classService = new ClassService(context);
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;
    const orderBy = (searchParams.get('orderBy') as 'className' | 'createdAt') || 'className';
    const orderDirection = (searchParams.get('orderDirection') as 'asc' | 'desc') || 'asc';
    const status = searchParams.get('status') || undefined;
    
    // Use the service to list classes
    const result = await classService.listClasses(
      { page, limit },
      orderBy,
      orderDirection,
      { status }
    );
    
    console.log('Classes found:', result.data.length, 'total:', result.total);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing classes:', error);
    
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