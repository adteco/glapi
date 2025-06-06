import { NextRequest, NextResponse } from 'next/server';
import { ClassService } from '@glapi/api-service';
import { getServiceContext } from '../../utils/auth';

// GET /api/classes/:id - Get a class by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    
    const classService = new ClassService(context);
    const result = await classService.getClassById(id);
    
    if (!result) {
      return NextResponse.json(
        { message: `Class with ID "${id}" not found` },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ class: result });
  } catch (error) {
    console.error('Error getting class:', error);
    
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

// PUT /api/classes/:id - Update a class
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    const body = await request.json();
    
    const classService = new ClassService(context);
    
    // Get the class to ensure it exists
    const existingClass = await classService.getClassById(id);
    if (!existingClass) {
      return NextResponse.json(
        { message: `Class with ID "${id}" not found` },
        { status: 404 }
      );
    }
    
    // Update the class
    const result = await classService.updateClass(id, body);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating class:', error);
    
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

// DELETE /api/classes/:id - Delete a class
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    
    const classService = new ClassService(context);
    
    // Delete the class
    await classService.deleteClass(id);
    
    return NextResponse.json({
      success: true,
      message: 'Class deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting class:', error);
    
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