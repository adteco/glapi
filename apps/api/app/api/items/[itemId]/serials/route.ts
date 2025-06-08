import { NextRequest, NextResponse } from 'next/server';
import { InventoryTrackingService } from '@glapi/api-service';
import { getServiceContext } from '../../../utils/auth';
import { isServiceError } from '../../../utils/errors';

// GET /api/items/:itemId/serials - List serial numbers for an item
export async function GET(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const context = getServiceContext();
    const service = new InventoryTrackingService(context);
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;
    const status = searchParams.get('status') as 'AVAILABLE' | 'SOLD' | 'IN_TRANSIT' | 'RETURNED' | 'DAMAGED' | 'LOST' | undefined;
    const lotNumberId = searchParams.get('lotNumberId') || undefined;
    
    const result = await service.listSerialNumbers(params.itemId, {
      page,
      limit,
      status,
      lotNumberId
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing serial numbers:', error);
    
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

// POST /api/items/:itemId/serials - Create a serial number
export async function POST(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const context = getServiceContext();
    const body = await request.json();
    
    const service = new InventoryTrackingService(context);
    const result = await service.createSerialNumber({
      itemId: params.itemId,
      ...body
    });
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating serial number:', error);
    
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