/**
 * Workflow Execution Service
 *
 * Core engine for executing workflow automation instances.
 * Handles:
 * - Starting workflow instances from triggers
 * - Processing steps sequentially
 * - Managing state transitions
 * - Error handling and retries
 * - Dead Letter Queue (DLQ) for failed workflows
 */

import { BaseService } from './base-service';
import { ServiceError, ServiceContext } from '../types';
import {
  WorkflowAutomationRepository,
  WorkflowDefinitionWithSteps,
  WorkflowInstanceWithExecutions,
  workflowAutomationRepository,
} from '@glapi/database';
import type {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowInstance,
  WorkflowStepExecution,
  WorkflowInstanceStatus,
  WorkflowStepExecutionStatus,
  WorkflowTriggerType,
  TriggerCondition,
  ConditionActionConfig,
  DelayActionConfig,
  NotificationActionConfig,
  InternalActionConfig,
  TransformActionConfig,
} from '@glapi/database/schema';
import { EventService, createEventService } from './event-service';
import { EventCategory } from '../types/events.types';

// ============================================================================
// Types
// ============================================================================

export interface StartWorkflowInput {
  workflowDefinitionId?: string;
  workflowCode?: string;
  triggerType: WorkflowTriggerType;
  triggerContext?: Record<string, unknown>;
  relatedDocumentType?: string;
  relatedDocumentId?: string;
}

export interface StartWorkflowResult {
  instance: WorkflowInstance;
  definition: WorkflowDefinition;
}

export interface StepExecutionResult {
  success: boolean;
  outputData?: Record<string, unknown>;
  error?: {
    message: string;
    code?: string;
    details?: Record<string, unknown>;
  };
  nextStepId?: string | null;
  shouldRetry?: boolean;
  shouldWait?: boolean;
  waitUntil?: Date;
}

export interface ExecuteStepInput {
  instance: WorkflowInstance;
  step: WorkflowStep;
  executionContext: Record<string, unknown>;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 300000, // 5 minutes
  backoffMultiplier: 2,
};

// ============================================================================
// Service
// ============================================================================

export class WorkflowExecutionService extends BaseService {
  private repository: WorkflowAutomationRepository;
  private eventService: EventService;
  private actionExecutors: Map<string, ActionExecutor>;

  constructor(context: ServiceContext = {}) {
    super(context);
    this.repository = workflowAutomationRepository;
    this.eventService = createEventService(context.organizationId, context.userId);
    this.actionExecutors = new Map();

    // Register built-in action executors
    this.registerActionExecutor('notification', new NotificationActionExecutor());
    this.registerActionExecutor('internal_action', new InternalActionExecutor());
    this.registerActionExecutor('condition', new ConditionActionExecutor());
    this.registerActionExecutor('delay', new DelayActionExecutor());
    this.registerActionExecutor('transform', new TransformActionExecutor());
  }

  /**
   * Register a custom action executor
   */
  registerActionExecutor(actionType: string, executor: ActionExecutor): void {
    this.actionExecutors.set(actionType, executor);
  }

  // ============================================================================
  // Workflow Lifecycle
  // ============================================================================

