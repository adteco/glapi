import { NextRequest, NextResponse } from 'next/server';
import { PricingService } from '@glapi/api-service';
import { getServiceContext } from '../../utils/auth';
import { handleApiError } from '../../utils/errors';

// PATCH /api/item-pricing/:id - Update item pricing
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const service = new PricingService(context);
    
    const body = await request.json() as any;
    const result = await service.updateItemPricing(params.id, body);
    
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/item-pricing/:id - Delete item pricing
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const service = new PricingService(context);
    
    await service.deleteItemPricing(params.id);
    
    return NextResponse.json({ message: 'Item pricing deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}