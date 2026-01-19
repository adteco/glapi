import { and, eq, desc, asc, inArray, sql, isNull, lt, lte, gte } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  workflowDefinitions,
  workflowSteps,
  workflowInstances,
  workflowStepExecutions,
  workflowWebhooks,
  workflowSchedules,
  workflowEventSubscriptions,
  WorkflowDefinition,
  NewWorkflowDefinition,
  WorkflowStep,
  NewWorkflowStep,
  WorkflowInstance,
  NewWorkflowInstance,
  WorkflowStepExecution,
  NewWorkflowStepExecution,
  WorkflowWebhook,
  NewWorkflowWebhook,
  WorkflowSchedule,
  NewWorkflowSchedule,
  WorkflowEventSubscription,
  NewWorkflowEventSubscription,
  WorkflowDefinitionStatus,
  WorkflowInstanceStatus,
  WorkflowStepExecutionStatus,
  WorkflowTriggerType,
} from '../db/schema';

// ============================================================================
// Extended Types
// ============================================================================

export interface WorkflowDefinitionWithSteps extends WorkflowDefinition {
  steps: WorkflowStep[];
}

export interface WorkflowInstanceWithExecutions extends WorkflowInstance {
  stepExecutions: WorkflowStepExecution[];
}

export interface UpdateWorkflowDefinition {
  name?: string;
  description?: string;
  status?: WorkflowDefinitionStatus;
  triggerConfig?: Record<string, unknown>;
  maxExecutionTimeMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  enableLogging?: boolean;
  enableMetrics?: boolean;
  tags?: string[];
  category?: string;
  updatedBy?: string;
  publishedAt?: Date;
  publishedBy?: string;
}

export interface UpdateWorkflowInstance {
  status?: WorkflowInstanceStatus;
  currentStepId?: string | null;
  currentStepOrder?: number | null;
  executionContext?: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string | null;
  errorDetails?: Record<string, unknown> | null;
  retryCount?: number;
  lastRetryAt?: Date;
}

export interface UpdateWorkflowStepExecution {
  status?: WorkflowStepExecutionStatus;
  outputData?: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  errorMessage?: string | null;
  errorDetails?: Record<string, unknown> | null;
  errorCode?: string | null;
  retryCount?: number;
  lastRetryAt?: Date;
  externalRequestId?: string;
  externalResponseCode?: number;
  externalResponseBody?: Record<string, unknown>;
}

// ============================================================================
// Repository
// ============================================================================

export class WorkflowAutomationRepository extends BaseRepository {
  // ============================================================================
  // WORKFLOW DEFINITIONS
  // ============================================================================

  /**
   * Create a new workflow definition
   */
  async createDefinition(data: NewWorkflowDefinition): Promise<WorkflowDefinition> {
    const [result] = await this.db
      .insert(workflowDefinitions)
      .values(data)
      .returning();

    return result;
  }

  /**
   * Find a workflow definition by ID
   */
  async findDefinitionById(definitionId: string): Promise<WorkflowDefinition | null> {
    const [result] = await this.db
      .select()
      .from(workflowDefinitions)
      .where(eq(workflowDefinitions.id, definitionId))
      .limit(1);

    return result || null;
  }

