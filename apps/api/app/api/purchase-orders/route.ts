import { NextRequest, NextResponse } from 'next/server';
import { PurchaseOrderHybridService } from '@glapi/api-service';
import { getServiceContext } from '../utils/auth';
import { handleApiError } from '../utils/errors';

/**
 * GET /api/purchase-orders
 * List purchase orders with pagination and filtering
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getServiceContext();
    const service = new PurchaseOrderHybridService({
      organizationId: context.organizationId,
      userId: context.userId,
    });

    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20;
    const status = searchParams.get('status') || undefined;
    const vendorId = searchParams.get('vendorId') || undefined;
    const subsidiaryId = searchParams.get('subsidiaryId') || undefined;
    const orderDateFrom = searchParams.get('orderDateFrom') || undefined;
    const orderDateTo = searchParams.get('orderDateTo') || undefined;
    const search = searchParams.get('search') || undefined;
    const result = await service.listPurchaseOrders(
      { page, limit },
      { status, vendorId, subsidiaryId, orderDateFrom, orderDateTo, search }
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/purchase-orders
 * Create a new purchase order
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getServiceContext();
    const service = new PurchaseOrderHybridService({
      organizationId: context.organizationId,
      userId: context.userId,
    });

    const body = await request.json();
    const result = await service.createPurchaseOrder(body);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
