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

export async function GET(request: NextRequest) {
  try {
    const context = getServiceContext(request);
    const service = new InventoryTransferService(context);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const transferType = searchParams.get('transferType') || undefined;
    const fromSubsidiaryId = searchParams.get('fromSubsidiaryId') || undefined;
    const toSubsidiaryId = searchParams.get('toSubsidiaryId') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

    const transfers = await service.listTransfers({
      status: status as any,
      transferType: transferType as any,
      fromSubsidiaryId,
      toSubsidiaryId,
      limit,
      offset,
    });

    return NextResponse.json({ data: transfers });
  } catch (error) {
    console.error('Failed to list transfers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list transfers' },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = getServiceContext(request);
    const body = await request.json();
    const service = new InventoryTransferService(context);

    const transfer = await service.createTransfer(body);

    return NextResponse.json({ data: transfer }, { status: 201 });
  } catch (error) {
    console.error('Failed to create transfer:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create transfer' },
      { status: 400 }
    );
  }
}
