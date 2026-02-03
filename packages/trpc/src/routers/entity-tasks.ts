/**
 * Entity Tasks tRPC Router
 *
 * Provides API endpoints for managing polymorphic entity tasks that can be
 * associated with any entity type (project, customer, employee, vendor, lead,
 * prospect, contact). Supports subtasks, status tracking, and reordering.
 */

import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';
import {
  db,
  entityTasks,
  eq,
  and,
  asc,
  desc,
  inArray,
  isNull,
} from '@glapi/database';
import type { EntityTask } from '@glapi/database';
import { sql } from 'drizzle-orm';

// =============================================================================
// Input Schemas
// =============================================================================

const entityTypeEnum = z.enum([
  'project',
  'customer',
  'employee',
  'vendor',
  'lead',
  'prospect',
  'contact',
]);

const statusEnum = z.enum([
  'not_started',
  'in_progress',
  'pending_review',
  'completed',
  'blocked',
  'cancelled',
]);

const priorityEnum = z.enum([
  'critical',
  'high',
  'medium',
  'low',
]);

// List input schema with filters and pagination
const listInputSchema = z.object({
  entityType: entityTypeEnum.optional(),
  entityId: z.string().uuid().optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  assigneeId: z.string().uuid().optional(),
  parentTaskId: z.string().uuid().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(50),
}).optional();

// Create task schema
const createTaskSchema = z.object({
  entityType: entityTypeEnum,
  entityId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: priorityEnum.optional().default('medium'),
  assigneeId: z.string().uuid().optional().nullable(),
  reviewerId: z.string().uuid().optional().nullable(),
  parentTaskId: z.string().uuid().optional().nullable(),
  estimatedStartDate: z.string().optional().nullable(),
  estimatedEndDate: z.string().optional().nullable(),
  estimatedHours: z.string().optional().nullable(),
  estimatedBudget: z.string().optional().nullable(),
  isBillable: z.boolean().optional().default(false),
  billingRate: z.string().optional().nullable(),
  customFieldValues: z.record(z.unknown()).optional().default({}),
  dependsOnTaskIds: z.array(z.string().uuid()).optional().default([]),
  sortOrder: z.number().int().optional().default(0),
});

// Update task schema
const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  reviewerId: z.string().uuid().nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  estimatedStartDate: z.string().nullable().optional(),
  estimatedEndDate: z.string().nullable().optional(),
  actualStartDate: z.string().nullable().optional(),
  actualEndDate: z.string().nullable().optional(),
  estimatedHours: z.string().nullable().optional(),
  actualHours: z.string().nullable().optional(),
  estimatedBudget: z.string().nullable().optional(),
  actualCost: z.string().nullable().optional(),
  isBillable: z.boolean().optional(),
  billingRate: z.string().nullable().optional(),
  blockingReason: z.string().nullable().optional(),
  customFieldValues: z.record(z.unknown()).optional(),
  dependsOnTaskIds: z.array(z.string().uuid()).optional(),
  sortOrder: z.number().int().optional(),
});

// Update status schema
const updateStatusSchema = z.object({
  id: z.string().uuid(),
  status: statusEnum,
  blockingReason: z.string().optional(),
});

// Bulk update status schema
const bulkUpdateStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  status: statusEnum,
});

// Reorder schema
const reorderSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string().uuid(),
      sortOrder: z.number().int().min(0),
      parentTaskId: z.string().uuid().optional().nullable(),
    })
  ),
});

// Delete schema
const deleteSchema = z.object({
  id: z.string().uuid(),
  deleteSubtasks: z.boolean().optional().default(false),
});

// =============================================================================
// Helper Functions
// =============================================================================

async function verifyTaskOwnership(
  taskId: string,
  organizationId: string
): Promise<EntityTask> {
  const task = await db.query.entityTasks.findFirst({
    where: and(
      eq(entityTasks.id, taskId),
      eq(entityTasks.organizationId, organizationId)
    ),
  });

  if (!task) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Task not found',
    });
  }

  return task;
}

async function getSubtasksRecursive(
  taskId: string,
  organizationId: string
): Promise<string[]> {
  const childTasks = await db.query.entityTasks.findMany({
    where: and(
      eq(entityTasks.parentTaskId, taskId),
      eq(entityTasks.organizationId, organizationId)
    ),
    columns: { id: true },
  });

  const childIds = childTasks.map((t) => t.id);
  const grandchildIds = await Promise.all(
    childIds.map((id) => getSubtasksRecursive(id, organizationId))
  );

  return [...childIds, ...grandchildIds.flat()];
}

// =============================================================================
// Router
// =============================================================================

