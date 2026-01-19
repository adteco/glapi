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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = getServiceContext(request);
    const body = await request.json();
    const service = new InventoryAdjustmentService(context);

    if (!body.reason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    }

    const adjustment = await service.reject(id, body.reason);

    return NextResponse.json({ data: adjustment });
  } catch (error) {
    console.error('Failed to reject adjustment:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reject adjustment' },
      { status: error instanceof Error && error.message.includes('not found') ? 404 : 400 }
    );
  }
}
