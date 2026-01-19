import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import {
  WorkflowManagementService,
  WorkflowExecutionService,
  WorkflowDLQService,
} from '@glapi/api-service';

// ============================================================================
// Input Schemas
// ============================================================================

const triggerConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'contains', 'starts_with', 'ends_with', 'regex']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.array(z.number())]),
});

const eventTriggerConfigSchema = z.object({
  eventType: z.string(),
  documentTypes: z.array(z.string()).optional(),
  conditions: z.array(triggerConditionSchema).optional(),
});

const scheduleTriggerConfigSchema = z.object({
  cronExpression: z.string(),
  timezone: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const webhookTriggerConfigSchema = z.object({
  secretKey: z.string().optional(),
  allowedIps: z.array(z.string()).optional(),
  requiredHeaders: z.record(z.string()).optional(),
});

const manualTriggerConfigSchema = z.object({
  allowedRoleIds: z.array(z.string()).optional(),
  allowedUserIds: z.array(z.string()).optional(),
  requiredInputSchema: z.record(z.unknown()).optional(),
});

const triggerConfigSchema = z.union([
  eventTriggerConfigSchema,
  scheduleTriggerConfigSchema,
  webhookTriggerConfigSchema,
  manualTriggerConfigSchema,
]);

const createWorkflowInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  workflowCode: z.string().min(1).max(100),
  triggerType: z.enum(['event', 'schedule', 'webhook', 'manual', 'api']),
  triggerConfig: triggerConfigSchema,
  maxExecutionTimeMs: z.number().int().positive().optional(),
  maxRetries: z.number().int().min(0).optional(),
  retryDelayMs: z.number().int().positive().optional(),
  enableLogging: z.boolean().optional(),
  enableMetrics: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
});

const updateWorkflowInputSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  triggerType: z.enum(['event', 'schedule', 'webhook', 'manual', 'api']).optional(),
  triggerConfig: triggerConfigSchema.optional(),
  maxExecutionTimeMs: z.number().int().positive().optional(),
  maxRetries: z.number().int().min(0).optional(),
  retryDelayMs: z.number().int().positive().optional(),
  enableLogging: z.boolean().optional(),
  enableMetrics: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
});

const uiPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const createStepInputSchema = z.object({
  stepCode: z.string().min(1).max(100),
  stepName: z.string().min(1),
  description: z.string().optional(),
  stepOrder: z.number().int().min(1),
  actionType: z.enum([
    'webhook',
    'internal_action',
    'notification',
    'condition',
    'delay',
    'transform',
    'approval',
    'loop',
    'parallel',
    'sub_workflow',
  ]),
  actionConfig: z.record(z.unknown()),
  nextStepId: z.string().uuid().optional(),
  onErrorStepId: z.string().uuid().optional(),
  errorStrategy: z.enum(['stop', 'continue', 'retry', 'branch']).optional(),
  maxRetries: z.number().int().min(0).optional(),
  retryDelayMs: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
  skipConditions: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.unknown(),
  })).optional(),
  uiPosition: uiPositionSchema.optional(),
});

const updateStepInputSchema = z.object({
  stepName: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  stepOrder: z.number().int().min(1).optional(),
  actionType: z.enum([
    'webhook',
    'internal_action',
    'notification',
    'condition',
    'delay',
    'transform',
    'approval',
    'loop',
    'parallel',
    'sub_workflow',
  ]).optional(),
  actionConfig: z.record(z.unknown()).optional(),
  nextStepId: z.string().uuid().nullable().optional(),
  onErrorStepId: z.string().uuid().nullable().optional(),
  errorStrategy: z.enum(['stop', 'continue', 'retry', 'branch']).optional(),
  maxRetries: z.number().int().min(0).nullable().optional(),
  retryDelayMs: z.number().int().positive().nullable().optional(),
  timeoutMs: z.number().int().positive().nullable().optional(),
  skipConditions: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.unknown(),
  })).nullable().optional(),
  uiPosition: uiPositionSchema.nullable().optional(),
});

const workflowListInputSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  triggerType: z.enum(['event', 'schedule', 'webhook', 'manual', 'api']).optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).optional();

const executionListInputSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  workflowDefinitionId: z.string().uuid().optional(),
  status: z.union([
    z.enum(['pending', 'running', 'waiting', 'completed', 'failed', 'cancelled', 'timed_out']),
    z.array(z.enum(['pending', 'running', 'waiting', 'completed', 'failed', 'cancelled', 'timed_out'])),
  ]).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  relatedDocumentType: z.string().optional(),
  relatedDocumentId: z.string().uuid().optional(),
}).optional();

const dlqListInputSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  workflowCode: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
}).optional();

// ============================================================================
// Router
// ============================================================================