  /**
   * Start a new workflow instance
   */
  async startWorkflow(input: StartWorkflowInput): Promise<StartWorkflowResult> {
    const organizationId = this.requireOrganizationContext();

    // Find workflow definition
    let definition: WorkflowDefinitionWithSteps | null = null;

    if (input.workflowDefinitionId) {
      definition = await this.repository.findDefinitionWithSteps(input.workflowDefinitionId);
    } else if (input.workflowCode) {
      definition = await this.repository.findLatestDefinitionByCode(organizationId, input.workflowCode);
    }

    if (!definition) {
      throw new ServiceError(
        'Workflow definition not found',
        'WORKFLOW_NOT_FOUND',
        404
      );
    }

    if (definition.status !== 'active') {
      throw new ServiceError(
        `Workflow is not active (status: ${definition.status})`,
        'WORKFLOW_NOT_ACTIVE',
        400
      );
    }

    // Find the first step
    const firstStep = await this.repository.findFirstStep(definition.id);

    // Create the workflow instance
    const instance = await this.repository.createInstance({
      organizationId,
      workflowDefinitionId: definition.id,
      definitionSnapshot: JSON.parse(JSON.stringify({ ...definition, steps: definition.steps })),
      status: 'pending',
      currentStepId: firstStep?.id || null,
      currentStepOrder: firstStep?.stepOrder || null,
      triggeredBy: input.triggerType,
      triggerContext: input.triggerContext || {},
      triggerUserId: this.context.userId || null,
      executionContext: {
        ...input.triggerContext,
        _workflow: {
          definitionId: definition.id,
          definitionCode: definition.workflowCode,
          version: definition.version,
          startedAt: new Date().toISOString(),
        },
      },
      relatedDocumentType: input.relatedDocumentType || null,
      relatedDocumentId: input.relatedDocumentId || null,
    });

    // Emit workflow started event
    await this.eventService.emit({
      eventType: 'WorkflowStarted',
      eventCategory: EventCategory.WORKFLOW,
      aggregateId: instance.id,
      aggregateType: 'WorkflowInstance',
      data: {
        workflowDefinitionId: definition.id,
        workflowCode: definition.workflowCode,
        triggerType: input.triggerType,
        relatedDocumentType: input.relatedDocumentType,
        relatedDocumentId: input.relatedDocumentId,
      },
    });

    return { instance, definition };
  }

