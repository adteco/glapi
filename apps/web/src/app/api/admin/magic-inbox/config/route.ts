/**
 * Magic Inbox Configuration API
 *
 * GET  /api/admin/magic-inbox/config - Get current configuration
 * POST /api/admin/magic-inbox/config - Enable Magic Inbox
 * PATCH /api/admin/magic-inbox/config - Update configuration
 * DELETE /api/admin/magic-inbox/config - Disable Magic Inbox
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MagicInboxConfigService, type EnableMagicInboxInput } from '@glapi/api-service';
import { getServiceContext, requireAdmin } from '../../../utils/auth';
import { handleApiError } from '../../../utils/errors';

// Validation schema for enabling Magic Inbox
const EnableMagicInboxSchema = z.discriminatedUnion('emailType', [
  z.object({
    emailType: z.literal('prefix'),
    prefix: z.string().min(3).max(50),
  }),
  z.object({
    emailType: z.literal('custom_domain'),
    customDomain: z.string().min(4),
  }),
]);

/**
 * GET /api/admin/magic-inbox/config
 * Get the current Magic Inbox configuration for the organization
 */
export async function GET() {
  try {
    const context = await getServiceContext();
    await requireAdmin();

    const service = new MagicInboxConfigService({
      organizationId: context.organizationId,
      userId: context.userId,
    });

    const config = await service.getConfig();

    if (!config) {
      return NextResponse.json({
        enabled: false,
        message: 'Magic Inbox is not configured for this organization',
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/admin/magic-inbox/config
 * Enable Magic Inbox for the organization
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getServiceContext();
    await requireAdmin();

    const body = await request.json();
    const parsed = EnableMagicInboxSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Invalid configuration data',
          errors: parsed.error.errors,
        },
        { status: 400 }
      );
    }

    const service = new MagicInboxConfigService({
      organizationId: context.organizationId,
      userId: context.userId,
    });

    const config = await service.enableMagicInbox(parsed.data as EnableMagicInboxInput);

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/admin/magic-inbox/config
 * Disable Magic Inbox for the organization
 */
export async function DELETE() {
  try {
    const context = await getServiceContext();
    await requireAdmin();

    const service = new MagicInboxConfigService({
      organizationId: context.organizationId,
      userId: context.userId,
    });

    await service.disableMagicInbox();

    return NextResponse.json({ success: true, message: 'Magic Inbox disabled' });
  } catch (error) {
    return handleApiError(error);
  }
}
