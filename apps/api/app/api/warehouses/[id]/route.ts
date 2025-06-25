import { NextRequest, NextResponse } from 'next/server';
import { WarehousePricingService } from '@glapi/api-service';
import { handleApiError } from '../../utils/errors';
import { getServiceContext } from '../../utils/auth';

/**
 * GET /api/warehouses/:id
 * Get a specific warehouse
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

    const warehouse = await warehousePricingService.getWarehouse(params.id);
    return NextResponse.json(warehouse);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/warehouses/:id
 * Update a warehouse
 */
export async function PATCH(
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
    const warehouse = await warehousePricingService.updateWarehouse(params.id, body);

    return NextResponse.json(warehouse);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/warehouses/:id
 * Delete a warehouse
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

    await warehousePricingService.deleteWarehouse(params.id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}