import { NextRequest, NextResponse } from 'next/server';
import { VendorItemsService } from '@glapi/api-service';
import { getServiceContext } from '../../../utils/auth';
import { isServiceError } from '../../../utils/errors';

// GET /api/items/:id/vendors - Get vendors for an item
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getServiceContext();
    const service = new VendorItemsService(context);
    
    const result = await service.getItemVendors(params.id);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting item vendors:', error);
    
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