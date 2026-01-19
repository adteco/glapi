import { NextRequest, NextResponse } from 'next/server';
import { PurchaseOrderHybridService } from '@glapi/api-service';
import { getServiceContext } from '../../utils/auth';
import { handleApiError } from '../../utils/errors';

/**
 * GET /api/purchase-orders/:id
 * Get a purchase order by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getServiceContext();
    const { id } = await params;

    const service = new PurchaseOrderHybridService({
      organizationId: context.organizationId,
      userId: context.userId,
    });

    const result = await service.getPurchaseOrderById(id);

    if (!result) {
      return NextResponse.json(
        { message: `Purchase order with ID "${id}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
