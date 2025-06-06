import { NextRequest, NextResponse } from 'next/server';
import { ContactService } from '@glapi/api-service';
import { getServiceContext } from '../../utils/auth';

// GET /api/contacts/:id - Get a contact by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    
    const contactService = new ContactService(context);
    const result = await contactService.getContactById(id);
    
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

// PUT /api/contacts/:id - Update a contact
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    const body = await request.json();
    
    const contactService = new ContactService(context);
    
    // Get the contact to ensure it exists
    const existingContact = await contactService.getContactById(id);
    if (!existingContact) {
      return NextResponse.json(
        { message: `Contact with ID "${id}" not found` },
        { status: 404 }
      );
    }
    
    // Update the contact
    const result = await contactService.updateContact(id, body);
    
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
    const context = getServiceContext();
    const { id } = params;
    
    const contactService = new ContactService(context);
    
    // Delete the contact
    await contactService.deleteContact(id);
    
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