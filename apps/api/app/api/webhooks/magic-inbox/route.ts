/**
 * Magic Inbox Webhook Handler
 *
 * Receives analyzed documents from magic-inbox-processor and creates
 * pending documents for human review.
 *
 * Authentication: HMAC signature verification using shared secret
 *
 * Endpoint: POST /api/webhooks/magic-inbox
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { z } from 'zod';
import { magicInboxService } from '@glapi/api-service';
import type { MagicInboxWebhookPayload } from '@glapi/api-service';

// ============================================================================
// Configuration
// ============================================================================

const WEBHOOK_SECRET = process.env.MAGIC_INBOX_WEBHOOK_SECRET;

// ============================================================================
// Validation Schema
// ============================================================================

const webhookPayloadSchema = z.object({
  messageId: z.string(),
  orgId: z.string(),
  sender: z.string(),
  senderName: z.string().optional(),
  recipients: z.array(z.string()),
  subject: z.string(),
  documentType: z.enum([
    'invoice',
    'purchase_order',
    'receipt',
    'shipping',
    'support',
    'marketing',
    'contract',
    'report',
    'newsletter',
    'meeting',
    'credit_memo',
    'unknown',
  ]),
  confidence: z.number().min(0).max(1),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  summary: z.string().optional(),
  actionItems: z.array(z.string()).optional(),
  entities: z
    .object({
      dates: z.array(z.string()).optional(),
      amounts: z.array(z.string()).optional(),
      identifiers: z.array(z.string()).optional(),
      people: z.array(z.string()).optional(),
      companies: z.array(z.string()).optional(),
    })
    .optional(),
  extractedInvoice: z
    .object({
      vendorName: z.string().optional(),
      vendorEmail: z.string().optional(),
      vendorAddress: z.string().optional(),
      invoiceNumber: z.string().optional(),
      invoiceDate: z.string().optional(),
      dueDate: z.string().optional(),
      poNumber: z.string().optional(),
      subtotal: z.number().optional(),
      taxAmount: z.number().optional(),
      totalAmount: z.number().optional(),
      currency: z.string().optional(),
      lineItems: z
        .array(
          z.object({
            description: z.string().optional(),
            quantity: z.number().optional(),
            unitPrice: z.number().optional(),
            amount: z.number().optional(),
          })
        )
        .optional(),
      paymentTerms: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  s3Bucket: z.string(),
  s3Key: z.string(),
  metadata: z
    .object({
      headers: z.record(z.unknown()).optional(),
      securityInfo: z
        .object({
          spamVerdict: z.string().optional(),
          virusVerdict: z.string().optional(),
          spfVerdict: z.string().optional(),
          dkimVerdict: z.string().optional(),
          dmarcVerdict: z.string().optional(),
        })
        .optional(),
      attachments: z
        .array(
          z.object({
            filename: z.string(),
            contentType: z.string(),
            size: z.number(),
            s3Key: z.string().optional(),
          })
        )
        .optional(),
      processingInfo: z
        .object({
          attemptCount: z.number(),
          lastProcessed: z.string(),
          duration: z.number().optional(),
          errors: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .optional(),
  receivedAt: z.string().optional(),
});

// ============================================================================
// HMAC Signature Verification
// ============================================================================

/**
 * Verify the HMAC signature of the webhook payload
 */
function verifySignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    return false;
  }

  // Expected format: "sha256=<hex-digest>"
  const parts = signature.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const expectedSignature = parts[1];
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(computedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

// ============================================================================
// Webhook Handler
// ============================================================================

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  console.log(`[MagicInbox Webhook] ${requestId} - Received request`);

  try {
    // Get the raw body for signature verification
    const body = await req.text();

    // Verify webhook secret is configured
    if (!WEBHOOK_SECRET) {
      console.error(
        `[MagicInbox Webhook] ${requestId} - MAGIC_INBOX_WEBHOOK_SECRET not configured`
      );
      // In development, allow requests without signature
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Webhook secret not configured' },
          { status: 500 }
        );
      }
      console.warn(
        `[MagicInbox Webhook] ${requestId} - Skipping signature verification in development`
      );
    } else {
      // Verify signature
      const headersList = await headers();
      const signature = headersList.get('x-magic-inbox-signature');

      if (!verifySignature(body, signature, WEBHOOK_SECRET)) {
        console.error(
          `[MagicInbox Webhook] ${requestId} - Invalid signature`
        );
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        );
      }
    }

    // Parse and validate payload
    let payload: MagicInboxWebhookPayload;
    try {
      const rawPayload = JSON.parse(body);
      const validationResult = webhookPayloadSchema.safeParse(rawPayload);

      if (!validationResult.success) {
        console.error(
          `[MagicInbox Webhook] ${requestId} - Validation error:`,
          validationResult.error.errors
        );
        return NextResponse.json(
          {
            error: 'Invalid payload',
            details: validationResult.error.errors,
          },
          { status: 400 }
        );
      }

      payload = validationResult.data as MagicInboxWebhookPayload;
    } catch (parseError) {
      console.error(
        `[MagicInbox Webhook] ${requestId} - JSON parse error:`,
        parseError
      );
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    console.log(
      `[MagicInbox Webhook] ${requestId} - Processing document:`,
      {
        messageId: payload.messageId,
        orgId: payload.orgId,
        documentType: payload.documentType,
        subject: payload.subject?.substring(0, 50),
      }
    );

    // Process the webhook
    const result = await magicInboxService.processMagicInboxWebhook(payload);

    if (!result.received) {
      console.error(
        `[MagicInbox Webhook] ${requestId} - Processing failed:`,
        result.error
      );
      return NextResponse.json(
        { error: result.error },
        { status: 422 }
      );
    }

    console.log(
      `[MagicInbox Webhook] ${requestId} - Success:`,
      {
        documentId: result.documentId,
        duplicate: result.duplicate,
      }
    );

    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    console.error(`[MagicInbox Webhook] ${requestId} - Error:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Health Check
// ============================================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'Magic Inbox Webhook',
    description: 'Receives analyzed documents from magic-inbox-processor',
    authenticated: !!WEBHOOK_SECRET,
  });
}