  /**
   * Find a workflow definition with its steps
   */
  async findDefinitionWithSteps(definitionId: string): Promise<WorkflowDefinitionWithSteps | null> {
    const definition = await this.findDefinitionById(definitionId);
    if (!definition) return null;

    const steps = await this.db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.workflowDefinitionId, definitionId))
      .orderBy(asc(workflowSteps.stepOrder));

    return { ...definition, steps };
  }

  /**
   * Find the latest version of a workflow by code
   */
  async findLatestDefinitionByCode(
    organizationId: string,
    workflowCode: string
  ): Promise<WorkflowDefinitionWithSteps | null> {
    const [definition] = await this.db
      .select()
      .from(workflowDefinitions)
      .where(
        and(
          eq(workflowDefinitions.organizationId, organizationId),
          eq(workflowDefinitions.workflowCode, workflowCode),
          eq(workflowDefinitions.isLatestVersion, true)
        )
      )
      .limit(1);

    if (!definition) return null;

    const steps = await this.db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.workflowDefinitionId, definition.id))
      .orderBy(asc(workflowSteps.stepOrder));

    return { ...definition, steps };
  }

  /**
   * Find all workflow definitions for an organization
   */
  async findAllDefinitions(
    organizationId: string,
    options?: {
      status?: WorkflowDefinitionStatus;
      latestOnly?: boolean;
      category?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<WorkflowDefinition[]> {
    const conditions = [eq(workflowDefinitions.organizationId, organizationId)];

    if (options?.status) {
      conditions.push(eq(workflowDefinitions.status, options.status));
    }

    if (options?.latestOnly !== false) {
      conditions.push(eq(workflowDefinitions.isLatestVersion, true));
    }

    if (options?.category) {
      conditions.push(eq(workflowDefinitions.category, options.category));
    }

    let query = this.db
      .select()
      .from(workflowDefinitions)
      .where(and(...conditions))
      .orderBy(desc(workflowDefinitions.updatedAt));

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return await query;
  }

  /**
   * Find active workflows by trigger type
   */
  async findActiveDefinitionsByTriggerType(
    organizationId: string,
    triggerType: WorkflowTriggerType
  ): Promise<WorkflowDefinitionWithSteps[]> {
    const definitions = await this.db
      .select()
      .from(workflowDefinitions)
      .where(
        and(
          eq(workflowDefinitions.organizationId, organizationId),
          eq(workflowDefinitions.triggerType, triggerType),
          eq(workflowDefinitions.status, 'active'),
          eq(workflowDefinitions.isLatestVersion, true)
        )
      );

    // Get steps for all definitions
    const definitionIds = definitions.map((d) => d.id);
    if (definitionIds.length === 0) return [];

    const allSteps = await this.db
      .select()
      .from(workflowSteps)
      .where(inArray(workflowSteps.workflowDefinitionId, definitionIds))
      .orderBy(asc(workflowSteps.stepOrder));

    // Group steps by definition
    const stepsByDefinition = new Map<string, WorkflowStep[]>();
    for (const step of allSteps) {
      const existing = stepsByDefinition.get(step.workflowDefinitionId) || [];
      existing.push(step);
      stepsByDefinition.set(step.workflowDefinitionId, existing);
    }

    return definitions.map((def) => ({
      ...def,
      steps: stepsByDefinition.get(def.id) || [],
    }));
  }

  /**
   * Update a workflow definition
   */
  async updateDefinition(
    definitionId: string,
    data: UpdateWorkflowDefinition
  ): Promise<WorkflowDefinition | null> {
    const [result] = await this.db
      .update(workflowDefinitions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workflowDefinitions.id, definitionId))
      .returning();

    return result || null;
  }

  /**
   * Create a new version of a workflow definition
   */
  async createNewVersion(
    previousVersionId: string,
    organizationId: string
  ): Promise<WorkflowDefinitionWithSteps | null> {
    // Get the previous version with steps
    const previousVersion = await this.findDefinitionWithSteps(previousVersionId);
    if (!previousVersion) return null;

    // Mark previous version as not latest
    await this.db
      .update(workflowDefinitions)
      .set({ isLatestVersion: false, updatedAt: new Date() })
      .where(eq(workflowDefinitions.id, previousVersionId));

    // Create new version
    const newVersion = await this.createDefinition({
      organizationId,
      name: previousVersion.name,
      description: previousVersion.description,
      workflowCode: previousVersion.workflowCode,
      version: previousVersion.version + 1,
      isLatestVersion: true,
      previousVersionId,
      status: 'draft',
      triggerType: previousVersion.triggerType,
      triggerConfig: previousVersion.triggerConfig,
      maxExecutionTimeMs: previousVersion.maxExecutionTimeMs,
      maxRetries: previousVersion.maxRetries,
      retryDelayMs: previousVersion.retryDelayMs,
      enableLogging: previousVersion.enableLogging,
      enableMetrics: previousVersion.enableMetrics,
      tags: previousVersion.tags,
      category: previousVersion.category,
    });

    // Copy steps to new version
    const newSteps = await this.createSteps(
      previousVersion.steps.map((step) => ({
        workflowDefinitionId: newVersion.id,
        stepCode: step.stepCode,
        stepName: step.stepName,
        description: step.description,
        stepOrder: step.stepOrder,
        actionType: step.actionType,
        actionConfig: step.actionConfig,
        nextStepId: null, // Will need to be remapped
        onErrorStepId: null, // Will need to be remapped
        errorStrategy: step.errorStrategy,
        maxRetries: step.maxRetries,
        retryDelayMs: step.retryDelayMs,
        timeoutMs: step.timeoutMs,
        skipConditions: step.skipConditions,
        uiPosition: step.uiPosition,
      }))
    );

    return { ...newVersion, steps: newSteps };
  }

  /**
   * Delete a workflow definition (soft delete by archiving)
   */
  async archiveDefinition(definitionId: string): Promise<boolean> {
    const result = await this.db
      .update(workflowDefinitions)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(workflowDefinitions.id, definitionId));

    return result.rowCount !== null && result.rowCount > 0;
  }

  // ============================================================================
  // WORKFLOW STEPS
  // ============================================================================

  /**
   * Create workflow steps
   */
  async createSteps(steps: NewWorkflowStep[]): Promise<WorkflowStep[]> {
    if (steps.length === 0) return [];

    return await this.db
      .insert(workflowSteps)
      .values(steps)
      .returning();
  }

  /**
   * Find steps by workflow definition ID
   */
  async findStepsByDefinitionId(definitionId: string): Promise<WorkflowStep[]> {
    return await this.db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.workflowDefinitionId, definitionId))
      .orderBy(asc(workflowSteps.stepOrder));
  }

  /**
   * Find a step by ID
   */
  async findStepById(stepId: string): Promise<WorkflowStep | null> {
    const [result] = await this.db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.id, stepId))
      .limit(1);

    return result || null;
  }

  /**
   * Find the first step of a workflow
   */
  async findFirstStep(definitionId: string): Promise<WorkflowStep | null> {
    const [result] = await this.db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.workflowDefinitionId, definitionId))
      .orderBy(asc(workflowSteps.stepOrder))
      .limit(1);

    return result || null;
  }

  /**
   * Delete steps by workflow definition ID
   */
  async deleteStepsByDefinitionId(definitionId: string): Promise<void> {
    await this.db
      .delete(workflowSteps)
      .where(eq(workflowSteps.workflowDefinitionId, definitionId));
  }

  // ============================================================================
  // WORKFLOW INSTANCES
  // ============================================================================

  /**
   * Create a new workflow instance
   */
  async createInstance(data: NewWorkflowInstance): Promise<WorkflowInstance> {
    const [result] = await this.db
      .insert(workflowInstances)
      .values(data)
      .returning();

    return result;
  }

  /**
   * Find an instance by ID
   */
  async findInstanceById(instanceId: string): Promise<WorkflowInstance | null> {
    const [result] = await this.db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, instanceId))
      .limit(1);

    return result || null;
  }

  /**
   * Find an instance with its step executions
   */
  async findInstanceWithExecutions(instanceId: string): Promise<WorkflowInstanceWithExecutions | null> {
    const instance = await this.findInstanceById(instanceId);
    if (!instance) return null;

    const stepExecutions = await this.db
      .select()
      .from(workflowStepExecutions)
      .where(eq(workflowStepExecutions.workflowInstanceId, instanceId))
      .orderBy(asc(workflowStepExecutions.stepOrder));

    return { ...instance, stepExecutions };
  }

  /**
   * Find instances by status
   */
  async findInstancesByStatus(
    organizationId: string,
    status: WorkflowInstanceStatus | WorkflowInstanceStatus[],
    limit = 100
  ): Promise<WorkflowInstance[]> {
    const statusArray = Array.isArray(status) ? status : [status];

    return await this.db
      .select()
      .from(workflowInstances)
      .where(
        and(
          eq(workflowInstances.organizationId, organizationId),
          inArray(workflowInstances.status, statusArray)
        )
      )
      .orderBy(desc(workflowInstances.createdAt))
      .limit(limit);
  }

  /**
   * Find instances by related document
   */
  async findInstancesByDocument(
    documentType: string,
    documentId: string
  ): Promise<WorkflowInstance[]> {
    return await this.db
      .select()
      .from(workflowInstances)
      .where(
        and(
          eq(workflowInstances.relatedDocumentType, documentType),
          eq(workflowInstances.relatedDocumentId, documentId)
        )
      )
      .orderBy(desc(workflowInstances.createdAt));
  }

  /**
   * Find instances that have timed out
   */
  async findTimedOutInstances(beforeDate: Date): Promise<WorkflowInstance[]> {
    return await this.db
      .select()
      .from(workflowInstances)
      .where(
        and(
          inArray(workflowInstances.status, ['running', 'waiting']),
          lt(workflowInstances.startedAt, beforeDate)
        )
      );
  }

  /**
   * Find instances needing retry
   */
  async findInstancesForRetry(maxRetries: number): Promise<WorkflowInstance[]> {
    return await this.db
      .select()
      .from(workflowInstances)
      .where(
        and(
          eq(workflowInstances.status, 'failed'),
          lt(workflowInstances.retryCount, maxRetries)
        )
      )
      .orderBy(asc(workflowInstances.lastRetryAt))
      .limit(100);
  }

  /**
   * Update an instance
   */
  async updateInstance(
    instanceId: string,
    data: UpdateWorkflowInstance
  ): Promise<WorkflowInstance | null> {
    const [result] = await this.db
      .update(workflowInstances)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workflowInstances.id, instanceId))
      .returning();

    return result || null;
  }

  // ============================================================================
  // WORKFLOW STEP EXECUTIONS
  // ============================================================================

  /**
   * Create a step execution record
   */
  async createStepExecution(data: NewWorkflowStepExecution): Promise<WorkflowStepExecution> {
    const [result] = await this.db
      .insert(workflowStepExecutions)
      .values(data)
      .returning();

    return result;
  }

  /**
   * Find step executions for an instance
   */
  async findStepExecutionsByInstanceId(instanceId: string): Promise<WorkflowStepExecution[]> {
    return await this.db
      .select()
      .from(workflowStepExecutions)
      .where(eq(workflowStepExecutions.workflowInstanceId, instanceId))
      .orderBy(asc(workflowStepExecutions.stepOrder));
  }

  /**
   * Find a step execution by ID
   */
  async findStepExecutionById(executionId: string): Promise<WorkflowStepExecution | null> {
    const [result] = await this.db
      .select()
      .from(workflowStepExecutions)
      .where(eq(workflowStepExecutions.id, executionId))
      .limit(1);

    return result || null;
  }

  /**
   * Update a step execution
   */
  async updateStepExecution(
    executionId: string,
    data: UpdateWorkflowStepExecution
  ): Promise<WorkflowStepExecution | null> {
    const [result] = await this.db
      .update(workflowStepExecutions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workflowStepExecutions.id, executionId))
      .returning();

    return result || null;
  }

  /**
   * Find failed step executions for retry
   */
  async findFailedStepExecutionsForRetry(
    instanceId: string,
    maxRetries: number
  ): Promise<WorkflowStepExecution[]> {
    return await this.db
      .select()
      .from(workflowStepExecutions)
      .where(
        and(
          eq(workflowStepExecutions.workflowInstanceId, instanceId),
          eq(workflowStepExecutions.status, 'failed'),
          lt(workflowStepExecutions.retryCount, maxRetries)
        )
      );
  }

  // ============================================================================
  // WORKFLOW WEBHOOKS
  // ============================================================================

  /**
   * Create a webhook
   */
  async createWebhook(data: NewWorkflowWebhook): Promise<WorkflowWebhook> {
    const [result] = await this.db
      .insert(workflowWebhooks)
      .values(data)
      .returning();

    return result;
  }

  /**
   * Find a webhook by key
   */
  async findWebhookByKey(webhookKey: string): Promise<WorkflowWebhook | null> {
    const [result] = await this.db
      .select()
      .from(workflowWebhooks)
      .where(eq(workflowWebhooks.webhookKey, webhookKey))
      .limit(1);

    return result || null;
  }

  /**
   * Find webhooks by workflow definition
   */
  async findWebhooksByDefinitionId(definitionId: string): Promise<WorkflowWebhook[]> {
    return await this.db
      .select()
      .from(workflowWebhooks)
      .where(eq(workflowWebhooks.workflowDefinitionId, definitionId));
  }

  /**
   * Increment webhook invocation count
   */
  async incrementWebhookInvocation(webhookId: string): Promise<void> {
    await this.db
      .update(workflowWebhooks)
      .set({
        totalInvocations: sql`${workflowWebhooks.totalInvocations} + 1`,
        lastInvokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workflowWebhooks.id, webhookId));
  }

  // ============================================================================
  // WORKFLOW SCHEDULES
  // ============================================================================

  /**
   * Create a schedule
   */
  async createSchedule(data: NewWorkflowSchedule): Promise<WorkflowSchedule> {
    const [result] = await this.db
      .insert(workflowSchedules)
      .values(data)
      .returning();

    return result;
  }

  /**
   * Find schedules due for execution
   */
  async findDueSchedules(beforeDate: Date): Promise<WorkflowSchedule[]> {
    return await this.db
      .select()
      .from(workflowSchedules)
      .where(
        and(
          eq(workflowSchedules.isActive, true),
          lte(workflowSchedules.nextScheduledAt, beforeDate)
        )
      )
      .orderBy(asc(workflowSchedules.nextScheduledAt));
  }

  /**
   * Find schedules by workflow definition
   */
  async findSchedulesByDefinitionId(definitionId: string): Promise<WorkflowSchedule[]> {
    return await this.db
      .select()
      .from(workflowSchedules)
      .where(eq(workflowSchedules.workflowDefinitionId, definitionId));
  }

  /**
   * Update schedule after execution
   */
  async updateScheduleAfterExecution(
    scheduleId: string,
    nextScheduledAt: Date,
    lastInstanceId: string,
    success: boolean
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      lastScheduledAt: new Date(),
      nextScheduledAt,
      lastInstanceId,
      totalExecutions: sql`${workflowSchedules.totalExecutions} + 1`,
      updatedAt: new Date(),
    };

    if (success) {
      updates.successfulExecutions = sql`${workflowSchedules.successfulExecutions} + 1`;
    } else {
      updates.failedExecutions = sql`${workflowSchedules.failedExecutions} + 1`;
    }

    await this.db
      .update(workflowSchedules)
      .set(updates)
      .where(eq(workflowSchedules.id, scheduleId));
  }

  // ============================================================================
  // WORKFLOW EVENT SUBSCRIPTIONS
  // ============================================================================

  /**
   * Create an event subscription
   */
  async createEventSubscription(data: NewWorkflowEventSubscription): Promise<WorkflowEventSubscription> {
    const [result] = await this.db
      .insert(workflowEventSubscriptions)
      .values(data)
      .returning();

    return result;
  }

  /**
   * Find active subscriptions for an event type
   */
  async findActiveSubscriptionsForEvent(
    organizationId: string,
    eventType: string
  ): Promise<WorkflowEventSubscription[]> {
    return await this.db
      .select()
      .from(workflowEventSubscriptions)
      .where(
        and(
          eq(workflowEventSubscriptions.organizationId, organizationId),
          eq(workflowEventSubscriptions.eventType, eventType),
          eq(workflowEventSubscriptions.isActive, true)
        )
      );
  }

  /**
   * Find subscriptions by workflow definition
   */
  async findSubscriptionsByDefinitionId(definitionId: string): Promise<WorkflowEventSubscription[]> {
    return await this.db
      .select()
      .from(workflowEventSubscriptions)
      .where(eq(workflowEventSubscriptions.workflowDefinitionId, definitionId));
  }

  /**
   * Increment subscription trigger count
   */
  async incrementSubscriptionTrigger(subscriptionId: string): Promise<void> {
    await this.db
      .update(workflowEventSubscriptions)
      .set({
        totalTriggers: sql`${workflowEventSubscriptions.totalTriggers} + 1`,
        lastTriggeredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workflowEventSubscriptions.id, subscriptionId));
  }

  /**
   * Update subscription active status
   */
  async updateSubscriptionStatus(subscriptionId: string, isActive: boolean): Promise<void> {
    await this.db
      .update(workflowEventSubscriptions)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(workflowEventSubscriptions.id, subscriptionId));
  }
}

// Export singleton factory
export function createWorkflowAutomationRepository(): WorkflowAutomationRepository {
  return new WorkflowAutomationRepository();
}
