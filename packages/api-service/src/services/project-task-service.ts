/**
 * Project Task Service
 *
 * Business logic for project tasks, milestones, templates, and project templates.
 * Handles task management, assignment workflows, status transitions, and
 * template instantiation.
 *
 * @module project-task-service
 */

import { BaseService } from './base-service';
import {
  ProjectMilestone,
  CreateProjectMilestoneInput,
  UpdateProjectMilestoneInput,
  ProjectTaskTemplate,
  CreateProjectTaskTemplateInput,
  UpdateProjectTaskTemplateInput,
  ProjectTask,
  CreateProjectTaskInput,
  UpdateProjectTaskInput,
  ProjectTemplate,
  CreateProjectTemplateInput,
  UpdateProjectTemplateInput,
  ProjectTemplateTask,
  CreateProjectTemplateTaskInput,
  ProjectTaskFilters,
  ProjectMilestoneFilters,
  ProjectTaskTemplateFilters,
  ProjectTemplateFilters,
  ProjectTaskBulkStatusUpdateInput,
  ProjectTaskGenerateFromTemplatesInput,
  InstantiateProjectFromTemplateInput,
  ProjectTaskSummary,
  MilestoneProgress,
  MilestoneDefinition,
  ProjectTaskStatus,
  ProjectTaskPriority,
  ProjectMilestoneStatus,
} from '../types/project-tasks.types';
import { PaginationParams, PaginatedResult, ServiceError } from '../types';
import { ProjectTaskRepository, type ContextualDatabase } from '@glapi/database';

export interface ProjectTaskServiceOptions {
  db?: ContextualDatabase;
}

export class ProjectTaskService extends BaseService {
  private repository: ProjectTaskRepository;

  constructor(context = {}, options: ProjectTaskServiceOptions = {}) {
    super(context);
    // Pass the contextual db to the repository for RLS support
    this.repository = new ProjectTaskRepository(options.db);
  }

