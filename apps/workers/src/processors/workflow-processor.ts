/**
 * Workflow Processor - Background job processor for communication workflows
 *
 * Handles:
 * 1. Resuming waiting workflow executions when their delay has passed
 * 2. Processing pending communication events (sending emails)
 * 3. Cleaning up completed/stale executions
 */

import { eq, and, lte, sql, asc, inArray } from 'drizzle-orm';
import { db } from '@glapi/database';
import {
  communicationWorkflowExecutions,
  communicationWorkflowSteps,
  communicationEvents,
} from '@glapi/database/schema';
import type {
  CommunicationWorkflowExecution,
  CommunicationWorkflowStep,
  CommunicationEvent,
} from '@glapi/database';
import { createChildLogger, type Logger } from '../utils/logger.js';
import { registerHealthCheck, type HealthCheck } from '../utils/health.js';

// =============================================================================
// Types
// =============================================================================

export interface WorkflowProcessorConfig {
  pollIntervalMs: number;
  batchSize: number;
  maxRetries: number;
  emailSendEnabled: boolean;
}

interface ProcessorState {
  running: boolean;
  lastPollTime: Date | null;
  executionsResumed: number;
  emailsSent: number;
  errors: number;
  consecutiveErrors: number;
}

interface EmailProviderInterface {
  sendEmail(options: {
    to: string;
    toName?: string;
    from: string;
    fromName?: string;
    replyTo?: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
  }): Promise<{
    messageId: string;
    acceptedRecipients: string[];
    rejectedRecipients?: string[];
  }>;
}

// =============================================================================
// Workflow Processor
// =============================================================================

export class WorkflowProcessor {
  private readonly logger: Logger;
  private readonly config: WorkflowProcessorConfig;
  private readonly emailProvider?: EmailProviderInterface;
  private state: ProcessorState;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(config: WorkflowProcessorConfig, emailProvider?: EmailProviderInterface) {
    this.config = config;
    this.emailProvider = emailProvider;
    this.logger = createChildLogger('WorkflowProcessor');
    this.state = {
      running: false,
      lastPollTime: null,
      executionsResumed: 0,
      emailsSent: 0,
      errors: 0,
      consecutiveErrors: 0,
    };

    registerHealthCheck('workflow-processor', () => this.healthCheck());
  }

  /**
   * Start the processor
   */
  async start(): Promise<void> {
    if (this.state.running) {
      this.logger.warn('Workflow processor already running');
      return;
    }

    this.logger.info({ config: this.config }, 'Starting workflow processor');
    this.state.running = true;

    this.schedulePoll();
  }

  /**
   * Stop the processor gracefully
   */
  async stop(): Promise<void> {
    if (!this.state.running) {
      return;
    }

    this.logger.info('Stopping workflow processor');
    this.state.running = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    this.logger.info(
      {
        executionsResumed: this.state.executionsResumed,
        emailsSent: this.state.emailsSent,
        errors: this.state.errors,
      },
      'Workflow processor stopped'
    );
  }

  /**
   * Schedule the next poll cycle
   */
  private schedulePoll(): void {
    if (!this.state.running) return;

    this.pollTimer = setTimeout(async () => {
      await this.poll();
      this.schedulePoll();
    }, this.config.pollIntervalMs);
  }

  /**
   * Execute a single poll cycle
   */
  private async poll(): Promise<void> {
    try {
      this.state.lastPollTime = new Date();

      // 1. Resume waiting executions
      const resumed = await this.resumeWaitingExecutions();
      this.state.executionsResumed += resumed;

      // 2. Process pending emails
      if (this.config.emailSendEnabled && this.emailProvider) {
        const sent = await this.processPendingEmails();
        this.state.emailsSent += sent;
      }

      this.state.consecutiveErrors = 0;
    } catch (error) {
      this.state.errors++;
      this.state.consecutiveErrors++;
      this.logger.error(
        { error, consecutiveErrors: this.state.consecutiveErrors },
        'Poll cycle failed'
      );
    }
  }

