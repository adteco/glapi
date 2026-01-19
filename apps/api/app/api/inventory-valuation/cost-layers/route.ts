import { NextRequest, NextResponse } from 'next/server';
import { InventoryValuationService } from '@glapi/api-service';

function getServiceContext(request: NextRequest) {
  const organizationId = request.headers.get('x-organization-id');
  const userId = request.headers.get('x-user-id');

  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  return { organizationId, userId: userId || undefined };
}

/**
 * GET /api/inventory-valuation/cost-layers
 * Get detailed cost layer information for FIFO/LIFO tracking
 */
export async function GET(request: NextRequest) {
  try {
    const context = getServiceContext(request);
    const service = new InventoryValuationService(context);

    const { searchParams } = new URL(request.url);

    // Parse filters
    const filters = {
      subsidiaryId: searchParams.get('subsidiaryId') ?? undefined,
      locationId: searchParams.get('locationId') ?? undefined,
      itemId: searchParams.get('itemId') ?? undefined,
      includeZeroQuantity: searchParams.get('includeFullyDepleted') === 'true',
    };

    // Parse pagination
    const pagination = {
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0,
    };

    const result = await service.getAllCostLayers(filters, pagination);

    return NextResponse.json({
      data: result.layers,
      totalCount: result.totalCount,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        hasMore: pagination.offset + pagination.limit < result.totalCount,
      },
    });
  } catch (error) {
    console.error('Failed to get cost layers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get cost layers' },
      { status: error instanceof Error && error.message.includes('required') ? 400 : 500 }
    );
  }
}
