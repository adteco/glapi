import { NextRequest, NextResponse } from 'next/server';
import { getAsc606Caller, handleAsc606ApiError } from '../../_lib';

// POST /api/revenue/asc606/demo/seed
// Seeds demo ASC-606 software scenarios (prepaid, billed monthly, discount, upsell, downsell, cancellation).
export async function POST(request: NextRequest) {
  try {
    const caller = await getAsc606Caller();
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    const result = await caller.revenue.seedSoftwareDemoScenarios({
      forceRecalculate: Boolean(body.forceRecalculate),
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleAsc606ApiError(error);
  }
}

