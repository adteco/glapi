import { NextRequest, NextResponse } from 'next/server';
import { PricingService } from '@glapi/api-service';
import { getServiceContext } from '../../../utils/auth';
import { isServiceError } from '../../../utils/errors';

// GET /api/price-lists/:id/items - Get items in a price list
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getServiceContext();
    const service = new PricingService(context);
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;
    
    const result = await service.getPriceListItems(params.id, { page, limit });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting price list items:', error);
    
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

// POST /api/price-lists/:id/items - Add an item to a price list
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getServiceContext();
    const body = await request.json() as any;
    
    const service = new PricingService(context);
    
    // Check if it's a bulk update (array) or single item add
    if (Array.isArray(body.updates)) {
      // Bulk update prices
      await service.bulkUpdatePrices(params.id, body.updates);
      return NextResponse.json({ message: 'Prices updated successfully' });
    } else {
      // Add single item to price list
      const result = await service.createItemPricing({
        ...(typeof body === 'object' && body !== null ? body : {}),
        priceListId: params.id
      });
      return NextResponse.json(result, { status: 201 });
    }
  } catch (error) {
    console.error('Error bulk updating prices:', error);
    
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