import { NextRequest, NextResponse } from 'next/server';
import { ItemCategoriesService } from '@glapi/api-service';
import { getServiceContext } from '../utils/auth';
import { isServiceError } from '../utils/errors';

// GET /api/item-categories - List all item categories
export async function GET(request: NextRequest) {
  try {
    const context = getServiceContext();
    const service = new ItemCategoriesService(context);
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;
    
    const result = await service.listCategories({ page, limit });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing item categories:', error);
    
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

// POST /api/item-categories - Create a new item category
export async function POST(request: NextRequest) {
  try {
    const context = getServiceContext();
    const body = await request.json();
    
    const service = new ItemCategoriesService(context);
    const result = await service.createCategory(body);
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating item category:', error);
    
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