  /**
   * Execute a workflow instance (process all steps)
   */
  async executeWorkflow(instanceId: string): Promise<WorkflowInstance> {
    const organizationId = this.requireOrganizationContext();

    // Get instance with current state
    let instance = await this.repository.findInstanceById(instanceId);
    if (!instance) {
      throw new ServiceError('Workflow instance not found', 'INSTANCE_NOT_FOUND', 404);
    }

    if (instance.organizationId !== organizationId) {
      throw new ServiceError('Workflow instance not found', 'INSTANCE_NOT_FOUND', 404);
    }

    // Check if already completed or failed
    if (['completed', 'failed', 'cancelled', 'timed_out'].includes(instance.status)) {
      return instance;
    }

    // Get definition from snapshot
    const definition = instance.definitionSnapshot as WorkflowDefinitionWithSteps;
    const steps = definition.steps || [];

    // Update status to running
    instance = (await this.repository.updateInstance(instanceId, {
      status: 'running',
      startedAt: instance.startedAt || new Date(),
    }))!;

    // Process steps
    let currentStepOrder = instance.currentStepOrder || 0;
    let executionContext = (instance.executionContext || {}) as Record<string, unknown>;

    try {
      while (currentStepOrder < steps.length) {
        const step = steps.find((s) => s.stepOrder === currentStepOrder);
        if (!step) {
          // No more steps, workflow complete
          break;
        }

        // Check skip conditions
        if (step.skipConditions && this.evaluateConditions(step.skipConditions as TriggerCondition[], executionContext)) {
          // Skip this step
          await this.createStepExecution(instance.id, step, 'skipped', {});
          currentStepOrder++;
          continue;
        }

        // Execute the step
        const result = await this.executeStep({
          instance,
          step,
          executionContext,
        });

        if (result.shouldWait) {
          // Step is waiting (e.g., for approval, external response)
          instance = (await this.repository.updateInstance(instanceId, {
            status: 'waiting',
            currentStepId: step.id,
            currentStepOrder,
            executionContext,
          }))!;
          return instance;
        }

        if (!result.success) {
          // Handle step failure
          const handled = await this.handleStepFailure(instance, step, result, executionContext);
          if (!handled.continue) {
            // Workflow failed
            instance = (await this.repository.updateInstance(instanceId, {
              status: 'failed',
              errorMessage: result.error?.message,
              errorDetails: result.error?.details,
              completedAt: new Date(),
              executionContext,
            }))!;

            await this.emitWorkflowCompleted(instance, 'failed');
            return instance;
          }
          // Continue to next step (error was handled)
        }

        // Merge output data into context
        if (result.outputData) {
          executionContext = {
            ...executionContext,
            [step.stepCode]: result.outputData,
            _lastOutput: result.outputData,
          };
        }

        // Determine next step
        if (result.nextStepId) {
          const nextStep = steps.find((s) => s.id === result.nextStepId);
          currentStepOrder = nextStep?.stepOrder ?? steps.length;
        } else if (step.nextStepId) {
          const nextStep = steps.find((s) => s.id === step.nextStepId);
          currentStepOrder = nextStep?.stepOrder ?? currentStepOrder + 1;
        } else {
          currentStepOrder++;
        }

        // Update instance state
        instance = (await this.repository.updateInstance(instanceId, {
          currentStepId: steps[currentStepOrder]?.id || null,
          currentStepOrder,
          executionContext,
        }))!;
      }

      // Workflow completed successfully
      instance = (await this.repository.updateInstance(instanceId, {
        status: 'completed',
        completedAt: new Date(),
        executionContext,
      }))!;

      await this.emitWorkflowCompleted(instance, 'completed');
      return instance;
    } catch (error) {
      // Unexpected error - mark workflow as failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      instance = (await this.repository.updateInstance(instanceId, {
        status: 'failed',
        errorMessage,
        errorDetails: { stack: error instanceof Error ? error.stack : undefined },
        completedAt: new Date(),
      }))!;

      await this.emitWorkflowCompleted(instance, 'failed');
      throw error;
    }
  }

  /**
   * Execute a single step
   */
  async executeStep(input: ExecuteStepInput): Promise<StepExecutionResult> {
    const { instance, step, executionContext } = input;
    const startedAt = new Date();

    // Create step execution record
    const execution = await this.createStepExecution(instance.id, step, 'running', executionContext);

    try {
      // Get the action executor
      const executor = this.actionExecutors.get(step.actionType);
      if (!executor) {
        throw new Error(`No executor registered for action type: ${step.actionType}`);
      }

      // Execute the action
      const result = await executor.execute(step, executionContext, this.context);

      // Calculate duration
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      // Update execution record
      await this.repository.updateStepExecution(execution.id, {
        status: result.success ? 'completed' : 'failed',
        outputData: result.outputData,
        completedAt,
        durationMs,
        errorMessage: result.error?.message,
        errorDetails: result.error?.details,
        errorCode: result.error?.code,
      });

      return result;
    } catch (error) {
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.repository.updateStepExecution(execution.id, {
        status: 'failed',
        completedAt,
        durationMs,
        errorMessage,
        errorDetails: { stack: error instanceof Error ? error.stack : undefined },
        errorCode: 'EXECUTION_ERROR',
      });

      return {
        success: false,
        error: {
          message: errorMessage,
          code: 'EXECUTION_ERROR',
        },
        shouldRetry: this.shouldRetryError(error),
      };
    }
  }

  /**
   * Resume a waiting workflow instance
   */
  async resumeWorkflow(instanceId: string, resumeData?: Record<string, unknown>): Promise<WorkflowInstance> {
    const organizationId = this.requireOrganizationContext();

    const instance = await this.repository.findInstanceById(instanceId);
    if (!instance) {
      throw new ServiceError('Workflow instance not found', 'INSTANCE_NOT_FOUND', 404);
    }

    if (instance.organizationId !== organizationId) {
      throw new ServiceError('Workflow instance not found', 'INSTANCE_NOT_FOUND', 404);
    }

    if (instance.status !== 'waiting') {
      throw new ServiceError(
        `Cannot resume workflow in status: ${instance.status}`,
        'INVALID_WORKFLOW_STATUS',
        400
      );
    }

    // Merge resume data into execution context
    if (resumeData) {
      const executionContext = {
        ...(instance.executionContext as Record<string, unknown>),
        _resume: resumeData,
      };
      await this.repository.updateInstance(instanceId, {
        executionContext,
        currentStepOrder: (instance.currentStepOrder || 0) + 1, // Move to next step
      });
    }

    // Continue execution
    return this.executeWorkflow(instanceId);
  }

  /**
   * Cancel a workflow instance
   */
  async cancelWorkflow(instanceId: string, reason?: string): Promise<WorkflowInstance> {
    const organizationId = this.requireOrganizationContext();

    const instance = await this.repository.findInstanceById(instanceId);
    if (!instance) {
      throw new ServiceError('Workflow instance not found', 'INSTANCE_NOT_FOUND', 404);
    }

    if (instance.organizationId !== organizationId) {
      throw new ServiceError('Workflow instance not found', 'INSTANCE_NOT_FOUND', 404);
    }

    if (['completed', 'failed', 'cancelled'].includes(instance.status)) {
      throw new ServiceError(
        `Cannot cancel workflow in status: ${instance.status}`,
        'INVALID_WORKFLOW_STATUS',
        400
      );
    }

    const updated = await this.repository.updateInstance(instanceId, {
      status: 'cancelled',
      completedAt: new Date(),
      errorMessage: reason || 'Cancelled by user',
    });

    await this.emitWorkflowCompleted(updated!, 'cancelled');
    return updated!;
  }

  /**
   * Retry a failed workflow instance
   */
  async retryWorkflow(instanceId: string): Promise<WorkflowInstance> {
    const organizationId = this.requireOrganizationContext();

    const instance = await this.repository.findInstanceById(instanceId);
    if (!instance) {
      throw new ServiceError('Workflow instance not found', 'INSTANCE_NOT_FOUND', 404);
    }

    if (instance.organizationId !== organizationId) {
      throw new ServiceError('Workflow instance not found', 'INSTANCE_NOT_FOUND', 404);
    }

    if (instance.status !== 'failed') {
      throw new ServiceError(
        'Can only retry failed workflows',
        'INVALID_WORKFLOW_STATUS',
        400
      );
    }

    const definition = instance.definitionSnapshot as WorkflowDefinitionWithSteps;
    const maxRetries = definition.maxRetries || DEFAULT_RETRY_CONFIG.maxRetries;

    if (instance.retryCount >= maxRetries) {
      throw new ServiceError(
        `Maximum retries (${maxRetries}) exceeded`,
        'MAX_RETRIES_EXCEEDED',
        400
      );
    }

    // Update retry count and reset status
    await this.repository.updateInstance(instanceId, {
      status: 'pending',
      retryCount: instance.retryCount + 1,
      lastRetryAt: new Date(),
      errorMessage: null,
      errorDetails: null,
    });

    // Re-execute
    return this.executeWorkflow(instanceId);
  }

  // ============================================================================
  // Trigger Handlers
  // ============================================================================

  /**
   * Handle an event trigger
   */
  async handleEventTrigger(
    eventType: string,
    eventData: Record<string, unknown>,
    documentType?: string,
    documentId?: string
  ): Promise<WorkflowInstance[]> {
    const organizationId = this.requireOrganizationContext();

    // Find matching event subscriptions
    const subscriptions = await this.repository.findActiveSubscriptionsForEvent(
      organizationId,
      eventType
    );

    const instances: WorkflowInstance[] = [];

    for (const subscription of subscriptions) {
      // Check document type filter
      if (subscription.documentTypes && documentType) {
        if (!subscription.documentTypes.includes(documentType)) {
          continue;
        }
      }

      // Check conditions
      if (subscription.conditions) {
        if (!this.evaluateConditions(subscription.conditions as TriggerCondition[], eventData)) {
          continue;
        }
      }

      // Start workflow
      try {
        const result = await this.startWorkflow({
          workflowDefinitionId: subscription.workflowDefinitionId,
          triggerType: 'event',
          triggerContext: {
            eventType,
            eventData,
            documentType,
            documentId,
          },
          relatedDocumentType: documentType,
          relatedDocumentId: documentId,
        });

        // Increment subscription trigger count
        await this.repository.incrementSubscriptionTrigger(subscription.id);

        // Execute immediately (or queue for async execution)
        const executed = await this.executeWorkflow(result.instance.id);
        instances.push(executed);
      } catch (error) {
        // Log error but continue with other subscriptions
        console.error(`Failed to trigger workflow for subscription ${subscription.id}:`, error);
      }
    }

    return instances;
  }

  /**
   * Handle a webhook trigger
   */
  async handleWebhookTrigger(
    webhookKey: string,
    payload: Record<string, unknown>,
    headers?: Record<string, string>
  ): Promise<WorkflowInstance> {
    // Find webhook
    const webhook = await this.repository.findWebhookByKey(webhookKey);
    if (!webhook) {
      throw new ServiceError('Webhook not found', 'WEBHOOK_NOT_FOUND', 404);
    }

    if (!webhook.isActive) {
      throw new ServiceError('Webhook is not active', 'WEBHOOK_INACTIVE', 400);
    }

    // Check expiration
    if (webhook.expiresAt && webhook.expiresAt < new Date()) {
      throw new ServiceError('Webhook has expired', 'WEBHOOK_EXPIRED', 400);
    }

    // Set organization context
    this.context.organizationId = webhook.organizationId;

    // Start workflow
    const result = await this.startWorkflow({
      workflowDefinitionId: webhook.workflowDefinitionId,
      triggerType: 'webhook',
      triggerContext: {
        webhookKey,
        payload,
        headers,
      },
    });

    // Increment invocation count
    await this.repository.incrementWebhookInvocation(webhook.id);

    // Execute
    return this.executeWorkflow(result.instance.id);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async createStepExecution(
    instanceId: string,
    step: WorkflowStep,
    status: WorkflowStepExecutionStatus,
    inputData: Record<string, unknown>
  ): Promise<WorkflowStepExecution> {
    return this.repository.createStepExecution({
      workflowInstanceId: instanceId,
      workflowStepId: step.id,
      stepCode: step.stepCode,
      stepOrder: step.stepOrder,
      actionType: step.actionType,
      status,
      inputData,
      startedAt: status === 'running' ? new Date() : undefined,
    });
  }

  private evaluateConditions(conditions: TriggerCondition[], context: Record<string, unknown>): boolean {
    return conditions.every((condition) => {
      const value = this.getValueFromPath(context, condition.field);
      return this.evaluateCondition(condition, value);
    });
  }

  private evaluateCondition(condition: TriggerCondition, value: unknown): boolean {
    const targetValue = condition.value;

    switch (condition.operator) {
      case 'eq':
        return value === targetValue;
      case 'ne':
        return value !== targetValue;
      case 'gt':
        return typeof value === 'number' && typeof targetValue === 'number' && value > targetValue;
      case 'gte':
        return typeof value === 'number' && typeof targetValue === 'number' && value >= targetValue;
      case 'lt':
        return typeof value === 'number' && typeof targetValue === 'number' && value < targetValue;
      case 'lte':
        return typeof value === 'number' && typeof targetValue === 'number' && value <= targetValue;
      case 'in':
        return Array.isArray(targetValue) && targetValue.includes(value);
      case 'not_in':
        return Array.isArray(targetValue) && !targetValue.includes(value);
      case 'contains':
        return typeof value === 'string' && typeof targetValue === 'string' && value.includes(targetValue);
      case 'starts_with':
        return typeof value === 'string' && typeof targetValue === 'string' && value.startsWith(targetValue);
      case 'ends_with':
        return typeof value === 'string' && typeof targetValue === 'string' && value.endsWith(targetValue);
      case 'regex':
        return typeof value === 'string' && typeof targetValue === 'string' && new RegExp(targetValue).test(value);
      default:
        return false;
    }
  }

  private getValueFromPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private async handleStepFailure(
    instance: WorkflowInstance,
    step: WorkflowStep,
    result: StepExecutionResult,
    executionContext: Record<string, unknown>
  ): Promise<{ continue: boolean; nextStepId?: string }> {
    const errorStrategy = step.errorStrategy || 'stop';

    switch (errorStrategy) {
      case 'continue':
        return { continue: true };

      case 'retry':
        if (result.shouldRetry) {
          const maxRetries = step.maxRetries || DEFAULT_RETRY_CONFIG.maxRetries;
          const executions = await this.repository.findStepExecutionsByInstanceId(instance.id);
          const stepRetries = executions.filter(
            (e) => e.workflowStepId === step.id && e.status === 'failed'
          ).length;

          if (stepRetries < maxRetries) {
            // Calculate backoff delay
            const delay = this.calculateBackoffDelay(stepRetries, step.retryDelayMs);
            await new Promise((resolve) => setTimeout(resolve, delay));

            // Retry the step
            const retryResult = await this.executeStep({ instance, step, executionContext });
            if (retryResult.success) {
              return { continue: true };
            }
          }
        }
        return { continue: false };

      case 'branch':
        if (step.onErrorStepId) {
          return { continue: true, nextStepId: step.onErrorStepId };
        }
        return { continue: false };

      case 'stop':
      default:
        return { continue: false };
    }
  }

  private calculateBackoffDelay(retryCount: number, baseDelayMs?: number | null): number {
    const base = baseDelayMs || DEFAULT_RETRY_CONFIG.initialDelayMs;
    const delay = base * Math.pow(DEFAULT_RETRY_CONFIG.backoffMultiplier, retryCount);
    return Math.min(delay, DEFAULT_RETRY_CONFIG.maxDelayMs);
  }

  private shouldRetryError(error: unknown): boolean {
    // Determine if error is retryable (network errors, timeouts, etc.)
    if (error instanceof Error) {
      const retryableErrors = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'NETWORK_ERROR'];
      return retryableErrors.some((code) => error.message.includes(code));
    }
    return false;
  }

  private async emitWorkflowCompleted(
    instance: WorkflowInstance,
    status: 'completed' | 'failed' | 'cancelled'
  ): Promise<void> {
    await this.eventService.emit({
      eventType: `Workflow${status.charAt(0).toUpperCase() + status.slice(1)}`,
      eventCategory: EventCategory.WORKFLOW,
      aggregateId: instance.id,
      aggregateType: 'WorkflowInstance',
      data: {
        workflowDefinitionId: instance.workflowDefinitionId,
        status,
        errorMessage: instance.errorMessage,
        relatedDocumentType: instance.relatedDocumentType,
        relatedDocumentId: instance.relatedDocumentId,
        duration: instance.startedAt && instance.completedAt
          ? instance.completedAt.getTime() - instance.startedAt.getTime()
          : null,
      },
    });
  }
}

