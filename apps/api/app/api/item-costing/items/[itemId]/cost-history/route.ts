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
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { itemId } = await params;
    const context = getServiceContext(request);
    const service = new ItemCostingConfigService(context);

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const history = await service.getItemCostHistory(itemId, {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return NextResponse.json({ data: history });
  } catch (error) {
    console.error('Failed to get item cost history:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get history' },
      { status: error instanceof Error && error.message.includes('required') ? 400 : 500 }
    );
  }
}
