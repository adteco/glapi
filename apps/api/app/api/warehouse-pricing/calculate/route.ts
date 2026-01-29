import { NextRequest, NextResponse } from 'next/server';
import { WarehousePricingService } from '@glapi/api-service';
import { handleApiError } from '../../utils/errors';
import { getServiceContext } from '../../utils/auth';

/**
 * POST /api/warehouse-pricing/calculate
 * Calculate customer price based on warehouse assignment
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getServiceContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const warehousePricingService = new WarehousePricingService(context);

    const body = await request.json() as any;
    
    // Validate required fields
    if (!body.customerId || !body.itemId) {
      return NextResponse.json(
        { error: 'customerId and itemId are required' },
        { status: 400 }
      );
    }

    const price = await warehousePricingService.getCustomerWarehousePrice({
      customerId: body.customerId,
      itemId: body.itemId,
      quantity: body.quantity,
      date: body.date ? new Date(body.date) : undefined,
    });

    if (!price) {
      return NextResponse.json(
        { 
          error: 'No price found', 
          details: 'No warehouse assignment or price found for this customer and item'
        },
        { status: 404 }
      );
    }

    return NextResponse.json(price);
  } catch (error) {
    return handleApiError(error);
  }
}