// ============================================================================
// Action Executors
// ============================================================================

export interface ActionExecutor {
  execute(
    step: WorkflowStep,
    context: Record<string, unknown>,
    serviceContext: ServiceContext
  ): Promise<StepExecutionResult>;
}

/**
 * Notification Action Executor
 */
class NotificationActionExecutor implements ActionExecutor {
  async execute(
    step: WorkflowStep,
    context: Record<string, unknown>,
    serviceContext: ServiceContext
  ): Promise<StepExecutionResult> {
    const config = step.actionConfig as NotificationActionConfig;

    try {
      // Process template strings in config
      const subject = this.processTemplate(config.subjectTemplate || '', context);
      const body = this.processTemplate(config.bodyTemplate || '', context);

      // In a real implementation, this would send notifications via email, slack, etc.
      // For now, we log the notification and return success
      console.log(`[Notification] Channels: ${config.channels.join(', ')}`);
      console.log(`[Notification] Subject: ${subject}`);
      console.log(`[Notification] Body: ${body}`);

      // TODO: Integrate with actual notification services
      // - Email: SendGrid, SES, etc.
      // - Slack: Slack API
      // - In-app: Push notification service
      // - SMS: Twilio, etc.

      return {
        success: true,
        outputData: {
          notificationSent: true,
          channels: config.channels,
          subject,
          sentAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Notification failed',
          code: 'NOTIFICATION_FAILED',
        },
      };
    }
  }