  /**
   * Generate a unique code for tasks, templates, etc.
   */
  private generateCode(prefix: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  // ============================================================================
  // Type Transformers
  // ============================================================================

  private transformMilestone(dbMilestone: any): ProjectMilestone {
    return {
      id: dbMilestone.id,
      projectId: dbMilestone.projectId,
      organizationId: dbMilestone.organizationId,
      name: dbMilestone.name,
      description: dbMilestone.description,
      targetDate: dbMilestone.targetDate,
      completedDate: dbMilestone.completedDate,
      status: dbMilestone.status as ProjectMilestoneStatus,
      sortOrder: dbMilestone.sortOrder,
      isBillingMilestone: dbMilestone.isBillingMilestone,
      metadata: dbMilestone.metadata,
      createdBy: dbMilestone.createdBy,
      createdAt: dbMilestone.createdAt,
      updatedAt: dbMilestone.updatedAt ?? new Date(),
    };
  }

  private transformTaskTemplate(dbTemplate: any): ProjectTaskTemplate {
    return {
      id: dbTemplate.id,
      organizationId: dbTemplate.organizationId,
      subsidiaryId: dbTemplate.subsidiaryId,
      templateCode: dbTemplate.templateCode,
      templateName: dbTemplate.templateName,
      description: dbTemplate.description,
      category: dbTemplate.category,
      priority: dbTemplate.priority as ProjectTaskPriority,
      estimatedHours: dbTemplate.estimatedHours ? Number(dbTemplate.estimatedHours) : null,
      instructions: dbTemplate.instructions,
      activityCodeId: dbTemplate.activityCodeId,
      defaultServiceItemId: dbTemplate.defaultServiceItemId,
      defaultAssigneeId: dbTemplate.defaultAssigneeId,
      dependsOnTemplateCodes: dbTemplate.dependsOnTemplateCodes ?? [],
      isActive: dbTemplate.isActive,
      sortOrder: dbTemplate.sortOrder,
      metadata: dbTemplate.metadata,
      createdBy: dbTemplate.createdBy,
      createdAt: dbTemplate.createdAt,
      updatedAt: dbTemplate.updatedAt ?? new Date(),
    };
  }

  private transformTask(dbTask: any): ProjectTask {
    return {
      id: dbTask.id,
      projectId: dbTask.projectId,
      milestoneId: dbTask.milestoneId,
      templateId: dbTask.templateId,
      parentTaskId: dbTask.parentTaskId,
      organizationId: dbTask.organizationId,
      taskCode: dbTask.taskCode,
      taskName: dbTask.taskName,
      description: dbTask.description,
      category: dbTask.category,
      priority: dbTask.priority as ProjectTaskPriority,
      status: dbTask.status as ProjectTaskStatus,
      activityCodeId: dbTask.activityCodeId,
      serviceItemId: dbTask.serviceItemId,
      assigneeId: dbTask.assigneeId,
      reviewerId: dbTask.reviewerId,
      dueDate: dbTask.dueDate,
      startedAt: dbTask.startedAt,
      completedAt: dbTask.completedAt,
      reviewedAt: dbTask.reviewedAt,
      estimatedHours: dbTask.estimatedHours ? Number(dbTask.estimatedHours) : null,
      actualHours: dbTask.actualHours ? Number(dbTask.actualHours) : null,
      dependsOnTaskIds: dbTask.dependsOnTaskIds ?? [],
      blockedReason: dbTask.blockedReason,
      workNotes: dbTask.workNotes,
      reviewNotes: dbTask.reviewNotes,
      attachmentUrls: dbTask.attachmentUrls ?? [],
      sortOrder: dbTask.sortOrder,
      isBillable: dbTask.isBillable,
      billingRate: dbTask.billingRate ? Number(dbTask.billingRate) : null,
      metadata: dbTask.metadata,
      createdBy: dbTask.createdBy,
      createdAt: dbTask.createdAt,
      updatedAt: dbTask.updatedAt ?? new Date(),
    };
  }

  private transformProjectTemplate(dbTemplate: any): ProjectTemplate {
    return {
      id: dbTemplate.id,
      organizationId: dbTemplate.organizationId,
      subsidiaryId: dbTemplate.subsidiaryId,
      templateCode: dbTemplate.templateCode,
      templateName: dbTemplate.templateName,
      description: dbTemplate.description,
      projectType: dbTemplate.projectType,
      defaultMilestones: dbTemplate.defaultMilestones ?? [],
      isActive: dbTemplate.isActive,
      sortOrder: dbTemplate.sortOrder,
      metadata: dbTemplate.metadata,
      createdBy: dbTemplate.createdBy,
      createdAt: dbTemplate.createdAt,
      updatedAt: dbTemplate.updatedAt ?? new Date(),
    };
  }

  private transformTemplateTask(dbTemplateTask: any): ProjectTemplateTask {
    return {
      id: dbTemplateTask.id,
      projectTemplateId: dbTemplateTask.projectTemplateId,
      taskTemplateId: dbTemplateTask.taskTemplateId,
      milestoneName: dbTemplateTask.milestoneName,
      sortOrder: dbTemplateTask.sortOrder,
      metadata: dbTemplateTask.metadata,
      createdAt: dbTemplateTask.createdAt,
    };
  }

  // ============================================================================
  // Project Milestones
  // ============================================================================

  async listMilestones(
    params: PaginationParams = {},
    filters: ProjectMilestoneFilters = {},
    orderBy: 'sortOrder' | 'targetDate' | 'name' | 'createdAt' = 'sortOrder',
    orderDirection: 'asc' | 'desc' = 'asc'
  ): Promise<PaginatedResult<ProjectMilestone>> {
    const organizationId = this.requireOrganizationContext();

    const result = await this.repository.findAllMilestones(
      organizationId,
      { page: params.page, limit: params.limit, orderBy, orderDirection },
      filters
    );

    return {
      data: result.data.map((m) => this.transformMilestone(m)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async getMilestoneById(id: string): Promise<ProjectMilestone | null> {
    const organizationId = this.requireOrganizationContext();
    const milestone = await this.repository.findMilestoneById(id, organizationId);
    return milestone ? this.transformMilestone(milestone) : null;
  }

  async getMilestonesByProject(projectId: string): Promise<ProjectMilestone[]> {
    const organizationId = this.requireOrganizationContext();
    const milestones = await this.repository.findMilestonesByProject(projectId, organizationId);
    return milestones.map((m) => this.transformMilestone(m));
  }

  async createMilestone(data: CreateProjectMilestoneInput): Promise<ProjectMilestone> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;

    const created = await this.repository.createMilestone({
      projectId: data.projectId,
      organizationId,
      name: data.name,
      description: data.description ?? null,
      targetDate: data.targetDate ?? null,
      status: (data.status ?? 'PENDING') as any,
      sortOrder: data.sortOrder ?? 0,
      isBillingMilestone: data.isBillingMilestone ?? false,
      metadata: data.metadata ?? null,
      createdBy: userId ?? null,
    });

    return this.transformMilestone(created);
  }

  async updateMilestone(id: string, data: UpdateProjectMilestoneInput): Promise<ProjectMilestone> {
    const organizationId = this.requireOrganizationContext();

    const updates: any = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.targetDate !== undefined) updates.targetDate = data.targetDate;
    if (data.completedDate !== undefined) updates.completedDate = data.completedDate;
    if (data.status !== undefined) updates.status = data.status;
    if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
    if (data.isBillingMilestone !== undefined) updates.isBillingMilestone = data.isBillingMilestone;
    if (data.metadata !== undefined) updates.metadata = data.metadata;

    // Auto-set completedDate when status changes to COMPLETED
    if (data.status === 'COMPLETED' && !data.completedDate) {
      updates.completedDate = new Date().toISOString().split('T')[0];
    }

    const updated = await this.repository.updateMilestone(id, organizationId, updates);

    if (!updated) {
      throw new ServiceError('Milestone not found', 'MILESTONE_NOT_FOUND', 404);
    }

    return this.transformMilestone(updated);
  }

  async deleteMilestone(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    await this.repository.deleteMilestone(id, organizationId);
  }

  // ============================================================================
  // Project Task Templates
  // ============================================================================

  async listTaskTemplates(
    params: PaginationParams = {},
    filters: ProjectTaskTemplateFilters = {},
    orderBy: 'sortOrder' | 'templateCode' | 'templateName' | 'createdAt' = 'sortOrder',
    orderDirection: 'asc' | 'desc' = 'asc'
  ): Promise<PaginatedResult<ProjectTaskTemplate>> {
    const organizationId = this.requireOrganizationContext();

    const result = await this.repository.findAllTaskTemplates(
      organizationId,
      { page: params.page, limit: params.limit, orderBy, orderDirection },
      filters
    );

    return {
      data: result.data.map((t) => this.transformTaskTemplate(t)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async getTaskTemplateById(id: string): Promise<ProjectTaskTemplate | null> {
    const organizationId = this.requireOrganizationContext();
    const template = await this.repository.findTaskTemplateById(id, organizationId);
    return template ? this.transformTaskTemplate(template) : null;
  }

  async getTaskTemplateByCode(templateCode: string): Promise<ProjectTaskTemplate | null> {
    const organizationId = this.requireOrganizationContext();
    const template = await this.repository.findTaskTemplateByCode(templateCode, organizationId);
    return template ? this.transformTaskTemplate(template) : null;
  }

  async createTaskTemplate(data: CreateProjectTaskTemplateInput): Promise<ProjectTaskTemplate> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;

    // Check for duplicate template code
    const existing = await this.repository.findTaskTemplateByCode(data.templateCode, organizationId);
    if (existing) {
      throw new ServiceError(
        `Task template with code "${data.templateCode}" already exists`,
        'DUPLICATE_TEMPLATE_CODE',
        409
      );
    }

    const created = await this.repository.createTaskTemplate({
      organizationId,
      subsidiaryId: data.subsidiaryId ?? null,
      templateCode: data.templateCode,
      templateName: data.templateName,
      description: data.description ?? null,
      category: data.category ?? null,
      priority: (data.priority ?? 'MEDIUM') as any,
      estimatedHours: data.estimatedHours?.toString() ?? null,
      instructions: data.instructions ?? null,
      activityCodeId: data.activityCodeId ?? null,
      defaultServiceItemId: data.defaultServiceItemId ?? null,
      defaultAssigneeId: data.defaultAssigneeId ?? null,
      dependsOnTemplateCodes: data.dependsOnTemplateCodes ?? [],
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      metadata: data.metadata ?? null,
      createdBy: userId ?? null,
    });

    return this.transformTaskTemplate(created);
  }

  async updateTaskTemplate(id: string, data: UpdateProjectTaskTemplateInput): Promise<ProjectTaskTemplate> {
    const organizationId = this.requireOrganizationContext();

    // If updating template code, check for duplicates
    if (data.templateCode) {
      const existing = await this.repository.findTaskTemplateByCode(data.templateCode, organizationId);
      if (existing && existing.id !== id) {
        throw new ServiceError(
          `Task template with code "${data.templateCode}" already exists`,
          'DUPLICATE_TEMPLATE_CODE',
          409
        );
      }
    }

    const updates: any = {};
    if (data.templateCode !== undefined) updates.templateCode = data.templateCode;
    if (data.templateName !== undefined) updates.templateName = data.templateName;
    if (data.description !== undefined) updates.description = data.description;
    if (data.category !== undefined) updates.category = data.category;
    if (data.priority !== undefined) updates.priority = data.priority;
    if (data.estimatedHours !== undefined) updates.estimatedHours = data.estimatedHours?.toString() ?? null;
    if (data.instructions !== undefined) updates.instructions = data.instructions;
    if (data.activityCodeId !== undefined) updates.activityCodeId = data.activityCodeId;
    if (data.defaultServiceItemId !== undefined) updates.defaultServiceItemId = data.defaultServiceItemId;
    if (data.defaultAssigneeId !== undefined) updates.defaultAssigneeId = data.defaultAssigneeId;
    if (data.dependsOnTemplateCodes !== undefined) updates.dependsOnTemplateCodes = data.dependsOnTemplateCodes;
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
    if (data.metadata !== undefined) updates.metadata = data.metadata;

    const updated = await this.repository.updateTaskTemplate(id, organizationId, updates);

    if (!updated) {
      throw new ServiceError('Task template not found', 'TEMPLATE_NOT_FOUND', 404);
    }

    return this.transformTaskTemplate(updated);
  }

  async deleteTaskTemplate(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    await this.repository.deleteTaskTemplate(id, organizationId);
  }

  // ============================================================================
  // Project Tasks
  // ============================================================================

  async listTasks(
    params: PaginationParams = {},
    filters: ProjectTaskFilters = {},
    orderBy: 'sortOrder' | 'dueDate' | 'taskName' | 'createdAt' | 'priority' = 'sortOrder',
    orderDirection: 'asc' | 'desc' = 'asc'
  ): Promise<PaginatedResult<ProjectTask>> {
    const organizationId = this.requireOrganizationContext();

    const repoFilters: any = { ...filters };
    if (filters.dueBefore) repoFilters.dueBefore = new Date(filters.dueBefore);
    if (filters.dueAfter) repoFilters.dueAfter = new Date(filters.dueAfter);

    const result = await this.repository.findAllTasks(
      organizationId,
      { page: params.page, limit: params.limit, orderBy, orderDirection },
      repoFilters
    );

    return {
      data: result.data.map((t) => this.transformTask(t)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async getTaskById(id: string): Promise<ProjectTask | null> {
    const organizationId = this.requireOrganizationContext();
    const task = await this.repository.findTaskById(id, organizationId);
    return task ? this.transformTask(task) : null;
  }

  async getTasksByProject(projectId: string): Promise<ProjectTask[]> {
    const organizationId = this.requireOrganizationContext();
    const tasks = await this.repository.findTasksByProject(projectId, organizationId);
    return tasks.map((t) => this.transformTask(t));
  }

  async getTasksByMilestone(milestoneId: string): Promise<ProjectTask[]> {
    const tasks = await this.repository.findTasksByMilestone(milestoneId);
    return tasks.map((t) => this.transformTask(t));
  }

  async getTasksByAssignee(assigneeId: string, filters: { status?: ProjectTaskStatus | ProjectTaskStatus[] } = {}): Promise<ProjectTask[]> {
    const organizationId = this.requireOrganizationContext();
    const tasks = await this.repository.findTasksByAssignee(assigneeId, organizationId, filters);
    return tasks.map((t) => this.transformTask(t));
  }

  async getChildTasks(parentTaskId: string): Promise<ProjectTask[]> {
    const tasks = await this.repository.findChildTasks(parentTaskId);
    return tasks.map((t) => this.transformTask(t));
  }

  async getOverdueTasks(): Promise<ProjectTask[]> {
    const organizationId = this.requireOrganizationContext();
    const tasks = await this.repository.findOverdueTasks(organizationId);
    return tasks.map((t) => this.transformTask(t));
  }

  async createTask(data: CreateProjectTaskInput): Promise<ProjectTask> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;

    // Validate dependencies if provided
    if (data.dependsOnTaskIds && data.dependsOnTaskIds.length > 0) {
      for (const depId of data.dependsOnTaskIds) {
        const depTask = await this.repository.findTaskById(depId, organizationId);
        if (!depTask) {
          throw new ServiceError(
            `Dependency task with ID "${depId}" not found`,
            'DEPENDENCY_NOT_FOUND',
            400
          );
        }
      }
    }

    const created = await this.repository.createTask({
      projectId: data.projectId,
      organizationId,
      milestoneId: data.milestoneId ?? null,
      templateId: data.templateId ?? null,
      parentTaskId: data.parentTaskId ?? null,
      taskCode: data.taskCode ?? this.generateCode('TSK'),
      taskName: data.taskName,
      description: data.description ?? null,
      category: data.category ?? null,
      priority: (data.priority ?? 'MEDIUM') as any,
      status: (data.status ?? 'NOT_STARTED') as any,
      activityCodeId: data.activityCodeId ?? null,
      serviceItemId: data.serviceItemId ?? null,
      assigneeId: data.assigneeId ?? null,
      reviewerId: data.reviewerId ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      estimatedHours: data.estimatedHours?.toString() ?? null,
      dependsOnTaskIds: data.dependsOnTaskIds ?? [],
      workNotes: data.workNotes ?? null,
      attachmentUrls: data.attachmentUrls ?? [],
      sortOrder: data.sortOrder ?? 0,
      isBillable: data.isBillable ?? true,
      billingRate: data.billingRate?.toString() ?? null,
      metadata: data.metadata ?? null,
      createdBy: userId ?? null,
    });

    return this.transformTask(created);
  }

  async updateTask(id: string, data: UpdateProjectTaskInput): Promise<ProjectTask> {
    const organizationId = this.requireOrganizationContext();

    // Validate dependencies if provided
    if (data.dependsOnTaskIds && data.dependsOnTaskIds.length > 0) {
      for (const depId of data.dependsOnTaskIds) {
        if (depId === id) {
          throw new ServiceError('Task cannot depend on itself', 'INVALID_DEPENDENCY', 400);
        }
        const depTask = await this.repository.findTaskById(depId, organizationId);
        if (!depTask) {
          throw new ServiceError(
            `Dependency task with ID "${depId}" not found`,
            'DEPENDENCY_NOT_FOUND',
            400
          );
        }
      }
    }

    const updates: any = {};
    if (data.milestoneId !== undefined) updates.milestoneId = data.milestoneId;
    if (data.parentTaskId !== undefined) updates.parentTaskId = data.parentTaskId;
    if (data.taskCode !== undefined) updates.taskCode = data.taskCode;
    if (data.taskName !== undefined) updates.taskName = data.taskName;
    if (data.description !== undefined) updates.description = data.description;
    if (data.category !== undefined) updates.category = data.category;
    if (data.priority !== undefined) updates.priority = data.priority;
    if (data.status !== undefined) updates.status = data.status;
    if (data.activityCodeId !== undefined) updates.activityCodeId = data.activityCodeId;
    if (data.serviceItemId !== undefined) updates.serviceItemId = data.serviceItemId;
    if (data.assigneeId !== undefined) updates.assigneeId = data.assigneeId;
    if (data.reviewerId !== undefined) updates.reviewerId = data.reviewerId;
    if (data.dueDate !== undefined) updates.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.estimatedHours !== undefined) updates.estimatedHours = data.estimatedHours?.toString() ?? null;
    if (data.actualHours !== undefined) updates.actualHours = data.actualHours?.toString() ?? null;
    if (data.dependsOnTaskIds !== undefined) updates.dependsOnTaskIds = data.dependsOnTaskIds;
    if (data.blockedReason !== undefined) updates.blockedReason = data.blockedReason;
    if (data.workNotes !== undefined) updates.workNotes = data.workNotes;
    if (data.reviewNotes !== undefined) updates.reviewNotes = data.reviewNotes;
    if (data.attachmentUrls !== undefined) updates.attachmentUrls = data.attachmentUrls;
    if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
    if (data.isBillable !== undefined) updates.isBillable = data.isBillable;
    if (data.billingRate !== undefined) updates.billingRate = data.billingRate?.toString() ?? null;
    if (data.metadata !== undefined) updates.metadata = data.metadata;

    const updated = await this.repository.updateTask(id, organizationId, updates);

    if (!updated) {
      throw new ServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    return this.transformTask(updated);
  }

  async updateTaskStatus(id: string, status: ProjectTaskStatus, blockedReason?: string): Promise<ProjectTask> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;

    // If setting to BLOCKED, require a reason
    if (status === 'BLOCKED' && !blockedReason) {
      throw new ServiceError('Blocked reason is required when setting status to BLOCKED', 'BLOCKED_REASON_REQUIRED', 400);
    }

    const updated = await this.repository.updateTaskStatus(id, organizationId, status, userId);

    if (!updated) {
      throw new ServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    // Update blocked reason if provided
    if (blockedReason && status === 'BLOCKED') {
      await this.repository.updateTask(id, organizationId, { blockedReason });
    }

    return this.transformTask(updated);
  }

  async deleteTask(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    await this.repository.deleteTask(id, organizationId);
  }

  /**
   * Bulk update task status
   */
  async bulkUpdateTaskStatus(input: ProjectTaskBulkStatusUpdateInput): Promise<ProjectTask[]> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;
    const updatedTasks: ProjectTask[] = [];

    for (const taskId of input.taskIds) {
      const updated = await this.repository.updateTaskStatus(taskId, organizationId, input.status, userId);
      if (updated) {
        if (input.blockedReason && input.status === 'BLOCKED') {
          await this.repository.updateTask(taskId, organizationId, { blockedReason: input.blockedReason });
        }
        updatedTasks.push(this.transformTask(updated));
      }
    }

    return updatedTasks;
  }

  /**
   * Generate tasks from task templates
   */
  async generateTasksFromTemplates(input: ProjectTaskGenerateFromTemplatesInput): Promise<ProjectTask[]> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;

    // Get all specified task templates
    const templates: any[] = [];
    for (const templateId of input.taskTemplateIds) {
      const template = await this.repository.findTaskTemplateById(templateId, organizationId);
      if (template) {
        templates.push(template);
      }
    }

    if (templates.length === 0) {
      throw new ServiceError('No valid task templates found', 'NO_TEMPLATES_FOUND', 400);
    }

    // Create tasks from templates
    const tasksToCreate = templates.map((template, index) => {
      let dueDate: Date | null = null;

      if (input.dueDateOffset !== undefined) {
        dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + input.dueDateOffset);
      }

      return {
        projectId: input.projectId,
        organizationId,
        milestoneId: input.milestoneId ?? null,
        templateId: template.id,
        taskCode: this.generateCode('TSK'),
        taskName: template.templateName,
        description: template.description,
        category: template.category,
        priority: template.priority,
        status: 'NOT_STARTED' as const,
        activityCodeId: template.activityCodeId,
        serviceItemId: template.defaultServiceItemId,
        assigneeId: input.defaultAssigneeId ?? template.defaultAssigneeId,
        estimatedHours: template.estimatedHours,
        dependsOnTaskIds: [],
        sortOrder: template.sortOrder ?? index,
        isBillable: true,
        dueDate,
        createdBy: userId,
      };
    });

    const created = await this.repository.createTasksBulk(tasksToCreate);
    return created.map((t) => this.transformTask(t));
  }

  /**
   * Get project task summary
   */
  async getProjectTaskSummary(projectId: string): Promise<ProjectTaskSummary> {
    const organizationId = this.requireOrganizationContext();

    const summary = await this.repository.getTaskSummaryByProject(projectId, organizationId);

    if (!summary) {
      return {
        projectId,
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        blockedTasks: 0,
        overdueTasks: 0,
        notStartedTasks: 0,
        completionPercentage: 0,
        totalEstimatedHours: 0,
        totalActualHours: 0,
      };
    }

    const totalTasks = Number(summary.total ?? 0);
    const completedTasks = Number(summary.completed ?? 0);

    return {
      projectId,
      totalTasks,
      completedTasks,
      inProgressTasks: Number(summary.inProgress ?? 0),
      blockedTasks: Number(summary.blocked ?? 0),
      notStartedTasks: Number(summary.notStarted ?? 0),
      overdueTasks: 0, // Would need additional query
      completionPercentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      totalEstimatedHours: Number(summary.totalEstimatedHours ?? 0),
      totalActualHours: Number(summary.totalActualHours ?? 0),
    };
  }

  /**
   * Get milestone progress
   */
  async getMilestoneProgress(projectId: string): Promise<MilestoneProgress[]> {
    const milestones = await this.getMilestonesByProject(projectId);
    const progress: MilestoneProgress[] = [];

    for (const milestone of milestones) {
      const tasks = await this.getTasksByMilestone(milestone.id);
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;

      progress.push({
        milestoneId: milestone.id,
        milestoneName: milestone.name,
        status: milestone.status,
        targetDate: milestone.targetDate,
        totalTasks,
        completedTasks,
        completionPercentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      });
    }

    return progress;
  }

  // ============================================================================
  // Project Templates
  // ============================================================================

  async listProjectTemplates(
    params: PaginationParams = {},
    filters: ProjectTemplateFilters = {},
    orderBy: 'sortOrder' | 'templateCode' | 'templateName' | 'createdAt' = 'sortOrder',
    orderDirection: 'asc' | 'desc' = 'asc'
  ): Promise<PaginatedResult<ProjectTemplate>> {
    const organizationId = this.requireOrganizationContext();

    const result = await this.repository.findAllProjectTemplates(
      organizationId,
      { page: params.page, limit: params.limit, orderBy, orderDirection },
      filters
    );

    return {
      data: result.data.map((t) => this.transformProjectTemplate(t)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async getProjectTemplateById(id: string): Promise<ProjectTemplate | null> {
    const organizationId = this.requireOrganizationContext();
    const template = await this.repository.findProjectTemplateById(id, organizationId);
    return template ? this.transformProjectTemplate(template) : null;
  }

  async getProjectTemplateByCode(templateCode: string): Promise<ProjectTemplate | null> {
    const organizationId = this.requireOrganizationContext();
    const template = await this.repository.findProjectTemplateByCode(templateCode, organizationId);
    return template ? this.transformProjectTemplate(template) : null;
  }

  async createProjectTemplate(data: CreateProjectTemplateInput): Promise<ProjectTemplate> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;

    // Check for duplicate template code
    const existing = await this.repository.findProjectTemplateByCode(data.templateCode, organizationId);
    if (existing) {
      throw new ServiceError(
        `Project template with code "${data.templateCode}" already exists`,
        'DUPLICATE_TEMPLATE_CODE',
        409
      );
    }

    // Ensure defaultMilestones has the correct type for the repository
    // Use type assertion since Zod's inferred type for optional arrays can cause type narrowing issues
    const milestones = (data.defaultMilestones ?? []) as Array<{
      name: string;
      description?: string;
      targetDayOffset?: number;
      isBillingMilestone?: boolean;
      sortOrder?: number;
    }>;

    const created = await this.repository.createProjectTemplate({
      organizationId,
      subsidiaryId: data.subsidiaryId ?? null,
      templateCode: data.templateCode,
      templateName: data.templateName,
      description: data.description ?? null,
      projectType: data.projectType ?? null,
      defaultMilestones: milestones,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      metadata: data.metadata ?? null,
      createdBy: userId ?? null,
    });

    return this.transformProjectTemplate(created);
  }

  async updateProjectTemplate(id: string, data: UpdateProjectTemplateInput): Promise<ProjectTemplate> {
    const organizationId = this.requireOrganizationContext();

    // If updating template code, check for duplicates
    if (data.templateCode) {
      const existing = await this.repository.findProjectTemplateByCode(data.templateCode, organizationId);
      if (existing && existing.id !== id) {
        throw new ServiceError(
          `Project template with code "${data.templateCode}" already exists`,
          'DUPLICATE_TEMPLATE_CODE',
          409
        );
      }
    }

    const updates: any = {};
    if (data.templateCode !== undefined) updates.templateCode = data.templateCode;
    if (data.templateName !== undefined) updates.templateName = data.templateName;
    if (data.description !== undefined) updates.description = data.description;
    if (data.projectType !== undefined) updates.projectType = data.projectType;
    if (data.defaultMilestones !== undefined) updates.defaultMilestones = data.defaultMilestones;
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
    if (data.metadata !== undefined) updates.metadata = data.metadata;

    const updated = await this.repository.updateProjectTemplate(id, organizationId, updates);

    if (!updated) {
      throw new ServiceError('Project template not found', 'TEMPLATE_NOT_FOUND', 404);
    }

    return this.transformProjectTemplate(updated);
  }

  async deleteProjectTemplate(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    await this.repository.deleteProjectTemplate(id, organizationId);
  }

  // ============================================================================
  // Project Template Tasks
  // ============================================================================

  async getProjectTemplateTasks(projectTemplateId: string): Promise<ProjectTemplateTask[]> {
    const templateTasks = await this.repository.findTemplateTasksByProjectTemplate(projectTemplateId);
    return templateTasks.map((tt) => this.transformTemplateTask(tt));
  }

  async addTaskToProjectTemplate(data: CreateProjectTemplateTaskInput): Promise<ProjectTemplateTask> {
    const created = await this.repository.createProjectTemplateTask({
      projectTemplateId: data.projectTemplateId,
      taskTemplateId: data.taskTemplateId,
      milestoneName: data.milestoneName ?? null,
      sortOrder: data.sortOrder ?? 0,
      metadata: data.metadata ?? null,
    });

    return this.transformTemplateTask(created);
  }

  async removeTaskFromProjectTemplate(id: string): Promise<void> {
    await this.repository.deleteProjectTemplateTask(id);
  }

  // ============================================================================
  // Template Instantiation
  // ============================================================================

  /**
   * Instantiate a project from a project template
   * Creates milestones and tasks based on the template configuration
   */
  async instantiateProjectFromTemplate(input: InstantiateProjectFromTemplateInput): Promise<{
    milestones: ProjectMilestone[];
    tasks: ProjectTask[];
  }> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;

    // Get the project template
    const template = await this.repository.findProjectTemplateById(input.projectTemplateId, organizationId);
    if (!template) {
      throw new ServiceError('Project template not found', 'TEMPLATE_NOT_FOUND', 404);
    }

    const startDate = input.startDate ? new Date(input.startDate) : new Date();

    // Create milestones from template
    const milestoneMap = new Map<string, string>(); // milestoneName -> milestoneId
    const createdMilestones: ProjectMilestone[] = [];

    if (template.defaultMilestones && Array.isArray(template.defaultMilestones)) {
      for (const milestoneDef of template.defaultMilestones as any[]) {
        let targetDate: string | null = null;
        if (milestoneDef.targetDayOffset !== undefined) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + milestoneDef.targetDayOffset);
          targetDate = date.toISOString().split('T')[0];
        }

        const milestone = await this.repository.createMilestone({
          projectId: input.projectId,
          organizationId,
          name: milestoneDef.name,
          description: milestoneDef.description ?? null,
          targetDate,
          status: 'PENDING' as any,
          sortOrder: milestoneDef.sortOrder ?? 0,
          isBillingMilestone: milestoneDef.isBillingMilestone ?? false,
          createdBy: userId ?? null,
        });

        milestoneMap.set(milestoneDef.name, milestone.id);
        createdMilestones.push(this.transformMilestone(milestone));
      }
    }

    // Get template tasks with their task template details
    const templateTasksWithDetails = await this.repository.findTemplateTasksWithDetails(input.projectTemplateId);

    // Create tasks from template tasks
    const createdTasks: ProjectTask[] = [];
    for (const { templateTask, taskTemplate } of templateTasksWithDetails) {
      const milestoneId = templateTask.milestoneName
        ? milestoneMap.get(templateTask.milestoneName) ?? null
        : null;

      const task = await this.repository.createTask({
        projectId: input.projectId,
        organizationId,
        milestoneId,
        templateId: taskTemplate.id,
        taskCode: this.generateCode('TSK'),
        taskName: taskTemplate.templateName,
        description: taskTemplate.description,
        category: taskTemplate.category,
        priority: taskTemplate.priority,
        status: 'NOT_STARTED' as const,
        activityCodeId: taskTemplate.activityCodeId,
        serviceItemId: taskTemplate.defaultServiceItemId,
        assigneeId: input.defaultAssigneeId ?? taskTemplate.defaultAssigneeId,
        estimatedHours: taskTemplate.estimatedHours,
        dependsOnTaskIds: [],
        sortOrder: templateTask.sortOrder,
        isBillable: true,
        createdBy: userId ?? null,
      });

      createdTasks.push(this.transformTask(task));
    }

    return {
      milestones: createdMilestones,
      tasks: createdTasks,
    };
  }
}
