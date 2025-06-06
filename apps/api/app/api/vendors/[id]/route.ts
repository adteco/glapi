import { NextRequest, NextResponse } from 'next/server';
import { VendorService } from '@glapi/api-service';
import { getServiceContext } from '../../utils/auth';

// GET /api/vendors/:id - Get a vendor by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    
    const vendorService = new VendorService(context);
    const result = await vendorService.getVendorById(id);
    
    if (!result) {
      return NextResponse.json(
        { message: `Vendor with ID "${id}" not found` },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ vendor: result });
  } catch (error) {
    console.error('Error getting vendor:', error);
    
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

// PUT /api/vendors/:id - Update a vendor
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    const body = await request.json();
    
    const vendorService = new VendorService(context);
    
    // Get the vendor to ensure it exists
    const existingVendor = await vendorService.getVendorById(id);
    if (!existingVendor) {
      return NextResponse.json(
        { message: `Vendor with ID "${id}" not found` },
        { status: 404 }
      );
    }
    
    // Update the vendor
    const result = await vendorService.updateVendor(id, body);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating vendor:', error);
    
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

// DELETE /api/vendors/:id - Delete a vendor
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    
    const vendorService = new VendorService(context);
    
    // Delete the vendor
    await vendorService.deleteVendor(id);
    
    return NextResponse.json({
      success: true,
      message: 'Vendor deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    
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