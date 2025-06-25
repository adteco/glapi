import { NextRequest, NextResponse } from 'next/server';
import { PricingService } from '@glapi/api-service';
import { getServiceContext } from '../../../utils/auth';
import { isServiceError } from '../../../utils/errors';

// GET /api/items/:id/pricing - Get pricing for an item
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const service = new PricingService(context);
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const priceListId = searchParams.get('priceListId') || undefined;
    
    const result = await service.getItemPrices(params.id, priceListId);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting item pricing:', error);
    
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