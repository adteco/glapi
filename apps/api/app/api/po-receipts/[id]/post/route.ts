import { NextRequest, NextResponse } from 'next/server';
import { POReceiptHybridService } from '@glapi/api-service';
import { getServiceContext } from '../../../utils/auth';
import { handleApiError } from '../../../utils/errors';

/**
 * POST /api/po-receipts/:id/post
 * Post a PO receipt to update inventory and PO quantities
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getServiceContext();
    const { id } = await params;

    const service = new POReceiptHybridService({
      organizationId: context.organizationId,
      userId: context.userId,
    });

    const result = await service.postReceipt(id);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
