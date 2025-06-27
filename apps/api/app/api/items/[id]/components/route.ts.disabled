import { NextRequest, NextResponse } from 'next/server';
import { AssembliesKitsService } from '@glapi/api-service';
import { getServiceContext } from '../../../utils/auth';
import { isServiceError } from '../../../utils/errors';

// GET /api/items/:id/components - Get BOM/kit components for an item
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const service = new AssembliesKitsService(context);
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;
    
    const result = await service.getComponents(params.id, { page, limit });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting item components:', error);
    
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

// POST /api/items/:id/components - Add component to assembly/kit
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const body = await request.json();
    
    const service = new AssembliesKitsService(context);
    const result = await service.addComponent({
      parentItemId: params.id,
      ...body
    });
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error adding component:', error);
    
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