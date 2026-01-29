import { NextRequest, NextResponse } from 'next/server';
import { ItemsService } from '@glapi/api-service';
import { getServiceContext } from '../utils/auth';
import { isServiceError } from '../utils/errors';

// GET /api/items - List all items with filters
export async function GET(request: NextRequest) {
  try {
    const context = await getServiceContext();
    const service = new ItemsService(context);
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;
    const search = searchParams.get('search') || undefined;
    const itemType = searchParams.get('itemType') || undefined;
    const categoryId = searchParams.get('categoryId') || undefined;
    const isActive = searchParams.get('isActive') === 'true' ? true : 
                     searchParams.get('isActive') === 'false' ? false : undefined;
    const isPurchasable = searchParams.get('isPurchasable') === 'true' ? true :
                         searchParams.get('isPurchasable') === 'false' ? false : undefined;
    const isSaleable = searchParams.get('isSaleable') === 'true' ? true :
                      searchParams.get('isSaleable') === 'false' ? false : undefined;
    const parentItemId = searchParams.get('parentItemId') || undefined;
    const includeVariants = searchParams.get('includeVariants') === 'true';
    
    const result = await service.listItems({
      page,
      limit,
      search,
      itemType,
      categoryId,
      isActive,
      isPurchasable,
      isSaleable,
      parentItemId,
      includeVariants
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing items:', error);
    
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

// POST /api/items - Create a new item
export async function POST(request: NextRequest) {
  try {
    const context = await getServiceContext();
    const body = await request.json() as any;
    
    const service = new ItemsService(context);
    const result = await service.createItem(body);
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating item:', error);
    
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