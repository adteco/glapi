import { BaseService } from './base-service';
import {
  TimeEntry,
  CreateTimeEntryInput,
  UpdateTimeEntryInput,
  TimeEntryFilters,
  SubmitTimeEntriesInput,
  ApproveTimeEntriesInput,
  RejectTimeEntriesInput,
  LaborCostRate,
  CreateLaborCostRateInput,
  EmployeeProjectAssignment,
  CreateEmployeeProjectAssignmentInput,
  TimeEntrySummaryByEmployee,
  TimeEntrySummaryByProject,
  VALID_TIME_ENTRY_STATUS_TRANSITIONS,
  TimeEntryStatus,
  TimeEntryPostingResult,
  TimeEntryAttachment,
  CreateTimeEntryAttachmentInput,
} from '../types/time-entries.types';
import { PaginationParams, PaginatedResult, ServiceError } from '../types';
import {
  TimeEntryRepository,
  TimeEntryWithRelations as RepoTimeEntryWithRelations,
  ProjectTaskRepository,
} from '@glapi/database';

export class TimeEntryService extends BaseService {
  private repository: TimeEntryRepository;
  private projectTaskRepository: ProjectTaskRepository;

  constructor(context = {}) {
    super(context);
    this.repository = new TimeEntryRepository();
    this.projectTaskRepository = new ProjectTaskRepository();
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Transform database time entry to service layer type
   */
  private transformEntry(dbEntry: any): TimeEntry {
    return {
      id: dbEntry.id,
      organizationId: dbEntry.organizationId,
      subsidiaryId: dbEntry.subsidiaryId,
      employeeId: dbEntry.employeeId,
      projectId: dbEntry.projectId,
      costCodeId: dbEntry.costCodeId,
      projectTaskId: dbEntry.projectTaskId,
      entryDate: dbEntry.entryDate,
      hours: dbEntry.hours,
      entryType: dbEntry.entryType,
      isBillable: dbEntry.isBillable,
      billingRate: dbEntry.billingRate,
      laborRate: dbEntry.laborRate,
      laborCost: dbEntry.laborCost,
      burdenRate: dbEntry.burdenRate,
      burdenCost: dbEntry.burdenCost,
      totalCost: dbEntry.totalCost,
      description: dbEntry.description,
      internalNotes: dbEntry.internalNotes,
      status: dbEntry.status,
      submittedAt: dbEntry.submittedAt,
      submittedBy: dbEntry.submittedBy,
      approvedAt: dbEntry.approvedAt,
      approvedBy: dbEntry.approvedBy,
      rejectedAt: dbEntry.rejectedAt,
      rejectedBy: dbEntry.rejectedBy,
      rejectionReason: dbEntry.rejectionReason,
      postedAt: dbEntry.postedAt,
      glTransactionId: dbEntry.glTransactionId,
      glPostingBatchId: dbEntry.glPostingBatchId,
      externalId: dbEntry.externalId,
      externalSource: dbEntry.externalSource,
      metadata: dbEntry.metadata as Record<string, unknown> | null,
      createdBy: dbEntry.createdBy,
      createdAt: dbEntry.createdAt,
      updatedAt: dbEntry.updatedAt,
    };
  }

  /**
   * Transform database labor rate to service layer type
   */
  private transformLaborRate(dbRate: any): LaborCostRate {
    return {
      id: dbRate.id,
      organizationId: dbRate.organizationId,
      subsidiaryId: dbRate.subsidiaryId,
      employeeId: dbRate.employeeId,
      projectId: dbRate.projectId,
      costCodeId: dbRate.costCodeId,
      laborRole: dbRate.laborRole,
      laborRate: dbRate.laborRate,
      burdenRate: dbRate.burdenRate,
      billingRate: dbRate.billingRate,
      overtimeMultiplier: dbRate.overtimeMultiplier,
      doubleTimeMultiplier: dbRate.doubleTimeMultiplier,
      effectiveFrom: dbRate.effectiveFrom,
      effectiveTo: dbRate.effectiveTo,
      priority: dbRate.priority,
      isActive: dbRate.isActive,
      currencyCode: dbRate.currencyCode,
      description: dbRate.description,
      metadata: dbRate.metadata as Record<string, unknown> | null,
      createdBy: dbRate.createdBy,
      createdAt: dbRate.createdAt,
      updatedAt: dbRate.updatedAt,
    };
  }

  /**
   * Transform database assignment to service layer type
   */
  private transformAssignment(dbAssignment: any): EmployeeProjectAssignment {
    return {
      id: dbAssignment.id,
      organizationId: dbAssignment.organizationId,
      employeeId: dbAssignment.employeeId,
      projectId: dbAssignment.projectId,
      role: dbAssignment.role,
      defaultCostCodeId: dbAssignment.defaultCostCodeId,
      budgetedHours: dbAssignment.budgetedHours,
      actualHours: dbAssignment.actualHours,
      startDate: dbAssignment.startDate,
      endDate: dbAssignment.endDate,
      isActive: dbAssignment.isActive,
      canApproveTime: dbAssignment.canApproveTime,
      metadata: dbAssignment.metadata as Record<string, unknown> | null,
      createdBy: dbAssignment.createdBy,
      createdAt: dbAssignment.createdAt,
      updatedAt: dbAssignment.updatedAt,
    };
  }

  private async getAccessibleProjectTask(taskId: string, organizationId: string) {
    const projectIds = await this.projectTaskRepository.getAccessibleProjectIds(organizationId);
    const task = await this.projectTaskRepository.findById(taskId, projectIds);
    if (!task) {
      throw new ServiceError('Project task not found', 'PROJECT_TASK_NOT_FOUND', 404);
    }
    return task;
  }

  /**
   * Calculate labor costs based on rate hierarchy
   */
  private async calculateLaborCosts(
    employeeId: string,
    projectId: string | null | undefined,
    costCodeId: string | null | undefined,
    entryDate: string,
    hours: string,
    entryType: string
  ): Promise<{ laborRate: string; laborCost: string; burdenRate: string; burdenCost: string; totalCost: string }> {
    const organizationId = this.requireOrganizationContext();

    const rate = await this.repository.findApplicableLaborRate(
      organizationId,
      employeeId,
      entryDate,
      projectId || undefined,
      costCodeId || undefined
    );

    if (!rate) {
      return {
        laborRate: '0',
        laborCost: '0',
        burdenRate: '0',
        burdenCost: '0',
        totalCost: '0',
      };
    }

    // Calculate effective labor rate based on entry type
    const baseLaborRate = parseFloat(rate.laborRate);
    let effectiveLaborRate: number;

    switch (entryType) {
      case 'OVERTIME':
        effectiveLaborRate = baseLaborRate * parseFloat(rate.overtimeMultiplier);
        break;
      case 'DOUBLE_TIME':
        effectiveLaborRate = baseLaborRate * parseFloat(rate.doubleTimeMultiplier);
        break;
      default:
        effectiveLaborRate = baseLaborRate;
    }

    const hoursNum = parseFloat(hours);
    const laborCost = hoursNum * effectiveLaborRate;

    // Calculate burden costs
    const burdenRateNum = parseFloat(rate.burdenRate || '0');
    const burdenCost = hoursNum * burdenRateNum;

    const totalCost = laborCost + burdenCost;

    return {
      laborRate: effectiveLaborRate.toFixed(4),
      laborCost: laborCost.toFixed(4),
      burdenRate: rate.burdenRate,
      burdenCost: burdenCost.toFixed(4),
      totalCost: totalCost.toFixed(4),
    };
  }

  // ============================================================================
  // Time Entry CRUD
  // ============================================================================

  /**
   * List time entries with filters and pagination
   */
  async list(
    params: PaginationParams = {},
    filters: TimeEntryFilters = {},
    orderBy: 'entryDate' | 'createdAt' | 'status' | 'hours' = 'entryDate',
    orderDirection: 'asc' | 'desc' = 'desc'
  ): Promise<PaginatedResult<TimeEntry>> {
    const organizationId = this.requireOrganizationContext();
    const page = params.page || 1;
    const limit = params.limit || 20;

    // Convert filters to repository format
    const repoFilters: any = { ...filters };
    if (filters.status && typeof filters.status === 'string') {
      repoFilters.status = filters.status;
    }

    const result = await this.repository.findAll(
      organizationId,
      repoFilters,
      page,
      limit,
      orderBy,
      orderDirection
    );

    return {
      data: result.entries.map((e) => this.transformEntry(e)),
      total: result.totalCount,
      page,
      limit,
      totalPages: Math.ceil(result.totalCount / limit),
    };
  }

  /**
   * Get time entry by ID
   */
  async getById(id: string): Promise<TimeEntry | null> {
    const organizationId = this.requireOrganizationContext();
    const entry = await this.repository.findById(id, organizationId);
    return entry ? this.transformEntry(entry) : null;
  }

  /**
   * Get time entry by ID with relations (employee, project, approver)
   */
  async getByIdWithRelations(id: string): Promise<RepoTimeEntryWithRelations | null> {
    const organizationId = this.requireOrganizationContext();
    return this.repository.findByIdWithRelations(id, organizationId);
  }

  /**
   * Create a new time entry
   */
  async create(input: CreateTimeEntryInput): Promise<TimeEntry> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Default employee to current user if not specified
    const employeeId = input.employeeId || userId;

    let projectId = input.projectId || null;
    let projectTaskId = input.projectTaskId || null;

    if (projectTaskId) {
      const task = await this.getAccessibleProjectTask(projectTaskId, organizationId);
      if (projectId && projectId !== task.projectId) {
        throw new ServiceError(
          'Project task must belong to the selected project',
          'PROJECT_TASK_MISMATCH',
          400
        );
      }
      projectId = task.projectId;
    }

    // Verify employee has access to project if specified
    if (projectId) {
      const hasAccess = await this.repository.isEmployeeAssignedToProject(
        employeeId,
        projectId,
        organizationId
      );
      if (!hasAccess) {
        throw new ServiceError(
          'Employee is not assigned to this project',
          'EMPLOYEE_NOT_ASSIGNED',
          403
        );
      }
    }

    // Calculate labor costs
    const costs = await this.calculateLaborCosts(
      employeeId,
      projectId,
      input.costCodeId,
      input.entryDate,
      input.hours,
      input.entryType || 'REGULAR'
    );

    const created = await this.repository.create({
      organizationId,
      employeeId,
      projectId,
      costCodeId: input.costCodeId || null,
      projectTaskId,
      entryDate: input.entryDate,
      hours: input.hours,
      entryType: input.entryType || 'REGULAR',
      description: input.description || null,
      internalNotes: input.internalNotes || null,
      isBillable: input.isBillable ?? true,
      laborRate: costs.laborRate,
      laborCost: costs.laborCost,
      burdenRate: costs.burdenRate,
      burdenCost: costs.burdenCost,
      totalCost: costs.totalCost,
      externalId: input.externalId || null,
      externalSource: input.externalSource || null,
      metadata: input.metadata || null,
      createdBy: userId,
    });

    return this.transformEntry(created);
  }

