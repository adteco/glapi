import { NextRequest, NextResponse } from 'next/server';
import { POReceiptHybridService } from '@glapi/api-service';
import { getServiceContext } from '../../utils/auth';
import { handleApiError } from '../../utils/errors';

/**
 * GET /api/po-receipts/:id
 * Get a PO receipt by ID
 */
export async function GET(
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

    const result = await service.getReceiptById(id);

    if (!result) {
      return NextResponse.json(
        { message: `PO receipt with ID "${id}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
