import { NextRequest, NextResponse } from 'next/server';
import { POReceiptHybridService } from '@glapi/api-service';
import { getServiceContext } from '../utils/auth';
import { handleApiError } from '../utils/errors';

/**
 * GET /api/po-receipts
 * List PO receipts with pagination and filtering
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getServiceContext();
    const service = new POReceiptHybridService({
      organizationId: context.organizationId,
      userId: context.userId,
    });

    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20;
    const status = searchParams.get('status') || undefined;
    const purchaseOrderId = searchParams.get('purchaseOrderId') || undefined;
    const vendorId = searchParams.get('vendorId') || undefined;
    const subsidiaryId = searchParams.get('subsidiaryId') || undefined;
    const receiptDateFrom = searchParams.get('receiptDateFrom') || undefined;
    const receiptDateTo = searchParams.get('receiptDateTo') || undefined;
    const search = searchParams.get('search') || undefined;
    const result = await service.listReceipts(
      { page, limit },
      { status, purchaseOrderId, vendorId, subsidiaryId, receiptDateFrom, receiptDateTo, search }
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/po-receipts
 * Create a new PO receipt
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getServiceContext();
    const service = new POReceiptHybridService({
      organizationId: context.organizationId,
      userId: context.userId,
    });

    const body = await request.json();
    const result = await service.createReceipt(body);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
