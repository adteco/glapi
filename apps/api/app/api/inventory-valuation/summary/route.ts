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
 * GET /api/inventory-valuation/summary
 * Get aggregated valuation summary by dimension (subsidiary, location, or category)
 */
export async function GET(request: NextRequest) {
  try {
    const context = getServiceContext(request);
    const service = new InventoryValuationService(context);

    const { searchParams } = new URL(request.url);

    const groupBy = (searchParams.get('groupBy') as 'subsidiary' | 'location' | 'category') ?? 'subsidiary';

    // Validate groupBy parameter
    if (!['subsidiary', 'location', 'category'].includes(groupBy)) {
      return NextResponse.json(
        { error: 'groupBy must be one of: subsidiary, location, category' },
        { status: 400 }
      );
    }

    // Parse filters
    const filters = {
      subsidiaryId: searchParams.get('subsidiaryId') ?? undefined,
      locationId: searchParams.get('locationId') ?? undefined,
    };

    // Get summary by dimension
    const summary = await service.getValuationSummary(groupBy, filters);

    // Also get total valuation
    const totals = await service.getTotalValuation(filters);

    return NextResponse.json({
      data: summary,
      totals,
      groupBy,
    });
  } catch (error) {
    console.error('Failed to get valuation summary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get valuation summary' },
      { status: error instanceof Error && error.message.includes('required') ? 400 : 500 }
    );
  }
}
