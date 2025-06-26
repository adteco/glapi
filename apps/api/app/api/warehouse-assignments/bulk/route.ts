import { NextRequest, NextResponse } from 'next/server';
import { WarehousePricingService } from '@glapi/api-service';
import { handleApiError } from '../../utils/errors';
import { getServiceContext } from '../../utils/auth';

/**
 * POST /api/warehouse-assignments/bulk
 * Bulk assign customers to warehouses for items
 */
export async function POST(request: NextRequest) {
  try {
    const context = getServiceContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const warehousePricingService = new WarehousePricingService(context);

    const body = await request.json();
    
    // Validate that body is an array
    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json(
        { error: 'Request body must be a non-empty array of assignments' },
        { status: 400 }
      );
    }

    // Validate each assignment has required fields
    for (const assignment of body) {
      if (!assignment.customerId || !assignment.itemId || !assignment.warehouseId) {
        return NextResponse.json(
          { error: 'Each assignment must have customerId, itemId, and warehouseId' },
          { status: 400 }
        );
      }
    }

    const assignments = await warehousePricingService.bulkAssignCustomerWarehouses(body);

    return NextResponse.json(
      { 
        success: true, 
        created: assignments.length,
        assignments 
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}