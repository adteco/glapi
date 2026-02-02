/**
 * Magic Inbox Usage API
 *
 * GET /api/admin/magic-inbox/usage - Get current period usage
 */

import { NextResponse } from 'next/server';
import { MagicInboxUsageService } from '@glapi/api-service';
import { getServiceContext, requireAdmin } from '../../../utils/auth';
import { handleApiError } from '../../../utils/errors';

// Skip admin check in development for easier testing
const checkAdmin = async () => {
  if (process.env.NODE_ENV !== 'production') return;
  await requireAdmin();
};

/**
 * GET /api/admin/magic-inbox/usage
 * Get the current billing period usage
 */
export async function GET() {
  try {
    const context = await getServiceContext();
    await checkAdmin();

    const service = new MagicInboxUsageService({
      organizationId: context.organizationId,
      userId: context.userId,
    });

    const usage = await service.getCurrentPeriodUsage();

    return NextResponse.json(usage);
  } catch (error) {
    return handleApiError(error);
  }
}
