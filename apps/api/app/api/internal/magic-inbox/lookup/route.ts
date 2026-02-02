/**
 * Magic Inbox Internal Lookup API
 *
 * POST /api/internal/magic-inbox/lookup - Look up webhook URL by email address
 *
 * This endpoint is called by the magic-inbox-processor Lambda to route
 * incoming emails to the correct organization's webhook.
 *
 * SECURITY: This endpoint should only be accessible from internal AWS services.
 * It uses a shared internal API key for authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { magicInboxConfigService } from '@glapi/api-service';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

const LookupSchema = z.object({
  email: z.string().email(),
});

/**
 * Verify internal API key
 */
async function verifyInternalAuth(): Promise<boolean> {
  if (!INTERNAL_API_KEY) {
    // In development, allow without key
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Internal] No INTERNAL_API_KEY configured, allowing request in development');
      return true;
    }
    return false;
  }

  const headersList = await headers();
  const authHeader = headersList.get('authorization');

  if (!authHeader) {
    return false;
  }

  // Support both "Bearer <key>" and just "<key>"
  const key = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  return key === INTERNAL_API_KEY;
}

/**
 * POST /api/internal/magic-inbox/lookup
 * Look up the webhook configuration for an email address
 *
 * Request body: { email: "acme@adteco.app" }
 * Response: { organizationId, webhookUrl, found: true } or { found: false }
 *
 * Note: We don't return the webhook secret hash directly. The Lambda should
 * use its own signing key and the webhook handler will verify against the
 * organization's stored hash.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify internal authentication
    const isAuthorized = await verifyInternalAuth();
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = LookupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          found: false,
          error: 'Invalid email format',
        },
        { status: 400 }
      );
    }

    const result = await magicInboxConfigService.lookupByEmail(parsed.data.email);

    if (!result) {
      return NextResponse.json({
        found: false,
        message: 'No Magic Inbox configuration found for this email address',
      });
    }

    // Return the routing information
    // Note: We include the webhookSecretHash so the Lambda can sign payloads
    // The Lambda should sign the payload with this hash before POSTing to the webhook
    return NextResponse.json({
      found: true,
      organizationId: result.organizationId,
      webhookUrl: result.webhookUrl,
      // The Lambda uses this to create an HMAC signature for the webhook payload
      webhookSecretHash: result.webhookSecretHash,
    });
  } catch (error) {
    console.error('[Internal] Magic Inbox lookup error:', error);

    return NextResponse.json(
      {
        found: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/internal/magic-inbox/lookup
 * Health check for the internal lookup endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'magic-inbox-lookup',
    timestamp: new Date().toISOString(),
  });
}