export const workflowsRouter = router({
  // -------------------------------------------------------------------------
  // Workflow Definition CRUD
  // -------------------------------------------------------------------------

  /**
   * List workflow definitions
   */
  list: authenticatedProcedure
    .input(workflowListInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      return service.listWorkflows(input || {});
    }),

  /**
   * Get a single workflow by ID
   */
  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      return service.getWorkflow(input.id);
    }),

  /**
   * Get a workflow by code
   */
  getByCode: authenticatedProcedure
    .input(z.object({ workflowCode: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      return service.getWorkflowByCode(input.workflowCode);
    }),

  /**
   * Create a new workflow
   */
  create: authenticatedProcedure
    .input(createWorkflowInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      return service.createWorkflow(input);
    }),

  /**
   * Update a workflow
   */
  update: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: updateWorkflowInputSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      return service.updateWorkflow(input.id, input.data);
    }),

  /**
   * Delete a workflow
   */
  delete: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      await service.deleteWorkflow(input.id);
      return { success: true };
    }),

  /**
   * Publish a workflow (draft -> active)
   */
  publish: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      return service.publishWorkflow(input.id);
    }),

  /**
   * Pause a workflow (active -> paused)
   */
  pause: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      return service.pauseWorkflow(input.id);
    }),

  /**
   * Resume a paused workflow
   */
  resume: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      return service.resumeWorkflow(input.id);
    }),

  /**
   * Archive a workflow
   */
  archive: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      return service.archiveWorkflow(input.id);
    }),

  /**
   * Create a new version of a workflow
   */
  createVersion: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      return service.createWorkflowVersion(input.id);
    }),

  /**
   * Duplicate a workflow
   */
  duplicate: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      newCode: z.string().min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      return service.duplicateWorkflow(input.id, input.newCode);
    }),

  // -------------------------------------------------------------------------
  // Workflow Steps
  // -------------------------------------------------------------------------

  /**
   * Add a step to a workflow
   */
  addStep: authenticatedProcedure
    .input(z.object({
      workflowId: z.string().uuid(),
      step: createStepInputSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      return service.addStep(input.workflowId, input.step);
    }),

  /**
   * Update a workflow step
   */
  updateStep: authenticatedProcedure
    .input(z.object({
      stepId: z.string().uuid(),
      data: updateStepInputSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      return service.updateStep(input.stepId, input.data);
    }),

  /**
   * Delete a workflow step
   */
  deleteStep: authenticatedProcedure
    .input(z.object({ stepId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      await service.deleteStep(input.stepId);
      return { success: true };
    }),

  /**
   * Reorder workflow steps
   */
  reorderSteps: authenticatedProcedure
    .input(z.object({
      workflowId: z.string().uuid(),
      stepIds: z.array(z.string().uuid()),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      return service.reorderSteps(input.workflowId, input.stepIds);
    }),

  // -------------------------------------------------------------------------
  // Execution History
  // -------------------------------------------------------------------------

  /**
   * List workflow executions
   */
  listExecutions: authenticatedProcedure
    .input(executionListInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      return service.listExecutions(input || {});
    }),

  /**
   * Get a single execution by ID
   */
  getExecution: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      return service.getExecution(input.id);
    }),

  /**
   * Get execution statistics
   */
  getExecutionStats: authenticatedProcedure
    .input(z.object({
      workflowDefinitionId: z.string().uuid().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      return service.getExecutionStats(input?.workflowDefinitionId);
    }),

  // -------------------------------------------------------------------------
  // Manual Execution
  // -------------------------------------------------------------------------

  /**
   * Manually trigger a workflow
   */
  trigger: authenticatedProcedure
    .input(z.object({
      workflowDefinitionId: z.string().uuid(),
      triggerContext: z.record(z.unknown()).optional(),
      relatedDocumentType: z.string().optional(),
      relatedDocumentId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkflowExecutionService(ctx.serviceContext);
      const result = await service.startWorkflow({
        workflowDefinitionId: input.workflowDefinitionId,
        triggerType: 'manual',
        triggerContext: input.triggerContext || {},
        relatedDocumentType: input.relatedDocumentType,
        relatedDocumentId: input.relatedDocumentId,
      });
      // Execute the workflow
      const executed = await service.executeWorkflow(result.instance.id);
      return executed;
    }),

  /**
   * Cancel a running workflow
   */
  cancel: authenticatedProcedure
    .input(z.object({
      instanceId: z.string().uuid(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkflowExecutionService(ctx.serviceContext);
      return service.cancelWorkflow(input.instanceId, input.reason);
    }),

  // -------------------------------------------------------------------------
  // Dead Letter Queue
  // -------------------------------------------------------------------------

  /**
   * List failed workflows (DLQ)
   */
  listFailed: authenticatedProcedure
    .input(dlqListInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new WorkflowDLQService(ctx.serviceContext);
      return service.getFailedWorkflows(input || {});
    }),

  /**
   * Get DLQ statistics
   */
  getDlqStats: authenticatedProcedure
    .query(async ({ ctx }) => {
      const service = new WorkflowDLQService(ctx.serviceContext);
      return service.getStats();
    }),

  /**
   * Retry a failed workflow
   */
  retry: authenticatedProcedure
    .input(z.object({ instanceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkflowDLQService(ctx.serviceContext);
      return service.retryWorkflow(input.instanceId);
    }),

  /**
   * Replay a failed workflow (start fresh)
   */
  replay: authenticatedProcedure
    .input(z.object({ instanceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkflowDLQService(ctx.serviceContext);
      return service.replayWorkflow(input.instanceId);
    }),

  /**
   * Bulk retry failed workflows
   */
  bulkRetry: authenticatedProcedure
    .input(z.object({ instanceIds: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkflowDLQService(ctx.serviceContext);
      const results = await service.bulkRetry(input.instanceIds);
      // Convert Map to object for JSON serialization
      const resultObj: Record<string, { success: boolean; error?: string }> = {};
      results.forEach((value, key) => {
        resultObj[key] = { success: value.success, error: value.error };
      });
      return resultObj;
    }),

  /**
   * Archive a failed workflow
   */
  archiveFailed: authenticatedProcedure
    .input(z.object({ instanceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkflowDLQService(ctx.serviceContext);
      return service.archiveFailedWorkflow(input.instanceId);
    }),

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  /**
   * Get available categories
   */
  getCategories: authenticatedProcedure
    .query(async ({ ctx }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      return service.getCategories();
    }),

  /**
   * Get all tags
   */
  getTags: authenticatedProcedure
    .query(async ({ ctx }) => {
      const service = new WorkflowManagementService(ctx.serviceContext);
      return service.getTags();
    }),
});
