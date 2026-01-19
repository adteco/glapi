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

export async function GET(request: NextRequest) {
  try {
    const context = getServiceContext(request);
    const service = new ItemCostingConfigService(context);
    const defaults = await service.getOrganizationDefaults();

    return NextResponse.json({ data: defaults });
  } catch (error) {
    console.error('Failed to get organization costing defaults:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get defaults' },
      { status: error instanceof Error && error.message.includes('required') ? 400 : 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = getServiceContext(request);
    const body = await request.json();
    const service = new ItemCostingConfigService(context);

    const defaults = await service.upsertOrganizationDefaults({
      defaultCostingMethod: body.defaultCostingMethod,
      allowStandardCostRevaluation: body.allowStandardCostRevaluation,
      defaultRevaluationAccountId: body.defaultRevaluationAccountId,
      priceVarianceThresholdPercent: body.priceVarianceThresholdPercent,
      quantityVarianceThresholdPercent: body.quantityVarianceThresholdPercent,
      trackCostLayers: body.trackCostLayers,
      autoRecalculateOnReceipt: body.autoRecalculateOnReceipt,
    });

    return NextResponse.json({ data: defaults });
  } catch (error) {
    console.error('Failed to update organization costing defaults:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update defaults' },
      { status: error instanceof Error && error.message.includes('required') ? 400 : 500 }
    );
  }
}
