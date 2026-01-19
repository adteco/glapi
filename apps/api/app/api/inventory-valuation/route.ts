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
 * GET /api/inventory-valuation
 * Get inventory valuation report with item details
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
      categoryId: searchParams.get('categoryId') ?? undefined,
      itemId: searchParams.get('itemId') ?? undefined,
      includeZeroQuantity: searchParams.get('includeZeroQuantity') === 'true',
      asOfDate: searchParams.get('asOfDate') ? new Date(searchParams.get('asOfDate')!) : undefined,
      costingMethod: searchParams.get('costingMethod') as any ?? undefined,
    };

    // Parse pagination
    const pagination = {
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0,
      orderBy: (searchParams.get('orderBy') as 'itemCode' | 'totalValue' | 'quantityOnHand') ?? 'itemCode',
      orderDirection: (searchParams.get('orderDirection') as 'asc' | 'desc') ?? 'asc',
    };

    const result = await service.getItemValuations(filters, pagination);

    return NextResponse.json({
      data: result.items,
      summary: result.summary,
      pagination: result.pagination,
      asOfDate: result.asOfDate.toISOString(),
    });
  } catch (error) {
    console.error('Failed to get inventory valuation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get inventory valuation' },
      { status: error instanceof Error && error.message.includes('required') ? 400 : 500 }
    );
  }
}
