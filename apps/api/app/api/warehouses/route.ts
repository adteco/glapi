import { NextRequest, NextResponse } from 'next/server';
import { WarehousePricingService } from '@glapi/api-service';
import { handleApiError } from '../utils/errors';
import { getServiceContext } from '../utils/auth';

/**
 * GET /api/warehouses
 * List all warehouses for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const context = getServiceContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const warehousePricingService = new WarehousePricingService(context);

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    const result = await warehousePricingService.listWarehouses({
      page,
      limit,
      activeOnly,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/warehouses
 * Create a new warehouse
 */
export async function POST(request: NextRequest) {
  try {
    const context = getServiceContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const warehousePricingService = new WarehousePricingService(context);

    const body = await request.json();
    const warehouse = await warehousePricingService.createWarehouse(body);

    return NextResponse.json(warehouse, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}