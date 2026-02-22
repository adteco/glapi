import { NextRequest, NextResponse } from 'next/server';
import { getAsc606Caller, handleAsc606ApiError } from '../../../../_lib';

// POST /api/revenue/asc606/subscriptions/:subscriptionId/license-changes/preview
// Returns what-if impact for a license add/remove change without persisting it.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    const { subscriptionId } = await params;
    const caller = await getAsc606Caller();
    const body = await request.json() as Record<string, unknown>;

    const result = await caller.subscriptions.previewLicenseChange({
      subscriptionId,
      itemId: String(body.itemId || ''),
      action: body.action as 'add' | 'remove',
      quantity: Number(body.quantity),
      unitPrice: body.unitPrice === undefined ? undefined : Number(body.unitPrice),
      effectiveDate: new Date(String(body.effectiveDate)),
      endDate: body.endDate ? new Date(String(body.endDate)) : undefined,
      reason: body.reason ? String(body.reason) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleAsc606ApiError(error);
  }
}
