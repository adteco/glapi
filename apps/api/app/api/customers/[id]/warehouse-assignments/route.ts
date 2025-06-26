import { NextRequest, NextResponse } from 'next/server';
import { WarehousePricingService } from '@glapi/api-service';
import { handleApiError } from '../../../utils/errors';
import { getServiceContext } from '../../../utils/auth';

/**
 * GET /api/customers/:id/warehouse-assignments
 * Get warehouse assignments for a customer
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

    const assignments = await warehousePricingService.getCustomerWarehouseAssignments(
      params.id
    );

    return NextResponse.json(assignments);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/customers/:id/warehouse-assignments
 * Assign customer to warehouse for an item
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
    const assignment = await warehousePricingService.assignCustomerWarehouse({
      ...body,
      customerId: params.id,
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}