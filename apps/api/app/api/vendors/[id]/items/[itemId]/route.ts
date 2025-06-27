import { NextRequest, NextResponse } from 'next/server';
import { VendorItemsService } from '@glapi/api-service';
import { getServiceContext } from '../../../../utils/auth';
import { isServiceError } from '../../../../utils/errors';

// PUT /api/vendors/:vendorId/items/:itemId - Update vendor item
export async function PUT(
  request: NextRequest,
  { params }: { params: { vendorId: string; itemId: string } }
) {
  try {
    const context = getServiceContext();
    const body = await request.json() as any;
    
    const service = new VendorItemsService(context);
    const result = await service.updateVendorItem(
      params.vendorId,
      params.itemId,
      body
    );
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating vendor item:', error);
    
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

// DELETE /api/vendors/:vendorId/items/:itemId - Remove item from vendor
export async function DELETE(
  request: NextRequest,
  { params }: { params: { vendorId: string; itemId: string } }
) {
  try {
    const context = getServiceContext();
    const service = new VendorItemsService(context);
    
    await service.removeVendorItem(params.vendorId, params.itemId);
    
    return NextResponse.json({ message: 'Item removed from vendor successfully' });
  } catch (error) {
    console.error('Error removing vendor item:', error);
    
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