import { NextRequest, NextResponse } from 'next/server';
import { InventoryTransferService } from '@glapi/api-service';

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
    const service = new InventoryTransferService(context);

    const transfer = await service.getTransfer(id);

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    return NextResponse.json({ data: transfer });
  } catch (error) {
    console.error('Failed to get transfer:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get transfer' },
      { status: 400 }
    );
  }
}
