import { NextRequest, NextResponse } from 'next/server';
import { getAsc606Caller, handleAsc606ApiError } from '../../../_lib';

// POST /api/revenue/asc606/sales-orders/:salesOrderId/plan
// Generates or regenerates an ASC 606 plan for an existing sales order.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ salesOrderId: string }> }
) {
  try {
    const { salesOrderId } = await params;
    const caller = await getAsc606Caller();
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    const result = await caller.salesOrders.generateRevenuePlan({
      salesOrderId,
      revenuePlan: body.revenuePlan as unknown,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleAsc606ApiError(error);
  }
}
