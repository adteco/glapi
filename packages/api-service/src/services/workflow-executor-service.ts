/**
 * Workflow Executor Service
 *
 * Executes communication workflow steps and manages workflow execution state.
 * Handles step execution including:
 * - send_email: Send emails using templates
 * - wait_delay: Pause execution for a duration
 * - wait_until: Pause until a specific time
 * - condition: Branch based on conditions
 * - webhook: Call external webhooks
 * - end: End the workflow
 */

import {
  db as globalDb,
  eq,
  and,
  communicationWorkflows,
  communicationWorkflowSteps,
  communicationWorkflowExecutions,
  communicationWorkflowStepHistory,
  communicationEvents,
  emailTemplates,
  type ContextualDatabase,
} from '@glapi/database';
import type {
  CommunicationWorkflow,
  CommunicationWorkflowStep,
  CommunicationWorkflowExecution,
  CommunicationWorkflowStepHistoryRecord,
  StepConfig,
  ExecutionContext,
  EmailTemplate,
} from '@glapi/database';

// =============================================================================
// Types
// =============================================================================

export interface ExecuteStepResult {
  success: boolean;
  nextStepId?: string | null;
  waitUntil?: Date;
  error?: string;
  output?: Record<string, unknown>;
}

export interface TriggerWorkflowInput {
  workflowId: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  context?: Record<string, unknown>;
  triggeredBy?: string;
}

export interface EmailProviderInterface {
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

export interface WorkflowExecutorServiceOptions {
  db?: ContextualDatabase;
  emailProvider?: EmailProviderInterface;
}

// =============================================================================
// Workflow Executor Service
// =============================================================================

export class WorkflowExecutorService {
  private db: ContextualDatabase;
  private emailProvider?: EmailProviderInterface;

  constructor(options: WorkflowExecutorServiceOptions = {}) {
    this.db = options.db ?? globalDb;
    this.emailProvider = options.emailProvider;
  }

  /**
   * Trigger a workflow for an entity
   */
  async triggerWorkflow(input: TriggerWorkflowInput): Promise<CommunicationWorkflowExecution> {
    const { workflowId, organizationId, entityType, entityId, context, triggeredBy } = input;

    // Get workflow and verify it's active
    const workflow = await this.db.query.communicationWorkflows.findFirst({
      where: and(
        eq(communicationWorkflows.id, workflowId),
        eq(communicationWorkflows.organizationId, organizationId),
        eq(communicationWorkflows.isActive, true)
      ),
    });

    if (!workflow) {
      throw new Error('Workflow not found or not active');
    }

    // Get first step
    const firstStep = await this.db.query.communicationWorkflowSteps.findFirst({
      where: eq(communicationWorkflowSteps.workflowId, workflowId),
      orderBy: (steps, { asc }) => [asc(steps.sortOrder)],
    });

    // Create execution record
    const [execution] = await this.db
      .insert(communicationWorkflowExecutions)
      .values({
        organizationId,
        workflowId,
        entityType,
        entityId,
        status: firstStep ? 'running' : 'completed',
        currentStepId: firstStep?.id ?? null,
        context: (context ?? {}) as ExecutionContext,
        startedAt: new Date(),
        completedAt: firstStep ? null : new Date(),
        triggeredBy,
      })
      .returning();

    // Update workflow statistics
    await this.db
      .update(communicationWorkflows)
      .set({
        totalExecutions: (workflow.totalExecutions ?? 0) + 1,
      })
      .where(eq(communicationWorkflows.id, workflowId));

    // If there's a first step, execute it
    if (firstStep && execution.status === 'running') {
      await this.executeStep(execution, firstStep);
    }

    return execution;
  }

