/**
 * GLAPI Client
 *
 * Handles communication with GLAPI endpoints for Magic Inbox processing.
 */

import * as crypto from 'crypto';
import type { GlapiLookupResponse, GlapiWebhookPayload, ProcessorConfig } from './types';

/**
 * Look up organization by email address
 *
 * Calls the internal GLAPI endpoint to find which organization
 * owns the given Magic Inbox email address.
 */
export async function lookupOrganizationByEmail(
  email: string,
  config: ProcessorConfig
): Promise<GlapiLookupResponse | null> {
  const url = `${config.glapiBaseUrl}/api/internal/magic-inbox/lookup`;

  console.log(`Looking up organization for email: ${email}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.glapiInternalToken}`,
      },
      body: JSON.stringify({ email }),
    });

    if (response.status === 404) {
      console.log(`No organization found for email: ${email}`);
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GLAPI lookup failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as GlapiLookupResponse;
    console.log(`Found organization: ${data.organizationId}`);
    return data;
  } catch (error) {
    console.error('Error looking up organization:', error);
    throw error;
  }
}

/**
 * Generate HMAC signature for webhook payload
 */
function generateSignature(payload: string, secretHash: string): string {
  // The secretHash stored in DB is SHA256(secret)
  // We sign with the secret, but we don't have the original secret
  // So for now, we'll sign with the hash itself
  // In production, the Lambda should have access to decrypt/retrieve the actual secret
  // or use a different signing mechanism
  const hmac = crypto.createHmac('sha256', secretHash);
  hmac.update(payload);
  return hmac.digest('hex');
}

/**
 * Send processed email data to GLAPI webhook
 */
export async function sendToWebhook(
  payload: GlapiWebhookPayload,
  webhookUrl: string,
  webhookSecretHash: string,
  config: ProcessorConfig
): Promise<{ pendingDocumentId: string }> {
  // Construct full webhook URL
  const fullUrl = webhookUrl.startsWith('http')
    ? webhookUrl
    : `${config.glapiBaseUrl}${webhookUrl}`;

  console.log(`Sending to webhook: ${fullUrl}`);

  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString, webhookSecretHash);

  try {
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The webhook handler expects sha256=<signature> format
        'X-Magic-Inbox-Signature': `sha256=${signature}`,
        'X-Magic-Inbox-Timestamp': Date.now().toString(),
        // Include org ID and webhook secret for per-org verification
        'X-Organization-Id': payload.orgId,
        'X-Webhook-Secret': webhookSecretHash,
      },
      body: payloadString,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Webhook call failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as { documentId?: string; pendingDocumentId?: string };
    const documentId = result.documentId || result.pendingDocumentId || 'unknown';
    console.log(`Webhook success, document ID: ${documentId}`);
    return { pendingDocumentId: documentId };
  } catch (error) {
    console.error('Error sending to webhook:', error);
    throw error;
  }
}
