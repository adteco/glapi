import { NextRequest, NextResponse } from 'next/server';
import { PricingService } from '@glapi/api-service';
import { getServiceContext } from '../utils/auth';
import { isServiceError } from '../utils/errors';

// GET /api/price-lists - List all price lists
export async function GET(request: NextRequest) {
  try {
    const context = getServiceContext();
    const service = new PricingService(context);
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;
    const activeOnly = searchParams.get('activeOnly') === 'true';
    
    const result = await service.listPriceLists({ page, limit, activeOnly });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing price lists:', error);
    
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

// POST /api/price-lists - Create a new price list
export async function POST(request: NextRequest) {
  try {
    const context = getServiceContext();
    const body = await request.json();
    
    const service = new PricingService(context);
    const result = await service.createPriceList(body);
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating price list:', error);
    
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