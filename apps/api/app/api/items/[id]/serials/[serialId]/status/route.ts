import { NextRequest, NextResponse } from 'next/server';
import { InventoryTrackingService } from '@glapi/api-service';
import { getServiceContext } from '../../../../../utils/auth';
import { isServiceError } from '../../../../../utils/errors';

// PUT /api/items/:id/serials/:serialId/status - Update serial status
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; serialId: string } }
) {
  try {
    const context = getServiceContext();
    const body = await request.json();
    
    if (!body.status) {
      return NextResponse.json(
        { message: 'Status is required' },
        { status: 400 }
      );
    }
    
    const service = new InventoryTrackingService(context);
    const result = await service.updateSerialNumber(params.serialId, {
      status: body.status,
      customerId: body.customerId,
      soldDate: body.soldDate
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating serial status:', error);
    
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