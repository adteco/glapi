/**
 * Workflow Management Service
 *
 * Provides CRUD operations for workflow definitions, steps, and execution history.
 * This service is used by the frontend UI for managing workflows.
 */

import { BaseService } from './base-service';
import { ServiceError, ServiceContext, PaginationParams, PaginatedResult } from '../types';
import {
  WorkflowAutomationRepository,
  workflowAutomationRepository,
} from '@glapi/database';
import type {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowInstance,
  WorkflowStepExecution,
  WorkflowTriggerType,
  WorkflowActionType,
  WorkflowDefinitionStatus,
  WorkflowInstanceStatus,
  WorkflowErrorStrategy,
  EventTriggerConfig,
  ScheduleTriggerConfig,
  WebhookTriggerConfig,
  ManualTriggerConfig,
  NewWorkflowDefinition,
  NewWorkflowStep,
} from '@glapi/database/schema';

// ============================================================================
// Types
// ============================================================================

export interface WorkflowDefinitionWithSteps extends WorkflowDefinition {
  steps: WorkflowStep[];
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  workflowCode: string;
  triggerType: WorkflowTriggerType;
  triggerConfig: EventTriggerConfig | ScheduleTriggerConfig | WebhookTriggerConfig | ManualTriggerConfig;
  maxExecutionTimeMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  enableLogging?: boolean;
  enableMetrics?: boolean;
  tags?: string[];
  category?: string;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  triggerType?: WorkflowTriggerType;
  triggerConfig?: EventTriggerConfig | ScheduleTriggerConfig | WebhookTriggerConfig | ManualTriggerConfig;
  maxExecutionTimeMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  enableLogging?: boolean;
  enableMetrics?: boolean;
  tags?: string[];
  category?: string;
}

export interface CreateStepInput {
  stepCode: string;
  stepName: string;
  description?: string;
  stepOrder: number;
  actionType: WorkflowActionType;
  actionConfig: Record<string, unknown>;
  nextStepId?: string;
  onErrorStepId?: string;
  errorStrategy?: WorkflowErrorStrategy;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  skipConditions?: Array<{
    field: string;
    operator: string;
    value: unknown;
  }>;
  uiPosition?: { x: number; y: number };
}

export interface UpdateStepInput {
  stepName?: string;
  description?: string;
  stepOrder?: number;
  actionType?: WorkflowActionType;
  actionConfig?: Record<string, unknown>;
  nextStepId?: string | null;
  onErrorStepId?: string | null;
  errorStrategy?: WorkflowErrorStrategy;
  maxRetries?: number | null;
  retryDelayMs?: number | null;
  timeoutMs?: number | null;
  skipConditions?: Array<{
    field: string;
    operator: string;
    value: unknown;
  }> | null;
  uiPosition?: { x: number; y: number } | null;
}

export interface WorkflowListFilters {
  status?: WorkflowDefinitionStatus;
  triggerType?: WorkflowTriggerType;
  category?: string;
  search?: string;
  tags?: string[];
}

export interface ExecutionListFilters {
  workflowDefinitionId?: string;
  status?: WorkflowInstanceStatus | WorkflowInstanceStatus[];
  fromDate?: Date;
  toDate?: Date;
  relatedDocumentType?: string;
  relatedDocumentId?: string;
}

export interface ExecutionWithSteps extends WorkflowInstance {
  definition?: WorkflowDefinition;
  stepExecutions: WorkflowStepExecution[];
}

// ============================================================================
// Service
// ============================================================================

export class WorkflowManagementService extends BaseService {
  private repository: WorkflowAutomationRepository;

  constructor(context: ServiceContext = {}) {
    super(context);
    this.repository = workflowAutomationRepository;
  }

  // -------------------------------------------------------------------------
  // Workflow Definition CRUD
  // -------------------------------------------------------------------------

  /**
   * List workflow definitions with pagination and filtering
   */
  async listWorkflows(
    params: PaginationParams & WorkflowListFilters = {}
  ): Promise<PaginatedResult<WorkflowDefinitionWithSteps>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(params);

    // Get all definitions (latest versions only by default)
    const allDefinitions = await this.repository.findAllDefinitions(organizationId, {
      status: params.status,
      latestOnly: true,
    });

    // Apply filters
    let filtered = allDefinitions;

    if (params.triggerType) {
      filtered = filtered.filter((d) => d.triggerType === params.triggerType);
    }

