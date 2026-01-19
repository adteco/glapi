import { NextRequest, NextResponse } from 'next/server';
import { ItemCostingConfigService } from '@glapi/api-service';

function getServiceContext(request: NextRequest) {
  const organizationId = request.headers.get('x-organization-id');
  const userId = request.headers.get('x-user-id');

  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  return { organizationId, userId: userId || undefined };
}

type RouteParams = {
  itemId: string;
  subsidiaryId: string;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { itemId, subsidiaryId } = await params;
    const context = getServiceContext(request);
    const body = await request.json();
    const service = new ItemCostingConfigService(context);

    if (!body.quantity || body.quantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be greater than 0' },
        { status: 400 }
      );
    }

    if (!body.transactionType) {
      return NextResponse.json(
        { error: 'Transaction type is required (RECEIPT, ISSUE, or ADJUSTMENT)' },
        { status: 400 }
      );
    }

    const validTypes = ['RECEIPT', 'ISSUE', 'ADJUSTMENT'];
    if (!validTypes.includes(body.transactionType)) {
      return NextResponse.json(
        { error: `Invalid transaction type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await service.calculateCost(
      itemId,
      subsidiaryId,
      body.quantity,
      body.transactionType,
      body.receiptCost
    );

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Failed to calculate cost:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate cost' },
      { status: error instanceof Error && error.message.includes('Insufficient') ? 400 : 500 }
    );
  }
}
