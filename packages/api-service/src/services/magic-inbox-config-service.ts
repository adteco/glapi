/**
 * Magic Inbox Configuration Service
 *
 * Manages organization-level Magic Inbox configuration including:
 * - Enable/disable Magic Inbox
 * - Email prefix registration
 * - Custom domain setup with DNS verification
 * - Webhook secret management
 * - Test email functionality
 */

import * as crypto from 'crypto';
import {
  withOrganizationContext,
  withoutRLS,
  magicInboxEmailRegistry,
  magicInboxTestEmails,
  organizations,
  eq,
  and,
} from '@glapi/database';
import type {
  MagicInboxEmailRegistryRecord,
  NewMagicInboxEmailRegistryRecord,
  MagicInboxTestEmailRecord,
  DNSRecord,
  MagicInboxSettings,
  MagicInboxTestResult,
} from '@glapi/database';
import { BaseService } from './base-service';
import { ServiceError } from '../types';

// ============================================================================
// Constants
// ============================================================================

const MAGIC_INBOX_DOMAIN = 'adteco.app';
const WEBHOOK_SECRET_LENGTH = 32;
const PREFIX_MIN_LENGTH = 3;
const PREFIX_MAX_LENGTH = 50;
const PREFIX_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const RESERVED_PREFIXES = [
  'admin', 'api', 'app', 'billing', 'docs', 'help',
  'info', 'mail', 'noreply', 'postmaster', 'sales',
  'support', 'test', 'www',
];

// ============================================================================
// Types
// ============================================================================

export interface EnableMagicInboxInput {
  emailType: 'prefix' | 'custom_domain';
  prefix?: string;
  customDomain?: string;
}

export interface MagicInboxConfig {
  enabled: boolean;
  emailAddress: string;
  emailType: 'prefix' | 'custom_domain';
  prefix?: string;
  customDomain?: string;
  verificationStatus?: 'pending' | 'verified' | 'failed';
  dnsRecords?: DNSRecord[];
  webhookUrl: string;
  webhookSecret?: string; // Only returned on first setup or regeneration
  createdAt: string;
  updatedAt: string;
}

export interface PrefixAvailabilityResult {
  available: boolean;
  reason?: string;
  suggestions?: string[];
}

export interface CustomDomainSetupResult {
  dnsRecords: DNSRecord[];
  verificationToken: string;
}

export interface DomainVerificationResult {
  verified: boolean;
  failedRecords?: DNSRecord[];
  error?: string;
}

// ============================================================================
// Service Class
// ============================================================================

export class MagicInboxConfigService extends BaseService {
  /**
   * Get the current Magic Inbox configuration for the organization
   */
  async getConfig(): Promise<MagicInboxConfig | null> {
    const organizationId = this.requireOrganizationContext();

    return withOrganizationContext({ organizationId }, async (contextDb) => {
      const registry = await contextDb.query.magicInboxEmailRegistry.findFirst({
        where: and(
          eq(magicInboxEmailRegistry.organizationId, organizationId),
          eq(magicInboxEmailRegistry.isActive, true)
        ),
      });

      if (!registry) {
        return null;
      }

      return this.registryToConfig(registry);
    });
  }

  /**
   * Enable Magic Inbox for the organization
   */
  async enableMagicInbox(input: EnableMagicInboxInput): Promise<MagicInboxConfig> {
    const organizationId = this.requireOrganizationContext();

    // Generate webhook secret outside context (doesn't need DB)
    const webhookSecret = this.generateWebhookSecret();
    const webhookSecretHash = this.hashSecret(webhookSecret);

    return withOrganizationContext({ organizationId }, async (contextDb) => {
      // Check if already enabled
      const existing = await contextDb.query.magicInboxEmailRegistry.findFirst({
        where: and(
          eq(magicInboxEmailRegistry.organizationId, organizationId),
          eq(magicInboxEmailRegistry.isActive, true)
        ),
      });

      if (existing) {
        throw new ServiceError(
          'Magic Inbox is already enabled for this organization',
          'MAGIC_INBOX_ALREADY_ENABLED',
          409
        );
      }

      let emailAddress: string;
      let prefix: string | undefined;
      let customDomain: string | undefined;
      let verificationStatus: 'pending' | 'verified' | undefined;
      let dnsRecords: DNSRecord[] | undefined;
      let verificationToken: string | undefined;

      if (input.emailType === 'prefix') {
        if (!input.prefix) {
          throw new ServiceError(
            'Prefix is required for prefix-based email',
            'PREFIX_REQUIRED',
            400
          );
        }

        // Validate and claim prefix (uses its own context)
        const availability = await this.checkPrefixAvailabilityInternal(contextDb, input.prefix);
        if (!availability.available) {
          throw new ServiceError(
            availability.reason || 'Prefix is not available',
            'PREFIX_NOT_AVAILABLE',
            409
          );
        }

        prefix = input.prefix.toLowerCase();
        emailAddress = `${prefix}@${MAGIC_INBOX_DOMAIN}`;
        verificationStatus = 'verified'; // Prefix-based doesn't need verification
      } else {
        if (!input.customDomain) {
          throw new ServiceError(
            'Custom domain is required for custom domain email',
            'CUSTOM_DOMAIN_REQUIRED',
            400
          );
        }

        customDomain = input.customDomain.toLowerCase();
        emailAddress = `inbox@${customDomain}`;
        verificationStatus = 'pending';
        verificationToken = this.generateVerificationToken();
        dnsRecords = this.generateDnsRecords(customDomain, verificationToken);
      }

      // Build webhook URL (relative to API base)
      const webhookUrl = `/api/webhooks/magic-inbox`;

      // Create registry record
      const newRegistry: NewMagicInboxEmailRegistryRecord = {
        organizationId,
        emailAddress,
        emailType: input.emailType,
        prefix,
        customDomain,
        isActive: true,
        verificationStatus,
        verificationToken,
        dnsRecords,
        webhookUrl,
        webhookSecretHash,
      };

      const [registry] = await contextDb
        .insert(magicInboxEmailRegistry)
        .values(newRegistry)
        .returning();

      // Return config with the plain webhook secret (only time it's exposed)
      return {
        ...this.registryToConfig(registry),
        webhookSecret,
      };
    });
  }