  /**
   * Update a time entry (only DRAFT or REJECTED status)
   */
  async update(id: string, input: UpdateTimeEntryInput): Promise<TimeEntry> {
    const organizationId = this.requireOrganizationContext();

    const existing = await this.repository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError(`Time entry with ID "${id}" not found`, 'TIME_ENTRY_NOT_FOUND', 404);
    }

    // Only allow updates for DRAFT or REJECTED entries
    if (!['DRAFT', 'REJECTED'].includes(existing.status)) {
      throw new ServiceError(
        `Cannot update time entry with status "${existing.status}". Only DRAFT or REJECTED entries can be updated.`,
        'TIME_ENTRY_NOT_EDITABLE',
        400
      );
    }

    let projectId =
      input.projectId !== undefined ? input.projectId : existing.projectId;
    let projectTaskId =
      input.projectTaskId !== undefined ? input.projectTaskId : existing.projectTaskId;

    if (projectTaskId) {
      const task = await this.getAccessibleProjectTask(projectTaskId, organizationId);
      if (projectId && projectId !== task.projectId) {
        throw new ServiceError(
          'Project task must belong to the selected project',
          'PROJECT_TASK_MISMATCH',
          400
        );
      }
      projectId = task.projectId;
    }

    if (projectId) {
      const hasAccess = await this.repository.isEmployeeAssignedToProject(
        existing.employeeId,
        projectId,
        organizationId
      );
      if (!hasAccess) {
        throw new ServiceError(
          'Employee is not assigned to this project',
          'EMPLOYEE_NOT_ASSIGNED',
          403
        );
      }
    }

