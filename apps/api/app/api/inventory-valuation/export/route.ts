import { NextRequest, NextResponse } from 'next/server';
import { InventoryValuationService } from '@glapi/api-service';

function getServiceContext(request: NextRequest) {
  const organizationId = request.headers.get('x-organization-id');
  const userId = request.headers.get('x-user-id');

  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  return { organizationId, userId: userId || undefined };
}

/**
 * GET /api/inventory-valuation/export
 * Export inventory valuation report in various formats (JSON, CSV)
 */
export async function GET(request: NextRequest) {
  try {
    const context = getServiceContext(request);
    const service = new InventoryValuationService(context);

    const { searchParams } = new URL(request.url);

    const format = (searchParams.get('format') as 'json' | 'csv') ?? 'csv';
    const reportType = searchParams.get('type') ?? 'valuation'; // 'valuation' or 'cost-layers'

    // Validate format
    if (!['json', 'csv'].includes(format)) {
      return NextResponse.json(
        { error: 'format must be one of: json, csv' },
        { status: 400 }
      );
    }

    // Parse filters
    const filters = {
      subsidiaryId: searchParams.get('subsidiaryId') ?? undefined,
      locationId: searchParams.get('locationId') ?? undefined,
      categoryId: searchParams.get('categoryId') ?? undefined,
      itemId: searchParams.get('itemId') ?? undefined,
      includeZeroQuantity: searchParams.get('includeZeroQuantity') === 'true',
    };

    let exportResult;
    if (reportType === 'cost-layers') {
      exportResult = await service.exportCostLayers(filters, format);
    } else {
      exportResult = await service.exportValuationReport(filters, format);
    }

    // Return appropriate response based on format
    if (format === 'json') {
      return NextResponse.json({
        data: JSON.parse(exportResult.data as string),
        filename: exportResult.filename,
        recordCount: exportResult.recordCount,
      });
    }

    // For CSV, return as file download
    return new NextResponse(exportResult.data, {
      status: 200,
      headers: {
        'Content-Type': exportResult.mimeType,
        'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
        'X-Record-Count': String(exportResult.recordCount),
      },
    });
  } catch (error) {
    console.error('Failed to export valuation report:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export valuation report' },
      { status: error instanceof Error && error.message.includes('required') ? 400 : 500 }
    );
  }
}
