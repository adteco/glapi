import { NextRequest, NextResponse } from 'next/server';
import { DepartmentService, NewDepartmentSchema } from '@glapi/api-service';
import { getServiceContext } from '../utils/auth';
import { isServiceError } from '../utils/errors';

// POST /api/departments - Create a new department
export async function POST(request: NextRequest) {
  try {
    const context = await getServiceContext();
    const body = await request.json() as any;
    
    console.log('Creating department with context:', context);
    console.log('Request body:', body);
    
    // Validate request body against schema
    const parsedData = NewDepartmentSchema.safeParse({
      ...(typeof body === 'object' && body !== null ? body : {}),
      organizationId: context.organizationId
    });
    
    if (!parsedData.success) {
      return NextResponse.json(
        {
          message: 'Invalid department data',
          errors: parsedData.error.errors
        },
        { status: 400 }
      );
    }
    
    // Initialize the service with the context
    const departmentService = new DepartmentService(context);
    
    // Create the department
    const result = await departmentService.createDepartment(parsedData.data);
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating department:', error);
    
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

// GET /api/departments - List all departments with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const context = await getServiceContext();
    const departmentService = new DepartmentService(context);
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;
    const orderBy = (searchParams.get('orderBy') as 'departmentName' | 'createdAt') || 'departmentName';
    const orderDirection = (searchParams.get('orderDirection') as 'asc' | 'desc') || 'asc';
    const subsidiaryId = searchParams.get('subsidiaryId') || undefined;
    
    // Use the service to list departments
    const result = await departmentService.listDepartments(
      { page, limit },
      orderBy,
      orderDirection,
      subsidiaryId ? { subsidiaryId } : {}
    );
    
    console.log('Departments found:', result.data.length, 'total:', result.total);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing departments:', error);
    
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