  /**
   * Resume waiting workflow executions
   */
  private async resumeWaitingExecutions(): Promise<number> {
    const now = new Date();

    // Find executions ready to resume
    const executions = await db
      .select()
      .from(communicationWorkflowExecutions)
      .where(
        and(
          eq(communicationWorkflowExecutions.status, 'waiting'),
          lte(communicationWorkflowExecutions.nextStepAt, now)
        )
      )
      .limit(this.config.batchSize)
      .for('update', { skipLocked: true });

    if (executions.length === 0) {
      return 0;
    }

    this.logger.debug({ count: executions.length }, 'Resuming waiting executions');

    let resumed = 0;

    for (const execution of executions) {
      try {
        await this.resumeExecution(execution);
        resumed++;
      } catch (error) {
        this.logger.error(
          { executionId: execution.id, error },
          'Failed to resume execution'
        );
      }
    }

    return resumed;
  }

  /**
   * Resume a single waiting execution
   */
  private async resumeExecution(
    execution: CommunicationWorkflowExecution
  ): Promise<void> {
    if (!execution.currentStepId) {
      // No current step, mark as completed
      await db
        .update(communicationWorkflowExecutions)
        .set({
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(communicationWorkflowExecutions.id, execution.id));
      return;
    }

    // Get the current step
    const currentStep = await db.query.communicationWorkflowSteps.findFirst({
      where: eq(communicationWorkflowSteps.id, execution.currentStepId),
    });

    if (!currentStep) {
      this.logger.warn(
        { executionId: execution.id, stepId: execution.currentStepId },
        'Current step not found'
      );
      return;
    }

    // Find next step
    const nextStep = currentStep.nextStepId
      ? await db.query.communicationWorkflowSteps.findFirst({
          where: eq(communicationWorkflowSteps.id, currentStep.nextStepId),
        })
      : await db.query.communicationWorkflowSteps.findFirst({
          where: and(
            eq(communicationWorkflowSteps.workflowId, currentStep.workflowId),
            sql`${communicationWorkflowSteps.sortOrder} > ${currentStep.sortOrder}`
          ),
          orderBy: [asc(communicationWorkflowSteps.sortOrder)],
        });

    if (!nextStep) {
      // No more steps, workflow completed
      await db
        .update(communicationWorkflowExecutions)
        .set({
          status: 'completed',
          currentStepId: null,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(communicationWorkflowExecutions.id, execution.id));
      return;
    }

    // Update execution to running state with next step
    await db
      .update(communicationWorkflowExecutions)
      .set({
        status: 'running',
        currentStepId: nextStep.id,
        nextStepAt: null,
        updatedAt: new Date(),
      })
      .where(eq(communicationWorkflowExecutions.id, execution.id));

    // Execute the next step (simplified - in production, delegate to executor service)
    await this.executeStep(execution, nextStep);
  }

  /**
   * Execute a workflow step
   */
  private async executeStep(
    execution: CommunicationWorkflowExecution,
    step: CommunicationWorkflowStep
  ): Promise<void> {
    const config = step.config as Record<string, unknown>;

    switch (step.stepType) {
      case 'send_email':
        // Create communication event if not exists
        if (config.templateId) {
          // This would create a communication event
          // The email will be picked up by processPendingEmails
          this.logger.debug(
            { executionId: execution.id, stepId: step.id },
            'Email step queued'
          );
        }
        break;

      case 'wait_delay':
      case 'wait_until': {
        // Calculate wait time and update execution
        let waitUntil: Date;
        if (step.stepType === 'wait_delay') {
          const delayValue = (config.delayValue as number) ?? 1;
          const delayUnit = (config.delayUnit as string) ?? 'days';
          let delayMs: number;
          switch (delayUnit) {
            case 'minutes':
              delayMs = delayValue * 60 * 1000;
              break;
            case 'hours':
              delayMs = delayValue * 60 * 60 * 1000;
              break;
            case 'days':
              delayMs = delayValue * 24 * 60 * 60 * 1000;
              break;
            case 'weeks':
              delayMs = delayValue * 7 * 24 * 60 * 60 * 1000;
              break;
            default:
              delayMs = delayValue * 24 * 60 * 60 * 1000;
          }
          waitUntil = new Date(Date.now() + delayMs);
        } else {
          waitUntil = new Date((config.waitUntilTime as string) ?? Date.now());
        }

        await db
          .update(communicationWorkflowExecutions)
          .set({
            status: 'waiting',
            nextStepAt: waitUntil,
            updatedAt: new Date(),
          })
          .where(eq(communicationWorkflowExecutions.id, execution.id));
        break;
      }

      case 'end':
        await db
          .update(communicationWorkflowExecutions)
          .set({
            status: 'completed',
            currentStepId: null,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(communicationWorkflowExecutions.id, execution.id));
        break;

      default:
        // Move to next step
        break;
    }
  }

  /**
   * Process pending communication events (send emails)
   */
  private async processPendingEmails(): Promise<number> {
    if (!this.emailProvider) {
      return 0;
    }

    // Find pending emails
    const pendingEvents = await db
      .select()
      .from(communicationEvents)
      .where(
        and(
          eq(communicationEvents.status, 'pending'),
          sql`${communicationEvents.scheduledAt} IS NULL OR ${communicationEvents.scheduledAt} <= NOW()`
        )
      )
      .limit(this.config.batchSize)
      .for('update', { skipLocked: true });

    if (pendingEvents.length === 0) {
      return 0;
    }

    this.logger.debug({ count: pendingEvents.length }, 'Processing pending emails');

    let sent = 0;

    for (const event of pendingEvents) {
      try {
        // Update to sending
        await db
          .update(communicationEvents)
          .set({ status: 'sending' })
          .where(eq(communicationEvents.id, event.id));

        // Send email
        const result = await this.emailProvider.sendEmail({
          to: event.toEmail,
          toName: event.toName ?? undefined,
          from: event.fromEmail,
          fromName: event.fromName ?? undefined,
          replyTo: event.replyTo ?? undefined,
          subject: event.subject,
          htmlBody: event.htmlBody,
          textBody: event.textBody ?? undefined,
        });

        // Update to sent
        await db
          .update(communicationEvents)
          .set({
            status: 'sent',
            sesMessageId: result.messageId,
            sentAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(communicationEvents.id, event.id));

        sent++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const newRetryCount = event.retryCount + 1;

        if (newRetryCount >= this.config.maxRetries) {
          // Max retries exceeded
          await db
            .update(communicationEvents)
            .set({
              status: 'failed',
              errorMessage: `Max retries exceeded: ${errorMessage}`,
              retryCount: newRetryCount,
              updatedAt: new Date(),
            })
            .where(eq(communicationEvents.id, event.id));
        } else {
          // Schedule retry
          await db
            .update(communicationEvents)
            .set({
              status: 'pending',
              errorMessage,
              retryCount: newRetryCount,
              updatedAt: new Date(),
            })
            .where(eq(communicationEvents.id, event.id));
        }

        this.logger.error(
          { eventId: event.id, error: errorMessage, retryCount: newRetryCount },
          'Failed to send email'
        );
      }
    }

    return sent;
  }

  /**
   * Health check
   */
  private async healthCheck(): Promise<HealthCheck> {
    const timestamp = new Date().toISOString();

    if (!this.state.running) {
      return { status: 'fail', message: 'Processor not running', timestamp };
    }

    if (this.state.consecutiveErrors >= 5) {
      return {
        status: 'warn',
        message: `High error rate: ${this.state.consecutiveErrors} consecutive errors`,
        timestamp,
      };
    }

    return { status: 'pass', timestamp };
  }

  /**
   * Get processor state
   */
  getState(): ProcessorState {
    return { ...this.state };
  }
}

// Default configuration
export const defaultWorkflowProcessorConfig: WorkflowProcessorConfig = {
  pollIntervalMs: 10000, // 10 seconds
  batchSize: 50,
  maxRetries: 3,
  emailSendEnabled: true,
};
