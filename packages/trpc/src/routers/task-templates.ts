/**
 * tRPC Router for Task Template Operations
 *
 * Provides API endpoints for managing reusable task templates:
 * - Task template CRUD operations
 * - Template duplication
 * - Template instantiation (creates actual entity_tasks from template)
 */

import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';
import {
  db,
  taskTemplates,
  entityTasks,
  eq,
  and,
  asc,
  sql,
} from '@glapi/database';
import type {
  TaskTemplate,
  TaskTemplateData,
  TaskTemplateItem,
  TaskTemplatePriority,
} from '@glapi/database';

// =============================================================================
// Input Schemas
// =============================================================================

const priorityEnum = z.enum(['critical', 'high', 'medium', 'low']);

/**
 * Schema for validating task items within a template
 * Note: We use z.infer to get the validated type, then cast to TaskTemplateItem
 * since the database types require specific fields
 */
const taskTemplateItemSchema = z.object({
  tempId: z.string().min(1),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: priorityEnum.optional(),
  estimatedHours: z.number().min(0).optional(),
  estimatedBudget: z.number().min(0).optional(),
  isBillable: z.boolean().optional(),
  parentTempId: z.string().optional(),
  dependsOnTempIds: z.array(z.string()).optional(),
  customFieldValues: z.record(z.unknown()).optional(),
  sortOrder: z.number().int().min(0),
});

const templateDataSchema = z.object({
  tasks: z.array(taskTemplateItemSchema),
});

/**
 * Type for validated template data from Zod schema
 */
type ValidatedTemplateData = z.infer<typeof templateDataSchema>;

/**
 * Convert validated template data to the database format
 */
function toTaskTemplateData(data: ValidatedTemplateData): TaskTemplateData {
  return {
    tasks: data.tasks.map((task): TaskTemplateItem => ({
      tempId: task.tempId,
      title: task.title,
      sortOrder: task.sortOrder,
      description: task.description,
      priority: task.priority as TaskTemplatePriority | undefined,
      estimatedHours: task.estimatedHours,
      estimatedBudget: task.estimatedBudget,
      isBillable: task.isBillable,
      parentTempId: task.parentTempId,
      dependsOnTempIds: task.dependsOnTempIds,
      customFieldValues: task.customFieldValues as Record<string, unknown> | undefined,
    })),
  };
}

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  entityTypes: z.array(z.string()).optional().default([]),
  templateData: templateDataSchema,
  category: z.string().max(100).optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  entityTypes: z.array(z.string()).optional(),
  templateData: templateDataSchema.optional(),
  category: z.string().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
});

const entityTypeEnum = z.enum([
  'project',
  'customer',
  'employee',
  'vendor',
  'lead',
  'prospect',
  'contact',
]);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Verify template ownership and return the template if found
 */
async function verifyTemplateOwnership(
  templateId: string,
  organizationId: string
): Promise<TaskTemplate> {
  const template = await db.query.taskTemplates.findFirst({
    where: and(
      eq(taskTemplates.id, templateId),
      eq(taskTemplates.organizationId, organizationId)
    ),
  });

  if (!template) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Task template not found',
    });
  }

  return template;
}

/**
 * Validate template data structure
 * Ensures all tempId references (parentTempId, dependsOnTempIds) point to valid tasks
 */
function validateTemplateData(templateData: ValidatedTemplateData): void {
  const tempIds = new Set(templateData.tasks.map((t) => t.tempId));

  for (const task of templateData.tasks) {
    // Validate parent reference
    if (task.parentTempId && !tempIds.has(task.parentTempId)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Task "${task.title}" references non-existent parent tempId: ${task.parentTempId}`,
      });
    }

    // Validate dependency references
    if (task.dependsOnTempIds) {
      for (const depId of task.dependsOnTempIds) {
        if (!tempIds.has(depId)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Task "${task.title}" references non-existent dependency tempId: ${depId}`,
          });
        }
      }
    }
  }

  // Check for circular parent references
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function hasCycle(tempId: string): boolean {
    if (inStack.has(tempId)) return true;
    if (visited.has(tempId)) return false;

    visited.add(tempId);
    inStack.add(tempId);

    const task = templateData.tasks.find((t) => t.tempId === tempId);
    if (task?.parentTempId) {
      if (hasCycle(task.parentTempId)) return true;
    }

    inStack.delete(tempId);
    return false;
  }

  for (const task of templateData.tasks) {
    if (hasCycle(task.tempId)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Template contains circular parent references',
      });
    }
  }
}

// =============================================================================
// Router
// =============================================================================

