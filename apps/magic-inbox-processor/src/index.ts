/**
 * Magic Inbox Processor Lambda
 *
 * Processes incoming emails from SES via SNS and creates pending documents in GLAPI.
 *
 * Flow:
 * 1. Receive SNS notification containing SES email notification
 * 2. Parse SES notification to extract email data
 * 3. Look up organization by recipient email address
 * 4. Classify document type (optional AI processing)
 * 5. Send to GLAPI webhook to create pending document
 */

import type { SNSEvent, Context } from 'aws-lambda';
import type { SESNotification, ProcessorConfig, ProcessingResult, DocumentType } from './types';
import { parseSesNotification, buildWebhookPayload, getRecipientEmail, isEmailSafe } from './ses-parser';
import { lookupOrganizationByEmail, sendToWebhook } from './glapi-client';
import { createInvoiceExtractionProvider } from './ai-extraction';

// Load configuration from environment
function getConfig(): ProcessorConfig {
  const glapiBaseUrl = process.env.GLAPI_BASE_URL;
  const glapiInternalToken = process.env.GLAPI_INTERNAL_TOKEN;

  if (!glapiBaseUrl) {
    throw new Error('GLAPI_BASE_URL environment variable is required');
  }

  if (!glapiInternalToken) {
    throw new Error('GLAPI_INTERNAL_TOKEN environment variable is required');
  }

  return {
    glapiBaseUrl,
    glapiInternalToken,
    emailStorageBucket: process.env.EMAIL_STORAGE_BUCKET,
    enableAiExtraction: process.env.ENABLE_AI_EXTRACTION === 'true',
    aiExtractionProvider: process.env.AI_EXTRACTION_PROVIDER === 'bedrock' ? 'bedrock' : 'heuristic',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    bedrockModelId: process.env.BEDROCK_MODEL_ID,
  };
}

/**
 * Simple document type classification based on subject keywords
 * TODO: Replace with AI-powered classification
 */
function classifyDocumentType(subject: string): { documentType: DocumentType; confidence: number } {
  const subjectLower = subject.toLowerCase();

  if (subjectLower.includes('invoice') || subjectLower.includes('bill')) {
    return { documentType: 'invoice', confidence: 0.8 };
  }
  if (subjectLower.includes('purchase order') || subjectLower.includes('po #')) {
    return { documentType: 'purchase_order', confidence: 0.8 };
  }
  if (subjectLower.includes('receipt')) {
    return { documentType: 'receipt', confidence: 0.8 };
  }
  if (subjectLower.includes('shipping') || subjectLower.includes('tracking') || subjectLower.includes('delivery')) {
    return { documentType: 'shipping', confidence: 0.7 };
  }
  if (subjectLower.includes('credit memo') || subjectLower.includes('credit note')) {
    return { documentType: 'credit_memo', confidence: 0.8 };
  }
  if (subjectLower.includes('contract') || subjectLower.includes('agreement')) {
    return { documentType: 'contract', confidence: 0.7 };
  }
  if (subjectLower.includes('report')) {
    return { documentType: 'report', confidence: 0.6 };
  }
  if (subjectLower.includes('newsletter') || subjectLower.includes('unsubscribe')) {
    return { documentType: 'newsletter', confidence: 0.7 };
  }
  if (subjectLower.includes('meeting') || subjectLower.includes('calendar')) {
    return { documentType: 'meeting', confidence: 0.7 };
  }

  return { documentType: 'unknown', confidence: 0.5 };
}

/**
 * Process a single SES notification
 */
async function processSesNotification(
  notification: SESNotification,
  config: ProcessorConfig
): Promise<ProcessingResult> {
  const messageId = notification.mail.messageId;

  try {
    console.log(`Processing email: ${messageId}`);

    // Check spam/virus status
    if (!isEmailSafe(notification)) {
      return {
        success: false,
        messageId,
        error: 'Email failed safety checks (spam or virus detected)',
      };
    }

    // Get recipient email to look up organization
    const recipientEmail = getRecipientEmail(notification);
    console.log(`Recipient email: ${recipientEmail}`);

    // Look up organization
    const orgLookup = await lookupOrganizationByEmail(recipientEmail, config);

    if (!orgLookup) {
      return {
        success: false,
        messageId,
        error: `No organization found for email: ${recipientEmail}`,
      };
    }

    // Parse email content
    const emailData = await parseSesNotification(notification, config.emailStorageBucket);

    let classification = classifyDocumentType(emailData.subject);
    const extractionProvider = createInvoiceExtractionProvider(config);
    const extraction = await extractionProvider.extract({
      subject: emailData.subject,
      bodyText: emailData.bodyText,
      sender: emailData.sender,
      senderName: emailData.senderName,
      attachments: emailData.attachments,
    });

    if (extraction) {
      classification = {
        documentType: extraction.documentType,
        confidence: Math.max(classification.confidence, extraction.confidence),
      };
    }

    // Build webhook payload
    const payload = buildWebhookPayload(
      emailData,
      orgLookup.organizationId,
      classification.documentType,
      classification.confidence,
      extraction
    );

    // Send to GLAPI webhook
    const result = await sendToWebhook(
      payload,
      orgLookup.webhookUrl,
      orgLookup.webhookSecretHash,
      config
    );

    return {
      success: true,
      messageId,
      organizationId: orgLookup.organizationId,
      pendingDocumentId: result.pendingDocumentId,
    };
  } catch (error) {
    console.error(`Error processing email ${messageId}:`, error);
    return {
      success: false,
      messageId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Lambda handler for SNS events from SES
 */
export async function handler(
  event: SNSEvent,
  context: Context
): Promise<{ processed: number; succeeded: number; failed: number; results: ProcessingResult[] }> {
  console.log('Received SNS event:', JSON.stringify(event, null, 2));

  const config = getConfig();
  const results: ProcessingResult[] = [];

  for (const record of event.Records) {
    try {
      // Parse the SNS message which contains the SES notification
      const sesNotification = JSON.parse(record.Sns.Message) as SESNotification;

      // Verify this is a received email notification
      if (sesNotification.notificationType !== 'Received') {
        console.log(`Skipping non-receive notification: ${sesNotification.notificationType}`);
        continue;
      }

      const result = await processSesNotification(sesNotification, config);
      results.push(result);
    } catch (error) {
      console.error('Error processing SNS record:', error);
      results.push({
        success: false,
        messageId: 'unknown',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const summary = {
    processed: results.length,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };

  console.log('Processing complete:', summary);
  return summary;
}

// For local testing
export { processSesNotification, getConfig };