    if (params.category) {
      filtered = filtered.filter((d) => d.category === params.category);
    }

    if (params.search) {
      const searchLower = params.search.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.name.toLowerCase().includes(searchLower) ||
          d.workflowCode.toLowerCase().includes(searchLower) ||
          (d.description && d.description.toLowerCase().includes(searchLower))
      );
    }

    if (params.tags && params.tags.length > 0) {
      filtered = filtered.filter((d) => {
        const defTags = (d.tags as string[]) || [];
        return params.tags!.some((tag) => defTags.includes(tag));
      });
    }

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + take);

    // Enrich with steps
    const enriched = await Promise.all(
      paginated.map(async (def) => {
        const withSteps = await this.repository.findDefinitionWithSteps(def.id);
        return withSteps as WorkflowDefinitionWithSteps;
      })
    );

    return this.createPaginatedResult(enriched.filter(Boolean) as WorkflowDefinitionWithSteps[], total, page, limit);
  }

  /**
   * Get a single workflow definition by ID
   */
  async getWorkflow(id: string): Promise<WorkflowDefinitionWithSteps | null> {
    const organizationId = this.requireOrganizationContext();

    const workflow = await this.repository.findDefinitionWithSteps(id);
    if (!workflow || workflow.organizationId !== organizationId) {
      return null;
    }

    return workflow as WorkflowDefinitionWithSteps;
  }

  /**
   * Get a workflow definition by code (latest version)
   */
  async getWorkflowByCode(workflowCode: string): Promise<WorkflowDefinitionWithSteps | null> {
    const organizationId = this.requireOrganizationContext();

    const workflow = await this.repository.findLatestDefinitionByCode(organizationId, workflowCode);
    return workflow as WorkflowDefinitionWithSteps | null;
  }

  /**
   * Create a new workflow definition
   */
  async createWorkflow(input: CreateWorkflowInput): Promise<WorkflowDefinitionWithSteps> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;

    // Check if workflow code already exists
    const existing = await this.repository.findLatestDefinitionByCode(organizationId, input.workflowCode);
    if (existing) {
      throw new ServiceError(
        `Workflow with code "${input.workflowCode}" already exists`,
        'WORKFLOW_CODE_EXISTS',
        400
      );
    }

    const definitionData: NewWorkflowDefinition = {
      organizationId,
      name: input.name,
      description: input.description,
      workflowCode: input.workflowCode,
      triggerType: input.triggerType,
      triggerConfig: input.triggerConfig,
      maxExecutionTimeMs: input.maxExecutionTimeMs,
      maxRetries: input.maxRetries,
      retryDelayMs: input.retryDelayMs,
      enableLogging: input.enableLogging ?? true,
      enableMetrics: input.enableMetrics ?? true,
      tags: input.tags || [],
      category: input.category,
      status: 'draft',
      version: 1,
      isLatestVersion: true,
      createdBy: userId,
      updatedBy: userId,
    };

    const definition = await this.repository.createDefinition(definitionData);

    return {
      ...definition,
      steps: [],
    };
  }

  /**
   * Update a workflow definition
   */
  async updateWorkflow(id: string, input: UpdateWorkflowInput): Promise<WorkflowDefinitionWithSteps> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;

    const existing = await this.repository.findDefinitionById(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new ServiceError('Workflow not found', 'WORKFLOW_NOT_FOUND', 404);
    }

    // Don't allow editing active workflows directly - should create new version
    if (existing.status === 'active') {
      throw new ServiceError(
        'Cannot edit an active workflow. Create a new version instead.',
        'WORKFLOW_ACTIVE',
        400
      );
    }

    const updateData: Partial<WorkflowDefinition> = {
      ...input,
      updatedBy: userId,
      updatedAt: new Date(),
    };

    const updated = await this.repository.updateDefinition(id, updateData);
    if (!updated) {
      throw new ServiceError('Failed to update workflow', 'UPDATE_FAILED', 500);
    }

    return (await this.repository.findDefinitionWithSteps(id)) as WorkflowDefinitionWithSteps;
  }

  /**
   * Delete a workflow definition
   */
  async deleteWorkflow(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    const existing = await this.repository.findDefinitionById(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new ServiceError('Workflow not found', 'WORKFLOW_NOT_FOUND', 404);
    }

    // Don't allow deleting active workflows
    if (existing.status === 'active') {
      throw new ServiceError(
        'Cannot delete an active workflow. Archive it first.',
        'WORKFLOW_ACTIVE',
        400
      );
    }

    await this.repository.deleteDefinition(id);
  }

  /**
   * Publish a workflow (change status from draft to active)
   */
  async publishWorkflow(id: string): Promise<WorkflowDefinitionWithSteps> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;

    const existing = await this.repository.findDefinitionWithSteps(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new ServiceError('Workflow not found', 'WORKFLOW_NOT_FOUND', 404);
    }

    if (existing.status !== 'draft') {
      throw new ServiceError(
        `Cannot publish workflow with status "${existing.status}"`,
        'INVALID_STATUS',
        400
      );
    }

    // Validate workflow has at least one step
    if (!existing.steps || existing.steps.length === 0) {
      throw new ServiceError(
        'Cannot publish workflow without any steps',
        'NO_STEPS',
        400
      );
    }

    const updated = await this.repository.updateDefinition(id, {
      status: 'active',
      publishedAt: new Date(),
      publishedBy: userId,
      updatedBy: userId,
      updatedAt: new Date(),
    });

    // Create event subscription or schedule based on trigger type
    if (existing.triggerType === 'event') {
      const triggerConfig = existing.triggerConfig as EventTriggerConfig;
      await this.repository.createEventSubscription({
        organizationId,
        workflowDefinitionId: id,
        eventType: triggerConfig.eventType,
        documentTypes: triggerConfig.documentTypes,
        conditions: triggerConfig.conditions,
        isActive: true,
      });
    } else if (existing.triggerType === 'schedule') {
      const triggerConfig = existing.triggerConfig as ScheduleTriggerConfig;
      await this.repository.createSchedule({
        organizationId,
        workflowDefinitionId: id,
        cronExpression: triggerConfig.cronExpression,
        timezone: triggerConfig.timezone || 'UTC',
        startDate: triggerConfig.startDate ? new Date(triggerConfig.startDate) : undefined,
        endDate: triggerConfig.endDate ? new Date(triggerConfig.endDate) : undefined,
        isActive: true,
      });
    } else if (existing.triggerType === 'webhook') {
      // Generate webhook key
      const webhookKey = this.generateWebhookKey();
      const triggerConfig = existing.triggerConfig as WebhookTriggerConfig;
      await this.repository.createWebhook({
        organizationId,
        workflowDefinitionId: id,
        webhookKey,
        secretKey: triggerConfig.secretKey,
        allowedIps: triggerConfig.allowedIps,
        requiredHeaders: triggerConfig.requiredHeaders,
        isActive: true,
      });
    }

    return (await this.repository.findDefinitionWithSteps(id)) as WorkflowDefinitionWithSteps;
  }

  /**
   * Pause a workflow (change status from active to paused)
   */
  async pauseWorkflow(id: string): Promise<WorkflowDefinitionWithSteps> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;

    const existing = await this.repository.findDefinitionById(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new ServiceError('Workflow not found', 'WORKFLOW_NOT_FOUND', 404);
    }

    if (existing.status !== 'active') {
      throw new ServiceError(
        `Cannot pause workflow with status "${existing.status}"`,
        'INVALID_STATUS',
        400
      );
    }

    await this.repository.updateDefinition(id, {
      status: 'paused',
      updatedBy: userId,
      updatedAt: new Date(),
    });

    return (await this.repository.findDefinitionWithSteps(id)) as WorkflowDefinitionWithSteps;
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(id: string): Promise<WorkflowDefinitionWithSteps> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;

    const existing = await this.repository.findDefinitionById(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new ServiceError('Workflow not found', 'WORKFLOW_NOT_FOUND', 404);
    }

    if (existing.status !== 'paused') {
      throw new ServiceError(
        `Cannot resume workflow with status "${existing.status}"`,
        'INVALID_STATUS',
        400
      );
    }

    await this.repository.updateDefinition(id, {
      status: 'active',
      updatedBy: userId,
      updatedAt: new Date(),
    });

    return (await this.repository.findDefinitionWithSteps(id)) as WorkflowDefinitionWithSteps;
  }

  /**
   * Archive a workflow
   */
  async archiveWorkflow(id: string): Promise<WorkflowDefinitionWithSteps> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;

    const existing = await this.repository.findDefinitionById(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new ServiceError('Workflow not found', 'WORKFLOW_NOT_FOUND', 404);
    }

    await this.repository.updateDefinition(id, {
      status: 'archived',
      updatedBy: userId,
      updatedAt: new Date(),
    });

    return (await this.repository.findDefinitionWithSteps(id)) as WorkflowDefinitionWithSteps;
  }

  /**
   * Create a new version of a workflow
   */
  async createWorkflowVersion(id: string): Promise<WorkflowDefinitionWithSteps> {
    const organizationId = this.requireOrganizationContext();

    const existing = await this.repository.findDefinitionById(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new ServiceError('Workflow not found', 'WORKFLOW_NOT_FOUND', 404);
    }

    const newVersion = await this.repository.createNewVersion(id, organizationId);
    if (!newVersion) {
      throw new ServiceError('Failed to create new version', 'VERSION_FAILED', 500);
    }

    return newVersion as WorkflowDefinitionWithSteps;
  }

  /**
   * Duplicate a workflow
   */
  async duplicateWorkflow(id: string, newCode: string): Promise<WorkflowDefinitionWithSteps> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;

    const existing = await this.repository.findDefinitionWithSteps(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new ServiceError('Workflow not found', 'WORKFLOW_NOT_FOUND', 404);
    }

    // Check if new code already exists
    const codeExists = await this.repository.findLatestDefinitionByCode(organizationId, newCode);
    if (codeExists) {
      throw new ServiceError(
        `Workflow with code "${newCode}" already exists`,
        'WORKFLOW_CODE_EXISTS',
        400
      );
    }

    // Create duplicate definition
    const newDefinition = await this.repository.createDefinition({
      organizationId,
      name: `${existing.name} (Copy)`,
      description: existing.description,
      workflowCode: newCode,
      triggerType: existing.triggerType,
      triggerConfig: existing.triggerConfig,
      maxExecutionTimeMs: existing.maxExecutionTimeMs,
      maxRetries: existing.maxRetries,
      retryDelayMs: existing.retryDelayMs,
      enableLogging: existing.enableLogging,
      enableMetrics: existing.enableMetrics,
      tags: existing.tags as string[],
      category: existing.category,
      status: 'draft',
      version: 1,
      isLatestVersion: true,
      createdBy: userId,
      updatedBy: userId,
    });

    // Duplicate steps
    const stepIdMap = new Map<string, string>();
    for (const step of existing.steps) {
      const newStep = await this.repository.createStep({
        workflowDefinitionId: newDefinition.id,
        stepCode: step.stepCode,
        stepName: step.stepName,
        description: step.description,
        stepOrder: step.stepOrder,
        actionType: step.actionType,
        actionConfig: step.actionConfig,
        errorStrategy: step.errorStrategy,
        maxRetries: step.maxRetries,
        retryDelayMs: step.retryDelayMs,
        timeoutMs: step.timeoutMs,
        skipConditions: step.skipConditions,
        uiPosition: step.uiPosition,
      });
      stepIdMap.set(step.id, newStep.id);
    }

    // Update step references (nextStepId, onErrorStepId)
    for (const step of existing.steps) {
      const newStepId = stepIdMap.get(step.id)!;
      const updates: Partial<WorkflowStep> = {};

      if (step.nextStepId && stepIdMap.has(step.nextStepId)) {
        updates.nextStepId = stepIdMap.get(step.nextStepId);
      }
      if (step.onErrorStepId && stepIdMap.has(step.onErrorStepId)) {
        updates.onErrorStepId = stepIdMap.get(step.onErrorStepId);
      }

      if (Object.keys(updates).length > 0) {
        await this.repository.updateStep(newStepId, updates);
      }
    }

    return (await this.repository.findDefinitionWithSteps(newDefinition.id)) as WorkflowDefinitionWithSteps;
  }

  // -------------------------------------------------------------------------
  // Workflow Step CRUD
  // -------------------------------------------------------------------------

  /**
   * Add a step to a workflow
   */
  async addStep(workflowId: string, input: CreateStepInput): Promise<WorkflowStep> {
    const organizationId = this.requireOrganizationContext();

    const workflow = await this.repository.findDefinitionById(workflowId);
    if (!workflow || workflow.organizationId !== organizationId) {
      throw new ServiceError('Workflow not found', 'WORKFLOW_NOT_FOUND', 404);
    }

    if (workflow.status === 'active') {
      throw new ServiceError(
        'Cannot modify steps of an active workflow',
        'WORKFLOW_ACTIVE',
        400
      );
    }

    const stepData: NewWorkflowStep = {
      workflowDefinitionId: workflowId,
      stepCode: input.stepCode,
      stepName: input.stepName,
      description: input.description,
      stepOrder: input.stepOrder,
      actionType: input.actionType,
      actionConfig: input.actionConfig,
      nextStepId: input.nextStepId,
      onErrorStepId: input.onErrorStepId,
      errorStrategy: input.errorStrategy || 'stop',
      maxRetries: input.maxRetries,
      retryDelayMs: input.retryDelayMs,
      timeoutMs: input.timeoutMs,
      skipConditions: input.skipConditions,
      uiPosition: input.uiPosition,
    };

    return this.repository.createStep(stepData);
  }

  /**
   * Update a workflow step
   */
  async updateStep(stepId: string, input: UpdateStepInput): Promise<WorkflowStep> {
    const organizationId = this.requireOrganizationContext();

    const step = await this.repository.findStepById(stepId);
    if (!step) {
      throw new ServiceError('Step not found', 'STEP_NOT_FOUND', 404);
    }

    const workflow = await this.repository.findDefinitionById(step.workflowDefinitionId);
    if (!workflow || workflow.organizationId !== organizationId) {
      throw new ServiceError('Workflow not found', 'WORKFLOW_NOT_FOUND', 404);
    }

    if (workflow.status === 'active') {
      throw new ServiceError(
        'Cannot modify steps of an active workflow',
        'WORKFLOW_ACTIVE',
        400
      );
    }

    const updated = await this.repository.updateStep(stepId, input);
    if (!updated) {
      throw new ServiceError('Failed to update step', 'UPDATE_FAILED', 500);
    }

    return updated;
  }

  /**
   * Delete a workflow step
   */
  async deleteStep(stepId: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    const step = await this.repository.findStepById(stepId);
    if (!step) {
      throw new ServiceError('Step not found', 'STEP_NOT_FOUND', 404);
    }

    const workflow = await this.repository.findDefinitionById(step.workflowDefinitionId);
    if (!workflow || workflow.organizationId !== organizationId) {
      throw new ServiceError('Workflow not found', 'WORKFLOW_NOT_FOUND', 404);
    }

    if (workflow.status === 'active') {
      throw new ServiceError(
        'Cannot delete steps of an active workflow',
        'WORKFLOW_ACTIVE',
        400
      );
    }

    await this.repository.deleteStep(stepId);
  }

  /**
   * Reorder workflow steps
   */
  async reorderSteps(workflowId: string, stepIds: string[]): Promise<WorkflowStep[]> {
    const organizationId = this.requireOrganizationContext();

    const workflow = await this.repository.findDefinitionWithSteps(workflowId);
    if (!workflow || workflow.organizationId !== organizationId) {
      throw new ServiceError('Workflow not found', 'WORKFLOW_NOT_FOUND', 404);
    }

    if (workflow.status === 'active') {
      throw new ServiceError(
        'Cannot reorder steps of an active workflow',
        'WORKFLOW_ACTIVE',
        400
      );
    }

    // Update step orders
    const updates = stepIds.map((stepId, index) =>
      this.repository.updateStep(stepId, { stepOrder: index + 1 })
    );

    await Promise.all(updates);

    const updated = await this.repository.findDefinitionWithSteps(workflowId);
    return updated?.steps || [];
  }

  // -------------------------------------------------------------------------
  // Execution History
  // -------------------------------------------------------------------------

  /**
   * List workflow executions (instances)
   */
  async listExecutions(
    params: PaginationParams & ExecutionListFilters = {}
  ): Promise<PaginatedResult<ExecutionWithSteps>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(params);

    // Get instances based on status filter
    const status = params.status || ['pending', 'running', 'waiting', 'completed', 'failed', 'cancelled', 'timed_out'];
    const instances = await this.repository.findInstancesByStatus(organizationId, status, 10000);

    // Apply filters
    let filtered = instances;

    if (params.workflowDefinitionId) {
      filtered = filtered.filter((i) => i.workflowDefinitionId === params.workflowDefinitionId);
    }

    if (params.fromDate) {
      filtered = filtered.filter((i) => i.createdAt >= params.fromDate!);
    }

    if (params.toDate) {
      filtered = filtered.filter((i) => i.createdAt <= params.toDate!);
    }

    if (params.relatedDocumentType) {
      filtered = filtered.filter((i) => i.relatedDocumentType === params.relatedDocumentType);
    }

    if (params.relatedDocumentId) {
      filtered = filtered.filter((i) => i.relatedDocumentId === params.relatedDocumentId);
    }

    // Sort by createdAt descending
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + take);

    // Enrich with definition and step executions
    const enriched: ExecutionWithSteps[] = await Promise.all(
      paginated.map(async (instance) => {
        const definition = await this.repository.findDefinitionById(instance.workflowDefinitionId);
        const stepExecutions = await this.repository.findStepExecutionsForInstance(instance.id);
        return {
          ...instance,
          definition: definition || undefined,
          stepExecutions: stepExecutions || [],
        };
      })
    );

    return this.createPaginatedResult(enriched, total, page, limit);
  }

  /**
   * Get a single execution by ID
   */
  async getExecution(id: string): Promise<ExecutionWithSteps | null> {
    const organizationId = this.requireOrganizationContext();

    const instance = await this.repository.findInstanceById(id);
    if (!instance || instance.organizationId !== organizationId) {
      return null;
    }

    const definition = await this.repository.findDefinitionById(instance.workflowDefinitionId);
    const stepExecutions = await this.repository.findStepExecutionsForInstance(id);

    return {
      ...instance,
      definition: definition || undefined,
      stepExecutions: stepExecutions || [],
    };
  }

  /**
   * Get execution statistics for a workflow
   */
  async getExecutionStats(workflowDefinitionId?: string): Promise<{
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    averageDurationMs: number | null;
    successRate: number | null;
  }> {
    const organizationId = this.requireOrganizationContext();

    // Get all instances
    const allStatuses: WorkflowInstanceStatus[] = ['pending', 'running', 'waiting', 'completed', 'failed', 'cancelled', 'timed_out'];
    let instances = await this.repository.findInstancesByStatus(organizationId, allStatuses, 10000);

    if (workflowDefinitionId) {
      instances = instances.filter((i) => i.workflowDefinitionId === workflowDefinitionId);
    }

    const total = instances.length;
    const pending = instances.filter((i) => i.status === 'pending').length;
    const running = instances.filter((i) => i.status === 'running' || i.status === 'waiting').length;
    const completed = instances.filter((i) => i.status === 'completed').length;
    const failed = instances.filter((i) => i.status === 'failed' || i.status === 'timed_out' || i.status === 'cancelled').length;

    // Calculate average duration for completed executions
    const completedInstances = instances.filter(
      (i) => i.status === 'completed' && i.startedAt && i.completedAt
    );
    const averageDurationMs =
      completedInstances.length > 0
        ? completedInstances.reduce((sum, i) => sum + (i.completedAt!.getTime() - i.startedAt!.getTime()), 0) /
          completedInstances.length
        : null;

    // Calculate success rate
    const finishedInstances = instances.filter(
      (i) => i.status === 'completed' || i.status === 'failed' || i.status === 'timed_out'
    );
    const successRate =
      finishedInstances.length > 0 ? (completed / finishedInstances.length) * 100 : null;

    return {
      total,
      pending,
      running,
      completed,
      failed,
      averageDurationMs,
      successRate,
    };
  }

  // -------------------------------------------------------------------------
  // Utility Methods
  // -------------------------------------------------------------------------

  /**
   * Get available categories (for filtering)
   */
  async getCategories(): Promise<string[]> {
    const organizationId = this.requireOrganizationContext();

    const definitions = await this.repository.findAllDefinitions(organizationId, {
      latestOnly: true,
    });

    const categories = new Set<string>();
    for (const def of definitions) {
      if (def.category) {
        categories.add(def.category);
      }
    }

    return Array.from(categories).sort();
  }

  /**
   * Get all tags used (for filtering)
   */
  async getTags(): Promise<string[]> {
    const organizationId = this.requireOrganizationContext();

    const definitions = await this.repository.findAllDefinitions(organizationId, {
      latestOnly: true,
    });

    const tags = new Set<string>();
    for (const def of definitions) {
      const defTags = (def.tags as string[]) || [];
      for (const tag of defTags) {
        tags.add(tag);
      }
    }

    return Array.from(tags).sort();
  }

  private generateWebhookKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createWorkflowManagementService(
  organizationId?: string,
  userId?: string
): WorkflowManagementService {
  return new WorkflowManagementService({ organizationId, userId });
}
