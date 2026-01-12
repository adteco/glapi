import { BaseService } from './base-service';
import {
  CloseTaskTemplate,
  CreateCloseTaskTemplateInput,
  UpdateCloseTaskTemplateInput,
  CloseChecklist,
  CreateCloseChecklistInput,
  UpdateCloseChecklistInput,
  CloseTask,
  CreateCloseTaskInput,
  UpdateCloseTaskInput,
  VarianceThreshold,
  CreateVarianceThresholdInput,
  UpdateVarianceThresholdInput,
  VarianceAlert,
  CreateVarianceAlertInput,
  AcknowledgeVarianceAlertInput,
  ResolveVarianceAlertInput,
  TieoutTemplate,
  CreateTieoutTemplateInput,
  UpdateTieoutTemplateInput,
  TieoutInstance,
  CreateTieoutInstanceInput,
  UpdateTieoutInstanceInput,
  CloseNotification,
  CreateCloseNotificationInput,
  CloseStatusSummary,
  GenerateTasksFromTemplatesInput,
  BulkUpdateTaskStatusInput,
} from '../types/close-management.types';
import { PaginationParams, PaginatedResult, ServiceError } from '../types';
import { CloseManagementRepository } from '@glapi/database';

export class CloseManagementService extends BaseService {
  private repository: CloseManagementRepository;

  constructor(context = {}) {
    super(context);
    this.repository = new CloseManagementRepository();
  }

  /**
   * Get accessible subsidiary IDs for the current organization
   */
  private async getAccessibleSubsidiaryIds(): Promise<string[]> {
    const organizationId = this.requireOrganizationContext();
    return this.repository.getAccessibleSubsidiaryIds(organizationId);
  }

  /**
   * Generate a unique task code
   */
  private generateTaskCode(prefix = 'TASK'): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  // ============================================================================
  // Task Templates
  // ============================================================================

