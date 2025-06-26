import { NextRequest, NextResponse } from 'next/server';
import { CustomerService } from '@glapi/api-service';
import { getServiceContext } from '../../../utils/auth';
import { handleApiError } from '../../../utils/errors';

// GET /api/customers/:id/children - Get child customers
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const customerService = new CustomerService(context);
    
    const children = await customerService.getChildCustomers(params.id);
    
    return NextResponse.json({
      data: children,
      total: children.length
    });
  } catch (error) {
    return handleApiError(error);
  }
}