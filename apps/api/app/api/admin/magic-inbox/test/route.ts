/**
 * Magic Inbox Test Email API
 *
 * POST /api/admin/magic-inbox/test - Send a test email
 * GET /api/admin/magic-inbox/test?id=xxx - Get test result
 */

import { NextRequest, NextResponse } from 'next/server';
import { MagicInboxConfigService } from '@glapi/api-service';
import { getServiceContext, requireAdmin } from '../../../utils/auth';
import { handleApiError } from '../../../utils/errors';

/**
 * POST /api/admin/magic-inbox/test
 * Send a test email to verify the Magic Inbox setup
 */
export async function POST() {
  try {
    const context = await getServiceContext();
    await requireAdmin();

    const service = new MagicInboxConfigService({
      organizationId: context.organizationId,
      userId: context.userId,
    });

    const result = await service.sendTestEmail();

    return NextResponse.json({
      success: true,
      testId: result.testId,
      message: 'Test email initiated. Check the result using the testId.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/admin/magic-inbox/test?id=xxx
 * Get the result of a test email
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getServiceContext();
    await requireAdmin();

    const testId = request.nextUrl.searchParams.get('id');

    if (!testId) {
      return NextResponse.json(
        { message: 'Test ID is required' },
        { status: 400 }
      );
    }

    const service = new MagicInboxConfigService({
      organizationId: context.organizationId,
      userId: context.userId,
    });

    const result = await service.getTestResult(testId);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
