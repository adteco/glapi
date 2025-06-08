import { NextRequest, NextResponse } from 'next/server';
import { InventoryTrackingService } from '@glapi/api-service';
import { getServiceContext } from '../../../utils/auth';
import { isServiceError } from '../../../utils/errors';

// GET /api/items/:itemId/lots - List lots for an item
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
    const status = searchParams.get('status') as 'ACTIVE' | 'EXPIRED' | 'RECALLED' | undefined;
    const includeExpired = searchParams.get('includeExpired') === 'true';
    
    const result = await service.listLotNumbers(params.itemId, {
      page,
      limit,
      status,
      includeExpired
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing lot numbers:', error);
    
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

// POST /api/items/:itemId/lots - Create a lot number
export async function POST(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const context = getServiceContext();
    const body = await request.json();
    
    const service = new InventoryTrackingService(context);
    const result = await service.createLotNumber({
      itemId: params.itemId,
      ...body
    });
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating lot number:', error);
    
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