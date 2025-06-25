import { NextRequest, NextResponse } from 'next/server';
import { UnitsOfMeasureService } from '@glapi/api-service';
import { getServiceContext } from '../utils/auth';
import { isServiceError } from '../utils/errors';

// GET /api/units-of-measure - List all units of measure
export async function GET(request: NextRequest) {
  try {
    const context = getServiceContext();
    const service = new UnitsOfMeasureService(context);
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;
    
    const result = await service.listUnitsOfMeasure({ page, limit });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing units of measure:', error);
    
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

// POST /api/units-of-measure - Create a new unit of measure
export async function POST(request: NextRequest) {
  try {
    const context = getServiceContext();
    const body = await request.json();
    
    const service = new UnitsOfMeasureService(context);
    const result = await service.createUnitsOfMeasure(body);
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating unit of measure:', error);
    
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