  private processTemplate(template: string, context: Record<string, unknown>): string {
    // Simple template processing - replace {{path}} with values from context
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getValueFromPath(context, path.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  private getValueFromPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }
}

/**
 * Internal Action Executor
 */
class InternalActionExecutor implements ActionExecutor {
  private actionRegistry: Map<string, InternalAction> = new Map();

  constructor() {
    // Register built-in internal actions
    this.registerAction('logMessage', async (params) => {
      console.log('[InternalAction] Log:', params.message);
      return { logged: true };
    });

    this.registerAction('updateContext', async (params, context) => {
      return { ...context, ...params };
    });
  }

  registerAction(name: string, action: InternalAction): void {
    this.actionRegistry.set(name, action);
  }

  async execute(
    step: WorkflowStep,
    context: Record<string, unknown>,
    serviceContext: ServiceContext
  ): Promise<StepExecutionResult> {
    const config = step.actionConfig as InternalActionConfig;

    const action = this.actionRegistry.get(config.actionName);
    if (!action) {
      return {
        success: false,
        error: {
          message: `Unknown internal action: ${config.actionName}`,
          code: 'UNKNOWN_ACTION',
        },
      };
    }

    try {
      // Process parameter templates
      const params: Record<string, unknown> = {};
      if (config.parameters) {
        Object.assign(params, config.parameters);
      }
      if (config.parameterTemplates) {
        for (const [key, template] of Object.entries(config.parameterTemplates)) {
          params[key] = this.processTemplate(template, context);
        }
      }

      const result = await action(params, context, serviceContext);

      return {
        success: true,
        outputData: result,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal action failed',
          code: 'INTERNAL_ACTION_FAILED',
        },
      };
    }
  }