  /**
   * Disable Magic Inbox for the organization
   */
  async disableMagicInbox(): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    return withOrganizationContext({ organizationId }, async (contextDb) => {
      const registry = await contextDb.query.magicInboxEmailRegistry.findFirst({
        where: and(
          eq(magicInboxEmailRegistry.organizationId, organizationId),
          eq(magicInboxEmailRegistry.isActive, true)
        ),
      });

      if (!registry) {
        throw new ServiceError(
          'Magic Inbox is not enabled for this organization',
          'MAGIC_INBOX_NOT_ENABLED',
          404
        );
      }

      await contextDb
        .update(magicInboxEmailRegistry)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(magicInboxEmailRegistry.id, registry.id));
    });
  }

  /**
   * Internal prefix availability check using provided db context
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async checkPrefixAvailabilityInternal(contextDb: any, prefix: string): Promise<PrefixAvailabilityResult> {
    const normalized = prefix.toLowerCase().trim();

    // Validate format
    if (normalized.length < PREFIX_MIN_LENGTH) {
      return {
        available: false,
        reason: `Prefix must be at least ${PREFIX_MIN_LENGTH} characters`,
      };
    }

    if (normalized.length > PREFIX_MAX_LENGTH) {
      return {
        available: false,
        reason: `Prefix must be at most ${PREFIX_MAX_LENGTH} characters`,
      };
    }

    if (!PREFIX_PATTERN.test(normalized)) {
      return {
        available: false,
        reason: 'Prefix must start and end with a letter or number, and contain only letters, numbers, and hyphens',
      };
    }

    // Check reserved prefixes
    if (RESERVED_PREFIXES.includes(normalized)) {
      return {
        available: false,
        reason: 'This prefix is reserved',
        suggestions: this.generatePrefixSuggestions(normalized),
      };
    }

    // Check if already taken
    const existing = await contextDb.query.magicInboxEmailRegistry.findFirst({
      where: and(
        eq(magicInboxEmailRegistry.prefix, normalized),
        eq(magicInboxEmailRegistry.isActive, true)
      ),
    });

    if (existing) {
      return {
        available: false,
        reason: 'This prefix is already in use',
        suggestions: this.generatePrefixSuggestions(normalized),
      };
    }

    return { available: true };
  }

  /**
   * Check if an email prefix is available
   */
  async checkPrefixAvailability(prefix: string): Promise<PrefixAvailabilityResult> {
    const organizationId = this.requireOrganizationContext();

    return withOrganizationContext({ organizationId }, async (contextDb) => {
      return this.checkPrefixAvailabilityInternal(contextDb, prefix);
    });
  }

  /**
   * Initiate custom domain setup
   */
  async initiateCustomDomain(domain: string): Promise<CustomDomainSetupResult> {
    const organizationId = this.requireOrganizationContext();

    // Validate domain format
    const domainPattern = /^[a-z0-9][a-z0-9-]*\.[a-z]{2,}$/i;
    if (!domainPattern.test(domain)) {
      throw new ServiceError(
        'Invalid domain format',
        'INVALID_DOMAIN_FORMAT',
        400
      );
    }

    return withOrganizationContext({ organizationId }, async (contextDb) => {
      // Check if domain is already in use
      const existing = await contextDb.query.magicInboxEmailRegistry.findFirst({
        where: and(
          eq(magicInboxEmailRegistry.customDomain, domain.toLowerCase()),
          eq(magicInboxEmailRegistry.isActive, true)
        ),
      });

      if (existing && existing.organizationId !== organizationId) {
        throw new ServiceError(
          'This domain is already in use by another organization',
          'DOMAIN_ALREADY_IN_USE',
          409
        );
      }

      const verificationToken = this.generateVerificationToken();
      const dnsRecords = this.generateDnsRecords(domain.toLowerCase(), verificationToken);

      return {
        dnsRecords,
        verificationToken,
      };
    });
  }

  /**
   * Verify custom domain DNS records
   */
  async verifyCustomDomain(): Promise<DomainVerificationResult> {
    const organizationId = this.requireOrganizationContext();

    return withOrganizationContext({ organizationId }, async (contextDb) => {
      const registry = await contextDb.query.magicInboxEmailRegistry.findFirst({
        where: and(
          eq(magicInboxEmailRegistry.organizationId, organizationId),
          eq(magicInboxEmailRegistry.isActive, true),
          eq(magicInboxEmailRegistry.emailType, 'custom_domain')
        ),
      });

      if (!registry) {
        throw new ServiceError(
          'No custom domain configuration found',
          'NO_CUSTOM_DOMAIN_CONFIG',
          404
        );
      }

      if (registry.verificationStatus === 'verified') {
        return { verified: true };
      }

      // In production, this would make actual DNS queries
      // For now, we'll simulate DNS verification
      const dnsRecords = registry.dnsRecords as DNSRecord[] | null;
      if (!dnsRecords || dnsRecords.length === 0) {
        throw new ServiceError(
          'No DNS records to verify',
          'NO_DNS_RECORDS',
          400
        );
      }

      // TODO: Implement actual DNS verification using DNS lookup
      // For now, return pending status
      return {
        verified: false,
        error: 'DNS verification pending - please ensure records are configured correctly',
      };
    });
  }

  /**
   * Regenerate webhook secret
   */
  async regenerateWebhookSecret(): Promise<string> {
    const organizationId = this.requireOrganizationContext();

    const newSecret = this.generateWebhookSecret();
    const newSecretHash = this.hashSecret(newSecret);

    return withOrganizationContext({ organizationId }, async (contextDb) => {
      const registry = await contextDb.query.magicInboxEmailRegistry.findFirst({
        where: and(
          eq(magicInboxEmailRegistry.organizationId, organizationId),
          eq(magicInboxEmailRegistry.isActive, true)
        ),
      });

      if (!registry) {
        throw new ServiceError(
          'Magic Inbox is not enabled for this organization',
          'MAGIC_INBOX_NOT_ENABLED',
          404
        );
      }

      await contextDb
        .update(magicInboxEmailRegistry)
        .set({
          webhookSecretHash: newSecretHash,
          updatedAt: new Date(),
        })
        .where(eq(magicInboxEmailRegistry.id, registry.id));

      return newSecret;
    });
  }

  /**
   * Send a test email
   */
  async sendTestEmail(): Promise<{ testId: string }> {
    const organizationId = this.requireOrganizationContext();

    return withOrganizationContext({ organizationId }, async (contextDb) => {
      const registry = await contextDb.query.magicInboxEmailRegistry.findFirst({
        where: and(
          eq(magicInboxEmailRegistry.organizationId, organizationId),
          eq(magicInboxEmailRegistry.isActive, true)
        ),
      });

      if (!registry) {
        throw new ServiceError(
          'Magic Inbox is not enabled for this organization',
          'MAGIC_INBOX_NOT_ENABLED',
          404
        );
      }

      // Create test email record
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      const [testEmail] = await contextDb
        .insert(magicInboxTestEmails)
        .values({
          organizationId,
          sentTo: registry.emailAddress,
          expiresAt,
        })
        .returning();

      // TODO: Actually send a test email via SES
      // For now, just create the tracking record

      return { testId: testEmail.id };
    });
  }

  /**
   * Get test email result
   */
  async getTestResult(testId: string): Promise<MagicInboxTestResult> {
    const organizationId = this.requireOrganizationContext();

    return withOrganizationContext({ organizationId }, async (contextDb) => {
      const testEmail = await contextDb.query.magicInboxTestEmails.findFirst({
        where: and(
          eq(magicInboxTestEmails.id, testId),
          eq(magicInboxTestEmails.organizationId, organizationId)
        ),
      });

      if (!testEmail) {
        throw new ServiceError(
          'Test email not found',
          'TEST_EMAIL_NOT_FOUND',
          404
        );
      }

      return this.testEmailToResult(testEmail);
    });
  }

  /**
   * Look up email registry by email address (for Lambda lookup)
   * This is a static method that doesn't require organization context.
   * Uses withoutRLS because it needs to search across all organizations.
   */
  static async lookupByEmail(emailAddress: string): Promise<{
    organizationId: string;
    webhookUrl: string;
    webhookSecretHash: string;
  } | null> {
    return withoutRLS(async (contextDb) => {
      const registry = await contextDb.query.magicInboxEmailRegistry.findFirst({
        where: and(
          eq(magicInboxEmailRegistry.emailAddress, emailAddress.toLowerCase()),
          eq(magicInboxEmailRegistry.isActive, true)
        ),
      });

      if (!registry) {
        return null;
      }

      return {
        organizationId: registry.organizationId,
        webhookUrl: registry.webhookUrl,
        webhookSecretHash: registry.webhookSecretHash,
      };
    });
  }

  /**
   * Verify webhook secret (for webhook handler)
   * Returns true if the provided secret hash matches the stored hash.
   * The Lambda receives the hash from the lookup endpoint and sends it
   * directly, so we compare hashes without re-hashing.
   * Uses withoutRLS because webhook verification happens before
   * organization context is established.
   */
  static async verifyWebhookSecret(organizationId: string, providedSecretHash: string): Promise<boolean> {
    return withoutRLS(async (contextDb) => {
      const registry = await contextDb.query.magicInboxEmailRegistry.findFirst({
        where: and(
          eq(magicInboxEmailRegistry.organizationId, organizationId),
          eq(magicInboxEmailRegistry.isActive, true)
        ),
      });

      if (!registry) {
        return false;
      }

      // Use timing-safe comparison of hashes
      // The Lambda sends the hash it received from lookup, so compare directly
      try {
        return crypto.timingSafeEqual(
          Buffer.from(providedSecretHash),
          Buffer.from(registry.webhookSecretHash)
        );
      } catch {
        return false;
      }
    });
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private generateWebhookSecret(): string {
    return crypto.randomBytes(WEBHOOK_SECRET_LENGTH).toString('hex');
  }

  private hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  private generateVerificationToken(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateDnsRecords(domain: string, verificationToken: string): DNSRecord[] {
    return [
      {
        type: 'MX',
        host: `inbox.${domain}`,
        value: 'inbound-smtp.us-east-1.amazonaws.com',
        priority: 10,
      },
      {
        type: 'TXT',
        host: `_magic-inbox.inbox.${domain}`,
        value: `magic-inbox-verify=${verificationToken}`,
      },
    ];
  }

  private generatePrefixSuggestions(base: string): string[] {
    const suggestions: string[] = [];
    const suffix = Math.floor(Math.random() * 1000);

    suggestions.push(`${base}-${suffix}`);
    suggestions.push(`${base}app`);
    suggestions.push(`${base}mail`);

    return suggestions;
  }

  private registryToConfig(registry: MagicInboxEmailRegistryRecord): MagicInboxConfig {
    return {
      enabled: registry.isActive,
      emailAddress: registry.emailAddress,
      emailType: registry.emailType as 'prefix' | 'custom_domain',
      prefix: registry.prefix ?? undefined,
      customDomain: registry.customDomain ?? undefined,
      verificationStatus: registry.verificationStatus as 'pending' | 'verified' | 'failed' | undefined,
      dnsRecords: registry.dnsRecords as DNSRecord[] | undefined,
      webhookUrl: registry.webhookUrl,
      createdAt: registry.createdAt.toISOString(),
      updatedAt: registry.updatedAt.toISOString(),
    };
  }

  private testEmailToResult(testEmail: MagicInboxTestEmailRecord): MagicInboxTestResult {
    let status: MagicInboxTestResult['status'];

    if (testEmail.error) {
      status = 'failed';
    } else if (testEmail.processed) {
      status = 'processed';
    } else if (testEmail.received) {
      status = 'received';
    } else if (new Date() > testEmail.expiresAt) {
      status = 'expired';
    } else {
      status = 'pending';
    }

    return {
      id: testEmail.id,
      status,
      sentAt: testEmail.sentAt.toISOString(),
      sentTo: testEmail.sentTo,
      receivedAt: testEmail.receivedAt?.toISOString(),
      processedAt: testEmail.processedAt?.toISOString(),
      pendingDocumentId: testEmail.pendingDocumentId ?? undefined,
      error: testEmail.error ?? undefined,
    };
  }
}

// Export singleton factory pattern
export const magicInboxConfigService = {
  create: (context = {}) => new MagicInboxConfigService(context),
  lookupByEmail: MagicInboxConfigService.lookupByEmail,
  verifyWebhookSecret: MagicInboxConfigService.verifyWebhookSecret,
};
