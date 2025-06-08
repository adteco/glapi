import { NextRequest, NextResponse } from 'next/server';
import { inventoryTrackingRepository } from '@glapi/database';
import { getServiceContext } from '../../../../utils/auth';
import { isServiceError } from '../../../../utils/errors';

// GET /api/items/:id/serials/search - Search by serial number
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const serialNumber = searchParams.get('serialNumber') || searchParams.get('q');
    
    if (!serialNumber) {
      return NextResponse.json(
        { message: 'Serial number is required' },
        { status: 400 }
      );
    }
    
    // Direct repository call for search
    const result = await inventoryTrackingRepository.findSerialByNumber(serialNumber);
    
    if (!result || result.itemId !== params.id) {
      return NextResponse.json(
        { message: 'Serial number not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error searching serial number:', error);
    
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