    // Recalculate costs if hours or entry type changed
    let costUpdates: Partial<{
      laborRate: string;
      laborCost: string;
      burdenRate: string;
      burdenCost: string;
      totalCost: string;
    }> = {};
    if (input.hours || input.entryType) {
      const hours = input.hours || existing.hours;
      const entryType = input.entryType || existing.entryType;
      const costCodeId = input.costCodeId !== undefined ? input.costCodeId : existing.costCodeId;
      const entryDate = input.entryDate || existing.entryDate;

      costUpdates = await this.calculateLaborCosts(
        existing.employeeId,
        projectId,
        costCodeId,
        entryDate,
        hours,
        entryType
      );
    }

    const updateData: any = {
      ...input,
      projectId: projectId || null,
      projectTaskId: projectTaskId || null,
      ...costUpdates,
    };

    // Reset status to DRAFT if it was rejected
    if (existing.status === 'REJECTED') {
      updateData.status = 'DRAFT';
      updateData.rejectedAt = null;
      updateData.rejectedBy = null;
      updateData.rejectionReason = null;
    }

    const updated = await this.repository.update(id, updateData, organizationId);

    if (!updated) {
      throw new ServiceError('Failed to update time entry', 'UPDATE_FAILED', 500);
    }

    return this.transformEntry(updated);
  }

  /**
   * List attachments for a time entry
   */
  async listAttachments(timeEntryId: string): Promise<TimeEntryAttachment[]> {
    const organizationId = this.requireOrganizationContext();
    const entry = await this.repository.findById(timeEntryId, organizationId);

    if (!entry) {
      throw new ServiceError('Time entry not found', 'TIME_ENTRY_NOT_FOUND', 404);
    }

    return this.repository.listAttachments(timeEntryId, organizationId);
  }

  /**
   * Add an attachment to a time entry
   */
  async addAttachment(input: CreateTimeEntryAttachmentInput): Promise<TimeEntryAttachment> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const entry = await this.repository.findById(input.timeEntryId, organizationId);
    if (!entry) {
      throw new ServiceError('Time entry not found', 'TIME_ENTRY_NOT_FOUND', 404);
    }

    return this.repository.addAttachment({
      organizationId,
      timeEntryId: input.timeEntryId,
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      contentType: input.contentType || null,
      fileSize: input.fileSize ?? null,
      uploadedBy: userId,
      metadata: input.metadata || null,
    });
  }

  /**
   * Delete an attachment from a time entry
   */
  async deleteAttachment(attachmentId: string): Promise<{ success: boolean }> {
    const organizationId = this.requireOrganizationContext();

    const removed = await this.repository.deleteAttachment(attachmentId, organizationId);
    if (!removed) {
      throw new ServiceError('Attachment not found', 'TIME_ENTRY_ATTACHMENT_NOT_FOUND', 404);
    }

    return { success: true };
  }

  /**
   * Delete a time entry (only DRAFT status)
   */
  async delete(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    const existing = await this.repository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError(`Time entry with ID "${id}" not found`, 'TIME_ENTRY_NOT_FOUND', 404);
    }

    if (existing.status !== 'DRAFT') {
      throw new ServiceError(
        `Cannot delete time entry with status "${existing.status}". Only DRAFT entries can be deleted.`,
        'TIME_ENTRY_NOT_DELETABLE',
        400
      );
    }

    await this.repository.delete(id, organizationId);
  }

  // ============================================================================
  // Approval Workflow
  // ============================================================================

  /**
   * Submit time entries for approval
   */
  async submit(input: SubmitTimeEntriesInput): Promise<TimeEntry[]> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const submitted: TimeEntry[] = [];

    for (const entryId of input.timeEntryIds) {
      const entry = await this.repository.findById(entryId, organizationId);
      if (!entry) {
        throw new ServiceError(`Time entry "${entryId}" not found`, 'TIME_ENTRY_NOT_FOUND', 404);
      }

      // Validate status transition
      const validTransitions = VALID_TIME_ENTRY_STATUS_TRANSITIONS[entry.status as TimeEntryStatus];
      if (!validTransitions.includes('SUBMITTED')) {
        throw new ServiceError(
          `Cannot submit time entry with status "${entry.status}"`,
          'INVALID_STATUS_TRANSITION',
          400
        );
      }

      const updated = await this.repository.submit(entryId, organizationId, userId);
      if (updated) {
        submitted.push(this.transformEntry(updated));
      }
    }

    return submitted;
  }

  /**
   * Approve time entries
   */
  async approve(input: ApproveTimeEntriesInput): Promise<TimeEntry[]> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const approved: TimeEntry[] = [];

    for (const entryId of input.timeEntryIds) {
      const entry = await this.repository.findById(entryId, organizationId);
      if (!entry) {
        throw new ServiceError(`Time entry "${entryId}" not found`, 'TIME_ENTRY_NOT_FOUND', 404);
      }

      // Validate status transition
      const validTransitions = VALID_TIME_ENTRY_STATUS_TRANSITIONS[entry.status as TimeEntryStatus];
      if (!validTransitions.includes('APPROVED')) {
        throw new ServiceError(
          `Cannot approve time entry with status "${entry.status}"`,
          'INVALID_STATUS_TRANSITION',
          400
        );
      }

      // Verify approver has permission (is assigned to project with canApproveTime)
      if (entry.projectId) {
        const assignments = await this.repository.findEmployeeAssignments(
          userId,
          organizationId,
          true
        );
        const canApprove = assignments.some(
          (a) => a.projectId === entry.projectId && a.canApproveTime
        );
        if (!canApprove) {
          throw new ServiceError(
            'You do not have permission to approve time for this project',
            'APPROVAL_NOT_AUTHORIZED',
            403
          );
        }
      }

      const updated = await this.repository.approve(
        entryId,
        organizationId,
        userId,
        input.comments
      );
      if (updated) {
        approved.push(this.transformEntry(updated));
      }
    }

    return approved;
  }

  /**
   * Reject time entries
   */
  async reject(input: RejectTimeEntriesInput): Promise<TimeEntry[]> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const rejected: TimeEntry[] = [];

    for (const entryId of input.timeEntryIds) {
      const entry = await this.repository.findById(entryId, organizationId);
      if (!entry) {
        throw new ServiceError(`Time entry "${entryId}" not found`, 'TIME_ENTRY_NOT_FOUND', 404);
      }

      // Validate status transition
      const validTransitions = VALID_TIME_ENTRY_STATUS_TRANSITIONS[entry.status as TimeEntryStatus];
      if (!validTransitions.includes('REJECTED')) {
        throw new ServiceError(
          `Cannot reject time entry with status "${entry.status}"`,
          'INVALID_STATUS_TRANSITION',
          400
        );
      }

      const updated = await this.repository.reject(
        entryId,
        organizationId,
        userId,
        input.reason
      );
      if (updated) {
        rejected.push(this.transformEntry(updated));
      }
    }

    return rejected;
  }

  /**
   * Return time entries to draft
   */
  async returnToDraft(timeEntryIds: string[]): Promise<TimeEntry[]> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const returned: TimeEntry[] = [];

    for (const entryId of timeEntryIds) {
      const entry = await this.repository.findById(entryId, organizationId);
      if (!entry) {
        throw new ServiceError(`Time entry "${entryId}" not found`, 'TIME_ENTRY_NOT_FOUND', 404);
      }

      // Validate status transition
      const validTransitions = VALID_TIME_ENTRY_STATUS_TRANSITIONS[entry.status as TimeEntryStatus];
      if (!validTransitions.includes('DRAFT')) {
        throw new ServiceError(
          `Cannot return time entry with status "${entry.status}" to draft`,
          'INVALID_STATUS_TRANSITION',
          400
        );
      }

      const updated = await this.repository.returnToDraft(entryId, organizationId, userId);
      if (updated) {
        returned.push(this.transformEntry(updated));
      }
    }

    return returned;
  }

  /**
   * Get pending approvals for the current user
   */
  async getPendingApprovals(
    params: PaginationParams = {}
  ): Promise<PaginatedResult<RepoTimeEntryWithRelations>> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    const page = params.page || 1;
    const limit = params.limit || 20;

    // Get projects where user can approve time
    const assignments = await this.repository.findEmployeeAssignments(userId, organizationId, true);
    const projectIds = assignments
      .filter((a) => a.canApproveTime)
      .map((a) => a.projectId);

    if (projectIds.length === 0) {
      return this.createPaginatedResult([], 0, page, limit);
    }

    // Get submitted entries for those projects
    const result = await this.repository.findAll(
      organizationId,
      { status: 'SUBMITTED' },
      page,
      limit,
      'submittedAt',
      'asc'
    );

    // Filter to only entries for projects user can approve
    const filteredData = result.entries.filter(
      (e) => e.projectId && projectIds.includes(e.projectId)
    );

    // Get relations for each entry
    const entriesWithRelations: RepoTimeEntryWithRelations[] = [];
    for (const entry of filteredData) {
      const withRelations = await this.repository.findByIdWithRelations(entry.id, organizationId);
      if (withRelations) {
        entriesWithRelations.push(withRelations);
      }
    }

    return {
      data: entriesWithRelations,
      total: filteredData.length,
      page,
      limit,
      totalPages: Math.ceil(filteredData.length / limit),
    };
  }

  // ============================================================================
  // Labor Cost Rates
  // ============================================================================

  /**
   * List labor cost rates
   */
  async listLaborRates(
    filters: {
      employeeId?: string;
      projectId?: string;
      costCodeId?: string;
      laborRole?: string;
      effectiveDate?: string;
      isActive?: boolean;
    } = {}
  ): Promise<LaborCostRate[]> {
    const organizationId = this.requireOrganizationContext();
    const rates = await this.repository.findLaborRates(organizationId, filters);
    return rates.map((r) => this.transformLaborRate(r));
  }

  /**
   * Create a labor cost rate
   */
  async createLaborRate(input: CreateLaborCostRateInput): Promise<LaborCostRate> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const created = await this.repository.createLaborRate({
      organizationId,
      employeeId: input.employeeId || null,
      projectId: input.projectId || null,
      costCodeId: input.costCodeId || null,
      laborRole: input.laborRole || null,
      laborRate: input.laborRate,
      burdenRate: input.burdenRate || '0',
      billingRate: input.billingRate || null,
      overtimeMultiplier: input.overtimeMultiplier || '1.5',
      doubleTimeMultiplier: input.doubleTimeMultiplier || '2.0',
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo || null,
      priority: input.priority ?? 0,
      description: input.description || null,
      metadata: input.metadata || null,
      createdBy: userId,
    });

    return this.transformLaborRate(created);
  }

  // ============================================================================
  // Employee Project Assignments
  // ============================================================================

  /**
   * Get employee assignments for current user
   */
  async getMyAssignments(activeOnly: boolean = true): Promise<EmployeeProjectAssignment[]> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const assignments = await this.repository.findEmployeeAssignments(
      userId,
      organizationId,
      activeOnly
    );
    return assignments.map((a) => this.transformAssignment(a));
  }

  /**
   * Create employee project assignment
   */
  async createAssignment(
    input: CreateEmployeeProjectAssignmentInput
  ): Promise<EmployeeProjectAssignment> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Check if assignment already exists
    const existing = await this.repository.isEmployeeAssignedToProject(
      input.employeeId,
      input.projectId,
      organizationId
    );
    if (existing) {
      throw new ServiceError(
        'Employee is already assigned to this project',
        'ASSIGNMENT_EXISTS',
        409
      );
    }

    const created = await this.repository.createAssignment({
      organizationId,
      employeeId: input.employeeId,
      projectId: input.projectId,
      role: input.role || null,
      defaultCostCodeId: input.defaultCostCodeId || null,
      budgetedHours: input.budgetedHours || null,
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      canApproveTime: input.canApproveTime ?? false,
      metadata: input.metadata || null,
      createdBy: userId,
    });

    return this.transformAssignment(created);
  }

  // ============================================================================
  // Aggregations & Reporting
  // ============================================================================

  /**
   * Get total hours for an employee in a date range
   */
  async getEmployeeTotalHours(
    employeeId: string,
    startDate: string,
    endDate: string,
    status?: TimeEntryStatus
  ): Promise<string> {
    const organizationId = this.requireOrganizationContext();
    const totalHours = await this.repository.getTotalHours(
      employeeId,
      organizationId,
      startDate,
      endDate,
      status ? [status] : undefined
    );
    return totalHours.toFixed(2);
  }

  /**
   * Get total cost for a project
   */
  async getProjectTotalCost(projectId: string, status?: TimeEntryStatus): Promise<string> {
    const organizationId = this.requireOrganizationContext();
    const result = await this.repository.getProjectTotalCost(
      projectId,
      organizationId,
      status ? [status] : undefined
    );
    return result.totalCost.toFixed(4);
  }

  /**
   * Get time entry summary by employee
   */
  async getSummaryByEmployee(
    startDate: string,
    endDate: string,
    status?: TimeEntryStatus
  ): Promise<TimeEntrySummaryByEmployee[]> {
    const organizationId = this.requireOrganizationContext();

    // Get all entries in range
    const result = await this.repository.findAll(
      organizationId,
      {
        startDate,
        endDate,
        status: status ? status : undefined,
      },
      1,
      10000, // Large limit for aggregation
      'entryDate',
      'asc'
    );

    // Group by employee
    const byEmployee = new Map<
      string,
      {
        employeeId: string;
        totalHours: number;
        totalCost: number;
        regularHours: number;
        overtimeHours: number;
        billableHours: number;
        nonBillableHours: number;
        entryCount: number;
      }
    >();

    for (const entry of result.entries) {
      const existing = byEmployee.get(entry.employeeId) || {
        employeeId: entry.employeeId,
        totalHours: 0,
        totalCost: 0,
        regularHours: 0,
        overtimeHours: 0,
        billableHours: 0,
        nonBillableHours: 0,
        entryCount: 0,
      };

      const hours = parseFloat(entry.hours || '0');
      existing.totalHours += hours;
      existing.totalCost += parseFloat(entry.totalCost || '0');
      existing.entryCount += 1;

      if (['REGULAR', 'PTO', 'SICK', 'HOLIDAY', 'OTHER'].includes(entry.entryType)) {
        existing.regularHours += hours;
      } else if (entry.entryType === 'OVERTIME') {
        existing.overtimeHours += hours;
      }

      if (entry.isBillable) {
        existing.billableHours += hours;
      } else {
        existing.nonBillableHours += hours;
      }

      byEmployee.set(entry.employeeId, existing);
    }

    // Transform to result format (employee names would need to be fetched separately)
    return Array.from(byEmployee.values()).map((e) => ({
      employeeId: e.employeeId,
      employeeName: '',
      employeeEmail: '',
      totalHours: e.totalHours.toFixed(2),
      totalCost: e.totalCost.toFixed(4),
      regularHours: e.regularHours.toFixed(2),
      overtimeHours: e.overtimeHours.toFixed(2),
      billableHours: e.billableHours.toFixed(2),
      nonBillableHours: e.nonBillableHours.toFixed(2),
      entryCount: e.entryCount,
    }));
  }

  /**
   * Get time entry summary by project
   */
  async getSummaryByProject(
    startDate: string,
    endDate: string,
    status?: TimeEntryStatus
  ): Promise<TimeEntrySummaryByProject[]> {
    const organizationId = this.requireOrganizationContext();

    const result = await this.repository.findAll(
      organizationId,
      {
        startDate,
        endDate,
        status: status ? status : undefined,
      },
      1,
      10000,
      'entryDate',
      'asc'
    );

    // Group by project
    const byProject = new Map<
      string,
      {
        projectId: string;
        totalHours: number;
        totalCost: number;
        totalBillingAmount: number;
        billableHours: number;
        nonBillableHours: number;
        entryCount: number;
      }
    >();

    for (const entry of result.entries) {
      if (!entry.projectId) continue;

      const existing = byProject.get(entry.projectId) || {
        projectId: entry.projectId,
        totalHours: 0,
        totalCost: 0,
        totalBillingAmount: 0,
        billableHours: 0,
        nonBillableHours: 0,
        entryCount: 0,
      };

      const hours = parseFloat(entry.hours || '0');
      const billingRate = parseFloat(entry.billingRate || '0');
      existing.totalHours += hours;
      existing.totalCost += parseFloat(entry.totalCost || '0');
      existing.totalBillingAmount += hours * billingRate;
      existing.entryCount += 1;

      if (entry.isBillable) {
        existing.billableHours += hours;
      } else {
        existing.nonBillableHours += hours;
      }

      byProject.set(entry.projectId, existing);
    }

    return Array.from(byProject.values()).map((p) => ({
      projectId: p.projectId,
      projectName: '',
      projectCode: '',
      totalHours: p.totalHours.toFixed(2),
      totalCost: p.totalCost.toFixed(4),
      totalBillingAmount: p.totalBillingAmount.toFixed(4),
      billableHours: p.billableHours.toFixed(2),
      nonBillableHours: p.nonBillableHours.toFixed(2),
      entryCount: p.entryCount,
    }));
  }

  // ============================================================================
  // GL Posting
  // ============================================================================

  /**
   * Post approved time entries to GL
   *
   * This method:
   * 1. Creates a posting batch to group entries
   * 2. Validates all entries are APPROVED
   * 3. Calculates totals for the batch
   * 4. Updates actual hours on project assignments
   * 5. Marks entries as posted with batch reference
   *
   * Note: Full GL transaction creation requires integration with GlPostingEngine
   * and proper account mapping configuration. Currently creates a batch record
   * with entry totals that can be used for manual or future automated posting.
   */
  async postToGL(timeEntryIds: string[]): Promise<TimeEntryPostingResult> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const result: TimeEntryPostingResult = {
      success: true,
      postedCount: 0,
      failedCount: 0,
      errors: [],
    };

    if (timeEntryIds.length === 0) {
      result.errors.push({ timeEntryId: '', error: 'No time entries provided' });
      result.success = false;
      return result;
    }

    // Validate all entries first
    const entriesToPost: Array<{
      id: string;
      hours: number;
      totalCost: number;
      projectId: string | null;
      employeeId: string;
      entryDate: string;
    }> = [];

    for (const entryId of timeEntryIds) {
      const entry = await this.repository.findById(entryId, organizationId);
      if (!entry) {
        result.errors.push({ timeEntryId: entryId, error: 'Time entry not found' });
        result.failedCount++;
        continue;
      }

      if (entry.status !== 'APPROVED') {
        result.errors.push({
          timeEntryId: entryId,
          error: `Cannot post time entry with status "${entry.status}". Only APPROVED entries can be posted.`,
        });
        result.failedCount++;
        continue;
      }

      entriesToPost.push({
        id: entry.id,
        hours: parseFloat(entry.hours || '0'),
        totalCost: parseFloat(entry.totalCost || '0'),
        projectId: entry.projectId,
        employeeId: entry.employeeId,
        entryDate: entry.entryDate,
      });
    }

    // If all entries failed validation, return early
    if (entriesToPost.length === 0) {
      result.success = false;
      return result;
    }

    // Calculate batch totals and date range
    const totalHours = entriesToPost.reduce((sum, e) => sum + e.hours, 0);
    const totalCost = entriesToPost.reduce((sum, e) => sum + e.totalCost, 0);
    const entryDates = entriesToPost.map((e) => e.entryDate).sort();
    const periodStart = entryDates[0];
    const periodEnd = entryDates[entryDates.length - 1];

    try {
      // Create a posting batch
      const batchNumber = await this.repository.generateBatchNumber(organizationId);
      const batch = await this.repository.createPostingBatch({
        organizationId,
        batchNumber,
        description: `Labor cost posting for ${entriesToPost.length} time entries`,
        periodStart,
        periodEnd,
        totalEntries: entriesToPost.length,
        totalHours: totalHours.toFixed(2),
        totalCost: totalCost.toFixed(4),
        status: 'POSTED',
        submittedBy: userId,
        submittedAt: new Date(),
        approvedBy: userId,
        approvedAt: new Date(),
        postedAt: new Date(),
        createdBy: userId,
      });

      // Group entries by project for assignment updates
      const entriesByProject = new Map<string, { employeeId: string; hours: number }[]>();
      for (const entry of entriesToPost) {
        if (entry.projectId) {
          const projectEntries = entriesByProject.get(entry.projectId) || [];
          projectEntries.push({ employeeId: entry.employeeId, hours: entry.hours });
          entriesByProject.set(entry.projectId, projectEntries);
        }
      }

      // Post each entry and update project assignment hours
      for (const entry of entriesToPost) {
        try {
          // Mark as posted with batch reference
          await this.repository.markAsPosted(entry.id, organizationId, batch.id, batch.id);

          // Update actual hours on project assignment if applicable
          if (entry.projectId) {
            await this.repository.updateAssignmentHours(
              entry.employeeId,
              entry.projectId,
              organizationId,
              entry.hours
            );
          }

          result.postedCount++;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to post time entry';
          result.errors.push({
            timeEntryId: entry.id,
            error: errorMessage,
          });
          result.failedCount++;
        }
      }

      // Add batch info to result
      (result as TimeEntryPostingResult & { batchId?: string; batchNumber?: string }).batchId =
        batch.id;
      (result as TimeEntryPostingResult & { batchId?: string; batchNumber?: string }).batchNumber =
        batch.batchNumber;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create posting batch';
      result.errors.push({
        timeEntryId: '',
        error: errorMessage,
      });
      result.success = false;
      return result;
    }

    result.success = result.failedCount === 0;
    return result;
  }

  // ============================================================================
  // Posting Batches
  // ============================================================================

  /**
   * List posting batches
   */
  async listPostingBatches(
    params: PaginationParams = {},
    filters: { status?: TimeEntryStatus } = {}
  ): Promise<PaginatedResult<any>> {
    const organizationId = this.requireOrganizationContext();
    const page = params.page || 1;
    const limit = params.limit || 20;

    const result = await this.repository.listPostingBatches(organizationId, filters, page, limit);

    return {
      data: result.batches,
      total: result.totalCount,
      page,
      limit,
      totalPages: Math.ceil(result.totalCount / limit),
    };
  }

  /**
   * Get posting batch by ID
   */
  async getPostingBatch(batchId: string): Promise<any | null> {
    const organizationId = this.requireOrganizationContext();
    return this.repository.getPostingBatch(batchId, organizationId);
  }
}
