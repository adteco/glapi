import { NextRequest, NextResponse } from 'next/server';
import { ProspectService } from '@glapi/api-service';
import { getServiceContext } from '../../utils/auth';

// GET /api/prospects/:id - Get a prospect by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    
    const prospectService = new ProspectService(context);
    const result = await prospectService.getProspectById(id);
    
    if (!result) {
      return NextResponse.json(
        { message: `Prospect with ID "${id}" not found` },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ prospect: result });
  } catch (error) {
    console.error('Error getting prospect:', error);
    
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

// PUT /api/prospects/:id - Update a prospect
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    const body = await request.json();
    
    const prospectService = new ProspectService(context);
    
    // Get the prospect to ensure it exists
    const existingProspect = await prospectService.getProspectById(id);
    if (!existingProspect) {
      return NextResponse.json(
        { message: `Prospect with ID "${id}" not found` },
        { status: 404 }
      );
    }
    
    // Update the prospect
    const result = await prospectService.updateProspect(id, body);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating prospect:', error);
    
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

// DELETE /api/prospects/:id - Delete a prospect
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    
    const prospectService = new ProspectService(context);
    
    // Delete the prospect
    await prospectService.deleteProspect(id);
    
    return NextResponse.json({
      success: true,
      message: 'Prospect deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting prospect:', error);
    
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