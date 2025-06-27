import { NextRequest, NextResponse } from 'next/server';
import { VendorItemsService } from '@glapi/api-service';
import { getServiceContext } from '../../../utils/auth';
import { isServiceError } from '../../../utils/errors';

// GET /api/vendors/:vendorId/items - List vendor items
export async function GET(
  request: NextRequest,
  { params }: { params: { vendorId: string } }
) {
  try {
    const context = getServiceContext();
    const service = new VendorItemsService(context);
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;
    
    const result = await service.getVendorItems(params.vendorId, { page, limit });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing vendor items:', error);
    
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

// POST /api/vendors/:vendorId/items - Add item to vendor
export async function POST(
  request: NextRequest,
  { params }: { params: { vendorId: string } }
) {
  try {
    const context = getServiceContext();
    const body = await request.json() as any;
    
    const service = new VendorItemsService(context);
    const result = await service.addVendorItem({
      vendorId: params.vendorId,
      ...(typeof body === 'object' && body !== null ? body : {})
    });
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error adding vendor item:', error);
    
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