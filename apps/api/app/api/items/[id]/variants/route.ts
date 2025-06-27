import { NextRequest, NextResponse } from 'next/server';
import { ItemsService } from '@glapi/api-service';
import { getServiceContext } from '../../../utils/auth';
import { isServiceError } from '../../../utils/errors';

// GET /api/items/:id/variants - Get variants for an item
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const service = new ItemsService(context);
    
    const result = await service.getItemVariants(params.id);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting item variants:', error);
    
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

// POST /api/items/:id/variants - Generate variants for an item
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const body = await request.json() as any;
    
    const service = new ItemsService(context);
    const result = await service.generateVariants({
      parentItemId: params.id,
      attributes: body.attributes
    });
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error generating item variants:', error);
    
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