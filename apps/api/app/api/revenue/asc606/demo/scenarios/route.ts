import { NextResponse } from 'next/server';
import { getAsc606Caller, handleAsc606ApiError } from '../../_lib';

// GET /api/revenue/asc606/demo/scenarios
// Lists seeded demo subscriptions for quick selection in demos.
export async function GET() {
  try {
    const caller = await getAsc606Caller();
    const result = await caller.revenue.listSoftwareDemoScenarios();
    return NextResponse.json(result);
  } catch (error) {
    return handleAsc606ApiError(error);
  }
}

