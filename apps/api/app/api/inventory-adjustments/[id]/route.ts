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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = getServiceContext(request);
    const service = new InventoryAdjustmentService(context);

    const adjustment = await service.getAdjustment(id);

    if (!adjustment) {
      return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 });
    }

    return NextResponse.json({ data: adjustment });
  } catch (error) {
    console.error('Failed to get adjustment:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get adjustment' },
      { status: 500 }
    );
  }
}
