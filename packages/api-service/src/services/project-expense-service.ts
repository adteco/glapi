import { z } from 'zod';
import { BaseService } from './base-service';
import { PaginatedResult, PaginationParams, ServiceError } from '../types';
import {
  ProjectExpenseEntry,
  CreateProjectExpenseInput,
  UpdateProjectExpenseInput,
  ProjectExpenseFilters,
  ProjectExpenseAttachment,
  CreateExpenseAttachmentInput,
  projectExpenseStatusEnum,
  ProjectExpensePostingResult,
} from '../types/project-expenses.types';
import {
  ProjectExpenseRepository,
  ProjectTaskRepository,
  ProjectCostCodeRepository,
  ProjectRepository,
} from '@glapi/database';
import type { Project, ProjectCostCode } from '@glapi/database';
import { JobCostPostingService } from './job-cost-posting-service';

export class ProjectExpenseService extends BaseService {
  private repository: ProjectExpenseRepository;
  private projectTaskRepository: ProjectTaskRepository;
  private costCodeRepository: ProjectCostCodeRepository;
  private projectRepository: ProjectRepository;
  private jobCostPostingService: JobCostPostingService;

  constructor(context = {}) {
    super(context);
    this.repository = new ProjectExpenseRepository();
    this.projectTaskRepository = new ProjectTaskRepository();
    this.costCodeRepository = new ProjectCostCodeRepository();
    this.projectRepository = new ProjectRepository();
    this.jobCostPostingService = new JobCostPostingService(context);
  }

  private async validateProjectAccess(projectId: string | null | undefined): Promise<Project | null> {
    if (!projectId) {
      return null;
    }
    const organizationId = this.requireOrganizationContext();
    const project = await this.projectRepository.findById(projectId, organizationId);
    if (!project) {
      throw new ServiceError('Access denied to this project', 'PROJECT_ACCESS_DENIED', 403);
    }
    return project;
  }

  private async resolveTaskProject(projectTaskId: string | null | undefined): Promise<string | null> {
    if (!projectTaskId) return null;
    const organizationId = this.requireOrganizationContext();
    const projectIds = await this.projectTaskRepository.getAccessibleProjectIds(organizationId);
    const task = await this.projectTaskRepository.findById(projectTaskId, projectIds);
    if (!task) {
      throw new ServiceError('Project task not found', 'PROJECT_TASK_NOT_FOUND', 404);
    }
    return task.projectId;
  }

  private async validateCostCode(costCodeId: string, projectId: string | null): Promise<ProjectCostCode> {
    const organizationId = this.requireOrganizationContext();
    const projectIds = await this.projectRepository.getAccessibleProjectIds(organizationId);
    const costCode = await this.costCodeRepository.findById(costCodeId, projectIds);
    if (!costCode) {
      throw new ServiceError('Cost code not found', 'PROJECT_COST_CODE_NOT_FOUND', 404);
    }
    if (projectId && costCode.projectId !== projectId) {
      throw new ServiceError(
        'Cost code must belong to the selected project',
        'PROJECT_COST_CODE_INVALID',
        400
      );
    }
    if (!costCode.costAccountId || !costCode.wipAccountId) {
      throw new ServiceError(
        'Cost code missing cost/WIP accounts',
        'PROJECT_COST_CODE_MISSING_ACCOUNTS',
        400
      );
    }
    return costCode;
  }

