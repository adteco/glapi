import { NextRequest, NextResponse } from 'next/server';
import { ItemCategoriesService } from '@glapi/api-service';
import { getServiceContext } from '../../utils/auth';
import { isServiceError } from '../../utils/errors';

// GET /api/item-categories/tree - Get hierarchical category tree
export async function GET(request: NextRequest) {
  try {
    const context = getServiceContext();
    const service = new ItemCategoriesService(context);
    
    const result = await service.getCategoryTree();
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting category tree:', error);
    
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