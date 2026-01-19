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
    const configs = await service.listSubsidiaryConfigs();

    return NextResponse.json({ data: configs });
  } catch (error) {
    console.error('Failed to list subsidiary costing configs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list configs' },
      { status: error instanceof Error && error.message.includes('required') ? 400 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = getServiceContext(request);
    const body = await request.json();
    const service = new ItemCostingConfigService(context);

    if (!body.subsidiaryId) {
      return NextResponse.json(
        { error: 'Subsidiary ID is required' },
        { status: 400 }
      );
    }

    if (!body.costingMethod) {
      return NextResponse.json(
        { error: 'Costing method is required' },
        { status: 400 }
      );
    }

    if (!body.effectiveDate) {
      return NextResponse.json(
        { error: 'Effective date is required' },
        { status: 400 }
      );
    }

    const config = await service.createSubsidiaryConfig({
      subsidiaryId: body.subsidiaryId,
      costingMethod: body.costingMethod,
      allowStandardCostRevaluation: body.allowStandardCostRevaluation,
      revaluationAccountId: body.revaluationAccountId,
      priceVarianceThresholdPercent: body.priceVarianceThresholdPercent,
      quantityVarianceThresholdPercent: body.quantityVarianceThresholdPercent,
      isActive: body.isActive ?? true,
      effectiveDate: body.effectiveDate,
      expirationDate: body.expirationDate,
    });

    return NextResponse.json({ data: config }, { status: 201 });
  } catch (error) {
    console.error('Failed to create subsidiary costing config:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create config' },
      { status: error instanceof Error && error.message.includes('required') ? 400 : 500 }
    );
  }
}
