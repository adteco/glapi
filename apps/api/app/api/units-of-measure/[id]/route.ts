import { NextRequest, NextResponse } from 'next/server';
import { UnitsOfMeasureService } from '@glapi/api-service';
import { getServiceContext } from '../../utils/auth';
import { isServiceError } from '../../utils/errors';

// GET /api/units-of-measure/:id - Get a unit of measure by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const service = new UnitsOfMeasureService(context);
    
    const result = await service.getUnitsOfMeasure(params.id);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting unit of measure:', error);
    
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

// PUT /api/units-of-measure/:id - Update a unit of measure
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const body = await request.json() as any;
    
    const service = new UnitsOfMeasureService(context);
    const result = await service.updateUnitsOfMeasure(params.id, body);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating unit of measure:', error);
    
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

// DELETE /api/units-of-measure/:id - Delete (deactivate) a unit of measure
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const service = new UnitsOfMeasureService(context);
    
    await service.deleteUnitsOfMeasure(params.id);
    
    return NextResponse.json({ message: 'Unit of measure deleted successfully' });
  } catch (error) {
    console.error('Error deleting unit of measure:', error);
    
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