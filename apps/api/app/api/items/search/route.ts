import { NextRequest, NextResponse } from 'next/server';
import { ItemsService } from '@glapi/api-service';
import { getServiceContext } from '../../utils/auth';
import { isServiceError } from '../../utils/errors';

// GET /api/items/search - Advanced search for items
export async function GET(request: NextRequest) {
  try {
    const context = await getServiceContext();
    const service = new ItemsService(context);
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || searchParams.get('query') || '';
    
    if (!query) {
      return NextResponse.json(
        { message: 'Search query is required' },
        { status: 400 }
      );
    }
    
    const result = await service.searchItems(query);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error searching items:', error);
    
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