export const entityTasksRouter = router({
  // ===========================================================================
  // List Tasks
  // ===========================================================================

  /**
   * List tasks with filters and pagination
   */
  list: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_entity_tasks', 'List tasks with filters and pagination', {
      scopes: ['tasks', 'projects', 'entities'],
      permissions: ['read:entity-tasks'],
    }) })
    .input(listInputSchema)
    .query(async ({ ctx, input = {} }) => {
      const { page = 1, limit = 50 } = input;
      const offset = (page - 1) * limit;

      // Build conditions array
      const conditions = [eq(entityTasks.organizationId, ctx.organizationId)];

      if (input.entityType) {
        conditions.push(eq(entityTasks.entityType, input.entityType));
      }

      if (input.entityId) {
        conditions.push(eq(entityTasks.entityId, input.entityId));
      }

      if (input.status) {
        conditions.push(eq(entityTasks.status, input.status));
      }

      if (input.priority) {
        conditions.push(eq(entityTasks.priority, input.priority));
      }

      if (input.assigneeId) {
        conditions.push(eq(entityTasks.assigneeId, input.assigneeId));
      }

      if (input.parentTaskId !== undefined) {
        if (input.parentTaskId === null) {
          conditions.push(isNull(entityTasks.parentTaskId));
        } else {
          conditions.push(eq(entityTasks.parentTaskId, input.parentTaskId));
        }
      }

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(entityTasks)
        .where(and(...conditions));
      const total = Number(countResult[0]?.count ?? 0);

      // Get tasks
      const tasks = await db.query.entityTasks.findMany({
        where: and(...conditions),
        orderBy: [asc(entityTasks.sortOrder), desc(entityTasks.createdAt)],
        limit,
        offset,
        with: {
          assignee: true,
          reviewer: true,
          parentTask: true,
        },
      });

      return {
        data: tasks,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  // ===========================================================================
  // Get Single Task
  // ===========================================================================

  /**
   * Get a single task by ID with subtasks
   */
  get: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_entity_task', 'Get a single task by ID with subtasks', {
      scopes: ['tasks', 'projects', 'entities'],
      permissions: ['read:entity-tasks'],
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const task = await db.query.entityTasks.findFirst({
        where: and(
          eq(entityTasks.id, input.id),
          eq(entityTasks.organizationId, ctx.organizationId)
        ),
        with: {
          assignee: true,
          reviewer: true,
          parentTask: true,
          childTasks: {
            orderBy: [asc(entityTasks.sortOrder)],
            with: {
              assignee: true,
              childTasks: {
                orderBy: [asc(entityTasks.sortOrder)],
              },
            },
          },
          createdByEntity: true,
        },
      });

      if (!task) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task not found',
        });
      }

      return task;
    }),

  // ===========================================================================
  // Create Task
  // ===========================================================================

  /**
   * Create a new task
   */
  create: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('create_entity_task', 'Create a new task for an entity', {
      scopes: ['tasks', 'projects', 'entities'],
      permissions: ['write:entity-tasks'],
      riskLevel: 'LOW',
    }) })
    .input(createTaskSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify parent task belongs to same organization if specified
      if (input.parentTaskId) {
        await verifyTaskOwnership(input.parentTaskId, ctx.organizationId);
      }

      const [task] = await db
        .insert(entityTasks)
        .values({
          organizationId: ctx.organizationId,
          entityType: input.entityType,
          entityId: input.entityId,
          title: input.title,
          description: input.description,
          priority: input.priority,
          assigneeId: input.assigneeId,
          reviewerId: input.reviewerId,
          parentTaskId: input.parentTaskId,
          estimatedStartDate: input.estimatedStartDate,
          estimatedEndDate: input.estimatedEndDate,
          estimatedHours: input.estimatedHours,
          estimatedBudget: input.estimatedBudget,
          isBillable: input.isBillable,
          billingRate: input.billingRate,
          customFieldValues: input.customFieldValues,
          dependsOnTaskIds: input.dependsOnTaskIds,
          sortOrder: input.sortOrder,
          status: 'not_started',
        })
        .returning();

      return task;
    }),

  // ===========================================================================
  // Update Task
  // ===========================================================================

  /**
   * Update a task
   */
  update: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('update_entity_task', 'Update a task', {
      scopes: ['tasks', 'projects', 'entities'],
      permissions: ['write:entity-tasks'],
      riskLevel: 'LOW',
    }) })
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateTaskSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTaskOwnership(input.id, ctx.organizationId);

      // Verify new parent task if specified
      if (input.data.parentTaskId) {
        await verifyTaskOwnership(input.data.parentTaskId, ctx.organizationId);

        // Prevent circular reference
        if (input.data.parentTaskId === input.id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'A task cannot be its own parent',
          });
        }
      }

      // Handle status change to completed
      let completedAt: Date | null | undefined = undefined;
      if (input.data.status === 'completed') {
        completedAt = new Date();
      } else if (input.data.status) {
        // Any other status clears completedAt
        completedAt = null;
      }

      const updateData: Record<string, unknown> = {
        ...input.data,
        updatedAt: new Date(),
      };

      if (completedAt !== undefined) {
        updateData.completedAt = completedAt;
      }

      const [updated] = await db
        .update(entityTasks)
        .set(updateData)
        .where(eq(entityTasks.id, input.id))
        .returning();

      return updated;
    }),

  // ===========================================================================
  // Delete Task
  // ===========================================================================

  /**
   * Delete a task (and optionally subtasks)
   */
  delete: authenticatedProcedure
    .meta({ ai: createDeleteAIMeta('delete_entity_task', 'Delete a task and optionally subtasks', {
      scopes: ['tasks', 'projects', 'entities'],
      permissions: ['delete:entity-tasks'],
      riskLevel: 'MEDIUM',
      requiresConfirmation: true,
    }) })
    .input(deleteSchema)
    .mutation(async ({ ctx, input }) => {
      await verifyTaskOwnership(input.id, ctx.organizationId);

      if (input.deleteSubtasks) {
        // Get all subtask IDs recursively
        const subtaskIds = await getSubtasksRecursive(input.id, ctx.organizationId);

        // Delete all subtasks first
        if (subtaskIds.length > 0) {
          await db
            .delete(entityTasks)
            .where(
              and(
                inArray(entityTasks.id, subtaskIds),
                eq(entityTasks.organizationId, ctx.organizationId)
              )
            );
        }
      } else {
        // Orphan subtasks by setting their parentTaskId to null
        await db
          .update(entityTasks)
          .set({ parentTaskId: null, updatedAt: new Date() })
          .where(
            and(
              eq(entityTasks.parentTaskId, input.id),
              eq(entityTasks.organizationId, ctx.organizationId)
            )
          );
      }

      // Delete the task
      await db
        .delete(entityTasks)
        .where(eq(entityTasks.id, input.id));

      return { success: true };
    }),

  // ===========================================================================
  // Update Status
  // ===========================================================================

  /**
   * Change task status with optional blocking reason
   */
  updateStatus: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('update_entity_task_status', 'Change task status with optional blocking reason', {
      scopes: ['tasks', 'projects', 'entities'],
      permissions: ['write:entity-tasks'],
      riskLevel: 'LOW',
    }) })
    .input(updateStatusSchema)
    .mutation(async ({ ctx, input }) => {
      await verifyTaskOwnership(input.id, ctx.organizationId);

      // Validate blocking reason for blocked status
      if (input.status === 'blocked' && !input.blockingReason) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Blocking reason is required when setting status to blocked',
        });
      }

      const updateData: Record<string, unknown> = {
        status: input.status,
        updatedAt: new Date(),
      };

      // Set completedAt when marking as completed
      if (input.status === 'completed') {
        updateData.completedAt = new Date();
        updateData.blockingReason = null;
      } else {
        updateData.completedAt = null;
      }

      // Set blocking reason
      if (input.status === 'blocked') {
        updateData.blockingReason = input.blockingReason;
      } else {
        updateData.blockingReason = null;
      }

      const [updated] = await db
        .update(entityTasks)
        .set(updateData)
        .where(eq(entityTasks.id, input.id))
        .returning();

      return updated;
    }),

  // ===========================================================================
  // Bulk Update Status
  // ===========================================================================

  /**
   * Bulk update status for multiple tasks
   */
  bulkUpdateStatus: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('bulk_update_entity_task_status', 'Bulk update status for multiple tasks', {
      scopes: ['tasks', 'projects', 'entities'],
      permissions: ['write:entity-tasks'],
      riskLevel: 'MEDIUM',
    }) })
    .input(bulkUpdateStatusSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify all tasks belong to the organization
      const tasks = await db.query.entityTasks.findMany({
        where: and(
          inArray(entityTasks.id, input.ids),
          eq(entityTasks.organizationId, ctx.organizationId)
        ),
        columns: { id: true },
      });

      if (tasks.length !== input.ids.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'One or more tasks not found',
        });
      }

      const updateData: Record<string, unknown> = {
        status: input.status,
        updatedAt: new Date(),
      };

      if (input.status === 'completed') {
        updateData.completedAt = new Date();
        updateData.blockingReason = null;
      } else {
        updateData.completedAt = null;
        updateData.blockingReason = null;
      }

      await db
        .update(entityTasks)
        .set(updateData)
        .where(
          and(
            inArray(entityTasks.id, input.ids),
            eq(entityTasks.organizationId, ctx.organizationId)
          )
        );

      return { success: true, updated: input.ids.length };
    }),

  // ===========================================================================
  // Reorder Tasks
  // ===========================================================================

  /**
   * Reorder tasks (update sortOrder and optionally parentTaskId)
   */
  reorder: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('reorder_entity_tasks', 'Reorder tasks - update sortOrder and optionally parentTaskId', {
      scopes: ['tasks', 'projects', 'entities'],
      permissions: ['write:entity-tasks'],
      riskLevel: 'LOW',
    }) })
    .input(reorderSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify all tasks belong to the organization
      const taskIds = input.tasks.map((t) => t.id);
      const existingTasks = await db.query.entityTasks.findMany({
        where: and(
          inArray(entityTasks.id, taskIds),
          eq(entityTasks.organizationId, ctx.organizationId)
        ),
        columns: { id: true },
      });

      if (existingTasks.length !== taskIds.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'One or more tasks not found',
        });
      }

      // Verify parent tasks if specified
      const parentIds = input.tasks
        .filter((t) => t.parentTaskId)
        .map((t) => t.parentTaskId as string);

      if (parentIds.length > 0) {
        const parentTasks = await db.query.entityTasks.findMany({
          where: and(
            inArray(entityTasks.id, parentIds),
            eq(entityTasks.organizationId, ctx.organizationId)
          ),
          columns: { id: true },
        });

        if (parentTasks.length !== new Set(parentIds).size) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'One or more parent tasks not found',
          });
        }
      }

      // Update each task
      const updates = input.tasks.map((taskUpdate) =>
        db
          .update(entityTasks)
          .set({
            sortOrder: taskUpdate.sortOrder,
            parentTaskId: taskUpdate.parentTaskId ?? null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(entityTasks.id, taskUpdate.id),
              eq(entityTasks.organizationId, ctx.organizationId)
            )
          )
      );

      await Promise.all(updates);

      return { success: true };
    }),

  // ===========================================================================
  // Get Subtasks
  // ===========================================================================

  /**
   * Get subtasks for a parent task
   */
  getSubtasks: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_entity_task_subtasks', 'Get subtasks for a parent task', {
      scopes: ['tasks', 'projects', 'entities'],
      permissions: ['read:entity-tasks'],
    }) })
    .input(z.object({ parentTaskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify parent task exists
      await verifyTaskOwnership(input.parentTaskId, ctx.organizationId);

      const subtasks = await db.query.entityTasks.findMany({
        where: and(
          eq(entityTasks.parentTaskId, input.parentTaskId),
          eq(entityTasks.organizationId, ctx.organizationId)
        ),
        orderBy: [asc(entityTasks.sortOrder), desc(entityTasks.createdAt)],
        with: {
          assignee: true,
          childTasks: {
            orderBy: [asc(entityTasks.sortOrder)],
          },
        },
      });

      return subtasks;
    }),

  // ===========================================================================
  // Get Tasks by Entity
  // ===========================================================================

  /**
   * Get all tasks for a specific entity
   */
  getByEntity: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_entity_tasks_by_entity', 'Get all tasks for a specific entity', {
      scopes: ['tasks', 'projects', 'entities'],
      permissions: ['read:entity-tasks'],
    }) })
    .input(
      z.object({
        entityType: entityTypeEnum,
        entityId: z.string().uuid(),
        includeSubtasks: z.boolean().optional().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(entityTasks.organizationId, ctx.organizationId),
        eq(entityTasks.entityType, input.entityType),
        eq(entityTasks.entityId, input.entityId),
      ];

      // Only get root-level tasks if not including subtasks inline
      if (!input.includeSubtasks) {
        conditions.push(isNull(entityTasks.parentTaskId));
      }

      const tasks = await db.query.entityTasks.findMany({
        where: and(...conditions),
        orderBy: [asc(entityTasks.sortOrder), desc(entityTasks.createdAt)],
        with: {
          assignee: true,
          reviewer: true,
          ...(input.includeSubtasks
            ? {
                childTasks: {
                  orderBy: [asc(entityTasks.sortOrder)],
                  with: {
                    assignee: true,
                    childTasks: {
                      orderBy: [asc(entityTasks.sortOrder)],
                    },
                  },
                },
              }
            : {}),
        },
      });

      return tasks;
    }),
});
