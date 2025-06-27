import { NextRequest, NextResponse } from 'next/server';
import { ProspectService, CreateEntitySchema } from '@glapi/api-service';
import { getServiceContext } from '../utils/auth';
import { isServiceError } from '../utils/errors';

// POST /api/prospects - Create a new prospect
export async function POST(request: NextRequest) {
  try {
    const context = getServiceContext();
    const body = await request.json() as any;
    
    console.log('Creating prospect with context:', context);
    console.log('Request body:', body);
    
    // Validate request body against schema
    const parsedData = CreateEntitySchema.safeParse({
      ...(typeof body === 'object' && body !== null ? body : {}),
      entityTypes: ['Prospect'],
      organizationId: context.organizationId
    });
    
    if (!parsedData.success) {
      return NextResponse.json(
        {
          message: 'Invalid prospect data',
          errors: parsedData.error.errors
        },
        { status: 400 }
      );
    }
    
    // Initialize the service with the context
    const prospectService = new ProspectService();
    
    // Create the prospect
    const result = await prospectService.create(
      context.organizationId,
      ['Prospect'],
      parsedData.data
    );
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating prospect:', error);
    
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

// GET /api/prospects - List all prospects with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const context = getServiceContext();
    const prospectService = new ProspectService();
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;
    const orderDirection = (searchParams.get('orderDirection') as 'asc' | 'desc') || 'asc';
    const status = searchParams.get('status') || undefined;
    
    // Use the service to list prospects
    const result = await prospectService.listProspects(
      context.organizationId,
      {
        page,
        limit,
        orderBy: 'name',
        orderDirection,
        status,
      }
    );
    
    console.log('Prospects found:', result.data.length, 'total:', result.total);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing prospects:', error);
    
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