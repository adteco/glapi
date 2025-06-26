import { NextRequest, NextResponse } from 'next/server';
import { WarehousePricingService } from '@glapi/api-service';
import { handleApiError } from '../../../utils/errors';
import { getServiceContext } from '../../../utils/auth';

/**
 * GET /api/warehouses/:id/price-lists
 * Get price lists for a warehouse
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const warehousePricingService = new WarehousePricingService(context);

    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get('date');
    const date = dateParam ? new Date(dateParam) : undefined;

    const priceLists = await warehousePricingService.getWarehousePriceLists(
      params.id,
      date
    );

    return NextResponse.json(priceLists);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/warehouses/:id/price-lists
 * Assign a price list to a warehouse
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const warehousePricingService = new WarehousePricingService(context);

    const body = await request.json();
    const assignment = await warehousePricingService.assignWarehousePriceList({
      ...body,
      warehouseId: params.id,
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/warehouses/:id/price-lists/:priceListId
 * Remove a price list from a warehouse
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const warehousePricingService = new WarehousePricingService(context);

    // Extract priceListId from query params
    const searchParams = request.nextUrl.searchParams;
    const priceListId = searchParams.get('priceListId');
    
    if (!priceListId) {
      return NextResponse.json(
        { error: 'priceListId is required' },
        { status: 400 }
      );
    }

    await warehousePricingService.removeWarehousePriceList(params.id, priceListId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}