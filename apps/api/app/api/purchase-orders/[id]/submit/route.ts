import { NextRequest, NextResponse } from 'next/server';
import { PurchaseOrderHybridService } from '@glapi/api-service';
import { getServiceContext } from '../../../utils/auth';
import { handleApiError } from '../../../utils/errors';

/**
 * POST /api/purchase-orders/:id/submit
 * Submit a purchase order for approval
 */
export async function POST(
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

    const result = await service.submitPurchaseOrder(id);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
