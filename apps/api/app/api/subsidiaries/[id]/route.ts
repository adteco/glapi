import { NextRequest, NextResponse } from 'next/server';
import { SubsidiaryService } from '@glapi/api-service';
import { getServiceContext } from '../../utils/auth';
import { isServiceError } from '../../utils/errors';

// GET /api/subsidiaries/:id - Get a subsidiary by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    
    const subsidiaryService = new SubsidiaryService(context);
    const result = await subsidiaryService.getSubsidiaryById(id);
    
    if (!result) {
      return NextResponse.json(
        { message: `Subsidiary with ID "${id}" not found` },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ subsidiary: result });
  } catch (error) {
    console.error('Error getting subsidiary:', error);
    
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

// PUT /api/subsidiaries/:id - Update a subsidiary
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    const body = await request.json();
    
    const subsidiaryService = new SubsidiaryService(context);
    
    // Get the subsidiary to ensure it exists
    const existingSubsidiary = await subsidiaryService.getSubsidiaryById(id);
    if (!existingSubsidiary) {
      return NextResponse.json(
        { message: `Subsidiary with ID "${id}" not found` },
        { status: 404 }
      );
    }
    
    // Update the subsidiary
    const result = await subsidiaryService.updateSubsidiary(id, body);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating subsidiary:', error);
    
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

// DELETE /api/subsidiaries/:id - Delete a subsidiary
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    
    const subsidiaryService = new SubsidiaryService(context);
    
    // Delete the subsidiary
    await subsidiaryService.deleteSubsidiary(id);
    
    return NextResponse.json({
      success: true,
      message: 'Subsidiary deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting subsidiary:', error);
    
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