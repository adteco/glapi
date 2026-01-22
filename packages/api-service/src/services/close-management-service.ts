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
  CloseTaskStatus,
  CloseTaskPriority,
  VarianceAlertSeverity,
  TieoutStatus,
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
  // Type Transformers
  // ============================================================================

  /**
   * Transform database task template to service type
   */
  private transformTaskTemplate(dbTemplate: any): CloseTaskTemplate {
    return {
      id: dbTemplate.id,
      organizationId: dbTemplate.subsidiaryId,
      templateName: dbTemplate.taskName,
      description: dbTemplate.description,
      category: dbTemplate.category,
      defaultPriority: dbTemplate.priority as CloseTaskPriority,
      estimatedDurationMinutes: dbTemplate.estimatedMinutes,
      dependsOnTemplateId: dbTemplate.dependsOnTemplateId,
      requiredRole: dbTemplate.requiredRole,
      instructions: dbTemplate.instructions,
      automationConfig: dbTemplate.automationConfig,
      isActive: dbTemplate.isActive,
      sortOrder: dbTemplate.sortOrder,
      createdAt: dbTemplate.createdAt,
      updatedAt: dbTemplate.updatedAt ?? new Date(),
    };
  }

  /**
   * Transform database checklist to service type
   */
  private transformChecklist(dbChecklist: any): CloseChecklist {
    return {
      id: dbChecklist.id,
      organizationId: dbChecklist.subsidiaryId,
      accountingPeriodId: dbChecklist.accountingPeriodId,
      checklistName: dbChecklist.checklistName,
      description: dbChecklist.notes,
      status: dbChecklist.status as CloseTaskStatus,
      startedAt: dbChecklist.startedAt,
      completedAt: dbChecklist.completedAt,
      dueDate: dbChecklist.targetCloseDate,
      assignedTo: dbChecklist.ownerId,
      createdBy: dbChecklist.createdBy,
      createdAt: dbChecklist.createdAt,
      updatedAt: dbChecklist.updatedAt ?? new Date(),
    };
  }

  /**
   * Transform database task to service type
   */
  private transformTask(dbTask: any): CloseTask {
    return {
      id: dbTask.id,
      checklistId: dbTask.checklistId,
      templateId: dbTask.templateId,
      taskName: dbTask.taskName,
      description: dbTask.description,
      category: dbTask.category,
      status: dbTask.status as CloseTaskStatus,
      priority: dbTask.priority as CloseTaskPriority,
      assignedTo: dbTask.assigneeId,
      dueDate: dbTask.dueDate,
      startedAt: dbTask.startedAt,
      completedAt: dbTask.completedAt,
      completedBy: dbTask.completedBy,
      reviewedBy: dbTask.reviewedBy,
      reviewedAt: dbTask.reviewedAt,
      blockedReason: dbTask.blockedReason,
      notes: dbTask.workNotes,
      attachments: dbTask.attachmentUrls,
      sortOrder: dbTask.sortOrder,
      createdAt: dbTask.createdAt,
      updatedAt: dbTask.updatedAt ?? new Date(),
    };
  }

  /**
   * Transform database variance threshold to service type
   */
  private transformVarianceThreshold(dbThreshold: any): VarianceThreshold {
    return {
      id: dbThreshold.id,
      organizationId: dbThreshold.subsidiaryId,
      thresholdName: dbThreshold.name,
      description: dbThreshold.description,
      metricType: dbThreshold.compareAgainst ?? 'BUDGET',
      accountId: dbThreshold.accountId,
      departmentId: null,
      absoluteThreshold: dbThreshold.absoluteThreshold,
      percentageThreshold: dbThreshold.percentageThreshold,
      comparisonType: dbThreshold.compareAgainst ?? 'BUDGET',
      severity: dbThreshold.severity as VarianceAlertSeverity,
      isActive: dbThreshold.isActive,
      createdAt: dbThreshold.createdAt,
      updatedAt: dbThreshold.updatedAt ?? new Date(),
    };
  }

  /**
   * Transform database variance alert to service type
   */
  private transformVarianceAlert(dbAlert: any): VarianceAlert {
    return {
      id: dbAlert.id,
      thresholdId: dbAlert.thresholdId ?? '',
      accountingPeriodId: dbAlert.accountingPeriodId,
      alertMessage: dbAlert.alertMessage,
      metricName: dbAlert.alertType ?? 'VARIANCE',
      expectedValue: dbAlert.comparisonValue,
      actualValue: dbAlert.currentValue,
      varianceAmount: dbAlert.varianceAmount,
      variancePercentage: dbAlert.variancePercent,
      severity: dbAlert.severity as VarianceAlertSeverity,
      isAcknowledged: dbAlert.isAcknowledged ?? false,
      acknowledgedBy: dbAlert.acknowledgedBy,
      acknowledgedAt: dbAlert.acknowledgedAt,
      acknowledgedNote: dbAlert.acknowledgedNote,
      isResolved: dbAlert.isResolved ?? false,
      resolvedBy: dbAlert.resolvedBy,
      resolvedAt: dbAlert.resolvedAt,
      resolutionNote: dbAlert.resolutionNote,
      createdAt: dbAlert.createdAt,
    };
  }

  /**
   * Transform database tieout template to service type
   */
  private transformTieoutTemplate(dbTemplate: any): TieoutTemplate {
    return {
      id: dbTemplate.id,
      organizationId: dbTemplate.subsidiaryId,
      templateName: dbTemplate.templateName,
      description: dbTemplate.description,
      sourceSystem: dbTemplate.sourceType,
      sourceQuery: dbTemplate.sourceConfig?.query ?? null,
      targetSystem: dbTemplate.targetType,
      targetQuery: dbTemplate.targetConfig?.query ?? null,
      reconciliationRules: dbTemplate.reconciliationRules,
      toleranceAmount: dbTemplate.toleranceAmount,
      tolerancePercentage: dbTemplate.tolerancePercent,
      isActive: dbTemplate.isActive,
      createdAt: dbTemplate.createdAt,
      updatedAt: dbTemplate.updatedAt ?? new Date(),
    };
  }

  /**
   * Transform database tieout instance to service type
   */
  private transformTieoutInstance(dbTieout: any): TieoutInstance {
    return {
      id: dbTieout.id,
      templateId: dbTieout.templateId,
      accountingPeriodId: dbTieout.accountingPeriodId,
      status: dbTieout.status as TieoutStatus,
      sourceValue: dbTieout.sourceValue,
      targetValue: dbTieout.targetValue,
      varianceAmount: dbTieout.varianceAmount,
      executedAt: dbTieout.executedAt,
      executedBy: dbTieout.executedBy,
      approvedAt: dbTieout.approvedAt,
      approvedBy: dbTieout.approvedBy,
      notes: dbTieout.workNotes,
      supportingDocuments: dbTieout.attachmentUrls,
      createdAt: dbTieout.createdAt,
      updatedAt: dbTieout.updatedAt ?? new Date(),
    };
  }

  /**
   * Transform database notification to service type
   */
  private transformNotification(dbNotification: any): CloseNotification {
    return {
      id: dbNotification.id,
      organizationId: dbNotification.organizationId ?? '',
      accountingPeriodId: dbNotification.accountingPeriodId,
      userId: dbNotification.userId,
      notificationType: dbNotification.notificationType,
      title: dbNotification.title,
      message: dbNotification.message,
      referenceType: dbNotification.referenceType,
      referenceId: dbNotification.referenceId,
      isRead: dbNotification.isRead,
      readAt: dbNotification.readAt,
      createdAt: dbNotification.createdAt,
    };
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
      data: result.data.map((t) => this.transformTaskTemplate(t)),
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

    const template = await this.repository.findTemplateById(id, subsidiaryIds);
    return template ? this.transformTaskTemplate(template) : null;
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

    const created = await this.repository.createTemplate({
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
    });

    return this.transformTaskTemplate(created);
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

    return this.transformTaskTemplate(updated);
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
      data: result.data.map((c) => this.transformChecklist(c)),
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

    const checklist = await this.repository.findChecklistById(id, subsidiaryIds);
    return checklist ? this.transformChecklist(checklist) : null;
  }

  async getChecklistByPeriod(periodId: string): Promise<CloseChecklist | null> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      return null;
    }

    const checklist = await this.repository.findChecklistByPeriod(periodId, subsidiaryIds);
    return checklist ? this.transformChecklist(checklist) : null;
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

    const created = await this.repository.createChecklist({
      subsidiaryId: data.organizationId,
      accountingPeriodId: data.accountingPeriodId,
      checklistName: data.checklistName,
      notes: data.description ?? null,
      targetCloseDate: data.dueDate ? new Date(data.dueDate) : null,
      ownerId: data.assignedTo ?? null,
      createdBy: userId,
    });

    return this.transformChecklist(created);
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

    return this.transformChecklist(updated);
  }

  // ============================================================================
  // Tasks
  // ============================================================================

  async listTasksByChecklist(checklistId: string): Promise<CloseTask[]> {
    const tasks = await this.repository.findTasksByChecklist(checklistId);
    return tasks.map((t) => this.transformTask(t));
  }

  async getTaskById(id: string): Promise<CloseTask | null> {
    const task = await this.repository.findTaskById(id);
    return task ? this.transformTask(task) : null;
  }

  async getTasksByAssignee(
    assigneeId: string,
    filters: { status?: string | string[]; limit?: number } = {}
  ): Promise<CloseTask[]> {
    const tasks = await this.repository.findTasksByAssignee(assigneeId, filters);
    return tasks.map((t) => this.transformTask(t));
  }

  async createTask(data: CreateCloseTaskInput): Promise<CloseTask> {
    const taskCode = this.generateTaskCode('TSK');

    const created = await this.repository.createTask({
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
    });

    return this.transformTask(created);
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

    return this.transformTask(updated);
  }

  async updateTaskStatus(id: string, status: string): Promise<CloseTask> {
    const userId = this.requireUserContext();

    const updated = await this.repository.updateTaskStatus(id, status, userId);

    if (!updated) {
      throw new ServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    // Update checklist progress after status change
    await this.repository.updateChecklistProgress(updated.checklistId);

    return this.transformTask(updated);
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

    return created.map((t) => this.transformTask(t));
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
        updatedTasks.push(this.transformTask(updated));
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

    const thresholds = await this.repository.findAllThresholds(subsidiaryIds, filters);
    return thresholds.map((t) => this.transformVarianceThreshold(t));
  }

  async getVarianceThresholdById(id: string): Promise<VarianceThreshold | null> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      return null;
    }

    const threshold = await this.repository.findThresholdById(id, subsidiaryIds);
    return threshold ? this.transformVarianceThreshold(threshold) : null;
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

    const created = await this.repository.createThreshold({
      subsidiaryId: data.organizationId,
      name: data.thresholdName,
      description: data.description ?? null,
      accountId: data.accountId ?? null,
      absoluteThreshold: data.absoluteThreshold ?? null,
      percentageThreshold: data.percentageThreshold ?? null,
      compareAgainst: data.comparisonType,
      severity: data.severity,
      isActive: data.isActive,
    });

    return this.transformVarianceThreshold(created);
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

    return this.transformVarianceThreshold(updated);
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
    const alerts = await this.repository.findAlertsByPeriod(periodId, filters);
    return alerts.map((a) => this.transformVarianceAlert(a));
  }

  async listAlertsByChecklist(checklistId: string): Promise<VarianceAlert[]> {
    const alerts = await this.repository.findAlertsByChecklist(checklistId);
    return alerts.map((a) => this.transformVarianceAlert(a));
  }

  async getAlertById(id: string): Promise<VarianceAlert | null> {
    const alert = await this.repository.findAlertById(id);
    return alert ? this.transformVarianceAlert(alert) : null;
  }

  async createVarianceAlert(data: CreateVarianceAlertInput): Promise<VarianceAlert> {
    const created = await this.repository.createAlert({
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
    });

    return this.transformVarianceAlert(created);
  }

  async acknowledgeAlert(id: string, input: AcknowledgeVarianceAlertInput): Promise<VarianceAlert> {
    const userId = this.requireUserContext();

    const alert = await this.repository.acknowledgeAlert(id, userId);

    if (!alert) {
      throw new ServiceError('Variance alert not found', 'ALERT_NOT_FOUND', 404);
    }

    return this.transformVarianceAlert(alert);
  }

  async resolveAlert(id: string, input: ResolveVarianceAlertInput): Promise<VarianceAlert> {
    const userId = this.requireUserContext();

    const alert = await this.repository.resolveAlert(id, userId, input.resolutionNote ?? '');

    if (!alert) {
      throw new ServiceError('Variance alert not found', 'ALERT_NOT_FOUND', 404);
    }

    return this.transformVarianceAlert(alert);
  }

  // ============================================================================
  // Tieout Templates
  // ============================================================================

  async listTieoutTemplates(filters: { isActive?: boolean } = {}): Promise<TieoutTemplate[]> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      return [];
    }

    const templates = await this.repository.findAllTieoutTemplates(subsidiaryIds, filters);
    return templates.map((t) => this.transformTieoutTemplate(t));
  }

  async getTieoutTemplateById(id: string): Promise<TieoutTemplate | null> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      return null;
    }

    const template = await this.repository.findTieoutTemplateById(id, subsidiaryIds);
    return template ? this.transformTieoutTemplate(template) : null;
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

    const created = await this.repository.createTieoutTemplate({
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
    });

    return this.transformTieoutTemplate(created);
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

    return this.transformTieoutTemplate(updated);
  }

  // ============================================================================
  // Tieout Instances
  // ============================================================================

  async listTieoutsByPeriod(
    periodId: string,
    filters: { status?: string | string[] } = {}
  ): Promise<TieoutInstance[]> {
    const tieouts = await this.repository.findTieoutsByPeriod(periodId, filters);
    return tieouts.map((t) => this.transformTieoutInstance(t));
  }

  async listTieoutsByChecklist(checklistId: string): Promise<TieoutInstance[]> {
    const tieouts = await this.repository.findTieoutsByChecklist(checklistId);
    return tieouts.map((t) => this.transformTieoutInstance(t));
  }

  async getTieoutById(id: string): Promise<TieoutInstance | null> {
    const tieout = await this.repository.findTieoutById(id);
    return tieout ? this.transformTieoutInstance(tieout) : null;
  }

  async createTieoutInstance(data: CreateTieoutInstanceInput): Promise<TieoutInstance> {
    // Get template to get the name
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();
    const template = await this.repository.findTieoutTemplateById(data.templateId, subsidiaryIds);
    const tieoutName = template?.templateName ?? `Tieout-${this.generateTaskCode('TOT')}`;

    const created = await this.repository.createTieout({
      templateId: data.templateId,
      accountingPeriodId: data.accountingPeriodId,
      tieoutName,
    });

    return this.transformTieoutInstance(created);
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

    return this.transformTieoutInstance(updated);
  }

  async approveTieout(id: string): Promise<TieoutInstance> {
    const userId = this.requireUserContext();

    const approved = await this.repository.approveTieout(id, userId);

    if (!approved) {
      throw new ServiceError('Tieout instance not found', 'TIEOUT_NOT_FOUND', 404);
    }

    return this.transformTieoutInstance(approved);
  }

  // ============================================================================
  // Notifications
  // ============================================================================

  async listNotifications(
    options: { isRead?: boolean; limit?: number } = {}
  ): Promise<CloseNotification[]> {
    const userId = this.requireUserContext();
    const notifications = await this.repository.findNotificationsByUser(userId, options);
    return notifications.map((n) => this.transformNotification(n));
  }

  async createNotification(data: CreateCloseNotificationInput): Promise<CloseNotification> {
    const created = await this.repository.createNotification({
      userId: data.userId,
      notificationType: data.notificationType,
      title: data.title,
      message: data.message,
      severity: 'INFO',
    });

    return this.transformNotification(created);
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
