/**
 * Magic Inbox Custom Domain Setup API
 *
 * POST /api/admin/magic-inbox/custom-domain - Initiate custom domain setup
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

const CustomDomainSchema = z.object({
  domain: z.string().min(4).regex(/^[a-z0-9][a-z0-9-]*\.[a-z]{2,}$/i, {
    message: 'Invalid domain format',
  }),
});

/**
 * POST /api/admin/magic-inbox/custom-domain
 * Initiate custom domain setup and get DNS records
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getServiceContext();
    await checkAdmin();

    const body = await request.json();
    const parsed = CustomDomainSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Invalid domain',
          errors: parsed.error.errors,
        },
        { status: 400 }
      );
    }

    const service = new MagicInboxConfigService({
      organizationId: context.organizationId,
      userId: context.userId,
    });

    const result = await service.initiateCustomDomain(parsed.data.domain);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