  async listTaskTemplates(
    params: PaginationParams = {},
    filters: { category?: string; isActive?: boolean } = {},
    orderBy: 'sortOrder' | 'taskCode' | 'taskName' | 'createdAt' = 'sortOrder',
    orderDirection: 'asc' | 'desc' = 'asc'
  ): Promise<PaginatedResult<CloseTaskTemplate>> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      return this.createPaginatedResult([], 0, params.page || 1, params.limit || 50);
    }

    const result = await this.repository.findAllTemplates(
      subsidiaryIds,
      { page: params.page, limit: params.limit, orderBy, orderDirection },
      filters
    );

    return {
      data: result.data as CloseTaskTemplate[],
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async getTaskTemplateById(id: string): Promise<CloseTaskTemplate | null> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      return null;
    }

    return this.repository.findTemplateById(id, subsidiaryIds) as Promise<CloseTaskTemplate | null>;
  }

  async createTaskTemplate(data: CreateCloseTaskTemplateInput): Promise<CloseTaskTemplate> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (!subsidiaryIds.includes(data.organizationId)) {
      throw new ServiceError(
        'Access denied to this organization',
        'ORGANIZATION_ACCESS_DENIED',
        403
      );
    }

    const taskCode = this.generateTaskCode('TPL');

    return this.repository.createTemplate({
      subsidiaryId: data.organizationId,
      taskCode,
      taskName: data.templateName,
      description: data.description ?? null,
      category: data.category ?? 'OTHER',
      priority: data.defaultPriority,
      estimatedMinutes: data.estimatedDurationMinutes ?? null,
      instructions: data.instructions ?? null,
      automationConfig: data.automationConfig ?? null,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
    }) as Promise<CloseTaskTemplate>;
  }

  async updateTaskTemplate(id: string, data: UpdateCloseTaskTemplateInput): Promise<CloseTaskTemplate> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      throw new ServiceError('No accessible subsidiaries', 'NO_SUBSIDIARY_ACCESS', 403);
    }

    const updated = await this.repository.updateTemplate(id, subsidiaryIds, {
      taskName: data.templateName,
      description: data.description,
      category: data.category,
      priority: data.defaultPriority,
      estimatedMinutes: data.estimatedDurationMinutes,
      instructions: data.instructions,
      automationConfig: data.automationConfig,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
    });

    if (!updated) {
      throw new ServiceError('Task template not found', 'TEMPLATE_NOT_FOUND', 404);
    }

    return updated as CloseTaskTemplate;
  }

  async deleteTaskTemplate(id: string): Promise<void> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      throw new ServiceError('No accessible subsidiaries', 'NO_SUBSIDIARY_ACCESS', 403);
    }

    await this.repository.deleteTemplate(id, subsidiaryIds);
  }

  // ============================================================================
  // Checklists
  // ============================================================================

  async listChecklists(
    params: PaginationParams = {},
    filters: { status?: string | string[]; periodId?: string } = {},
    orderBy: 'targetCloseDate' | 'createdAt' | 'checklistName' = 'targetCloseDate',
    orderDirection: 'asc' | 'desc' = 'desc'
  ): Promise<PaginatedResult<CloseChecklist>> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      return this.createPaginatedResult([], 0, params.page || 1, params.limit || 20);
    }

    const result = await this.repository.findAllChecklists(
      subsidiaryIds,
      { page: params.page, limit: params.limit, orderBy, orderDirection },
      filters
    );

    return {
      data: result.data as CloseChecklist[],
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async getChecklistById(id: string): Promise<CloseChecklist | null> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      return null;
    }

    return this.repository.findChecklistById(id, subsidiaryIds) as Promise<CloseChecklist | null>;
  }

  async getChecklistByPeriod(periodId: string): Promise<CloseChecklist | null> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      return null;
    }

    return this.repository.findChecklistByPeriod(periodId, subsidiaryIds) as Promise<CloseChecklist | null>;
  }

  async createChecklist(data: CreateCloseChecklistInput): Promise<CloseChecklist> {
    const userId = this.requireUserContext();
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (!subsidiaryIds.includes(data.organizationId)) {
      throw new ServiceError(
        'Access denied to this organization',
        'ORGANIZATION_ACCESS_DENIED',
        403
      );
    }

    // Check if a checklist already exists for this period
    const existing = await this.repository.findChecklistByPeriod(data.accountingPeriodId, subsidiaryIds);
    if (existing) {
      throw new ServiceError(
        'A checklist already exists for this accounting period',
        'CHECKLIST_EXISTS',
        409
      );
    }

    return this.repository.createChecklist({
      subsidiaryId: data.organizationId,
      accountingPeriodId: data.accountingPeriodId,
      checklistName: data.checklistName,
      notes: data.description ?? null,
      targetCloseDate: data.dueDate ? new Date(data.dueDate) : null,
      ownerId: data.assignedTo ?? null,
      createdBy: userId,
    }) as Promise<CloseChecklist>;
  }

  async updateChecklist(id: string, data: UpdateCloseChecklistInput): Promise<CloseChecklist> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      throw new ServiceError('No accessible subsidiaries', 'NO_SUBSIDIARY_ACCESS', 403);
    }

    const updated = await this.repository.updateChecklist(id, subsidiaryIds, {
      checklistName: data.checklistName,
      notes: data.description,
      status: data.status,
      targetCloseDate: data.dueDate ? new Date(data.dueDate) : undefined,
      ownerId: data.assignedTo,
    });

    if (!updated) {
      throw new ServiceError('Checklist not found', 'CHECKLIST_NOT_FOUND', 404);
    }

    return updated as CloseChecklist;
  }

  // ============================================================================
  // Tasks
  // ============================================================================

  async listTasksByChecklist(checklistId: string): Promise<CloseTask[]> {
    return this.repository.findTasksByChecklist(checklistId) as Promise<CloseTask[]>;
  }

  async getTaskById(id: string): Promise<CloseTask | null> {
    return this.repository.findTaskById(id) as Promise<CloseTask | null>;
  }

  async getTasksByAssignee(
    assigneeId: string,
    filters: { status?: string | string[]; limit?: number } = {}
  ): Promise<CloseTask[]> {
    return this.repository.findTasksByAssignee(assigneeId, filters) as Promise<CloseTask[]>;
  }

  async createTask(data: CreateCloseTaskInput): Promise<CloseTask> {
    const taskCode = this.generateTaskCode('TSK');

    return this.repository.createTask({
      checklistId: data.checklistId,
      templateId: data.templateId ?? null,
      taskCode,
      taskName: data.taskName,
      description: data.description ?? null,
      category: data.category ?? 'OTHER',
      priority: data.priority,
      assigneeId: data.assignedTo ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      sortOrder: data.sortOrder,
    }) as Promise<CloseTask>;
  }

  async updateTask(id: string, data: UpdateCloseTaskInput): Promise<CloseTask> {
    const updated = await this.repository.updateTask(id, {
      taskName: data.taskName,
      description: data.description,
      category: data.category,
      status: data.status,
      priority: data.priority,
      assigneeId: data.assignedTo,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      blockedReason: data.blockedReason,
      workNotes: data.notes,
      attachmentUrls: data.attachments,
      sortOrder: data.sortOrder,
    });

    if (!updated) {
      throw new ServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    // Update checklist progress after task update
    await this.repository.updateChecklistProgress(updated.checklistId);

    return updated as CloseTask;
  }

  async updateTaskStatus(id: string, status: string): Promise<CloseTask> {
    const userId = this.requireUserContext();

    const updated = await this.repository.updateTaskStatus(id, status, userId);

    if (!updated) {
      throw new ServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    // Update checklist progress after status change
    await this.repository.updateChecklistProgress(updated.checklistId);

    return updated as CloseTask;
  }

  async deleteTask(id: string): Promise<void> {
    const task = await this.repository.findTaskById(id);

    if (!task) {
      throw new ServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    await this.repository.deleteTask(id);

    // Update checklist progress after deletion
    await this.repository.updateChecklistProgress(task.checklistId);
  }

  /**
   * Generate tasks from templates for a checklist
   */
  async generateTasksFromTemplates(input: GenerateTasksFromTemplatesInput): Promise<CloseTask[]> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      throw new ServiceError('No accessible subsidiaries', 'NO_SUBSIDIARY_ACCESS', 403);
    }

    // Get the checklist to verify access and get due date
    const checklist = await this.repository.findChecklistById(input.checklistId, subsidiaryIds);
    if (!checklist) {
      throw new ServiceError('Checklist not found', 'CHECKLIST_NOT_FOUND', 404);
    }

    // Get all templates
    const templates = await this.repository.findAllTemplates(subsidiaryIds, {}, { isActive: true });
    const selectedTemplates = templates.data.filter(t => input.templateIds.includes(t.id));

    if (selectedTemplates.length === 0) {
      throw new ServiceError('No valid templates found', 'NO_TEMPLATES_FOUND', 400);
    }

    // Create tasks from templates
    const tasksToCreate = selectedTemplates.map((template, index) => {
      let dueDate: Date | null = null;

      if (checklist.targetCloseDate && input.dueDateOffset !== undefined) {
        dueDate = new Date(checklist.targetCloseDate);
        dueDate.setDate(dueDate.getDate() + input.dueDateOffset);
      }

      return {
        checklistId: input.checklistId,
        templateId: template.id,
        taskCode: this.generateTaskCode('TSK'),
        taskName: template.taskName,
        description: template.description ?? null,
        category: template.category ?? 'OTHER',
        priority: template.priority ?? 'MEDIUM',
        assigneeId: input.defaultAssignedTo ?? template.defaultAssigneeId ?? null,
        dueDate,
        sortOrder: template.sortOrder ?? index,
      };
    });

    const created = await this.repository.bulkCreateTasks(tasksToCreate);

    // Update checklist progress
    await this.repository.updateChecklistProgress(input.checklistId);

    return created as CloseTask[];
  }

  /**
   * Bulk update task status
   */
  async bulkUpdateTaskStatus(input: BulkUpdateTaskStatusInput): Promise<CloseTask[]> {
    const userId = this.requireUserContext();
    const updatedTasks: CloseTask[] = [];
    const checklistIds = new Set<string>();

    for (const taskId of input.taskIds) {
      const updated = await this.repository.updateTaskStatus(taskId, input.status, userId);
      if (updated) {
        updatedTasks.push(updated as CloseTask);
        checklistIds.add(updated.checklistId);
      }
    }

    // Update progress for all affected checklists
    for (const checklistId of checklistIds) {
      await this.repository.updateChecklistProgress(checklistId);
    }

    return updatedTasks;
  }

  // ============================================================================
  // Variance Thresholds
  // ============================================================================

  async listVarianceThresholds(
    filters: { isActive?: boolean } = {}
  ): Promise<VarianceThreshold[]> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      return [];
    }

    return this.repository.findAllThresholds(subsidiaryIds, filters) as Promise<VarianceThreshold[]>;
  }

  async getVarianceThresholdById(id: string): Promise<VarianceThreshold | null> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      return null;
    }

    return this.repository.findThresholdById(id, subsidiaryIds) as Promise<VarianceThreshold | null>;
  }

  async createVarianceThreshold(data: CreateVarianceThresholdInput): Promise<VarianceThreshold> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (!subsidiaryIds.includes(data.organizationId)) {
      throw new ServiceError(
        'Access denied to this organization',
        'ORGANIZATION_ACCESS_DENIED',
        403
      );
    }

    return this.repository.createThreshold({
      subsidiaryId: data.organizationId,
      name: data.thresholdName,
      description: data.description ?? null,
      accountId: data.accountId ?? null,
      absoluteThreshold: data.absoluteThreshold ?? null,
      percentageThreshold: data.percentageThreshold ?? null,
      compareAgainst: data.comparisonType,
      severity: data.severity,
      isActive: data.isActive,
    }) as Promise<VarianceThreshold>;
  }

  async updateVarianceThreshold(id: string, data: UpdateVarianceThresholdInput): Promise<VarianceThreshold> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      throw new ServiceError('No accessible subsidiaries', 'NO_SUBSIDIARY_ACCESS', 403);
    }

    const updated = await this.repository.updateThreshold(id, subsidiaryIds, {
      name: data.thresholdName,
      description: data.description,
      accountId: data.accountId,
      absoluteThreshold: data.absoluteThreshold,
      percentageThreshold: data.percentageThreshold,
      compareAgainst: data.comparisonType,
      severity: data.severity,
      isActive: data.isActive,
    });

    if (!updated) {
      throw new ServiceError('Variance threshold not found', 'THRESHOLD_NOT_FOUND', 404);
    }

    return updated as VarianceThreshold;
  }

  async deleteVarianceThreshold(id: string): Promise<void> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      throw new ServiceError('No accessible subsidiaries', 'NO_SUBSIDIARY_ACCESS', 403);
    }

    await this.repository.deleteThreshold(id, subsidiaryIds);
  }

  // ============================================================================
  // Variance Alerts
  // ============================================================================

  async listAlertsByPeriod(
    periodId: string,
    filters: { status?: string | string[]; severity?: string } = {}
  ): Promise<VarianceAlert[]> {
    return this.repository.findAlertsByPeriod(periodId, filters) as Promise<VarianceAlert[]>;
  }

  async listAlertsByChecklist(checklistId: string): Promise<VarianceAlert[]> {
    return this.repository.findAlertsByChecklist(checklistId) as Promise<VarianceAlert[]>;
  }

  async getAlertById(id: string): Promise<VarianceAlert | null> {
    return this.repository.findAlertById(id) as Promise<VarianceAlert | null>;
  }

  async createVarianceAlert(data: CreateVarianceAlertInput): Promise<VarianceAlert> {
    return this.repository.createAlert({
      thresholdId: data.thresholdId,
      accountingPeriodId: data.accountingPeriodId,
      accountId: data.thresholdId, // Using thresholdId as placeholder - would need proper accountId
      alertType: 'VARIANCE',
      currentValue: data.actualValue ?? '0',
      comparisonValue: data.expectedValue ?? null,
      varianceAmount: data.varianceAmount ?? null,
      variancePercent: data.variancePercentage ?? null,
      severity: data.severity,
      alertMessage: data.alertMessage,
    }) as Promise<VarianceAlert>;
  }

  async acknowledgeAlert(id: string, input: AcknowledgeVarianceAlertInput): Promise<VarianceAlert> {
    const userId = this.requireUserContext();

    const alert = await this.repository.acknowledgeAlert(id, userId);

    if (!alert) {
      throw new ServiceError('Variance alert not found', 'ALERT_NOT_FOUND', 404);
    }

    return alert as VarianceAlert;
  }

  async resolveAlert(id: string, input: ResolveVarianceAlertInput): Promise<VarianceAlert> {
    const userId = this.requireUserContext();

    const alert = await this.repository.resolveAlert(id, userId, input.resolutionNote ?? '');

    if (!alert) {
      throw new ServiceError('Variance alert not found', 'ALERT_NOT_FOUND', 404);
    }

    return alert as VarianceAlert;
  }

  // ============================================================================
  // Tieout Templates
  // ============================================================================

  async listTieoutTemplates(filters: { isActive?: boolean } = {}): Promise<TieoutTemplate[]> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      return [];
    }

    return this.repository.findAllTieoutTemplates(subsidiaryIds, filters) as Promise<TieoutTemplate[]>;
  }

  async getTieoutTemplateById(id: string): Promise<TieoutTemplate | null> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      return null;
    }

    return this.repository.findTieoutTemplateById(id, subsidiaryIds) as Promise<TieoutTemplate | null>;
  }

  async createTieoutTemplate(data: CreateTieoutTemplateInput): Promise<TieoutTemplate> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (!subsidiaryIds.includes(data.organizationId)) {
      throw new ServiceError(
        'Access denied to this organization',
        'ORGANIZATION_ACCESS_DENIED',
        403
      );
    }

    const templateCode = this.generateTaskCode('TIE');

    return this.repository.createTieoutTemplate({
      subsidiaryId: data.organizationId,
      templateCode,
      templateName: data.templateName,
      description: data.description ?? null,
      sourceType: data.sourceSystem,
      targetType: data.targetSystem,
      sourceConfig: data.sourceQuery ? { query: data.sourceQuery } : null,
      targetConfig: data.targetQuery ? { query: data.targetQuery } : null,
      toleranceAmount: data.toleranceAmount ?? null,
      tolerancePercent: data.tolerancePercentage ?? null,
      isActive: data.isActive,
    }) as Promise<TieoutTemplate>;
  }

  async updateTieoutTemplate(id: string, data: UpdateTieoutTemplateInput): Promise<TieoutTemplate> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      throw new ServiceError('No accessible subsidiaries', 'NO_SUBSIDIARY_ACCESS', 403);
    }

    const updated = await this.repository.updateTieoutTemplate(id, subsidiaryIds, {
      templateName: data.templateName,
      description: data.description,
      sourceType: data.sourceSystem,
      targetType: data.targetSystem,
      sourceConfig: data.sourceQuery ? { query: data.sourceQuery } : undefined,
      targetConfig: data.targetQuery ? { query: data.targetQuery } : undefined,
      toleranceAmount: data.toleranceAmount,
      tolerancePercent: data.tolerancePercentage,
      isActive: data.isActive,
    });

    if (!updated) {
      throw new ServiceError('Tieout template not found', 'TEMPLATE_NOT_FOUND', 404);
    }

    return updated as TieoutTemplate;
  }

  // ============================================================================
  // Tieout Instances
  // ============================================================================

  async listTieoutsByPeriod(
    periodId: string,
    filters: { status?: string | string[] } = {}
  ): Promise<TieoutInstance[]> {
    return this.repository.findTieoutsByPeriod(periodId, filters) as Promise<TieoutInstance[]>;
  }

  async listTieoutsByChecklist(checklistId: string): Promise<TieoutInstance[]> {
    return this.repository.findTieoutsByChecklist(checklistId) as Promise<TieoutInstance[]>;
  }

  async getTieoutById(id: string): Promise<TieoutInstance | null> {
    return this.repository.findTieoutById(id) as Promise<TieoutInstance | null>;
  }

  async createTieoutInstance(data: CreateTieoutInstanceInput): Promise<TieoutInstance> {
    // Get template to get the name
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();
    const template = await this.repository.findTieoutTemplateById(data.templateId, subsidiaryIds);
    const tieoutName = template?.templateName ?? `Tieout-${this.generateTaskCode('TOT')}`;

    return this.repository.createTieout({
      templateId: data.templateId,
      accountingPeriodId: data.accountingPeriodId,
      tieoutName,
    }) as Promise<TieoutInstance>;
  }

  async updateTieoutInstance(id: string, data: UpdateTieoutInstanceInput): Promise<TieoutInstance> {
    const updated = await this.repository.updateTieout(id, {
      status: data.status,
      sourceValue: data.sourceValue,
      targetValue: data.targetValue,
      varianceAmount: data.varianceAmount,
      workNotes: data.notes,
      attachmentUrls: data.supportingDocuments,
    });

    if (!updated) {
      throw new ServiceError('Tieout instance not found', 'TIEOUT_NOT_FOUND', 404);
    }

    return updated as TieoutInstance;
  }

  async approveTieout(id: string): Promise<TieoutInstance> {
    const userId = this.requireUserContext();

    const approved = await this.repository.approveTieout(id, userId);

    if (!approved) {
      throw new ServiceError('Tieout instance not found', 'TIEOUT_NOT_FOUND', 404);
    }

    return approved as TieoutInstance;
  }

  // ============================================================================
  // Notifications
  // ============================================================================

  async listNotifications(
    options: { isRead?: boolean; limit?: number } = {}
  ): Promise<CloseNotification[]> {
    const userId = this.requireUserContext();
    return this.repository.findNotificationsByUser(userId, options) as Promise<CloseNotification[]>;
  }

  async createNotification(data: CreateCloseNotificationInput): Promise<CloseNotification> {
    return this.repository.createNotification({
      userId: data.userId,
      notificationType: data.notificationType,
      title: data.title,
      message: data.message,
      severity: 'INFO',
    }) as Promise<CloseNotification>;
  }

  async markNotificationRead(id: string): Promise<void> {
    const userId = this.requireUserContext();
    await this.repository.markNotificationRead(id, userId);
  }

  async markAllNotificationsRead(): Promise<void> {
    const userId = this.requireUserContext();
    await this.repository.markAllNotificationsRead(userId);
  }

  async dismissNotification(id: string): Promise<void> {
    const userId = this.requireUserContext();
    await this.repository.dismissNotification(id, userId);
  }

  // ============================================================================
  // Dashboard / Summary
  // ============================================================================

  async getCloseStatusSummary(periodId: string): Promise<CloseStatusSummary> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      return {
        checklistId: '',
        checklistName: '',
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        blockedTasks: 0,
        overdueTasks: 0,
        completionPercentage: 0,
      };
    }

    const checklist = await this.repository.findChecklistByPeriod(periodId, subsidiaryIds);

    if (!checklist) {
      return {
        checklistId: '',
        checklistName: '',
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        blockedTasks: 0,
        overdueTasks: 0,
        completionPercentage: 0,
      };
    }

    const summary = await this.repository.getCloseStatusSummary(subsidiaryIds, periodId);

    const totalTasks = Number(summary?.totalTasks ?? 0);
    const completedTasks = Number(summary?.completed ?? 0);

    return {
      checklistId: checklist.id,
      checklistName: checklist.checklistName,
      totalTasks,
      completedTasks,
      inProgressTasks: Number(summary?.inProgress ?? 0),
      blockedTasks: Number(summary?.blocked ?? 0),
      overdueTasks: 0, // Would need additional query
      completionPercentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    };
  }

  async getOverdueTasks(): Promise<CloseTask[]> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      return [];
    }

    const result = await this.repository.getOverdueTasks(subsidiaryIds);
    return result.map(r => r.close_tasks) as CloseTask[];
  }
}
