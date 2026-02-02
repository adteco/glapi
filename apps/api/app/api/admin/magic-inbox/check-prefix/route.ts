/**
 * Magic Inbox Prefix Availability Check API
 *
 * POST /api/admin/magic-inbox/check-prefix - Check if a prefix is available
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MagicInboxConfigService } from '@glapi/api-service';
import { getServiceContext, requireAdmin } from '../../../utils/auth';
import { handleApiError } from '../../../utils/errors';

// Skip admin check in development for easier testing
const checkAdmin = async () => {
  if (process.env.NODE_ENV !== 'production') return;
  await requireAdmin();
};

const CheckPrefixSchema = z.object({
  prefix: z.string().min(3).max(50),
});

/**
 * POST /api/admin/magic-inbox/check-prefix
 * Check if an email prefix is available
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getServiceContext();
    await checkAdmin();

    const body = await request.json();
    const parsed = CheckPrefixSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Invalid prefix',
          errors: parsed.error.errors,
        },
        { status: 400 }
      );
    }

    const service = new MagicInboxConfigService({
      organizationId: context.organizationId,
      userId: context.userId,
    });

    const result = await service.checkPrefixAvailability(parsed.data.prefix);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
