/**
 * tRPC Router for Workflow Operations
 *
 * Provides API endpoints for managing workflows:
 * - Workflow CRUD operations
 * - Workflow groups management
 * - Workflow components management
 * - Template duplication
 */

import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  db,
  workflows,
  workflowGroups,
  workflowComponents,
  eq,
  and,
  asc,
  desc,
  isNull,
} from '@glapi/database';
import type {
  Workflow,
  WorkflowGroup,
  WorkflowComponent,
  WorkflowComponentType,
} from '@glapi/database';

// =============================================================================
// Input Schemas
// =============================================================================

const componentTypeEnum = z.enum([
  'lists',
  'transactions',
  'time_tracking',
  'construction',
]);

// Workflow schemas
const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  isTemplate: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  isTemplate: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// Group schemas
const createGroupSchema = z.object({
  workflowId: z.string().uuid(),
  name: z.string().min(1).max(255),
  displayOrder: z.number().int().min(0).optional().default(0),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  displayOrder: z.number().int().min(0).optional(),
});

// Component schemas
const createComponentSchema = z.object({
  workflowId: z.string().uuid(),
  groupId: z.string().uuid().optional().nullable(),
  componentType: componentTypeEnum,
  componentKey: z.string().min(1).max(100),
  displayName: z.string().min(1).max(255),
  icon: z.string().max(100).optional().nullable(),
  route: z.string().min(1).max(255),
  displayOrder: z.number().int().min(0).optional().default(0),
  isEnabled: z.boolean().optional().default(true),
});

const updateComponentSchema = z.object({
  groupId: z.string().uuid().optional().nullable(),
  componentType: componentTypeEnum.optional(),
  componentKey: z.string().min(1).max(100).optional(),
  displayName: z.string().min(1).max(255).optional(),
  icon: z.string().max(100).nullable().optional(),
  route: z.string().min(1).max(255).optional(),
  displayOrder: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional(),
});

// Reorder schema
const reorderComponentsSchema = z.object({
  workflowId: z.string().uuid(),
  componentOrders: z.array(
    z.object({
      id: z.string().uuid(),
      displayOrder: z.number().int().min(0),
      groupId: z.string().uuid().optional().nullable(),
    })
  ),
});

// =============================================================================
// Helper Functions
// =============================================================================

async function verifyWorkflowOwnership(
  workflowId: string,
  organizationId: string
): Promise<Workflow> {
  const workflow = await db.query.workflows.findFirst({
    where: and(
      eq(workflows.id, workflowId),
      eq(workflows.organizationId, organizationId)
    ),
  });

  if (!workflow) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Workflow not found',
    });
  }

  return workflow;
}

async function verifyGroupOwnership(
  groupId: string,
  organizationId: string
): Promise<WorkflowGroup> {
  const group = await db.query.workflowGroups.findFirst({
    where: eq(workflowGroups.id, groupId),
    with: {
      workflow: true,
    },
  });

  if (!group || group.workflow.organizationId !== organizationId) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Workflow group not found',
    });
  }

  return group;
}

async function verifyComponentOwnership(
  componentId: string,
  organizationId: string
): Promise<WorkflowComponent> {
  const component = await db.query.workflowComponents.findFirst({
    where: eq(workflowComponents.id, componentId),
    with: {
      workflow: true,
    },
  });

  if (!component || component.workflow.organizationId !== organizationId) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Workflow component not found',
    });
  }

  return component;
}

// =============================================================================
// Auto-Creation Helper
// =============================================================================

/**
 * Copy a system template (organizationId = null) to create a workflow for an organization
 */