  private processTemplate(template: string, context: Record<string, unknown>): unknown {
    // If template is exactly {{path}}, return the actual value
    const exactMatch = template.match(/^\{\{([^}]+)\}\}$/);
    if (exactMatch) {
      return this.getValueFromPath(context, exactMatch[1].trim());
    }

    // Otherwise, do string replacement
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getValueFromPath(context, path.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  private getValueFromPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }
}

type InternalAction = (
  params: Record<string, unknown>,
  context: Record<string, unknown>,
  serviceContext: ServiceContext
) => Promise<Record<string, unknown>>;

/**
 * Condition Action Executor
 */
class ConditionActionExecutor implements ActionExecutor {
  async execute(
    step: WorkflowStep,
    context: Record<string, unknown>,
    serviceContext: ServiceContext
  ): Promise<StepExecutionResult> {
    const config = step.actionConfig as ConditionActionConfig;

    // Evaluate conditions in order
    for (const branch of config.conditions) {
      if (this.evaluateConditions(branch.condition, context)) {
        return {
          success: true,
          outputData: {
            branch: branch.branchName || 'matched',
            conditionMet: true,
          },
          nextStepId: branch.nextStepId,
        };
      }
    }

    // No conditions matched - use default
    return {
      success: true,
      outputData: {
        branch: config.defaultBranchName || 'default',
        conditionMet: false,
      },
      nextStepId: config.defaultNextStepId,
    };
  }

