/**
 * tRPC Router for Communication Workflows
 *
 * Provides API endpoints for managing automated email workflows:
 * - CRUD operations for workflows
 * - Step management (add, update, delete, reorder)
 * - Workflow activation/deactivation
 * - Manual triggering and execution management
 */

import { z } from 'zod';
import { router, authenticatedProcedure, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';
import {
  db,
  communicationWorkflows,
  communicationWorkflowSteps,
  communicationWorkflowExecutions,
  communicationWorkflowStepHistory,
  eq,
  and,
  asc,
  desc,
  sql,
  inArray,
} from '@glapi/database';
import type {
  CommunicationWorkflow,
  CommunicationWorkflowStep,
  CommunicationWorkflowExecution,
  TriggerConfig,
  FilterConditions,
  StepConfig,
  BranchConfig,
} from '@glapi/database';

// =============================================================================
// Input Schemas
// =============================================================================

const triggerTypeEnum = z.enum([
  'manual',
  'entity_created',
  'entity_updated',
  'event',
  'schedule',
  'webhook',
  'form_submission',
]);

const stepTypeEnum = z.enum([
  'send_email',
  'wait_delay',
  'wait_until',
  'condition',
  'update_entity',
  'webhook',
  'branch',
  'end',
]);

const executionStatusEnum = z.enum([
  'pending',
  'running',
  'waiting',
  'completed',
  'failed',
  'cancelled',
  'paused',
]);

const entityTypeEnum = z.enum([
  'customer',
  'employee',
  'contact',
  'lead',
  'prospect',
  'vendor',
]);

const filterRuleSchema = z.object({
  field: z.string(),
  operator: z.enum([
    'equals',
    'not_equals',
    'contains',
    'starts_with',
    'ends_with',
    'gt',
    'lt',
    'gte',
    'lte',
    'is_null',
    'is_not_null',
  ]),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

const triggerConfigSchema = z.object({
  entityTypes: z.array(z.string()).optional(),
  eventName: z.string().optional(),
  cronExpression: z.string().optional(),
  timezone: z.string().optional(),
  webhookPath: z.string().optional(),
});

const filterConditionsSchema = z.object({
  rules: z.array(filterRuleSchema).optional(),
  combinator: z.enum(['and', 'or']).optional(),
});

const stepConfigSchema = z.object({
  templateId: z.string().uuid().optional(),
  templateVariables: z.record(z.string()).optional(),
  customSubject: z.string().optional(),
  customBody: z.string().optional(),
  delayAmount: z.number().int().min(1).optional(),
  delayUnit: z.enum(['minutes', 'hours', 'days', 'weeks']).optional(),
  waitUntilField: z.string().optional(),
  waitUntilCondition: z.enum(['equals', 'not_null', 'gt', 'lt']).optional(),
  waitUntilValue: z.union([z.string(), z.number()]).optional(),
  conditionRules: z.array(filterRuleSchema).optional(),
  conditionCombinator: z.enum(['and', 'or']).optional(),
  updateFields: z.record(z.unknown()).optional(),
  webhookUrl: z.string().url().optional(),
  webhookMethod: z.enum(['POST', 'PUT', 'PATCH']).optional(),
  webhookHeaders: z.record(z.string()).optional(),
  webhookPayload: z.record(z.unknown()).optional(),
});

const branchSchema = z.object({
  name: z.string(),
  conditions: z.array(filterRuleSchema),
  nextStepId: z.string().uuid(),
});

const branchConfigSchema = z.object({
  branches: z.array(branchSchema),
  defaultNextStepId: z.string().uuid().optional(),
});

// Workflow schemas
const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  triggerType: triggerTypeEnum.optional().default('manual'),
  triggerConfig: triggerConfigSchema.optional(),
  targetEntityType: entityTypeEnum.optional(),
  filterConditions: filterConditionsSchema.optional(),
  isTemplate: z.boolean().optional().default(false),
});

const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  triggerType: triggerTypeEnum.optional(),
  triggerConfig: triggerConfigSchema.nullable().optional(),
  targetEntityType: entityTypeEnum.nullable().optional(),
  filterConditions: filterConditionsSchema.nullable().optional(),
  isTemplate: z.boolean().optional(),
});

// Step schemas
const createStepSchema = z.object({
  workflowId: z.string().uuid(),
  name: z.string().min(1).max(255),
  stepType: stepTypeEnum,
  config: stepConfigSchema.optional().default({}),
  sortOrder: z.number().int().min(0).optional(),
  nextStepId: z.string().uuid().nullable().optional(),
  branchConfig: branchConfigSchema.nullable().optional(),
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional(),
});

const updateStepSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  stepType: stepTypeEnum.optional(),
  config: stepConfigSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
  nextStepId: z.string().uuid().nullable().optional(),
  branchConfig: branchConfigSchema.nullable().optional(),
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional(),
});

// List schemas
const listWorkflowsSchema = z.object({
  isActive: z.boolean().optional(),
  isTemplate: z.boolean().optional(),
  triggerType: triggerTypeEnum.optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});

const listExecutionsSchema = z.object({
  workflowId: z.string().uuid().optional(),
  status: z.array(executionStatusEnum).optional(),
  entityType: entityTypeEnum.optional(),
  entityId: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});

// =============================================================================
// Helper Functions
// =============================================================================

async function verifyWorkflowOwnership(
  workflowId: string,
  organizationId: string
): Promise<CommunicationWorkflow> {
  const workflow = await db.query.communicationWorkflows.findFirst({
    where: and(
      eq(communicationWorkflows.id, workflowId),
      eq(communicationWorkflows.organizationId, organizationId)
    ),
  });

  if (!workflow) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Communication workflow not found',
    });
  }

  return workflow;
}

async function verifyStepOwnership(
  stepId: string,
  organizationId: string
): Promise<CommunicationWorkflowStep & { workflow: CommunicationWorkflow }> {
  const step = await db.query.communicationWorkflowSteps.findFirst({
    where: eq(communicationWorkflowSteps.id, stepId),
    with: {
      workflow: true,
    },
  });

  if (!step || step.workflow.organizationId !== organizationId) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Workflow step not found',
    });
  }

  return step as CommunicationWorkflowStep & { workflow: CommunicationWorkflow };
}

// =============================================================================
// Router
// =============================================================================