  private transform(entry: any): ProjectExpenseEntry {
    return {
      id: entry.id,
      organizationId: entry.organizationId,
      subsidiaryId: entry.subsidiaryId,
      employeeId: entry.employeeId,
      projectId: entry.projectId,
      projectTaskId: entry.projectTaskId,
      costCodeId: entry.costCodeId,
      expenseType: entry.expenseType,
      vendorName: entry.vendorName,
      vendorInvoiceNumber: entry.vendorInvoiceNumber,
      expenseDate: entry.expenseDate,
      amount: entry.amount,
      currencyCode: entry.currencyCode,
      description: entry.description,
      isBillable: entry.isBillable,
      status: entry.status,
      submittedAt: entry.submittedAt,
      submittedBy: entry.submittedBy,
      approvedAt: entry.approvedAt,
      approvedBy: entry.approvedBy,
      rejectedAt: entry.rejectedAt,
      rejectedBy: entry.rejectedBy,
      rejectionReason: entry.rejectionReason,
      postedAt: entry.postedAt,
      metadata: entry.metadata,
      createdBy: entry.createdBy,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  async list(
    params: PaginationParams = {},
    filters: ProjectExpenseFilters = {},
    orderBy: 'expenseDate' | 'createdAt' | 'amount' = 'expenseDate',
    orderDirection: 'asc' | 'desc' = 'desc'
  ): Promise<PaginatedResult<ProjectExpenseEntry>> {
    const organizationId = this.requireOrganizationContext();
    const result = await this.repository.findAll(
      organizationId,
      filters,
      params.page,
      params.limit,
      orderBy,
      orderDirection
    );

    return {
      data: result.data.map((entry) => this.transform(entry)),
      total: result.total,
      page: params.page || 1,
      limit: params.limit || 50,
      totalPages: Math.ceil(result.total / (params.limit || 50)),
    };
  }

  async getById(id: string): Promise<ProjectExpenseEntry> {
    const organizationId = this.requireOrganizationContext();
    const entry = await this.repository.findById(id, organizationId);
    if (!entry) {
      throw new ServiceError('Expense entry not found', 'PROJECT_EXPENSE_NOT_FOUND', 404);
    }
    return this.transform(entry);
  }

  async create(input: CreateProjectExpenseInput): Promise<ProjectExpenseEntry> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    const projectIdFromTask = await this.resolveTaskProject(input.projectTaskId || null);

    if (input.projectId && projectIdFromTask && input.projectId !== projectIdFromTask) {
      throw new ServiceError('Project task must belong to the selected project', 'PROJECT_TASK_MISMATCH', 400);
    }

    const initialProjectId = projectIdFromTask || input.projectId || null;
    const costCode = await this.validateCostCode(input.costCodeId, initialProjectId);
    const resolvedProjectId = initialProjectId || costCode.projectId;

    if (!resolvedProjectId) {
      throw new ServiceError('Project is required for the selected cost code', 'PROJECT_REQUIRED', 400);
    }

    const project = await this.validateProjectAccess(resolvedProjectId);
    const subsidiaryId = project?.subsidiaryId || null;

    const created = await this.repository.create({
      organizationId,
      subsidiaryId,
      employeeId: userId,
      projectId: resolvedProjectId,
      projectTaskId: input.projectTaskId || null,
      costCodeId: input.costCodeId,
      expenseType: input.expenseType || 'OTHER',
      vendorName: input.vendorName || null,
      vendorInvoiceNumber: input.vendorInvoiceNumber || null,
      expenseDate: input.expenseDate,
      amount: input.amount,
      currencyCode: input.currencyCode || 'USD',
      description: input.description || null,
      isBillable: input.isBillable ?? true,
      metadata: input.metadata || null,
      createdBy: userId,
    });

    return this.transform(created);
  }

  async update(id: string, input: UpdateProjectExpenseInput): Promise<ProjectExpenseEntry> {
    const organizationId = this.requireOrganizationContext();
    const existing = await this.repository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError('Expense entry not found', 'PROJECT_EXPENSE_NOT_FOUND', 404);
    }

    if (!['DRAFT', 'REJECTED'].includes(existing.status)) {
      throw new ServiceError('Only DRAFT or REJECTED entries can be updated', 'PROJECT_EXPENSE_NOT_EDITABLE', 400);
    }

    const nextProjectTaskId =
      input.projectTaskId !== undefined ? input.projectTaskId : existing.projectTaskId;
    const projectIdFromTask = await this.resolveTaskProject(nextProjectTaskId);
    let projectId =
      input.projectId !== undefined ? input.projectId : projectIdFromTask || existing.projectId;

    if (input.projectTaskId && projectIdFromTask && projectId && projectId !== projectIdFromTask) {
      throw new ServiceError('Project task must belong to the selected project', 'PROJECT_TASK_MISMATCH', 400);
    }

    let costCodeId =
      input.costCodeId !== undefined ? input.costCodeId : existing.costCodeId || null;
    let costCode: ProjectCostCode | null = null;
    if (costCodeId) {
      costCode = await this.validateCostCode(costCodeId, projectId);
      if (!projectId) {
        projectId = costCode.projectId;
      }
    }

    const project = await this.validateProjectAccess(projectId);
    const subsidiaryId =
      projectId && project ? project.subsidiaryId || null : existing.subsidiaryId || null;

    const updated = await this.repository.update(
      id,
      {
        projectId: projectId || null,
        projectTaskId: nextProjectTaskId,
        costCodeId,
        expenseType: input.expenseType ?? existing.expenseType,
        vendorName: input.vendorName ?? existing.vendorName,
        vendorInvoiceNumber: input.vendorInvoiceNumber ?? existing.vendorInvoiceNumber,
        expenseDate: input.expenseDate ?? existing.expenseDate,
        amount: input.amount ?? existing.amount,
        currencyCode: input.currencyCode ?? existing.currencyCode,
        description: input.description ?? existing.description,
        isBillable: input.isBillable ?? existing.isBillable,
        metadata: input.metadata ?? existing.metadata,
        subsidiaryId,
        status: existing.status === 'REJECTED' ? 'DRAFT' : existing.status,
        rejectedAt: existing.status === 'REJECTED' ? null : existing.rejectedAt,
        rejectedBy: existing.status === 'REJECTED' ? null : existing.rejectedBy,
        rejectionReason: existing.status === 'REJECTED' ? null : existing.rejectionReason,
      },
      organizationId
    );

    if (!updated) {
      throw new ServiceError('Failed to update expense entry', 'PROJECT_EXPENSE_UPDATE_FAILED', 500);
    }

    return this.transform(updated);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    const organizationId = this.requireOrganizationContext();
    const existing = await this.repository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError('Expense entry not found', 'PROJECT_EXPENSE_NOT_FOUND', 404);
    }

