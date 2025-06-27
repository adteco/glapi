import { NextRequest, NextResponse } from 'next/server';
import { LeadService } from '@glapi/api-service';
import { getServiceContext } from '../../utils/auth';
import { isServiceError } from '../../utils/errors';

// GET /api/leads/:id - Get a lead by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    
    const leadService = new LeadService();
    const result = await leadService.findById(id, context.organizationId);
    
    if (!result) {
      return NextResponse.json(
        { message: `Lead with ID "${id}" not found` },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ lead: result });
  } catch (error) {
    console.error('Error getting lead:', error);
    
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

// PUT /api/leads/:id - Update a lead
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    const body = await request.json() as any;
    
    const leadService = new LeadService();
    
    // Get the lead to ensure it exists
    const existingLead = await leadService.findById(id, context.organizationId);
    if (!existingLead) {
      return NextResponse.json(
        { message: `Lead with ID "${id}" not found` },
        { status: 404 }
      );
    }
    
    // Update the lead
    const result = await leadService.update(id, context.organizationId, body);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating lead:', error);
    
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

// DELETE /api/leads/:id - Delete a lead
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    
    const leadService = new LeadService();
    
    // Delete the lead
    await leadService.delete(id, context.organizationId);
    
    return NextResponse.json({
      success: true,
      message: 'Lead deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting lead:', error);
    
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