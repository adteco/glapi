/**
 * AWS SES Email Provider
 *
 * Implements the EmailProvider interface from delivery-connectors-service.ts
 * for sending emails via AWS Simple Email Service (SES) v2.
 */

import { SESv2Client, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-sesv2';
import type { EmailProvider, EmailDeliveryOptions } from './delivery-connectors-service';

// ============================================================================
// Configuration Types
// ============================================================================

export interface SESEmailProviderConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  configurationSetName?: string;
  defaultFromEmail?: string;
  defaultFromName?: string;
  defaultReplyTo?: string;
  feedbackForwardingEnabled?: boolean;
}

// ============================================================================
// SES Email Provider Implementation
// ============================================================================

export class SESEmailProvider implements EmailProvider {
  private client: SESv2Client;
  private config: SESEmailProviderConfig;

  constructor(config: SESEmailProviderConfig) {
    this.config = config;

    const clientConfig: ConstructorParameters<typeof SESv2Client>[0] = {
      region: config.region,
    };

    // Only add credentials if explicitly provided (otherwise use default credential chain)
    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    }

    this.client = new SESv2Client(clientConfig);
  }

  /**
   * Send an email via AWS SES
   */
  async sendEmail(options: EmailDeliveryOptions): Promise<{
    messageId: string;
    acceptedRecipients: string[];
    rejectedRecipients?: string[];
  }> {
    const { recipients, subject, bodyText, bodyHtml, attachments } = options;

    // Build the email content
    const content: SendEmailCommandInput['Content'] = {
      Simple: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {},
      },
    };

    // Add HTML body if provided
    if (bodyHtml) {
      content.Simple!.Body!.Html = {
        Data: bodyHtml,
        Charset: 'UTF-8',
      };
    }

    // Add text body if provided
    if (bodyText) {
      content.Simple!.Body!.Text = {
        Data: bodyText,
        Charset: 'UTF-8',
      };
    }

    // If we have attachments, we need to use Raw email instead
    if (attachments && attachments.length > 0) {
      const rawEmail = await this.buildRawEmailWithAttachments(
        recipients,
        subject,
        bodyText,
        bodyHtml,
        attachments
      );

      content.Raw = {
        Data: Buffer.from(rawEmail),
      };
      delete content.Simple;
    }

    const command = new SendEmailCommand({
      FromEmailAddress: this.formatFromAddress(
        this.config.defaultFromEmail ?? 'noreply@example.com',
        this.config.defaultFromName
      ),
      Destination: {
        ToAddresses: recipients,
      },
      Content: content,
      ConfigurationSetName: this.config.configurationSetName,
      ReplyToAddresses: this.config.defaultReplyTo
        ? [this.config.defaultReplyTo]
        : undefined,
      FeedbackForwardingEmailAddress: this.config.feedbackForwardingEnabled
        ? this.config.defaultFromEmail
        : undefined,
    });

    try {
      const response = await this.client.send(command);

      return {
        messageId: response.MessageId ?? `ses-${Date.now()}`,
        acceptedRecipients: recipients,
        rejectedRecipients: [],
      };
    } catch (error) {
      // Re-throw with additional context
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`SES send failed: ${message}`);
    }
  }

  /**
   * Format the From address with optional display name
   */
  private formatFromAddress(email: string, name?: string): string {
    if (name) {
      return `${name} <${email}>`;
    }
    return email;
  }

  /**
   * Build a raw MIME email with attachments
   */
  private async buildRawEmailWithAttachments(
    recipients: string[],
    subject: string,
    bodyText?: string,
    bodyHtml?: string,
    attachments?: Array<{
      filename: string;
      content: Buffer | string;
      contentType: string;
    }>
  ): Promise<string> {
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fromAddress = this.formatFromAddress(
      this.config.defaultFromEmail ?? 'noreply@example.com',
      this.config.defaultFromName
    );

    let email = '';

    // Headers
    email += `From: ${fromAddress}\r\n`;
    email += `To: ${recipients.join(', ')}\r\n`;
    email += `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\n`;
    email += `MIME-Version: 1.0\r\n`;
    email += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n`;
    email += '\r\n';

    // Text part
    if (bodyText) {
      email += `--${boundary}\r\n`;
      email += `Content-Type: text/plain; charset=UTF-8\r\n`;
      email += `Content-Transfer-Encoding: quoted-printable\r\n`;
      email += '\r\n';
      email += this.encodeQuotedPrintable(bodyText);
      email += '\r\n';
    }

    // HTML part
    if (bodyHtml) {
      email += `--${boundary}\r\n`;
      email += `Content-Type: text/html; charset=UTF-8\r\n`;
      email += `Content-Transfer-Encoding: quoted-printable\r\n`;
      email += '\r\n';
      email += this.encodeQuotedPrintable(bodyHtml);
      email += '\r\n';
    }

    // Attachments
    if (attachments) {
      for (const attachment of attachments) {
        const content =
          typeof attachment.content === 'string'
            ? Buffer.from(attachment.content)
            : attachment.content;

        email += `--${boundary}\r\n`;
        email += `Content-Type: ${attachment.contentType}; name="${attachment.filename}"\r\n`;
        email += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
        email += `Content-Transfer-Encoding: base64\r\n`;
        email += '\r\n';
        email += content.toString('base64').replace(/(.{76})/g, '$1\r\n');
        email += '\r\n';
      }
    }

    // End boundary
    email += `--${boundary}--\r\n`;

    return email;
  }

  /**
   * Encode text as quoted-printable
   */
  private encodeQuotedPrintable(text: string): string {
    return text
      .replace(/[^\x20-\x7E\r\n]/g, (char) => {
        const code = char.charCodeAt(0);
        if (code < 256) {
          return '=' + code.toString(16).toUpperCase().padStart(2, '0');
        }
        // For multi-byte characters, encode as UTF-8
        const bytes = Buffer.from(char, 'utf8');
        return Array.from(bytes)
          .map((b) => '=' + b.toString(16).toUpperCase().padStart(2, '0'))
          .join('');
      })
      .replace(/=\r\n/g, '=\r\n')
      .replace(/(.{73}[^=])/g, '$1=\r\n');
  }
}

// ============================================================================
// Extended SES Provider with Communication System Features
// ============================================================================

export interface ExtendedEmailDeliveryOptions extends EmailDeliveryOptions {
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  tags?: Record<string, string>;
  configurationSet?: string;
}

export class SESCommunicationProvider extends SESEmailProvider {
  private extendedConfig: SESEmailProviderConfig;

  constructor(config: SESEmailProviderConfig) {
    super(config);
    this.extendedConfig = config;
  }

  /**
   * Send an email with extended options for the communication system
   */
  async sendCommunicationEmail(options: ExtendedEmailDeliveryOptions): Promise<{
    messageId: string;
    acceptedRecipients: string[];
    rejectedRecipients?: string[];
  }> {
    // For now, use the base sendEmail
    // TODO: Add support for cc, bcc, tags, and custom configuration sets
    return this.sendEmail(options);
  }

  /**
   * Verify an email address can receive emails
   */
  async verifyEmailAddress(email: string): Promise<boolean> {
    // In production, this would check against SES suppression list
    // For now, just validate the format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if an email is on the suppression list
   */
  async isEmailSuppressed(email: string): Promise<boolean> {
    // In production, this would query the SES account-level suppression list
    // For now, return false
    return false;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an SES email provider from environment variables
 */
export function createSESEmailProvider(): SESCommunicationProvider {
  const config: SESEmailProviderConfig = {
    region: process.env.AWS_SES_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    configurationSetName: process.env.AWS_SES_CONFIGURATION_SET,
    defaultFromEmail: process.env.DEFAULT_FROM_EMAIL ?? 'noreply@example.com',
    defaultFromName: process.env.DEFAULT_FROM_NAME ?? 'GLAPI',
    defaultReplyTo: process.env.DEFAULT_REPLY_TO,
    feedbackForwardingEnabled:
      process.env.AWS_SES_FEEDBACK_FORWARDING === 'true',
  };

  return new SESCommunicationProvider(config);
}

// ============================================================================
// Type Exports
// ============================================================================

export type { EmailProvider, EmailDeliveryOptions };
