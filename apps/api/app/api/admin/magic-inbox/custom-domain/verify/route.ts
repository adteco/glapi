/**
 * Magic Inbox Custom Domain Verification API
 *
 * POST /api/admin/magic-inbox/custom-domain/verify - Verify DNS records
 */

import { NextResponse } from 'next/server';
import { MagicInboxConfigService } from '@glapi/api-service';
import { getServiceContext, requireAdmin } from '../../../../utils/auth';
import { handleApiError } from '../../../../utils/errors';

/**
 * POST /api/admin/magic-inbox/custom-domain/verify
 * Verify that DNS records have been configured correctly
 */
export async function POST() {
  try {
    const context = await getServiceContext();
    await requireAdmin();

    const service = new MagicInboxConfigService({
      organizationId: context.organizationId,
      userId: context.userId,
    });

    const result = await service.verifyCustomDomain();

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
