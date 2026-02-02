/**
 * Magic Inbox Webhook Secret Management API
 *
 * POST /api/admin/magic-inbox/webhook-secret - Regenerate webhook secret
 */

import { NextResponse } from 'next/server';
import { MagicInboxConfigService } from '@glapi/api-service';
import { getServiceContext, requireAdmin } from '../../../utils/auth';
import { handleApiError } from '../../../utils/errors';

/**
 * POST /api/admin/magic-inbox/webhook-secret
 * Regenerate the webhook secret (invalidates the old one)
 */
export async function POST() {
  try {
    const context = await getServiceContext();
    await requireAdmin();

    const service = new MagicInboxConfigService({
      organizationId: context.organizationId,
      userId: context.userId,
    });

    const newSecret = await service.regenerateWebhookSecret();

    return NextResponse.json({
      success: true,
      webhookSecret: newSecret,
      message: 'Webhook secret regenerated. Update your Magic Inbox processor configuration.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