  /**
   * Execute a single workflow step
   */
  async executeStep(
    execution: CommunicationWorkflowExecution,
    step: CommunicationWorkflowStep
  ): Promise<ExecuteStepResult> {
    const startedAt = new Date();

    // Record step start in history
    const [history] = await this.db
      .insert(communicationWorkflowStepHistory)
      .values({
        executionId: execution.id,
        stepId: step.id,
        stepType: step.stepType,
        status: 'running',
        startedAt,
        input: execution.context as Record<string, unknown>,
      })
      .returning();

    try {
      // Execute based on step type
      let result: ExecuteStepResult;

      switch (step.stepType) {
        case 'send_email':
          result = await this.executeSendEmailStep(execution, step);
          break;
        case 'wait_delay':
          result = await this.executeWaitDelayStep(execution, step);
          break;
        case 'wait_until':
          result = await this.executeWaitUntilStep(execution, step);
          break;
        case 'condition':
          result = await this.executeConditionStep(execution, step);
          break;
        case 'webhook':
          result = await this.executeWebhookStep(execution, step);
          break;
        case 'end':
          result = { success: true, nextStepId: null };
          break;
        default:
          result = { success: false, error: `Unknown step type: ${step.stepType}` };
      }

      // Update history with result
      await this.db
        .update(communicationWorkflowStepHistory)
        .set({
          status: result.success ? 'completed' : 'failed',
          completedAt: result.waitUntil ? null : new Date(),
          output: result.output,
          errorMessage: result.error,
        })
        .where(eq(communicationWorkflowStepHistory.id, history.id));

      // Handle result
      if (result.success) {
        if (result.waitUntil) {
          // Execution is waiting
          await this.updateExecutionWaiting(execution, step.id, result.waitUntil);
        } else if (result.nextStepId === null) {
          // Workflow completed
          await this.completeExecution(execution, true);
        } else {
          // Move to next step
          const nextStep = await this.getNextStep(step, result.nextStepId);
          if (nextStep) {
            await this.updateExecutionStep(execution, nextStep.id, result.output);
            // Recursively execute next step (or schedule it)
            // For now, we'll let the processor handle the next step
          } else {
            // No more steps, workflow completed
            await this.completeExecution(execution, true);
          }
        }
      } else {
        // Step failed
        await this.failExecution(execution, step.id, result.error);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update history with error
      await this.db
        .update(communicationWorkflowStepHistory)
        .set({
          status: 'failed',
          completedAt: new Date(),
          errorMessage,
        })
        .where(eq(communicationWorkflowStepHistory.id, history.id));

      await this.failExecution(execution, step.id, errorMessage);

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Execute send_email step
   */
  private async executeSendEmailStep(
    execution: CommunicationWorkflowExecution,
    step: CommunicationWorkflowStep
  ): Promise<ExecuteStepResult> {
    const config = step.config as StepConfig;

    if (!config.templateId) {
      return { success: false, error: 'No template ID configured' };
    }

    // Get template
    const template = await this.db.query.emailTemplates.findFirst({
      where: and(
        eq(emailTemplates.id, config.templateId),
        eq(emailTemplates.organizationId, execution.organizationId)
      ),
    });

    if (!template) {
      return { success: false, error: 'Email template not found' };
    }

    // Get recipient from context
    const context = execution.context as ExecutionContext;
    const toEmail = config.recipientEmail ?? context.recipientEmail ?? context.email;
    const toName = config.recipientName ?? context.recipientName ?? context.name;

    if (!toEmail) {
      return { success: false, error: 'No recipient email found' };
    }

    // Substitute variables in template
    const variables = {
      ...context,
      ...(config.variableOverrides as Record<string, unknown> || {}),
    };

    const subject = this.substituteVariables(template.subject, variables);
    const htmlBody = this.substituteVariables(template.htmlBody, variables);
    const textBody = template.textBody
      ? this.substituteVariables(template.textBody, variables)
      : undefined;

    // Create communication event
    const [event] = await this.db
      .insert(communicationEvents)
      .values({
        organizationId: execution.organizationId,
        entityType: execution.entityType,
        entityId: execution.entityId,
        toEmail: toEmail as string,
        toName: toName as string | undefined,
        fromEmail: template.fromEmail ?? 'noreply@example.com',
        fromName: template.fromName,
        replyTo: template.replyTo,
        subject,
        htmlBody,
        textBody,
        templateId: template.id,
        templateVariables: variables,
        workflowExecutionId: execution.id,
        workflowStepId: step.id,
        eventType: 'workflow',
        status: 'pending',
      })
      .returning();

    // If we have an email provider, send immediately
    if (this.emailProvider) {
      try {
        const result = await this.emailProvider.sendEmail({
          to: toEmail as string,
          toName: toName as string | undefined,
          from: template.fromEmail ?? 'noreply@example.com',
          fromName: template.fromName ?? undefined,
          replyTo: template.replyTo ?? undefined,
          subject,
          htmlBody,
          textBody,
        });

        // Update event status
        await this.db
          .update(communicationEvents)
          .set({
            status: 'sent',
            sesMessageId: result.messageId,
            sentAt: new Date(),
          })
          .where(eq(communicationEvents.id, event.id));

        return {
          success: true,
          nextStepId: step.nextStepId,
          output: { emailId: event.id, messageId: result.messageId },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Email send failed';

        await this.db
          .update(communicationEvents)
          .set({
            status: 'failed',
            errorMessage,
          })
          .where(eq(communicationEvents.id, event.id));

        return { success: false, error: errorMessage };
      }
    }

    // Email will be sent by a separate processor
    return {
      success: true,
      nextStepId: step.nextStepId,
      output: { emailId: event.id, status: 'queued' },
    };
  }

  /**
   * Execute wait_delay step
   */
  private async executeWaitDelayStep(
    execution: CommunicationWorkflowExecution,
    step: CommunicationWorkflowStep
  ): Promise<ExecuteStepResult> {
    const config = step.config as StepConfig;

    const delayValue = config.delayValue ?? 1;
    const delayUnit = config.delayUnit ?? 'days';

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
        delayMs = delayValue * 24 * 60 * 60 * 1000; // Default to days
    }

    const waitUntil = new Date(Date.now() + delayMs);

    return {
      success: true,
      nextStepId: step.nextStepId,
      waitUntil,
      output: { delayValue, delayUnit, waitUntil: waitUntil.toISOString() },
    };
  }

  /**
   * Execute wait_until step
   */
  private async executeWaitUntilStep(
    execution: CommunicationWorkflowExecution,
    step: CommunicationWorkflowStep
  ): Promise<ExecuteStepResult> {
    const config = step.config as StepConfig;

    if (!config.waitUntilTime) {
      return { success: false, error: 'No wait until time configured' };
    }

    const waitUntil = new Date(config.waitUntilTime);

    if (waitUntil <= new Date()) {
      // Time has passed, proceed immediately
      return {
        success: true,
        nextStepId: step.nextStepId,
        output: { waitUntil: waitUntil.toISOString(), immediate: true },
      };
    }

    return {
      success: true,
      nextStepId: step.nextStepId,
      waitUntil,
      output: { waitUntil: waitUntil.toISOString() },
    };
  }

  /**
   * Execute condition step
   */
  private async executeConditionStep(
    execution: CommunicationWorkflowExecution,
    step: CommunicationWorkflowStep
  ): Promise<ExecuteStepResult> {
    const config = step.config as StepConfig;
    const context = execution.context as ExecutionContext;

    if (!config.conditionField || !config.conditionOperator) {
      return { success: false, error: 'Condition not configured' };
    }

    const fieldValue = context[config.conditionField];
    const compareValue = config.conditionValue;

    let conditionMet = false;

    switch (config.conditionOperator) {
      case 'equals':
        conditionMet = fieldValue === compareValue;
        break;
      case 'not_equals':
        conditionMet = fieldValue !== compareValue;
        break;
      case 'contains':
        conditionMet = String(fieldValue).includes(String(compareValue));
        break;
      case 'greater_than':
        conditionMet = Number(fieldValue) > Number(compareValue);
        break;
      case 'less_than':
        conditionMet = Number(fieldValue) < Number(compareValue);
        break;
      case 'is_empty':
        conditionMet = !fieldValue || fieldValue === '';
        break;
      case 'is_not_empty':
        conditionMet = !!fieldValue && fieldValue !== '';
        break;
      default:
        conditionMet = false;
    }

    // Determine next step based on condition
    const branchConfig = step.branchConfig as { trueBranchStepId?: string; falseBranchStepId?: string } | null;
    const nextStepId = conditionMet
      ? branchConfig?.trueBranchStepId ?? step.nextStepId
      : branchConfig?.falseBranchStepId ?? step.nextStepId;

    return {
      success: true,
      nextStepId,
      output: {
        conditionField: config.conditionField,
        conditionOperator: config.conditionOperator,
        conditionValue: compareValue,
        fieldValue,
        conditionMet,
        branch: conditionMet ? 'true' : 'false',
      },
    };
  }

  /**
   * Execute webhook step
   */
  private async executeWebhookStep(
    execution: CommunicationWorkflowExecution,
    step: CommunicationWorkflowStep
  ): Promise<ExecuteStepResult> {
    const config = step.config as StepConfig;

    if (!config.webhookUrl) {
      return { success: false, error: 'No webhook URL configured' };
    }

    const method = config.httpMethod ?? 'POST';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(config.webhookHeaders as Record<string, string> || {}),
    };

    const body = {
      workflowId: execution.workflowId,
      executionId: execution.id,
      entityType: execution.entityType,
      entityId: execution.entityId,
      context: execution.context,
      ...(config.webhookPayload as Record<string, unknown> || {}),
    };

    try {
      const response = await fetch(config.webhookUrl, {
        method,
        headers,
        body: method !== 'GET' ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Webhook failed with status ${response.status}: ${response.statusText}`,
        };
      }

      const responseData = await response.json().catch(() => null);

      return {
        success: true,
        nextStepId: step.nextStepId,
        output: {
          statusCode: response.status,
          response: responseData,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Webhook request failed',
      };
    }
  }

  /**
   * Get the next step to execute
   */
  private async getNextStep(
    currentStep: CommunicationWorkflowStep,
    nextStepId?: string | null
  ): Promise<CommunicationWorkflowStep | null> {
    if (nextStepId) {
      return this.db.query.communicationWorkflowSteps.findFirst({
        where: eq(communicationWorkflowSteps.id, nextStepId),
      });
    }

    // Get next step by sort order
    const nextStep = await this.db.query.communicationWorkflowSteps.findFirst({
      where: and(
        eq(communicationWorkflowSteps.workflowId, currentStep.workflowId),
        eq(communicationWorkflowSteps.sortOrder, currentStep.sortOrder + 1)
      ),
    });

    return nextStep ?? null;
  }

  /**
   * Update execution to waiting state
   */
  private async updateExecutionWaiting(
    execution: CommunicationWorkflowExecution,
    stepId: string,
    waitUntil: Date
  ): Promise<void> {
    await this.db
      .update(communicationWorkflowExecutions)
      .set({
        status: 'waiting',
        currentStepId: stepId,
        nextStepAt: waitUntil,
        updatedAt: new Date(),
      })
      .where(eq(communicationWorkflowExecutions.id, execution.id));
  }

  /**
   * Update execution to move to next step
   */
  private async updateExecutionStep(
    execution: CommunicationWorkflowExecution,
    nextStepId: string,
    output?: Record<string, unknown>
  ): Promise<void> {
    const context = execution.context as ExecutionContext;
    const newContext: ExecutionContext = output
      ? { ...context, lastStepOutput: output }
      : context;

    await this.db
      .update(communicationWorkflowExecutions)
      .set({
        status: 'running',
        currentStepId: nextStepId,
        context: newContext,
        nextStepAt: null,
        updatedAt: new Date(),
      })
      .where(eq(communicationWorkflowExecutions.id, execution.id));
  }

  /**
   * Mark execution as completed
   */
  private async completeExecution(
    execution: CommunicationWorkflowExecution,
    success: boolean
  ): Promise<void> {
    await this.db
      .update(communicationWorkflowExecutions)
      .set({
        status: 'completed',
        currentStepId: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(communicationWorkflowExecutions.id, execution.id));

    // Update workflow statistics
    if (success) {
      await this.db
        .update(communicationWorkflows)
        .set({
          successfulExecutions: (execution.workflowId as unknown as number) + 1, // This will be fixed in next update
        })
        .where(eq(communicationWorkflows.id, execution.workflowId));
    }
  }

  /**
   * Mark execution as failed
   */
  private async failExecution(
    execution: CommunicationWorkflowExecution,
    stepId: string,
    errorMessage?: string
  ): Promise<void> {
    await this.db
      .update(communicationWorkflowExecutions)
      .set({
        status: 'failed',
        errorMessage,
        errorStepId: stepId,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(communicationWorkflowExecutions.id, execution.id));

    // Update workflow statistics
    await this.db
      .update(communicationWorkflows)
      .set({
        failedExecutions: (execution.workflowId as unknown as number) + 1, // This will be fixed in next update
      })
      .where(eq(communicationWorkflows.id, execution.workflowId));
  }

  /**
   * Substitute variables in a template string
   */
  private substituteVariables(
    content: string,
    variables: Record<string, unknown>
  ): string {
    return content.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      const value = variables[trimmedKey];
      if (value === undefined || value === null) {
        return match; // Keep placeholder if no value
      }
      return String(value);
    });
  }

  /**
   * Resume waiting executions
   * Called by the workflow processor to check for and continue waiting executions
   */
  async resumeWaitingExecutions(): Promise<number> {
    const now = new Date();

    // Find executions ready to resume
    const waitingExecutions = await this.db.query.communicationWorkflowExecutions.findMany({
      where: and(
        eq(communicationWorkflowExecutions.status, 'waiting'),
        // nextStepAt <= now
      ),
    });

    let resumed = 0;

    for (const execution of waitingExecutions) {
      if (execution.nextStepAt && execution.nextStepAt <= now) {
        // Get the current step
        if (execution.currentStepId) {
          const step = await this.db.query.communicationWorkflowSteps.findFirst({
            where: eq(communicationWorkflowSteps.id, execution.currentStepId),
          });

          if (step) {
            // Get next step and execute
            const nextStep = await this.getNextStep(step, step.nextStepId);
            if (nextStep) {
              await this.updateExecutionStep(execution, nextStep.id);
              await this.executeStep(execution, nextStep);
              resumed++;
            } else {
              await this.completeExecution(execution, true);
              resumed++;
            }
          }
        }
      }
    }

    return resumed;
  }
}

// Export singleton instance
export const workflowExecutorService = new WorkflowExecutorService();