    if (existing.status !== 'DRAFT') {
      throw new ServiceError('Only DRAFT entries can be deleted', 'PROJECT_EXPENSE_NOT_EDITABLE', 400);
    }

    const removed = await this.repository.delete(id, organizationId);
    if (!removed) {
      throw new ServiceError('Failed to delete expense entry', 'PROJECT_EXPENSE_DELETE_FAILED', 500);
    }

    return { success: true };
  }

  async changeStatus(id: string, nextStatus: z.infer<typeof projectExpenseStatusEnum>, comments?: string) {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    const existing = await this.repository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError('Expense entry not found', 'PROJECT_EXPENSE_NOT_FOUND', 404);
    }

    const allowedTransitions: Record<string, string[]> = {
      DRAFT: ['SUBMITTED', 'CANCELLED'],
      SUBMITTED: ['APPROVED', 'REJECTED', 'DRAFT'],
      REJECTED: ['DRAFT'],
      APPROVED: ['POSTED', 'DRAFT'],
      POSTED: [],
      CANCELLED: [],
    };

    if (!allowedTransitions[existing.status]?.includes(nextStatus)) {
      throw new ServiceError(
        `Cannot transition from ${existing.status} to ${nextStatus}`,
        'PROJECT_EXPENSE_INVALID_TRANSITION',
        400
      );
    }

    const updates: Partial<ProjectExpenseEntry> = { status: nextStatus };
    if (nextStatus === 'SUBMITTED') {
      updates.submittedAt = new Date();
      updates.submittedBy = userId;
    } else if (nextStatus === 'APPROVED') {
      updates.approvedAt = new Date();
      updates.approvedBy = userId;
    } else if (nextStatus === 'REJECTED') {
      updates.rejectedAt = new Date();
      updates.rejectedBy = userId;
      updates.rejectionReason = comments || 'Rejected';
    }

    const updated = await this.repository.update(id, updates, organizationId);
    if (!updated) {
      throw new ServiceError('Failed to update expense status', 'PROJECT_EXPENSE_UPDATE_FAILED', 500);
    }

    await this.repository.recordApproval(id, nextStatus, existing.status, nextStatus, userId, comments);
    return this.transform(updated);
  }

  async postToGL(expenseIds: string[]): Promise<ProjectExpensePostingResult> {
    const organizationId = this.requireOrganizationContext();
    const result: ProjectExpensePostingResult = {
      success: true,
      postedCount: 0,
      failedCount: 0,
      errors: [],
    };

    if (expenseIds.length === 0) {
      result.errors.push({ expenseId: '', error: 'No expense entries provided' });
      result.success = false;
      return result;
    }

    type ReadyExpense = {
      id: string;
      projectId: string;
      costCodeId: string;
      amount: number;
      expenseDate: string;
      subsidiaryId: string;
      description: string | null;
      currencyCode: string;
    };

    const expensesToPost: ReadyExpense[] = [];
    for (const expenseId of expenseIds) {
      const expense = await this.repository.findById(expenseId, organizationId);
      if (!expense) {
        result.errors.push({ expenseId, error: 'Expense entry not found' });
        result.failedCount++;
        continue;
      }

      if (expense.status !== 'APPROVED') {
        result.errors.push({
          expenseId,
          error: `Cannot post expense with status "${expense.status}". Only APPROVED entries may be posted.`,
        });
        result.failedCount++;
        continue;
      }

      if (!expense.projectId || !expense.costCodeId) {
        result.errors.push({
          expenseId,
          error: 'Project and cost code are required before posting an expense entry',
        });
        result.failedCount++;
        continue;
      }

      if (!expense.subsidiaryId) {
        result.errors.push({
          expenseId,
          error: 'Subsidiary is required before posting an expense entry',
        });
        result.failedCount++;
        continue;
      }

      const amount = parseFloat(expense.amount || '0');
      if (!amount || amount <= 0) {
        result.errors.push({
          expenseId,
          error: 'Expense entry must have a positive amount before posting',
        });
        result.failedCount++;
        continue;
      }

      expensesToPost.push({
        id: expense.id,
        projectId: expense.projectId,
        costCodeId: expense.costCodeId,
        amount,
        expenseDate: expense.expenseDate,
        subsidiaryId: expense.subsidiaryId,
        description: expense.description,
        currencyCode: expense.currencyCode || 'USD',
      });
    }

    if (expensesToPost.length === 0) {
      result.success = false;
      return result;
    }

    const postingGroups = new Map<string, ReadyExpense[]>();
    for (const expense of expensesToPost) {
      const key = `${expense.subsidiaryId}|${expense.currencyCode}`;
      const group = postingGroups.get(key) || [];
      group.push(expense);
      postingGroups.set(key, group);
    }

    const glTransactionIds: string[] = [];

    for (const groupEntries of postingGroups.values()) {
      const postingEntries = groupEntries.map((expense) => ({
        id: expense.id,
        projectId: expense.projectId,
        costCodeId: expense.costCodeId,
        amount: expense.amount,
        expenseDate: expense.expenseDate,
        subsidiaryId: expense.subsidiaryId,
        description: expense.description || `Expense posted on ${expense.expenseDate}`,
        currencyCode: expense.currencyCode,
      }));

      try {
        const { glResult } = await this.jobCostPostingService.postExpenseEntries(postingEntries);
        const glTransactionId = glResult.glTransaction.id;
        if (!glTransactionId) {
          throw new ServiceError('GL transaction missing identifier', 'GL_TRANSACTION_INVALID', 500);
        }
        glTransactionIds.push(glTransactionId);

        for (const expense of groupEntries) {
          try {
            await this.repository.markAsPosted(expense.id, organizationId, glTransactionId);
            result.postedCount++;
          } catch (innerError) {
            const message =
              innerError instanceof Error ? innerError.message : 'Failed to mark expense as posted';
            result.errors.push({ expenseId: expense.id, error: message });
            result.failedCount++;
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to post expense entries to GL';
        for (const expense of groupEntries) {
          result.errors.push({ expenseId: expense.id, error: errorMessage });
          result.failedCount++;
        }
      }
    }

    if (glTransactionIds.length > 0) {
      result.glTransactionId = glTransactionIds[0];
      result.glTransactionIds = glTransactionIds;
    }

    result.success = result.failedCount === 0;
    return result;
  }

  async listAttachments(expenseId: string): Promise<ProjectExpenseAttachment[]> {
    const organizationId = this.requireOrganizationContext();
    const entry = await this.repository.findById(expenseId, organizationId);
    if (!entry) {
      throw new ServiceError('Expense entry not found', 'PROJECT_EXPENSE_NOT_FOUND', 404);
    }
    return this.repository.listAttachments(expenseId, organizationId);
  }

  async addAttachment(input: CreateExpenseAttachmentInput): Promise<ProjectExpenseAttachment> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    const entry = await this.repository.findById(input.expenseId, organizationId);
    if (!entry) {
      throw new ServiceError('Expense entry not found', 'PROJECT_EXPENSE_NOT_FOUND', 404);
    }

    return this.repository.addAttachment({
      organizationId,
      expenseId: input.expenseId,
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      contentType: input.contentType || null,
      fileSize: input.fileSize ?? null,
      uploadedBy: userId,
      metadata: input.metadata || null,
    });
  }

  async deleteAttachment(attachmentId: string): Promise<{ success: boolean }> {
    const organizationId = this.requireOrganizationContext();
    const removed = await this.repository.deleteAttachment(attachmentId, organizationId);
    if (!removed) {
      throw new ServiceError('Attachment not found', 'PROJECT_EXPENSE_ATTACHMENT_NOT_FOUND', 404);
    }
    return { success: true };
  }
}
