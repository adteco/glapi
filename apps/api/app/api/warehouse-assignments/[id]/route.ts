import { NextRequest, NextResponse } from 'next/server';
import { WarehousePricingService } from '@glapi/api-service';
import { handleApiError } from '../../utils/errors';
import { getServiceContext } from '../../utils/auth';

/**
 * PATCH /api/warehouse-assignments/:id
 * Update a warehouse assignment
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

    const body = await request.json() as any;
    const assignment = await warehousePricingService.updateCustomerWarehouseAssignment(
      params.id,
      body
    );

    return NextResponse.json(assignment);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/warehouse-assignments/:id
 * Remove a warehouse assignment
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

    await warehousePricingService.removeCustomerWarehouseAssignment(params.id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}