  private evaluateConditions(conditions: TriggerCondition[], context: Record<string, unknown>): boolean {
    return conditions.every((condition) => {
      const value = this.getValueFromPath(context, condition.field);
      return this.evaluateCondition(condition, value);
    });
  }

  private evaluateCondition(condition: TriggerCondition, value: unknown): boolean {
    const targetValue = condition.value;

    switch (condition.operator) {
      case 'eq':
        return value === targetValue;
      case 'ne':
        return value !== targetValue;
      case 'gt':
        return typeof value === 'number' && typeof targetValue === 'number' && value > targetValue;
      case 'gte':
        return typeof value === 'number' && typeof targetValue === 'number' && value >= targetValue;
      case 'lt':
        return typeof value === 'number' && typeof targetValue === 'number' && value < targetValue;
      case 'lte':
        return typeof value === 'number' && typeof targetValue === 'number' && value <= targetValue;
      case 'in':
        return Array.isArray(targetValue) && targetValue.includes(value);
      case 'not_in':
        return Array.isArray(targetValue) && !targetValue.includes(value);
      default:
        return false;
    }
  }

  private getValueFromPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }
}

/**
 * Delay Action Executor
 */
class DelayActionExecutor implements ActionExecutor {
  async execute(
    step: WorkflowStep,
    context: Record<string, unknown>,
    serviceContext: ServiceContext
  ): Promise<StepExecutionResult> {
    const config = step.actionConfig as DelayActionConfig;

    switch (config.delayType) {
      case 'fixed':
        if (config.durationMs) {
          // For short delays, wait inline
          if (config.durationMs <= 30000) {
            await new Promise((resolve) => setTimeout(resolve, config.durationMs));
            return {
              success: true,
              outputData: { delayed: true, durationMs: config.durationMs },
            };
          }
          // For longer delays, mark as waiting
          return {
            success: true,
            shouldWait: true,
            waitUntil: new Date(Date.now() + config.durationMs),
            outputData: { scheduledResume: new Date(Date.now() + config.durationMs).toISOString() },
          };
        }
        break;

      case 'until_time':
        if (config.untilTime) {
          const targetTime = new Date(config.untilTime);
          if (targetTime > new Date()) {
            return {
              success: true,
              shouldWait: true,
              waitUntil: targetTime,
              outputData: { scheduledResume: targetTime.toISOString() },
            };
          }
        }
        break;

      case 'until_condition':
        // This would need a polling mechanism - mark as waiting
        return {
          success: true,
          shouldWait: true,
          outputData: {
            waitingFor: 'condition',
            condition: config.untilCondition,
          },
        };
    }

    return { success: true, outputData: { delayed: false } };
  }
}

