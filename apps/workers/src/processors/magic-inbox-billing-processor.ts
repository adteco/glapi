/**
 * Magic Inbox Billing Processor
 *
 * Syncs Magic Inbox usage to Stripe at the end of each billing period.
 * Runs as a scheduled job to ensure all unbilled usage records are synced.
 */

import { createChildLogger, type Logger } from '../utils/logger';
import { registerHealthCheck, type HealthCheck } from '../utils/health';
import { MagicInboxUsageService } from '@glapi/api-service';

export interface MagicInboxBillingProcessorConfig {
  /** How often to check for unbilled usage (in milliseconds) */
  pollIntervalMs: number;
  /** Whether to run the processor */
  enabled: boolean;
}

export const defaultMagicInboxBillingProcessorConfig: MagicInboxBillingProcessorConfig = {
  pollIntervalMs: 60 * 60 * 1000, // 1 hour
  enabled: true,
};

interface ProcessorState {
  running: boolean;
  lastRunTime: Date | null;
  recordsSynced: number;
  recordsFailed: number;
  consecutiveErrors: number;
}

/**
 * Magic Inbox Billing Processor
 *
 * Periodically checks for unbilled Magic Inbox usage records and syncs
 * them to Stripe for metered billing.
 */
export class MagicInboxBillingProcessor {
  private readonly logger: Logger;
  private readonly config: MagicInboxBillingProcessorConfig;
  private state: ProcessorState;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<MagicInboxBillingProcessorConfig> = {}) {
    this.config = { ...defaultMagicInboxBillingProcessorConfig, ...config };
    this.logger = createChildLogger('MagicInboxBillingProcessor');
    this.state = {
      running: false,
      lastRunTime: null,
      recordsSynced: 0,
      recordsFailed: 0,
      consecutiveErrors: 0,
    };

    // Register health check
    registerHealthCheck('magic-inbox-billing', () => this.healthCheck());
  }

  /**
   * Start the processor
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Magic Inbox billing processor is disabled');
      return;
    }

    if (this.state.running) {
      this.logger.warn('Processor already running');
      return;
    }

    this.logger.info({ config: this.config }, 'Starting Magic Inbox billing processor');
    this.state.running = true;

    // Run immediately on start, then schedule
    await this.runSync();
    this.schedulePoll();
  }

  /**
   * Stop the processor gracefully
   */
  async stop(): Promise<void> {
    if (!this.state.running) {
      return;
    }

    this.logger.info('Stopping Magic Inbox billing processor');
    this.state.running = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    this.logger.info(
      {
        recordsSynced: this.state.recordsSynced,
        recordsFailed: this.state.recordsFailed,
      },
      'Magic Inbox billing processor stopped'
    );
  }

  /**
   * Schedule the next sync
   */
  private schedulePoll(): void {
    if (!this.state.running) return;

    this.pollTimer = setTimeout(async () => {
      await this.runSync();
      this.schedulePoll();
    }, this.config.pollIntervalMs);
  }

  /**
   * Run the billing sync
   */
  private async runSync(): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.info('Starting billing sync');

      // Create a service instance without organization context
      // The syncUsageToStripe method handles all orgs internally
      const usageService = new MagicInboxUsageService({});
      const result = await usageService.syncUsageToStripe();

      this.state.lastRunTime = new Date();
      this.state.recordsSynced += result.synced;
      this.state.recordsFailed += result.failed;
      this.state.consecutiveErrors = 0;

      const duration = Date.now() - startTime;

      if (result.errors.length > 0) {
        this.logger.warn(
          {
            synced: result.synced,
            failed: result.failed,
            errors: result.errors,
            durationMs: duration,
          },
          'Billing sync completed with errors'
        );
      } else {
        this.logger.info(
          {
            synced: result.synced,
            durationMs: duration,
          },
          'Billing sync completed successfully'
        );
      }
    } catch (error) {
      this.state.consecutiveErrors++;
      this.logger.error(
        {
          error,
          consecutiveErrors: this.state.consecutiveErrors,
        },
        'Billing sync failed'
      );
    }
  }

  /**
   * Health check for the processor
   */
  private async healthCheck(): Promise<HealthCheck> {
    const timestamp = new Date().toISOString();

    if (!this.config.enabled) {
      return { status: 'pass', message: 'Processor disabled', timestamp };
    }

    if (!this.state.running) {
      return { status: 'fail', message: 'Processor not running', timestamp };
    }

    if (this.state.consecutiveErrors >= 3) {
      return {
        status: 'warn',
        message: `High error rate: ${this.state.consecutiveErrors} consecutive errors`,
        timestamp,
      };
    }

    return { status: 'pass', timestamp };
  }

  /**
   * Get current processor state
   */
  getState(): ProcessorState {
    return { ...this.state };
  }

  /**
   * Manually trigger a sync (for testing or admin operations)
   */
  async triggerSync(): Promise<{
    synced: number;
    failed: number;
    errors: string[];
  }> {
    const usageService = new MagicInboxUsageService({});
    return usageService.syncUsageToStripe();
  }
}
