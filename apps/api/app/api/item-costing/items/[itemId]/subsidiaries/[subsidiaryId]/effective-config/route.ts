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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { itemId, subsidiaryId } = await params;
    const context = getServiceContext(request);
    const service = new ItemCostingConfigService(context);
    const effectiveConfig = await service.getEffectiveConfig(itemId, subsidiaryId);

    return NextResponse.json({ data: effectiveConfig });
  } catch (error) {
    console.error('Failed to get effective costing config:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get config' },
      { status: error instanceof Error && error.message.includes('required') ? 400 : 500 }
    );
  }
}