async function copySystemTemplateToOrganization(
  templateName: string,
  organizationId: string
): Promise<void> {
  // Find the system template
  const template = await db.query.workflows.findFirst({
    where: and(
      eq(workflows.name, templateName),
      eq(workflows.isTemplate, true),
      isNull(workflows.organizationId)
    ),
    with: {
      groups: true,
      components: true,
    },
  });

  if (!template) {
    console.warn(`System template "${templateName}" not found, skipping auto-creation`);
    return;
  }

  // Check if workflow with this name already exists for the org
  const existing = await db.query.workflows.findFirst({
    where: and(
      eq(workflows.organizationId, organizationId),
      eq(workflows.name, templateName)
    ),
  });

  if (existing) {
    return; // Already exists, skip
  }

  // Create the new workflow for this organization
  const [newWorkflow] = await db
    .insert(workflows)
    .values({
      organizationId: organizationId,
      name: template.name,
      description: template.description,
      isTemplate: false,
      isActive: true,
    })
    .returning();

  // Create a mapping of old group IDs to new group IDs
  const groupIdMap = new Map<string, string>();

  // Copy groups
  if (template.groups.length > 0) {
    const newGroups = await db
      .insert(workflowGroups)
      .values(
        template.groups.map((group) => ({
          workflowId: newWorkflow.id,
          name: group.name,
          displayOrder: group.displayOrder,
        }))
      )
      .returning();

    // Build the ID mapping
    template.groups.forEach((oldGroup, index) => {
      groupIdMap.set(oldGroup.id, newGroups[index].id);
    });
  }

  // Copy components
  if (template.components.length > 0) {
    await db.insert(workflowComponents).values(
      template.components.map((component) => ({
        workflowId: newWorkflow.id,
        groupId: component.groupId
          ? groupIdMap.get(component.groupId) ?? null
          : null,
        componentType: component.componentType as WorkflowComponentType,
        componentKey: component.componentKey,
        displayName: component.displayName,
        icon: component.icon,
        route: component.route,
        displayOrder: component.displayOrder,
        isEnabled: component.isEnabled,
      }))
    );
  }

  console.log(`Auto-created "${templateName}" workflow for organization ${organizationId}`);
}

// =============================================================================
// Router
// =============================================================================