export const taskTemplatesRouter = router({
  // ===========================================================================
  // List Templates
  // ===========================================================================

  /**
   * List all task templates for the current organization
   *
   * Optionally filter by:
   * - entityType: Only templates applicable to this entity type (or with empty entityTypes)
   * - category: Only templates in this category
   * - includeInactive: Whether to include inactive templates
   */
  list: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_task_templates', 'List task templates with optional filters', {
      scopes: ['task-templates', 'tasks'],
      permissions: ['read:task-templates'],
    }) })
    .input(
      z
        .object({
          entityType: z.string().optional(),
          category: z.string().optional(),
          includeInactive: z.boolean().optional().default(false),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(taskTemplates.organizationId, ctx.organizationId)];

      if (!input?.includeInactive) {
        conditions.push(eq(taskTemplates.isActive, true));
      }

      if (input?.category) {
        conditions.push(eq(taskTemplates.category, input.category));
      }

      let result = await db.query.taskTemplates.findMany({
        where: and(...conditions),
        orderBy: [asc(taskTemplates.name)],
      });

      // Filter by entityType if specified
      // Templates match if their entityTypes array is empty (applies to all)
      // or includes the specified entityType
      if (input?.entityType) {
        result = result.filter((template) => {
          const types = template.entityTypes as string[];
          return types.length === 0 || types.includes(input.entityType!);
        });
      }

      return result;
    }),

  // ===========================================================================
  // Get Single Template
  // ===========================================================================

  /**
   * Get a single task template by ID
   */
  get: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_task_template', 'Get a task template by ID', {
      scopes: ['task-templates', 'tasks'],
      permissions: ['read:task-templates'],
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const template = await db.query.taskTemplates.findFirst({
        where: and(
          eq(taskTemplates.id, input.id),
          eq(taskTemplates.organizationId, ctx.organizationId)
        ),
      });

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task template not found',
        });
      }

      return template;
    }),

  // ===========================================================================
  // Create Template
  // ===========================================================================

  /**
   * Create a new task template
   */
  create: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('create_task_template', 'Create a new task template', {
      scopes: ['task-templates', 'tasks'],
      permissions: ['write:task-templates'],
      riskLevel: 'LOW',
    }) })
    .input(createTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate template data structure
      validateTemplateData(input.templateData);

      // Check for duplicate name within organization
      const existing = await db.query.taskTemplates.findFirst({
        where: and(
          eq(taskTemplates.organizationId, ctx.organizationId),
          eq(taskTemplates.name, input.name)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A task template with this name already exists',
        });
      }

      const [template] = await db
        .insert(taskTemplates)
        .values({
          organizationId: ctx.organizationId,
          name: input.name,
          description: input.description,
          entityTypes: input.entityTypes,
          templateData: toTaskTemplateData(input.templateData),
          category: input.category,
          createdBy: ctx.user?.entityId ?? null,
        })
        .returning();

      return template;
    }),

  // ===========================================================================
  // Update Template
  // ===========================================================================

  /**
   * Update a task template
   */
  update: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateTemplateSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTemplateOwnership(input.id, ctx.organizationId);

      // Validate template data if provided
      if (input.data.templateData) {
        validateTemplateData(input.data.templateData);
      }

      // Check for duplicate name if name is being updated
      if (input.data.name) {
        const existing = await db.query.taskTemplates.findFirst({
          where: and(
            eq(taskTemplates.organizationId, ctx.organizationId),
            eq(taskTemplates.name, input.data.name)
          ),
        });

        if (existing && existing.id !== input.id) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A task template with this name already exists',
          });
        }
      }

      // Build update object, converting templateData if present
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.data.name !== undefined) {
        updateData.name = input.data.name;
      }
      if (input.data.description !== undefined) {
        updateData.description = input.data.description;
      }
      if (input.data.entityTypes !== undefined) {
        updateData.entityTypes = input.data.entityTypes;
      }
      if (input.data.templateData !== undefined) {
        updateData.templateData = toTaskTemplateData(input.data.templateData);
      }
      if (input.data.category !== undefined) {
        updateData.category = input.data.category;
      }
      if (input.data.isActive !== undefined) {
        updateData.isActive = input.data.isActive;
      }

      const [updated] = await db
        .update(taskTemplates)
        .set(updateData)
        .where(eq(taskTemplates.id, input.id))
        .returning();

      return updated;
    }),

  // ===========================================================================
  // Delete Template
  // ===========================================================================

  /**
   * Delete a task template
   */
  delete: authenticatedProcedure
    .meta({ ai: createDeleteAIMeta('delete_task_template', 'Delete a task template', {
      scopes: ['task-templates', 'tasks'],
      permissions: ['delete:task-templates'],
      riskLevel: 'MEDIUM',
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTemplateOwnership(input.id, ctx.organizationId);

      await db.delete(taskTemplates).where(eq(taskTemplates.id, input.id));

      return { success: true };
    }),

  // ===========================================================================
  // Duplicate Template
  // ===========================================================================

  /**
   * Duplicate a task template with a new name
   */
  duplicate: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get the source template
      const sourceTemplate = await verifyTemplateOwnership(
        input.id,
        ctx.organizationId
      );

      // Check for duplicate name
      const existing = await db.query.taskTemplates.findFirst({
        where: and(
          eq(taskTemplates.organizationId, ctx.organizationId),
          eq(taskTemplates.name, input.name)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A task template with this name already exists',
        });
      }

      // Create the duplicate
      const [newTemplate] = await db
        .insert(taskTemplates)
        .values({
          organizationId: ctx.organizationId,
          name: input.name,
          description: sourceTemplate.description,
          entityTypes: sourceTemplate.entityTypes,
          templateData: sourceTemplate.templateData as TaskTemplateData,
          category: sourceTemplate.category,
          isActive: true,
          usageCount: 0,
          createdBy: ctx.user?.entityId ?? null,
        })
        .returning();

      return newTemplate;
    }),

  // ===========================================================================
  // Instantiate Template
  // ===========================================================================

  /**
   * Create actual entity_tasks records from a template
   *
   * This procedure:
   * 1. Gets the template and validates access
   * 2. Creates entity_task records for each task in the template
   * 3. Maps tempId references to real task IDs for parent/depends relationships
   * 4. Increments the usage_count on the template
   * 5. Returns the created task IDs
   */
  instantiate: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('instantiate_task_template', 'Create tasks from a template', {
      scopes: ['task-templates', 'tasks'],
      permissions: ['write:tasks', 'read:task-templates'],
      riskLevel: 'MEDIUM',
    }) })
    .input(
      z.object({
        templateId: z.string().uuid(),
        entityType: entityTypeEnum,
        entityId: z.string().uuid(),
        assigneeId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get and validate the template
      const template = await verifyTemplateOwnership(
        input.templateId,
        ctx.organizationId
      );

      if (!template.isActive) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot instantiate an inactive template',
        });
      }

      const templateData = template.templateData as TaskTemplateData;

      if (!templateData.tasks || templateData.tasks.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Template has no tasks to instantiate',
        });
      }

      // Validate entityType applicability
      const entityTypes = template.entityTypes as string[];
      if (
        entityTypes.length > 0 &&
        !entityTypes.includes(input.entityType)
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `This template does not apply to entity type: ${input.entityType}`,
        });
      }

      // Map of tempId -> created task ID
      const tempIdToTaskId = new Map<string, string>();
      const createdTaskIds: string[] = [];

      // Sort tasks by sortOrder to maintain hierarchy
      const sortedTasks = [...templateData.tasks].sort(
        (a, b) => a.sortOrder - b.sortOrder
      );

      // First pass: Create all tasks without parent/depends relationships
      for (const templateTask of sortedTasks) {
        const [createdTask] = await db
          .insert(entityTasks)
          .values({
            organizationId: ctx.organizationId,
            entityType: input.entityType,
            entityId: input.entityId,
            title: templateTask.title,
            description: templateTask.description,
            priority: templateTask.priority ?? 'medium',
            estimatedHours: templateTask.estimatedHours?.toString(),
            estimatedBudget: templateTask.estimatedBudget?.toString(),
            isBillable: templateTask.isBillable ?? false,
            sortOrder: templateTask.sortOrder,
            customFieldValues: templateTask.customFieldValues ?? {},
            assigneeId: input.assigneeId,
            createdBy: ctx.user?.entityId ?? null,
          })
          .returning();

        tempIdToTaskId.set(templateTask.tempId, createdTask.id);
        createdTaskIds.push(createdTask.id);
      }

      // Second pass: Update tasks with parent and dependency relationships
      for (const templateTask of sortedTasks) {
        const taskId = tempIdToTaskId.get(templateTask.tempId)!;
        const updates: Record<string, unknown> = {};

        // Map parent relationship
        if (templateTask.parentTempId) {
          const parentTaskId = tempIdToTaskId.get(templateTask.parentTempId);
          if (parentTaskId) {
            updates.parentTaskId = parentTaskId;
          }
        }

        // Map dependency relationships
        if (
          templateTask.dependsOnTempIds &&
          templateTask.dependsOnTempIds.length > 0
        ) {
          const dependsOnTaskIds = templateTask.dependsOnTempIds
            .map((tempId) => tempIdToTaskId.get(tempId))
            .filter(Boolean) as string[];

          if (dependsOnTaskIds.length > 0) {
            updates.dependsOnTaskIds = dependsOnTaskIds;
          }
        }

        // Only update if there are relationships to set
        if (Object.keys(updates).length > 0) {
          await db
            .update(entityTasks)
            .set(updates)
            .where(eq(entityTasks.id, taskId));
        }
      }

      // Increment usage count on the template
      await db
        .update(taskTemplates)
        .set({
          usageCount: sql`${taskTemplates.usageCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(taskTemplates.id, input.templateId));

      return {
        success: true,
        createdTaskIds,
        taskCount: createdTaskIds.length,
      };
    }),
});
