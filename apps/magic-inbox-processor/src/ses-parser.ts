/**
 * SES Email Parser
 *
 * Parses SES notifications and extracts email content.
 * Handles both inline content and S3-stored emails.
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { simpleParser, type ParsedMail } from 'mailparser';
import type { SESNotification, EmailAttachment, GlapiWebhookPayload, DocumentType } from './types';

const s3Client = new S3Client({});

export interface ParsedEmailData {
  messageId: string;
  sender: string;
  senderName?: string;
  recipients: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  receivedAt: string;
  s3Bucket: string;
  s3Key: string;
  attachments: EmailAttachment[];
  securityInfo: {
    spamVerdict?: string;
    virusVerdict?: string;
    spfVerdict?: string;
    dkimVerdict?: string;
    dmarcVerdict?: string;
  };
}

/**
 * Parse an SES notification and extract email data
 */
export async function parseSesNotification(
  notification: SESNotification,
  storageBucket?: string
): Promise<ParsedEmailData> {
  const { mail, receipt } = notification;

  // Determine S3 location
  const s3Action = receipt.action.type === 'S3' ? receipt.action : null;
  let s3Bucket = s3Action?.bucketName || storageBucket || 'magic-inbox-emails';
  let s3Key = s3Action?.objectKey || `emails/${mail.messageId}`;

  let parsedEmail: ParsedMail | null = null;
  let rawEmailContent: string | undefined;

  // If content is inline (small emails), use it directly
  if (notification.content) {
    rawEmailContent = notification.content;
    parsedEmail = await simpleParser(notification.content);
  }
  // If stored in S3, fetch and parse
  else if (s3Action?.bucketName && s3Action?.objectKey) {
    try {
      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: s3Action.bucketName,
          Key: s3Action.objectKey,
        })
      );

      if (response.Body) {
        rawEmailContent = await response.Body.transformToString();
        parsedEmail = await simpleParser(rawEmailContent);
      }
    } catch (error) {
      console.error('Failed to fetch email from S3:', error);
      // Continue with header info only
    }
  }

  // If we have inline content but no S3 storage yet, store it
  if (rawEmailContent && !s3Action && storageBucket) {
    try {
      s3Bucket = storageBucket;
      s3Key = `emails/${new Date().toISOString().split('T')[0]}/${mail.messageId}`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: s3Key,
          Body: rawEmailContent,
          ContentType: 'message/rfc822',
        })
      );
      console.log(`Stored email in S3: ${s3Bucket}/${s3Key}`);
    } catch (error) {
      console.error('Failed to store email in S3:', error);
    }
  }

  // Extract attachment metadata
  const attachments: EmailAttachment[] = [];
  if (parsedEmail?.attachments) {
    for (const att of parsedEmail.attachments) {
      attachments.push({
        filename: att.filename || 'unnamed',
        contentType: att.contentType,
        size: att.size,
      });
    }
  }

  // Parse sender info
  const senderAddress = mail.commonHeaders.from?.[0] || mail.source;
  const senderMatch = senderAddress.match(/^(.+?)\s*<(.+)>$/);
  const sender = senderMatch ? senderMatch[2] : senderAddress;
  const senderName = senderMatch ? senderMatch[1].replace(/["']/g, '').trim() : undefined;

  return {
    messageId: mail.messageId,
    sender,
    senderName,
    recipients: receipt.recipients,
    subject: mail.commonHeaders.subject || '(no subject)',
    bodyText: parsedEmail?.text || undefined,
    bodyHtml: typeof parsedEmail?.html === 'string' ? parsedEmail.html : undefined,
    receivedAt: mail.timestamp,
    s3Bucket,
    s3Key,
    attachments,
    securityInfo: {
      spamVerdict: receipt.spamVerdict.status,
      virusVerdict: receipt.virusVerdict.status,
      spfVerdict: receipt.spfVerdict.status,
      dkimVerdict: receipt.dkimVerdict.status,
      dmarcVerdict: receipt.dmarcVerdict.status,
    },
  };
}

/**
 * Build the webhook payload from parsed email data
 */
export function buildWebhookPayload(
  emailData: ParsedEmailData,
  orgId: string,
  documentType: DocumentType = 'unknown',
  confidence: number = 0.5
): GlapiWebhookPayload {
  return {
    messageId: emailData.messageId,
    orgId,
    sender: emailData.sender,
    senderName: emailData.senderName,
    recipients: emailData.recipients,
    subject: emailData.subject,
    documentType,
    confidence,
    s3Bucket: emailData.s3Bucket,
    s3Key: emailData.s3Key,
    receivedAt: emailData.receivedAt,
    metadata: {
      securityInfo: emailData.securityInfo,
      attachments: emailData.attachments,
      processingInfo: {
        attemptCount: 1,
        lastProcessed: new Date().toISOString(),
      },
    },
  };
}

/**
 * Extract the recipient email address from SES notification
 * This is used to look up which organization should receive this email
 */
export function getRecipientEmail(notification: SESNotification): string {
  // SES provides recipients in the receipt object
  const recipients = notification.receipt.recipients;

  if (recipients.length === 0) {
    throw new Error('No recipients found in SES notification');
  }

  // Return the first recipient (typically there's only one for Magic Inbox)
  return recipients[0].toLowerCase();
}

/**
 * Extract sender information
 */
export function getSenderEmail(notification: SESNotification): string {
  return notification.mail.source.toLowerCase();
}

/**
 * Check if the email passed spam/virus checks
 */
export function isEmailSafe(notification: SESNotification): boolean {
  const { receipt } = notification;

  // Reject if spam or virus detected
  if (receipt.spamVerdict.status === 'FAIL') {
    console.warn('Email failed spam check');
    return false;
  }

  if (receipt.virusVerdict.status === 'FAIL') {
    console.warn('Email failed virus check');
    return false;
  }

  return true;
}
