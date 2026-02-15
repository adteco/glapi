import { NextRequest, NextResponse } from 'next/server';
import { getAsc606Caller, handleAsc606ApiError } from '../../../_lib';

// GET /api/revenue/asc606/subscriptions/:subscriptionId/plan
// Returns subscription-level ASC 606 summary, waterfall, schedules, and obligations.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    const { subscriptionId } = await params;
    const caller = await getAsc606Caller();
    const searchParams = request.nextUrl.searchParams;

    const startDateRaw = searchParams.get('startDate');
    const endDateRaw = searchParams.get('endDate');

    const result = await caller.revenue.subscriptionPlan({
      subscriptionId,
      startDate: startDateRaw ? new Date(startDateRaw) : undefined,
      endDate: endDateRaw ? new Date(endDateRaw) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleAsc606ApiError(error);
  }
}
