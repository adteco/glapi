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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subsidiaryId: string }> }
) {
  try {
    const { subsidiaryId } = await params;
    const context = getServiceContext(request);
    const service = new ItemCostingConfigService(context);
    const config = await service.getSubsidiaryConfig(subsidiaryId);

    if (!config) {
      return NextResponse.json(
        { error: 'Subsidiary costing config not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: config });
  } catch (error) {
    console.error('Failed to get subsidiary costing config:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get config' },
      { status: error instanceof Error && error.message.includes('required') ? 400 : 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ subsidiaryId: string }> }
) {
  try {
    const { subsidiaryId } = await params;
    const context = getServiceContext(request);
    const body = await request.json();
    const service = new ItemCostingConfigService(context);

    const config = await service.updateSubsidiaryConfig(subsidiaryId, {
      costingMethod: body.costingMethod,
      allowStandardCostRevaluation: body.allowStandardCostRevaluation,
      revaluationAccountId: body.revaluationAccountId,
      priceVarianceThresholdPercent: body.priceVarianceThresholdPercent,
      quantityVarianceThresholdPercent: body.quantityVarianceThresholdPercent,
      isActive: body.isActive,
      effectiveDate: body.effectiveDate,
      expirationDate: body.expirationDate,
    });

    if (!config) {
      return NextResponse.json(
        { error: 'Subsidiary costing config not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: config });
  } catch (error) {
    console.error('Failed to update subsidiary costing config:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update config' },
      { status: error instanceof Error && error.message.includes('required') ? 400 : 500 }
    );
  }
}
