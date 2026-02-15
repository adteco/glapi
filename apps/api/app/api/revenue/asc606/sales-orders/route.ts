import { NextRequest, NextResponse } from 'next/server';
import { getAsc606Caller, handleAsc606ApiError } from '../_lib';

// POST /api/revenue/asc606/sales-orders
// Creates a sales order and returns the generated ASC 606 plan.
export async function POST(request: NextRequest) {
  try {
    const caller = await getAsc606Caller();
    const body = await request.json() as Record<string, unknown>;

    const payload = (body.order
      ? body
      : {
          order: body,
          revenuePlan: body.revenuePlan,
        }) as { order: unknown; revenuePlan?: unknown };

    const result = await caller.salesOrders.createWithRevenuePlan(payload);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleAsc606ApiError(error);
  }
}
