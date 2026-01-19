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
    const config = await service.getItemCostingMethod(itemId, subsidiaryId);

    if (!config) {
      return NextResponse.json(
        { error: 'Item costing method not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: config });
  } catch (error) {
    console.error('Failed to get item costing method:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get method' },
      { status: error instanceof Error && error.message.includes('required') ? 400 : 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { itemId, subsidiaryId } = await params;
    const context = getServiceContext(request);
    const body = await request.json();
    const service = new ItemCostingConfigService(context);

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

    const config = await service.createItemCostingMethod({
      itemId,
      subsidiaryId,
      costingMethod: body.costingMethod,
      standardCost: body.standardCost,
      standardCostEffectiveDate: body.standardCostEffectiveDate,
      allowStandardCostRevaluation: body.allowStandardCostRevaluation,
      revaluationAccountId: body.revaluationAccountId,
      overrideDefaultCost: body.overrideDefaultCost,
      priceVarianceThresholdPercent: body.priceVarianceThresholdPercent,
      quantityVarianceThresholdPercent: body.quantityVarianceThresholdPercent,
      isActive: body.isActive ?? true,
      effectiveDate: body.effectiveDate,
      expirationDate: body.expirationDate,
    });

    return NextResponse.json({ data: config }, { status: 201 });
  } catch (error) {
    console.error('Failed to create item costing method:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create method' },
      { status: error instanceof Error && error.message.includes('required') ? 400 : 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { itemId, subsidiaryId } = await params;
    const context = getServiceContext(request);
    const body = await request.json();
    const service = new ItemCostingConfigService(context);

    const config = await service.updateItemCostingMethod(itemId, subsidiaryId, {
      costingMethod: body.costingMethod,
      standardCost: body.standardCost,
      standardCostEffectiveDate: body.standardCostEffectiveDate,
      allowStandardCostRevaluation: body.allowStandardCostRevaluation,
      revaluationAccountId: body.revaluationAccountId,
      overrideDefaultCost: body.overrideDefaultCost,
      priceVarianceThresholdPercent: body.priceVarianceThresholdPercent,
      quantityVarianceThresholdPercent: body.quantityVarianceThresholdPercent,
      isActive: body.isActive,
      effectiveDate: body.effectiveDate,
      expirationDate: body.expirationDate,
    });

    if (!config) {
      return NextResponse.json(
        { error: 'Item costing method not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: config });
  } catch (error) {
    console.error('Failed to update item costing method:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update method' },
      { status: error instanceof Error && error.message.includes('required') ? 400 : 500 }
    );
  }
}