export const workflowsRouter = router({
  // ===========================================================================
  // Workflow CRUD
  // ===========================================================================

  /**
   * List all workflows for the current organization
   *
   * If the organization has no workflows, this will automatically create
   * the "Client to Cash" workflow from the system template to ensure
   * users have a default workflow immediately.
   */
  list: authenticatedProcedure
    .input(
      z
        .object({
          includeInactive: z.boolean().optional().default(false),
          templatesOnly: z.boolean().optional().default(false),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(workflows.organizationId, ctx.organizationId)];

      if (!input?.includeInactive) {
        conditions.push(eq(workflows.isActive, true));
      }

      if (input?.templatesOnly) {
        conditions.push(eq(workflows.isTemplate, true));
      }

      // First, check if org has any workflows at all
      const existingWorkflows = await db.query.workflows.findMany({
        where: eq(workflows.organizationId, ctx.organizationId),
        columns: { id: true },
        limit: 1,
      });

      // If no workflows exist, auto-create the default "Client to Cash" workflow
      if (existingWorkflows.length === 0) {
        await copySystemTemplateToOrganization('Client to Cash', ctx.organizationId);
      }

      const result = await db.query.workflows.findMany({
        where: and(...conditions),
        orderBy: [asc(workflows.name)],
        with: {
          groups: {
            orderBy: [asc(workflowGroups.displayOrder)],
          },
          components: {
            orderBy: [asc(workflowComponents.displayOrder)],
          },
        },
      });

      return result;
    }),

  /**
   * Get a single workflow by ID with groups and components
   */
  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const workflow = await db.query.workflows.findFirst({
        where: and(
          eq(workflows.id, input.id),
          eq(workflows.organizationId, ctx.organizationId)
        ),
        with: {
          groups: {
            orderBy: [asc(workflowGroups.displayOrder)],
            with: {
              components: {
                orderBy: [asc(workflowComponents.displayOrder)],
              },
            },
          },
          components: {
            orderBy: [asc(workflowComponents.displayOrder)],
          },
        },
      });

      if (!workflow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow not found',
        });
      }

      return workflow;
    }),

  /**
   * Create a new workflow
   */
  create: authenticatedProcedure
    .input(createWorkflowSchema)
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate name within organization
      const existing = await db.query.workflows.findFirst({
        where: and(
          eq(workflows.organizationId, ctx.organizationId),
          eq(workflows.name, input.name)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A workflow with this name already exists',
        });
      }

      const [workflow] = await db
        .insert(workflows)
        .values({
          organizationId: ctx.organizationId,
          name: input.name,
          description: input.description,
          isTemplate: input.isTemplate,
          isActive: input.isActive,
        })
        .returning();

      return workflow;
    }),

  /**
   * Update a workflow
   */
  update: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateWorkflowSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyWorkflowOwnership(input.id, ctx.organizationId);

      // Check for duplicate name if name is being updated
      if (input.data.name) {
        const existing = await db.query.workflows.findFirst({
          where: and(
            eq(workflows.organizationId, ctx.organizationId),
            eq(workflows.name, input.data.name)
          ),
        });

        if (existing && existing.id !== input.id) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A workflow with this name already exists',
          });
        }
      }

      const [updated] = await db
        .update(workflows)
        .set({
          ...input.data,
          updatedAt: new Date(),
        })
        .where(eq(workflows.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete a workflow (cascades to groups and components)
   */
  delete: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifyWorkflowOwnership(input.id, ctx.organizationId);

      await db.delete(workflows).where(eq(workflows.id, input.id));

      return { success: true };
    }),

  // ===========================================================================
  // Workflow Groups
  // ===========================================================================

  /**
   * Add a group to a workflow
   */
  addGroup: authenticatedProcedure
    .input(createGroupSchema)
    .mutation(async ({ ctx, input }) => {
      await verifyWorkflowOwnership(input.workflowId, ctx.organizationId);

      // Check for duplicate group name within workflow
      const existing = await db.query.workflowGroups.findFirst({
        where: and(
          eq(workflowGroups.workflowId, input.workflowId),
          eq(workflowGroups.name, input.name)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A group with this name already exists in this workflow',
        });
      }

      const [group] = await db
        .insert(workflowGroups)
        .values({
          workflowId: input.workflowId,
          name: input.name,
          displayOrder: input.displayOrder,
        })
        .returning();

      return group;
    }),

  /**
   * Update a workflow group
   */
  updateGroup: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateGroupSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const group = await verifyGroupOwnership(input.id, ctx.organizationId);

      // Check for duplicate name if name is being updated
      if (input.data.name) {
        const existing = await db.query.workflowGroups.findFirst({
          where: and(
            eq(workflowGroups.workflowId, group.workflowId),
            eq(workflowGroups.name, input.data.name)
          ),
        });

        if (existing && existing.id !== input.id) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A group with this name already exists in this workflow',
          });
        }
      }

      const [updated] = await db
        .update(workflowGroups)
        .set({
          ...input.data,
          updatedAt: new Date(),
        })
        .where(eq(workflowGroups.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete a workflow group (components will have groupId set to null)
   */
  deleteGroup: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifyGroupOwnership(input.id, ctx.organizationId);

      await db.delete(workflowGroups).where(eq(workflowGroups.id, input.id));

      return { success: true };
    }),

  // ===========================================================================
  // Workflow Components
  // ===========================================================================

  /**
   * Add a component to a workflow
   */
  addComponent: authenticatedProcedure
    .input(createComponentSchema)
    .mutation(async ({ ctx, input }) => {
      await verifyWorkflowOwnership(input.workflowId, ctx.organizationId);

      // Verify group belongs to the same workflow if specified
      if (input.groupId) {
        const group = await db.query.workflowGroups.findFirst({
          where: and(
            eq(workflowGroups.id, input.groupId),
            eq(workflowGroups.workflowId, input.workflowId)
          ),
        });

        if (!group) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'The specified group does not belong to this workflow',
          });
        }
      }

      // Check for duplicate component key within workflow
      const existing = await db.query.workflowComponents.findFirst({
        where: and(
          eq(workflowComponents.workflowId, input.workflowId),
          eq(workflowComponents.componentKey, input.componentKey)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A component with this key already exists in this workflow',
        });
      }

      const [component] = await db
        .insert(workflowComponents)
        .values({
          workflowId: input.workflowId,
          groupId: input.groupId,
          componentType: input.componentType,
          componentKey: input.componentKey,
          displayName: input.displayName,
          icon: input.icon,
          route: input.route,
          displayOrder: input.displayOrder,
          isEnabled: input.isEnabled,
        })
        .returning();

      return component;
    }),

  /**
   * Update a workflow component
   */
  updateComponent: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateComponentSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const component = await verifyComponentOwnership(
        input.id,
        ctx.organizationId
      );

      // Verify group belongs to the same workflow if specified
      if (input.data.groupId) {
        const group = await db.query.workflowGroups.findFirst({
          where: and(
            eq(workflowGroups.id, input.data.groupId),
            eq(workflowGroups.workflowId, component.workflowId)
          ),
        });

        if (!group) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'The specified group does not belong to this workflow',
          });
        }
      }

      // Check for duplicate component key if being updated
      if (input.data.componentKey) {
        const existing = await db.query.workflowComponents.findFirst({
          where: and(
            eq(workflowComponents.workflowId, component.workflowId),
            eq(workflowComponents.componentKey, input.data.componentKey)
          ),
        });

        if (existing && existing.id !== input.id) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A component with this key already exists in this workflow',
          });
        }
      }

      const [updated] = await db
        .update(workflowComponents)
        .set({
          ...input.data,
          updatedAt: new Date(),
        })
        .where(eq(workflowComponents.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete a workflow component
   */
  deleteComponent: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifyComponentOwnership(input.id, ctx.organizationId);

      await db
        .delete(workflowComponents)
        .where(eq(workflowComponents.id, input.id));

      return { success: true };
    }),

  /**
   * Reorder components within a workflow
   */
  reorderComponents: authenticatedProcedure
    .input(reorderComponentsSchema)
    .mutation(async ({ ctx, input }) => {
      await verifyWorkflowOwnership(input.workflowId, ctx.organizationId);

      // Update each component's order and optionally group
      const updates = input.componentOrders.map(async (item) => {
        // Verify group if specified
        if (item.groupId) {
          const group = await db.query.workflowGroups.findFirst({
            where: and(
              eq(workflowGroups.id, item.groupId),
              eq(workflowGroups.workflowId, input.workflowId)
            ),
          });

          if (!group) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Group ${item.groupId} does not belong to this workflow`,
            });
          }
        }

        return db
          .update(workflowComponents)
          .set({
            displayOrder: item.displayOrder,
            groupId: item.groupId ?? null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(workflowComponents.id, item.id),
              eq(workflowComponents.workflowId, input.workflowId)
            )
          );
      });

      await Promise.all(updates);

      // Return updated workflow with components
      const workflow = await db.query.workflows.findFirst({
        where: eq(workflows.id, input.workflowId),
        with: {
          groups: {
            orderBy: [asc(workflowGroups.displayOrder)],
          },
          components: {
            orderBy: [asc(workflowComponents.displayOrder)],
          },
        },
      });

      return workflow;
    }),

  // ===========================================================================
  // Template Operations
  // ===========================================================================

  /**
   * Duplicate a template workflow to create a new workflow
   */
  duplicateFromTemplate: authenticatedProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the template exists and belongs to this organization
      const template = await db.query.workflows.findFirst({
        where: and(
          eq(workflows.id, input.templateId),
          eq(workflows.organizationId, ctx.organizationId),
          eq(workflows.isTemplate, true)
        ),
        with: {
          groups: true,
          components: true,
        },
      });

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template workflow not found',
        });
      }

      // Check for duplicate name
      const existing = await db.query.workflows.findFirst({
        where: and(
          eq(workflows.organizationId, ctx.organizationId),
          eq(workflows.name, input.name)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A workflow with this name already exists',
        });
      }

      // Create the new workflow
      const [newWorkflow] = await db
        .insert(workflows)
        .values({
          organizationId: ctx.organizationId,
          name: input.name,
          description: input.description ?? template.description,
          isTemplate: false,
          isActive: true,
        })
        .returning();

      // Create a mapping of old group IDs to new group IDs
      const groupIdMap = new Map<string, string>();

      // Copy groups
      if (template.groups.length > 0) {
        const newGroups = await db
          .insert(workflowGroups)
          .values(
            template.groups.map((group) => ({
              workflowId: newWorkflow.id,
              name: group.name,
              displayOrder: group.displayOrder,
            }))
          )
          .returning();

        // Build the ID mapping
        template.groups.forEach((oldGroup, index) => {
          groupIdMap.set(oldGroup.id, newGroups[index].id);
        });
      }

      // Copy components
      if (template.components.length > 0) {
        await db.insert(workflowComponents).values(
          template.components.map((component) => ({
            workflowId: newWorkflow.id,
            groupId: component.groupId
              ? groupIdMap.get(component.groupId) ?? null
              : null,
            componentType: component.componentType as WorkflowComponentType,
            componentKey: component.componentKey,
            displayName: component.displayName,
            icon: component.icon,
            route: component.route,
            displayOrder: component.displayOrder,
            isEnabled: component.isEnabled,
          }))
        );
      }

      // Return the new workflow with its groups and components
      const result = await db.query.workflows.findFirst({
        where: eq(workflows.id, newWorkflow.id),
        with: {
          groups: {
            orderBy: [asc(workflowGroups.displayOrder)],
          },
          components: {
            orderBy: [asc(workflowComponents.displayOrder)],
          },
        },
      });

      return result;
    }),
});