/**
 * Transform Action Executor
 */
class TransformActionExecutor implements ActionExecutor {
  async execute(
    step: WorkflowStep,
    context: Record<string, unknown>,
    serviceContext: ServiceContext
  ): Promise<StepExecutionResult> {
    const config = step.actionConfig as TransformActionConfig;
    const output: Record<string, unknown> = {};

    try {
      for (const transformation of config.transformations) {
        let value = this.getValueFromPath(context, transformation.source);

        // Apply transformation
        if (transformation.transform && value !== undefined) {
          switch (transformation.transform) {
            case 'uppercase':
              value = typeof value === 'string' ? value.toUpperCase() : value;
              break;
            case 'lowercase':
              value = typeof value === 'string' ? value.toLowerCase() : value;
              break;
            case 'trim':
              value = typeof value === 'string' ? value.trim() : value;
              break;
            case 'json_parse':
              value = typeof value === 'string' ? JSON.parse(value) : value;
              break;
            case 'json_stringify':
              value = JSON.stringify(value);
              break;
            case 'number':
              value = Number(value);
              break;
            case 'string':
              value = String(value);
              break;
            case 'date':
              value = new Date(value as string).toISOString();
              break;
          }
        }

        // Set value at target path
        this.setValueAtPath(output, transformation.target, value);
      }

      return {
        success: true,
        outputData: output,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Transform failed',
          code: 'TRANSFORM_FAILED',
        },
      };
    }
  }

  private getValueFromPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  private setValueAtPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createWorkflowExecutionService(
  organizationId?: string,
  userId?: string
): WorkflowExecutionService {
  return new WorkflowExecutionService({ organizationId, userId });
}