export const communicationWorkflowsRouter = router({
  // ===========================================================================
  // Workflow CRUD
  // ===========================================================================

  list: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_communication_workflows', 'Search and list communication workflows', {
      scopes: ['communications', 'workflows', 'global'],
      permissions: ['read:communication-workflows'],
    }) })
    .input(listWorkflowsSchema)
    .query(async ({ ctx, input }) => {
      const { isActive, isTemplate, triggerType, search, page, limit } = input;
      const offset = (page - 1) * limit;

      const conditions = [eq(communicationWorkflows.organizationId, ctx.organizationId)];

      if (isActive !== undefined) {
        conditions.push(eq(communicationWorkflows.isActive, isActive));
      }

      if (isTemplate !== undefined) {
        conditions.push(eq(communicationWorkflows.isTemplate, isTemplate));
      }

      if (triggerType) {
        conditions.push(eq(communicationWorkflows.triggerType, triggerType));
      }

      if (search) {
        conditions.push(
          sql`(${communicationWorkflows.name} ILIKE ${'%' + search + '%'} OR ${communicationWorkflows.description} ILIKE ${'%' + search + '%'})`
        );
      }

      const workflows = await db.query.communicationWorkflows.findMany({
        where: and(...conditions),
        orderBy: [asc(communicationWorkflows.name)],
        limit,
        offset,
        with: {
          steps: {
            orderBy: [asc(communicationWorkflowSteps.sortOrder)],
          },
        },
      });

      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(communicationWorkflows)
        .where(and(...conditions));

      const total = countResult[0]?.count ?? 0;

      return {
        items: workflows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),

  get: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_communication_workflow', 'Get a communication workflow by ID', {
      scopes: ['communications', 'workflows'],
      permissions: ['read:communication-workflows'],
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const workflow = await db.query.communicationWorkflows.findFirst({
        where: and(
          eq(communicationWorkflows.id, input.id),
          eq(communicationWorkflows.organizationId, ctx.organizationId)
        ),
        with: {
          steps: {
            orderBy: [asc(communicationWorkflowSteps.sortOrder)],
          },
        },
      });

      if (!workflow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Communication workflow not found',
        });
      }

      return workflow;
    }),

  create: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('create_communication_workflow', 'Create a new communication workflow', {
      scopes: ['communications', 'workflows'],
      permissions: ['write:communication-workflows'],
      riskLevel: 'LOW',
    }) })
    .input(createWorkflowSchema)
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate name
      const existing = await db.query.communicationWorkflows.findFirst({
        where: and(
          eq(communicationWorkflows.organizationId, ctx.organizationId),
          eq(communicationWorkflows.name, input.name)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A workflow with this name already exists',
        });
      }

      const [workflow] = await db
        .insert(communicationWorkflows)
        .values({
          organizationId: ctx.organizationId,
          name: input.name,
          description: input.description,
          triggerType: input.triggerType,
          triggerConfig: input.triggerConfig as TriggerConfig | undefined,
          targetEntityType: input.targetEntityType,
          filterConditions: input.filterConditions as FilterConditions | undefined,
          isTemplate: input.isTemplate,
          isActive: false,
          createdBy: ctx.user?.entityId ?? null,
          updatedBy: ctx.user?.entityId ?? null,
        })
        .returning();

      return workflow;
    }),

  update: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateWorkflowSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workflow = await verifyWorkflowOwnership(input.id, ctx.organizationId);

      if (input.data.name && input.data.name !== workflow.name) {
        const existing = await db.query.communicationWorkflows.findFirst({
          where: and(
            eq(communicationWorkflows.organizationId, ctx.organizationId),
            eq(communicationWorkflows.name, input.data.name)
          ),
        });

        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A workflow with this name already exists',
          });
        }
      }

      const [updated] = await db
        .update(communicationWorkflows)
        .set({
          ...input.data,
          triggerConfig: input.data.triggerConfig as TriggerConfig | undefined,
          filterConditions: input.data.filterConditions as FilterConditions | undefined,
          updatedBy: ctx.user?.id,
          updatedAt: new Date(),
        })
        .where(eq(communicationWorkflows.id, input.id))
        .returning();

      return updated;
    }),

  delete: authenticatedProcedure
    .meta({ ai: createDeleteAIMeta('delete_communication_workflow', 'Delete a communication workflow', {
      scopes: ['communications', 'workflows'],
      permissions: ['delete:communication-workflows'],
      riskLevel: 'MEDIUM',
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifyWorkflowOwnership(input.id, ctx.organizationId);

      await db
        .delete(communicationWorkflows)
        .where(eq(communicationWorkflows.id, input.id));

      return { success: true };
    }),

  duplicate: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const original = await db.query.communicationWorkflows.findFirst({
        where: and(
          eq(communicationWorkflows.id, input.id),
          eq(communicationWorkflows.organizationId, ctx.organizationId)
        ),
        with: {
          steps: true,
        },
      });

      if (!original) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow not found',
        });
      }

      // Check for duplicate name
      const existing = await db.query.communicationWorkflows.findFirst({
        where: and(
          eq(communicationWorkflows.organizationId, ctx.organizationId),
          eq(communicationWorkflows.name, input.name)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A workflow with this name already exists',
        });
      }

      // Create new workflow
      const [newWorkflow] = await db
        .insert(communicationWorkflows)
        .values({
          organizationId: ctx.organizationId,
          name: input.name,
          description: original.description,
          triggerType: original.triggerType,
          triggerConfig: original.triggerConfig,
          targetEntityType: original.targetEntityType,
          filterConditions: original.filterConditions,
          isTemplate: false,
          isActive: false,
          createdBy: ctx.user?.entityId ?? null,
          updatedBy: ctx.user?.entityId ?? null,
        })
        .returning();

      // Copy steps with ID mapping for nextStepId references
      if (original.steps.length > 0) {
        const stepIdMap = new Map<string, string>();

        // First pass: create steps without nextStepId
        const newSteps = await db
          .insert(communicationWorkflowSteps)
          .values(
            original.steps.map((step) => ({
              workflowId: newWorkflow.id,
              name: step.name,
              stepType: step.stepType,
              config: step.config,
              sortOrder: step.sortOrder,
              positionX: step.positionX,
              positionY: step.positionY,
            }))
          )
          .returning();

        // Build ID mapping
        original.steps.forEach((oldStep, index) => {
          stepIdMap.set(oldStep.id, newSteps[index].id);
        });

        // Second pass: update nextStepId references
        for (const oldStep of original.steps) {
          if (oldStep.nextStepId) {
            const newStepId = stepIdMap.get(oldStep.id);
            const newNextStepId = stepIdMap.get(oldStep.nextStepId);
            if (newStepId && newNextStepId) {
              await db
                .update(communicationWorkflowSteps)
                .set({ nextStepId: newNextStepId })
                .where(eq(communicationWorkflowSteps.id, newStepId));
            }
          }
        }
      }

      return db.query.communicationWorkflows.findFirst({
        where: eq(communicationWorkflows.id, newWorkflow.id),
        with: {
          steps: {
            orderBy: [asc(communicationWorkflowSteps.sortOrder)],
          },
        },
      });
    }),

  // ===========================================================================
  // Workflow Activation
  // ===========================================================================

  activate: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workflow = await db.query.communicationWorkflows.findFirst({
        where: and(
          eq(communicationWorkflows.id, input.id),
          eq(communicationWorkflows.organizationId, ctx.organizationId)
        ),
        with: {
          steps: true,
        },
      });

      if (!workflow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow not found',
        });
      }

      // Validate workflow has at least one step
      if (workflow.steps.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot activate a workflow without any steps',
        });
      }

      const [updated] = await db
        .update(communicationWorkflows)
        .set({
          isActive: true,
          updatedBy: ctx.user?.id,
          updatedAt: new Date(),
        })
        .where(eq(communicationWorkflows.id, input.id))
        .returning();

      return updated;
    }),

  deactivate: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifyWorkflowOwnership(input.id, ctx.organizationId);

      const [updated] = await db
        .update(communicationWorkflows)
        .set({
          isActive: false,
          updatedBy: ctx.user?.id,
          updatedAt: new Date(),
        })
        .where(eq(communicationWorkflows.id, input.id))
        .returning();

      return updated;
    }),

  // ===========================================================================
  // Step Management
  // ===========================================================================

  addStep: authenticatedProcedure
    .input(createStepSchema)
    .mutation(async ({ ctx, input }) => {
      await verifyWorkflowOwnership(input.workflowId, ctx.organizationId);

      // Get the highest sort order
      const lastStep = await db.query.communicationWorkflowSteps.findFirst({
        where: eq(communicationWorkflowSteps.workflowId, input.workflowId),
        orderBy: [desc(communicationWorkflowSteps.sortOrder)],
      });

      const sortOrder = input.sortOrder ?? (lastStep ? lastStep.sortOrder + 1 : 0);

      const [step] = await db
        .insert(communicationWorkflowSteps)
        .values({
          workflowId: input.workflowId,
          name: input.name,
          stepType: input.stepType,
          config: input.config as StepConfig,
          sortOrder,
          nextStepId: input.nextStepId,
          branchConfig: input.branchConfig as BranchConfig | undefined,
          positionX: input.positionX,
          positionY: input.positionY,
        })
        .returning();

      return step;
    }),

  updateStep: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateStepSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyStepOwnership(input.id, ctx.organizationId);

      const [updated] = await db
        .update(communicationWorkflowSteps)
        .set({
          ...input.data,
          config: input.data.config as StepConfig | undefined,
          branchConfig: input.data.branchConfig as BranchConfig | undefined,
          updatedAt: new Date(),
        })
        .where(eq(communicationWorkflowSteps.id, input.id))
        .returning();

      return updated;
    }),

  deleteStep: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifyStepOwnership(input.id, ctx.organizationId);

      await db
        .delete(communicationWorkflowSteps)
        .where(eq(communicationWorkflowSteps.id, input.id));

      return { success: true };
    }),

  reorderSteps: authenticatedProcedure
    .input(
      z.object({
        workflowId: z.string().uuid(),
        stepOrders: z.array(
          z.object({
            id: z.string().uuid(),
            sortOrder: z.number().int().min(0),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyWorkflowOwnership(input.workflowId, ctx.organizationId);

      const updates = input.stepOrders.map((item) =>
        db
          .update(communicationWorkflowSteps)
          .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
          .where(
            and(
              eq(communicationWorkflowSteps.id, item.id),
              eq(communicationWorkflowSteps.workflowId, input.workflowId)
            )
          )
      );

      await Promise.all(updates);

      return db.query.communicationWorkflowSteps.findMany({
        where: eq(communicationWorkflowSteps.workflowId, input.workflowId),
        orderBy: [asc(communicationWorkflowSteps.sortOrder)],
      });
    }),

  // ===========================================================================
  // Execution Management
  // ===========================================================================

  trigger: authenticatedProcedure
    .input(
      z.object({
        workflowId: z.string().uuid(),
        entityType: entityTypeEnum.optional(),
        entityId: z.string().uuid().optional(),
        context: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workflow = await db.query.communicationWorkflows.findFirst({
        where: and(
          eq(communicationWorkflows.id, input.workflowId),
          eq(communicationWorkflows.organizationId, ctx.organizationId)
        ),
        with: {
          steps: {
            orderBy: [asc(communicationWorkflowSteps.sortOrder)],
            limit: 1,
          },
        },
      });

      if (!workflow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow not found',
        });
      }

      if (!workflow.isActive) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot trigger an inactive workflow',
        });
      }

      if (workflow.steps.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Workflow has no steps',
        });
      }

      const firstStep = workflow.steps[0];

      const [execution] = await db
        .insert(communicationWorkflowExecutions)
        .values({
          organizationId: ctx.organizationId,
          workflowId: input.workflowId,
          entityType: input.entityType,
          entityId: input.entityId,
          status: 'pending',
          currentStepId: firstStep.id,
          context: input.context ?? {},
          triggeredBy: 'manual',
          triggeredByUserId: ctx.user?.id,
        })
        .returning();

      // Update workflow statistics
      await db
        .update(communicationWorkflows)
        .set({
          totalExecutions: sql`${communicationWorkflows.totalExecutions} + 1`,
          lastExecutedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(communicationWorkflows.id, input.workflowId));

      return execution;
    }),

  listExecutions: authenticatedProcedure
    .input(listExecutionsSchema)
    .query(async ({ ctx, input }) => {
      const { workflowId, status, entityType, entityId, page, limit } = input;
      const offset = (page - 1) * limit;

      const conditions = [
        eq(communicationWorkflowExecutions.organizationId, ctx.organizationId),
      ];

      if (workflowId) {
        conditions.push(eq(communicationWorkflowExecutions.workflowId, workflowId));
      }

      if (status && status.length > 0) {
        conditions.push(inArray(communicationWorkflowExecutions.status, status));
      }

      if (entityType) {
        conditions.push(eq(communicationWorkflowExecutions.entityType, entityType));
      }

      if (entityId) {
        conditions.push(eq(communicationWorkflowExecutions.entityId, entityId));
      }

      const executions = await db.query.communicationWorkflowExecutions.findMany({
        where: and(...conditions),
        orderBy: [desc(communicationWorkflowExecutions.createdAt)],
        limit,
        offset,
        with: {
          workflow: {
            columns: {
              id: true,
              name: true,
            },
          },
          currentStep: {
            columns: {
              id: true,
              name: true,
              stepType: true,
            },
          },
        },
      });

      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(communicationWorkflowExecutions)
        .where(and(...conditions));

      const total = countResult[0]?.count ?? 0;

      return {
        items: executions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),

  getExecution: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const execution = await db.query.communicationWorkflowExecutions.findFirst({
        where: and(
          eq(communicationWorkflowExecutions.id, input.id),
          eq(communicationWorkflowExecutions.organizationId, ctx.organizationId)
        ),
        with: {
          workflow: true,
          currentStep: true,
          stepHistory: {
            orderBy: [asc(communicationWorkflowStepHistory.startedAt)],
          },
        },
      });

      if (!execution) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow execution not found',
        });
      }

      return execution;
    }),

  cancelExecution: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const execution = await db.query.communicationWorkflowExecutions.findFirst({
        where: and(
          eq(communicationWorkflowExecutions.id, input.id),
          eq(communicationWorkflowExecutions.organizationId, ctx.organizationId)
        ),
      });

      if (!execution) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow execution not found',
        });
      }

      if (['completed', 'failed', 'cancelled'].includes(execution.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot cancel a completed, failed, or already cancelled execution',
        });
      }

      const [updated] = await db
        .update(communicationWorkflowExecutions)
        .set({
          status: 'cancelled',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(communicationWorkflowExecutions.id, input.id))
        .returning();

      return updated;
    }),

  pauseExecution: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const execution = await db.query.communicationWorkflowExecutions.findFirst({
        where: and(
          eq(communicationWorkflowExecutions.id, input.id),
          eq(communicationWorkflowExecutions.organizationId, ctx.organizationId)
        ),
      });

      if (!execution) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow execution not found',
        });
      }

      if (!['running', 'waiting'].includes(execution.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only pause running or waiting executions',
        });
      }

      const [updated] = await db
        .update(communicationWorkflowExecutions)
        .set({
          status: 'paused',
          pausedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(communicationWorkflowExecutions.id, input.id))
        .returning();

      return updated;
    }),

  resumeExecution: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const execution = await db.query.communicationWorkflowExecutions.findFirst({
        where: and(
          eq(communicationWorkflowExecutions.id, input.id),
          eq(communicationWorkflowExecutions.organizationId, ctx.organizationId)
        ),
      });

      if (!execution) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow execution not found',
        });
      }

      if (execution.status !== 'paused') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only resume paused executions',
        });
      }

      const [updated] = await db
        .update(communicationWorkflowExecutions)
        .set({
          status: 'running',
          pausedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(communicationWorkflowExecutions.id, input.id))
        .returning();

      return updated;
    }),
});

// =============================================================================
// Type Exports
// =============================================================================

export type CommunicationWorkflowsRouter = typeof communicationWorkflowsRouter;
