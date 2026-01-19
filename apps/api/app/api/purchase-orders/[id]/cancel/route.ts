import { NextRequest, NextResponse } from 'next/server';
import { PurchaseOrderHybridService } from '@glapi/api-service';
import { getServiceContext } from '../../../utils/auth';
import { handleApiError } from '../../../utils/errors';

/**
 * POST /api/purchase-orders/:id/cancel
 * Cancel a purchase order
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getServiceContext();
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const reason = body.reason;

    const service = new PurchaseOrderHybridService({
      organizationId: context.organizationId,
      userId: context.userId,
    });

    const result = await service.cancelPurchaseOrder(id, reason);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
