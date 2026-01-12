import { z } from 'zod';
import { authenticatedProcedure, adminProcedure, router } from '../trpc';
import { CloseManagementService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

// Enums
const CloseTaskStatusEnum = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'PENDING_REVIEW',
  'COMPLETED',
  'BLOCKED',
  'SKIPPED',
]);

const CloseTaskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const VarianceAlertSeverityEnum = z.enum(['INFO', 'WARNING', 'CRITICAL']);

const TieoutStatusEnum = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'RECONCILED',
  'VARIANCE_IDENTIFIED',
  'APPROVED',
]);

// Input schemas
const createTaskTemplateSchema = z.object({
  organizationId: z.string().uuid(),
  templateName: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  defaultPriority: CloseTaskPriorityEnum.default('MEDIUM'),
  estimatedDurationMinutes: z.number().int().positive().optional(),
  dependsOnTemplateId: z.string().uuid().optional(),
  requiredRole: z.string().optional(),
  instructions: z.string().optional(),
  automationConfig: z.record(z.unknown()).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const createChecklistSchema = z.object({
  organizationId: z.string().uuid(),
  accountingPeriodId: z.string().uuid(),
  checklistName: z.string().min(1, 'Checklist name is required'),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  assignedTo: z.string().uuid().optional(),
});

const createTaskSchema = z.object({
  checklistId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  taskName: z.string().min(1, 'Task name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: CloseTaskPriorityEnum.default('MEDIUM'),
  assignedTo: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  sortOrder: z.number().int().default(0),
});

const createThresholdSchema = z.object({
  organizationId: z.string().uuid(),
  thresholdName: z.string().min(1, 'Threshold name is required'),
  description: z.string().optional(),
  metricType: z.string().min(1, 'Metric type is required'),
  accountId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  absoluteThreshold: z.string().optional(),
  percentageThreshold: z.string().optional(),
  comparisonType: z.string().min(1, 'Comparison type is required'),
  severity: VarianceAlertSeverityEnum.default('WARNING'),
  isActive: z.boolean().default(true),
});

const createTieoutTemplateSchema = z.object({
  organizationId: z.string().uuid(),
  templateName: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  sourceSystem: z.string().min(1, 'Source system is required'),
  sourceQuery: z.string().optional(),
  targetSystem: z.string().min(1, 'Target system is required'),
  targetQuery: z.string().optional(),
  reconciliationRules: z.record(z.unknown()).optional(),
  toleranceAmount: z.string().optional(),
  tolerancePercentage: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const closeManagementRouter = router({
  // ============================================================================
  // Task Templates
  // ============================================================================

  /**
   * List all task templates
   */
  listTemplates: authenticatedProcedure
    .input(
      z.object({
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(100).optional(),
        orderBy: z.enum(['sortOrder', 'taskCode', 'taskName', 'createdAt']).optional(),
        orderDirection: z.enum(['asc', 'desc']).optional(),
        category: z.string().optional(),
        isActive: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.listTaskTemplates(
        { page: input?.page, limit: input?.limit },
        { category: input?.category, isActive: input?.isActive },
        input?.orderBy || 'sortOrder',
        input?.orderDirection || 'asc'
      );
    }),

  /**
   * Get a single task template
   */
  getTemplate: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
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
   * Create a task template - ADMIN ONLY
   */
  createTemplate: adminProcedure
    .input(createTaskTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.createTaskTemplate(input);
    }),

  /**
   * Update a task template - ADMIN ONLY
   */
  updateTemplate: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: createTaskTemplateSchema.partial().omit({ organizationId: true }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.updateTaskTemplate(input.id, input.data);
    }),

  /**
   * Delete a task template - ADMIN ONLY
   */
  deleteTemplate: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      await service.deleteTaskTemplate(input.id);
      return { success: true };
    }),

  // ============================================================================
  // Checklists
  // ============================================================================

  /**
   * List all checklists
   */
  listChecklists: authenticatedProcedure
    .input(
      z.object({
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(100).optional(),
        orderBy: z.enum(['targetCloseDate', 'createdAt', 'checklistName']).optional(),
        orderDirection: z.enum(['asc', 'desc']).optional(),
        status: z.union([CloseTaskStatusEnum, z.array(CloseTaskStatusEnum)]).optional(),
        periodId: z.string().uuid().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.listChecklists(
        { page: input?.page, limit: input?.limit },
        { status: input?.status, periodId: input?.periodId },
        input?.orderBy || 'targetCloseDate',
        input?.orderDirection || 'desc'
      );
    }),

  /**
   * Get a single checklist
   */
  getChecklist: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      const checklist = await service.getChecklistById(input.id);

      if (!checklist) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Checklist not found',
        });
      }

      return checklist;
    }),

  /**
   * Get checklist for an accounting period
   */
  getChecklistByPeriod: authenticatedProcedure
    .input(z.object({ periodId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.getChecklistByPeriod(input.periodId);
    }),

  /**
   * Create a checklist for an accounting period
   */
  createChecklist: authenticatedProcedure
    .input(createChecklistSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.createChecklist(input);
    }),

  /**
   * Update a checklist
   */
  updateChecklist: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: z.object({
          checklistName: z.string().min(1).optional(),
          description: z.string().optional(),
          status: CloseTaskStatusEnum.optional(),
          dueDate: z.string().datetime().optional(),
          assignedTo: z.string().uuid().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.updateChecklist(input.id, input.data);
    }),

  // ============================================================================
  // Tasks
  // ============================================================================

  /**
   * List tasks for a checklist
   */
  listTasks: authenticatedProcedure
    .input(z.object({ checklistId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.listTasksByChecklist(input.checklistId);
    }),

  /**
   * Get a single task
   */
  getTask: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
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
   * Get tasks assigned to a user
   */
  getMyTasks: authenticatedProcedure
    .input(
      z.object({
        status: z.union([CloseTaskStatusEnum, z.array(CloseTaskStatusEnum)]).optional(),
        limit: z.number().int().positive().max(100).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.getTasksByAssignee(ctx.user.id, {
        status: input?.status,
        limit: input?.limit,
      });
    }),

  /**
   * Create a task
   */
  createTask: authenticatedProcedure
    .input(createTaskSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.createTask(input);
    }),

  /**
   * Update a task
   */
  updateTask: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: z.object({
          taskName: z.string().min(1).optional(),
          description: z.string().optional(),
          category: z.string().optional(),
          status: CloseTaskStatusEnum.optional(),
          priority: CloseTaskPriorityEnum.optional(),
          assignedTo: z.string().uuid().optional(),
          dueDate: z.string().datetime().optional(),
          blockedReason: z.string().optional(),
          notes: z.string().optional(),
          attachments: z.array(z.string()).optional(),
          sortOrder: z.number().int().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.updateTask(input.id, input.data);
    }),

  /**
   * Update task status
   */
  updateTaskStatus: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: CloseTaskStatusEnum,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.updateTaskStatus(input.id, input.status);
    }),

  /**
   * Delete a task
   */
  deleteTask: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      await service.deleteTask(input.id);
      return { success: true };
    }),

  /**
   * Generate tasks from templates
   */
  generateTasksFromTemplates: authenticatedProcedure
    .input(
      z.object({
        checklistId: z.string().uuid(),
        templateIds: z.array(z.string().uuid()).min(1),
        defaultAssignedTo: z.string().uuid().optional(),
        dueDateOffset: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.generateTasksFromTemplates(input);
    }),

  /**
   * Bulk update task status
   */
  bulkUpdateTaskStatus: authenticatedProcedure
    .input(
      z.object({
        taskIds: z.array(z.string().uuid()).min(1),
        status: CloseTaskStatusEnum,
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.bulkUpdateTaskStatus(input);
    }),

  // ============================================================================
  // Variance Thresholds
  // ============================================================================

  /**
   * List variance thresholds
   */
  listThresholds: authenticatedProcedure
    .input(z.object({ isActive: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.listVarianceThresholds({ isActive: input?.isActive });
    }),

  /**
   * Get a single variance threshold
   */
  getThreshold: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      const threshold = await service.getVarianceThresholdById(input.id);

      if (!threshold) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Variance threshold not found',
        });
      }

      return threshold;
    }),

  /**
   * Create a variance threshold - ADMIN ONLY
   */
  createThreshold: adminProcedure
    .input(createThresholdSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.createVarianceThreshold(input);
    }),

  /**
   * Update a variance threshold - ADMIN ONLY
   */
  updateThreshold: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: createThresholdSchema.partial().omit({ organizationId: true }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.updateVarianceThreshold(input.id, input.data);
    }),

  /**
   * Delete a variance threshold - ADMIN ONLY
   */
  deleteThreshold: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      await service.deleteVarianceThreshold(input.id);
      return { success: true };
    }),

  // ============================================================================
  // Variance Alerts
  // ============================================================================

  /**
   * List variance alerts for a period
   */
  listAlertsByPeriod: authenticatedProcedure
    .input(
      z.object({
        periodId: z.string().uuid(),
        status: z.union([z.string(), z.array(z.string())]).optional(),
        severity: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.listAlertsByPeriod(input.periodId, {
        status: input.status,
        severity: input.severity,
      });
    }),

  /**
   * List variance alerts for a checklist
   */
  listAlertsByChecklist: authenticatedProcedure
    .input(z.object({ checklistId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.listAlertsByChecklist(input.checklistId);
    }),

  /**
   * Get a single variance alert
   */
  getAlert: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      const alert = await service.getAlertById(input.id);

      if (!alert) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Variance alert not found',
        });
      }

      return alert;
    }),

  /**
   * Acknowledge a variance alert
   */
  acknowledgeAlert: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        acknowledgedNote: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.acknowledgeAlert(input.id, { acknowledgedNote: input.acknowledgedNote });
    }),

  /**
   * Resolve a variance alert
   */
  resolveAlert: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        resolutionNote: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.resolveAlert(input.id, { resolutionNote: input.resolutionNote });
    }),

  // ============================================================================
  // Tieout Templates
  // ============================================================================

  /**
   * List tieout templates
   */
  listTieoutTemplates: authenticatedProcedure
    .input(z.object({ isActive: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.listTieoutTemplates({ isActive: input?.isActive });
    }),

  /**
   * Get a single tieout template
   */
  getTieoutTemplate: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      const template = await service.getTieoutTemplateById(input.id);

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tieout template not found',
        });
      }

      return template;
    }),

  /**
   * Create a tieout template - ADMIN ONLY
   */
  createTieoutTemplate: adminProcedure
    .input(createTieoutTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.createTieoutTemplate(input);
    }),

  /**
   * Update a tieout template - ADMIN ONLY
   */
  updateTieoutTemplate: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: createTieoutTemplateSchema.partial().omit({ organizationId: true }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.updateTieoutTemplate(input.id, input.data);
    }),

  // ============================================================================
  // Tieout Instances
  // ============================================================================

  /**
   * List tieout instances for a period
   */
  listTieoutsByPeriod: authenticatedProcedure
    .input(
      z.object({
        periodId: z.string().uuid(),
        status: z.union([TieoutStatusEnum, z.array(TieoutStatusEnum)]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.listTieoutsByPeriod(input.periodId, { status: input.status });
    }),

  /**
   * List tieout instances for a checklist
   */
  listTieoutsByChecklist: authenticatedProcedure
    .input(z.object({ checklistId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.listTieoutsByChecklist(input.checklistId);
    }),

  /**
   * Get a single tieout instance
   */
  getTieout: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      const tieout = await service.getTieoutById(input.id);

      if (!tieout) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tieout instance not found',
        });
      }

      return tieout;
    }),

  /**
   * Create a tieout instance
   */
  createTieout: authenticatedProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        accountingPeriodId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.createTieoutInstance(input);
    }),

  /**
   * Update a tieout instance
   */
  updateTieout: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: z.object({
          status: TieoutStatusEnum.optional(),
          sourceValue: z.string().optional(),
          targetValue: z.string().optional(),
          varianceAmount: z.string().optional(),
          notes: z.string().optional(),
          supportingDocuments: z.array(z.string()).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.updateTieoutInstance(input.id, input.data);
    }),

  /**
   * Approve a tieout
   */
  approveTieout: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.approveTieout(input.id);
    }),

  // ============================================================================
  // Notifications
  // ============================================================================

  /**
   * Get notifications for current user
   */
  getMyNotifications: authenticatedProcedure
    .input(
      z.object({
        isRead: z.boolean().optional(),
        limit: z.number().int().positive().max(100).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.listNotifications({
        isRead: input?.isRead,
        limit: input?.limit,
      });
    }),

  /**
   * Mark a notification as read
   */
  markNotificationRead: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      await service.markNotificationRead(input.id);
      return { success: true };
    }),

  /**
   * Mark all notifications as read
   */
  markAllNotificationsRead: authenticatedProcedure.mutation(async ({ ctx }) => {
    const service = new CloseManagementService(ctx.serviceContext);
    await service.markAllNotificationsRead();
    return { success: true };
  }),

  /**
   * Dismiss a notification
   */
  dismissNotification: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      await service.dismissNotification(input.id);
      return { success: true };
    }),

  // ============================================================================
  // Dashboard / Summary
  // ============================================================================

  /**
   * Get close status summary for a period
   */
  getStatusSummary: authenticatedProcedure
    .input(z.object({ periodId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new CloseManagementService(ctx.serviceContext);
      return service.getCloseStatusSummary(input.periodId);
    }),

  /**
   * Get overdue tasks
   */
  getOverdueTasks: authenticatedProcedure.query(async ({ ctx }) => {
    const service = new CloseManagementService(ctx.serviceContext);
    return service.getOverdueTasks();
  }),
});
