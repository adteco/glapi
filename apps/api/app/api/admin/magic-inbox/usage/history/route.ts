/**
 * Magic Inbox Billing History API
 *
 * GET /api/admin/magic-inbox/usage/history - Get billing history
 */

import { NextRequest, NextResponse } from 'next/server';
import { MagicInboxUsageService } from '@glapi/api-service';
import { getServiceContext, requireAdmin } from '../../../../utils/auth';
import { handleApiError } from '../../../../utils/errors';

/**
 * GET /api/admin/magic-inbox/usage/history
 * Get the billing history with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getServiceContext();
    await checkAdmin();

    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;

    const service = new MagicInboxUsageService({
      organizationId: context.organizationId,
      userId: context.userId,
    });

    const history = await service.getBillingHistory({ page, limit });

    return NextResponse.json(history);
  } catch (error) {
    return handleApiError(error);
  }
}
