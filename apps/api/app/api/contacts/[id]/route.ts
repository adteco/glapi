import { NextRequest, NextResponse } from 'next/server';
import { ContactService } from '@glapi/api-service';
import { getServiceContext } from '../../utils/auth';
import { isServiceError } from '../../utils/errors';

// GET /api/contacts/:id - Get a contact by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getServiceContext();
    const { id } = params;
    
    const contactService = new ContactService();
    const result = await contactService.findById(id, context.organizationId);
    
    if (!result) {
      return NextResponse.json(
        { message: `Contact with ID "${id}" not found` },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ contact: result });
  } catch (error) {
    console.error('Error getting contact:', error);
    
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

// PUT /api/contacts/:id - Update a contact
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getServiceContext();
    const { id } = params;
    const body = await request.json() as any;
    
    const contactService = new ContactService();
    
    // Get the contact to ensure it exists
    const existingContact = await contactService.findById(id, context.organizationId);
    if (!existingContact) {
      return NextResponse.json(
        { message: `Contact with ID "${id}" not found` },
        { status: 404 }
      );
    }
    
    // Update the contact
    const result = await contactService.update(id, context.organizationId, body);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating contact:', error);
    
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

// DELETE /api/contacts/:id - Delete a contact
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getServiceContext();
    const { id } = params;
    
    const contactService = new ContactService();
    
    // Delete the contact
    await contactService.delete(id, context.organizationId);
    
    return NextResponse.json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting contact:', error);
    
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