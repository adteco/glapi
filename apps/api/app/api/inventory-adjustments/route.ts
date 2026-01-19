import { NextRequest, NextResponse } from 'next/server';
import { InventoryAdjustmentService } from '@glapi/api-service';

function getServiceContext(request: NextRequest) {
  const organizationId = request.headers.get('x-organization-id');
  const userId = request.headers.get('x-user-id');
  const userName = request.headers.get('x-user-name');

  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  return { organizationId, userId: userId || undefined, userName: userName || undefined };
}

export async function GET(request: NextRequest) {
  try {
    const context = getServiceContext(request);
    const service = new InventoryAdjustmentService(context);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as any;
    const subsidiaryId = searchParams.get('subsidiaryId') ?? undefined;
    const fromDate = searchParams.get('fromDate') ?? undefined;
    const toDate = searchParams.get('toDate') ?? undefined;
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const result = await service.listAdjustments({
      status,
      subsidiaryId,
      fromDate,
      toDate,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return NextResponse.json({ data: result.data, total: result.total });
  } catch (error) {
    console.error('Failed to list adjustments:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list adjustments' },
      { status: error instanceof Error && error.message.includes('required') ? 400 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = getServiceContext(request);
    const body = await request.json();
    const service = new InventoryAdjustmentService(context);

    if (!body.subsidiaryId) {
      return NextResponse.json({ error: 'Subsidiary ID is required' }, { status: 400 });
    }
    if (!body.adjustmentDate) {
      return NextResponse.json({ error: 'Adjustment date is required' }, { status: 400 });
    }
    if (!body.adjustmentType) {
      return NextResponse.json({ error: 'Adjustment type is required' }, { status: 400 });
    }
    if (!body.lines || body.lines.length === 0) {
      return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 });
    }

    const adjustment = await service.createAdjustment({
      subsidiaryId: body.subsidiaryId,
      adjustmentDate: body.adjustmentDate,
      adjustmentType: body.adjustmentType,
      reasonCode: body.reasonCode,
      reason: body.reason,
      reference: body.reference,
      notes: body.notes,
      lines: body.lines,
    });

    return NextResponse.json({ data: adjustment }, { status: 201 });
  } catch (error) {
    console.error('Failed to create adjustment:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create adjustment' },
      { status: 500 }
    );
  }
}
