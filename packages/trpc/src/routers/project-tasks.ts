import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { ProjectTaskService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';
import {
  // Milestone schemas
  createProjectMilestoneSchema,
  updateProjectMilestoneSchema,
  projectMilestoneListInputSchema,
  // Task template schemas
  createProjectTaskTemplateSchema,
  updateProjectTaskTemplateSchema,
  projectTaskTemplateListInputSchema,
  // Task schemas
  createProjectTaskSchema,
  updateProjectTaskSchema,
  projectTaskListInputSchema,
  updateTaskStatusSchema,
  // Project template schemas
  createProjectTemplateSchema,
  updateProjectTemplateSchema,
  projectTemplateListInputSchema,
  // Template task schemas
  createProjectTemplateTaskSchema,
  // Bulk operation schemas
  projectTaskBulkStatusUpdateSchema,
  projectTaskGenerateFromTemplatesSchema,
  instantiateProjectFromTemplateSchema,
  // Common types
  ProjectTaskStatusEnum,
} from '@glapi/types';
import { byIdInputSchema, uuidSchema } from '@glapi/types';

export const projectTasksRouter = router({
  // ============================================================================
  // Project Milestones
  // ============================================================================

  /**
   * List milestones with optional filters and pagination
   */
  listMilestones: authenticatedProcedure
    .input(projectMilestoneListInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.listMilestones(
        { page: input?.page, limit: input?.limit },
        input?.filters || {},
        input?.orderBy || 'sortOrder',
        input?.orderDirection || 'asc'
      );
    }),

  /**
   * Get a single milestone by ID
   */
  getMilestone: authenticatedProcedure
    .input(byIdInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      const milestone = await service.getMilestoneById(input.id);

      if (!milestone) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Milestone not found',
        });
      }

      return milestone;
    }),

  /**
   * Get milestones by project
   */
  getMilestonesByProject: authenticatedProcedure
    .input(z.object({ projectId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.getMilestonesByProject(input.projectId);
    }),

  /**
   * Create a new milestone
   */
  createMilestone: authenticatedProcedure
    .input(createProjectMilestoneSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.createMilestone(input);
    }),

  /**
   * Update a milestone
   */
  updateMilestone: authenticatedProcedure
    .input(
      z.object({
        id: uuidSchema,
        data: updateProjectMilestoneSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      try {
        return await service.updateMilestone(input.id, input.data);
      } catch (error: any) {
        if (error.code === 'MILESTONE_NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Milestone not found',
          });
        }
        throw error;
      }
    }),

  /**
   * Delete a milestone
   */
  deleteMilestone: authenticatedProcedure
    .input(byIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      await service.deleteMilestone(input.id);
      return { success: true };
    }),

  /**
   * Get milestone progress for a project
   */
  getMilestoneProgress: authenticatedProcedure
    .input(z.object({ projectId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.getMilestoneProgress(input.projectId);
    }),

  // ============================================================================
  // Project Task Templates
  // ============================================================================

  /**
   * List task templates with optional filters and pagination
   */
  listTaskTemplates: authenticatedProcedure
    .input(projectTaskTemplateListInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.listTaskTemplates(
        { page: input?.page, limit: input?.limit },
        input?.filters || {},
        input?.orderBy || 'sortOrder',
        input?.orderDirection || 'asc'
      );
    }),

  /**
   * Get a single task template by ID
   */
  getTaskTemplate: authenticatedProcedure
    .input(byIdInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      const template = await service.getTaskTemplateById(input.id);

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task template not found',
        });
      }

      return template;
    }),

  /**
   * Get a task template by code
   */
  getTaskTemplateByCode: authenticatedProcedure
    .input(z.object({ templateCode: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      const template = await service.getTaskTemplateByCode(input.templateCode);

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task template not found',
        });
      }

      return template;
    }),

  /**
   * Create a new task template
   */
  createTaskTemplate: authenticatedProcedure
    .input(createProjectTaskTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      try {
        return await service.createTaskTemplate(input);
      } catch (error: any) {
        if (error.code === 'DUPLICATE_TEMPLATE_CODE') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Update a task template
   */
  updateTaskTemplate: authenticatedProcedure
    .input(
      z.object({
        id: uuidSchema,
        data: updateProjectTaskTemplateSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      try {
        return await service.updateTaskTemplate(input.id, input.data);
      } catch (error: any) {
        if (error.code === 'TEMPLATE_NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Task template not found',
          });
        }
        if (error.code === 'DUPLICATE_TEMPLATE_CODE') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Delete a task template
   */
  deleteTaskTemplate: authenticatedProcedure
    .input(byIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      await service.deleteTaskTemplate(input.id);
      return { success: true };
    }),

  // ============================================================================
  // Project Tasks
  // ============================================================================

  /**
   * List tasks with optional filters and pagination
   */
  listTasks: authenticatedProcedure
    .input(projectTaskListInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.listTasks(
        { page: input?.page, limit: input?.limit },
        input?.filters || {},
        input?.orderBy || 'sortOrder',
        input?.orderDirection || 'asc'
      );
    }),

  /**
   * Get a single task by ID
   */
  getTask: authenticatedProcedure
    .input(byIdInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      const task = await service.getTaskById(input.id);

      if (!task) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task not found',
        });
      }

      return task;
    }),

  /**
   * Get tasks by project
   */
  getTasksByProject: authenticatedProcedure
    .input(z.object({ projectId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.getTasksByProject(input.projectId);
    }),

  /**
   * Get tasks by milestone
   */
  getTasksByMilestone: authenticatedProcedure
    .input(z.object({ milestoneId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.getTasksByMilestone(input.milestoneId);
    }),

  /**
   * Get tasks by assignee
   */
  getTasksByAssignee: authenticatedProcedure
    .input(
      z.object({
        assigneeId: uuidSchema,
        status: z.union([ProjectTaskStatusEnum, z.array(ProjectTaskStatusEnum)]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.getTasksByAssignee(input.assigneeId, { status: input.status });
    }),

  /**
   * Get my tasks (tasks assigned to the current user)
   * Note: Requires the user's entity/employee ID to be known
   */
  getMyTasks: authenticatedProcedure
    .input(
      z
        .object({
          assigneeId: uuidSchema.describe('The entity ID of the current user (employee)'),
          status: z.union([ProjectTaskStatusEnum, z.array(ProjectTaskStatusEnum)]).optional(),
        })
    )
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.getTasksByAssignee(input.assigneeId, { status: input?.status });
    }),

  /**
   * Get child tasks for a parent task
   */
  getChildTasks: authenticatedProcedure
    .input(z.object({ parentTaskId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.getChildTasks(input.parentTaskId);
    }),

  /**
   * Get overdue tasks
   */
  getOverdueTasks: authenticatedProcedure.query(async ({ ctx }) => {
    const service = new ProjectTaskService(ctx.serviceContext);
    return service.getOverdueTasks();
  }),

  /**
   * Create a new task
   */
  createTask: authenticatedProcedure
    .input(createProjectTaskSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      try {
        return await service.createTask(input);
      } catch (error: any) {
        if (error.code === 'DEPENDENCY_NOT_FOUND') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Update a task
   */
  updateTask: authenticatedProcedure
    .input(
      z.object({
        id: uuidSchema,
        data: updateProjectTaskSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      try {
        return await service.updateTask(input.id, input.data);
      } catch (error: any) {
        if (error.code === 'TASK_NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Task not found',
          });
        }
        if (error.code === 'DEPENDENCY_NOT_FOUND' || error.code === 'INVALID_DEPENDENCY') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Update task status
   */
  updateTaskStatus: authenticatedProcedure
    .input(
      z.object({
        id: uuidSchema,
        data: updateTaskStatusSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      try {
        return await service.updateTaskStatus(input.id, input.data.status, input.data.blockedReason);
      } catch (error: any) {
        if (error.code === 'TASK_NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Task not found',
          });
        }
        if (error.code === 'BLOCKED_REASON_REQUIRED') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Delete a task
   */
  deleteTask: authenticatedProcedure
    .input(byIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      await service.deleteTask(input.id);
      return { success: true };
    }),

  /**
   * Bulk update task status
   */
  bulkUpdateTaskStatus: authenticatedProcedure
    .input(projectTaskBulkStatusUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.bulkUpdateTaskStatus(input);
    }),

  /**
   * Get project task summary
   */
  getProjectTaskSummary: authenticatedProcedure
    .input(z.object({ projectId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.getProjectTaskSummary(input.projectId);
    }),

  // ============================================================================
  // Project Templates
  // ============================================================================

  /**
   * List project templates with optional filters and pagination
   */
  listProjectTemplates: authenticatedProcedure
    .input(projectTemplateListInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.listProjectTemplates(
        { page: input?.page, limit: input?.limit },
        input?.filters || {},
        input?.orderBy || 'sortOrder',
        input?.orderDirection || 'asc'
      );
    }),

  /**
   * Get a single project template by ID
   */
  getProjectTemplate: authenticatedProcedure
    .input(byIdInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      const template = await service.getProjectTemplateById(input.id);

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project template not found',
        });
      }

      return template;
    }),

  /**
   * Get a project template by code
   */
  getProjectTemplateByCode: authenticatedProcedure
    .input(z.object({ templateCode: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      const template = await service.getProjectTemplateByCode(input.templateCode);

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project template not found',
        });
      }

      return template;
    }),

  /**
   * Create a new project template
   */
  createProjectTemplate: authenticatedProcedure
    .input(createProjectTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      try {
        return await service.createProjectTemplate(input);
      } catch (error: any) {
        if (error.code === 'DUPLICATE_TEMPLATE_CODE') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Update a project template
   */
  updateProjectTemplate: authenticatedProcedure
    .input(
      z.object({
        id: uuidSchema,
        data: updateProjectTemplateSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      try {
        return await service.updateProjectTemplate(input.id, input.data);
      } catch (error: any) {
        if (error.code === 'TEMPLATE_NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project template not found',
          });
        }
        if (error.code === 'DUPLICATE_TEMPLATE_CODE') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Delete a project template
   */
  deleteProjectTemplate: authenticatedProcedure
    .input(byIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      await service.deleteProjectTemplate(input.id);
      return { success: true };
    }),

  // ============================================================================
  // Project Template Tasks
  // ============================================================================

  /**
   * Get tasks in a project template
   */
  getProjectTemplateTasks: authenticatedProcedure
    .input(z.object({ projectTemplateId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.getProjectTemplateTasks(input.projectTemplateId);
    }),

  /**
   * Add a task template to a project template
   */
  addTaskToProjectTemplate: authenticatedProcedure
    .input(createProjectTemplateTaskSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.addTaskToProjectTemplate(input);
    }),

  /**
   * Remove a task from a project template
   */
  removeTaskFromProjectTemplate: authenticatedProcedure
    .input(byIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      await service.removeTaskFromProjectTemplate(input.id);
      return { success: true };
    }),

  // ============================================================================
  // Template Instantiation
  // ============================================================================

  /**
   * Generate tasks from task templates
   */
  generateTasksFromTemplates: authenticatedProcedure
    .input(projectTaskGenerateFromTemplatesSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      try {
        return await service.generateTasksFromTemplates(input);
      } catch (error: any) {
        if (error.code === 'NO_TEMPLATES_FOUND') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Instantiate a project from a project template
   * Creates milestones and tasks based on the template configuration
   */
  instantiateProjectFromTemplate: authenticatedProcedure
    .input(instantiateProjectFromTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      try {
        return await service.instantiateProjectFromTemplate(input);
      } catch (error: any) {
        if (error.code === 'TEMPLATE_NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project template not found',
          });
        }
        throw error;
      }
    }),
});
