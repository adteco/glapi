import { NextRequest, NextResponse } from 'next/server';
import { CustomerService } from '@glapi/api-service';
import { getServiceContext } from '../../utils/auth';
import { isServiceError } from '../../utils/errors';

// GET /api/customers/:id - Get a customer by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    
    console.log('CustomerRoutes:getById - Request parameters:', {
      customerId: id,
      context: JSON.stringify(context),
      originalUrl: request.url
    });
    
    const customerService = new CustomerService(context);
    const result = await customerService.getCustomerById(id);
    
    console.log(`CustomerRoutes:getById - Result for ID "${id}":`, result ? 'Customer found' : 'Customer NOT found');
    
    if (!result) {
      return NextResponse.json(
        {
          message: `Customer with ID "${id}" not found`,
          debug: {
            requestedId: id,
            organizationId: context.organizationId
          }
        },
        { status: 404 }
      );
    }
    
    // Make sure to wrap the customer in a 'customer' property to match frontend expectations
    return NextResponse.json({ customer: result });
  } catch (error) {
    console.error('Error getting customer:', error);
    
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

// PUT /api/customers/:id - Update a customer
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    const body = await request.json() as any;
    
    const customerService = new CustomerService(context);
    
    // Get the customer to ensure it exists
    const existingCustomer = await customerService.getCustomerById(id);
    if (!existingCustomer) {
      return NextResponse.json(
        { message: `Customer with ID "${id}" not found` },
        { status: 404 }
      );
    }
    
    // Update the customer
    const result = await customerService.updateCustomer(id, body);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating customer:', error);
    
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

// DELETE /api/customers/:id - Delete a customer
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    
    const customerService = new CustomerService(context);
    
    // Delete the customer
    await customerService.deleteCustomer(id);
    
    return NextResponse.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    
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