/**
 * Time Entry Repository
 *
 * Repository for managing time entries with support for:
 * - CRUD operations with RLS
 * - Status transitions and approval workflow
 * - Filtering by employee, project, date range
 * - Labor rate lookups
 *
 * @module time-entry-repository
 * @author OliveWolf
 * @task glapi-zo0
 */

import { and, eq, sql, desc, asc, gte, lte, inArray, isNull, or } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  timeEntries,
  laborCostRates,
  employeeProjectAssignments,
  timeEntryApprovals,
  timeEntryBatches,
  type TimeEntry,
  type NewTimeEntry,
  type UpdateTimeEntry,
  type LaborCostRate,
  type NewLaborCostRate,
  type EmployeeProjectAssignment,
  type NewEmployeeProjectAssignment,
  type TimeEntryApproval,
  type NewTimeEntryApproval,
  type TimeEntryBatch,
  type NewTimeEntryBatch,
  type TimeEntryStatus,
  type ApprovalAction,
} from '../db/schema/time-entries';
import { projects } from '../db/schema/projects';
import { users } from '../db/schema/users';

// ============================================================================
// Types
// ============================================================================

export interface TimeEntryFilters {
  employeeId?: string;
  projectId?: string;
  costCodeId?: string;
  status?: TimeEntryStatus | TimeEntryStatus[];
  startDate?: string;
  endDate?: string;
  isBillable?: boolean;
  batchId?: string;
}

export interface TimeEntryWithRelations extends TimeEntry {
  employee?: { id: string; email: string; firstName?: string | null; lastName?: string | null };
  project?: { id: string; name: string; projectCode: string };
  approver?: { id: string; email: string; firstName?: string | null; lastName?: string | null };
}

export interface LaborRateFilters {
  employeeId?: string;
  projectId?: string;
  costCodeId?: string;
  laborRole?: string;
  effectiveDate?: string;
  isActive?: boolean;
}

// ============================================================================
// Time Entry Repository
// ============================================================================

export class TimeEntryRepository extends BaseRepository {
  // --------------------------------------------------------------------------
  // Time Entry CRUD
  // --------------------------------------------------------------------------

  /**
   * Find all time entries with filters and pagination
   */
  async findAll(
    organizationId: string,
    filters: TimeEntryFilters = {},
    page = 1,
    limit = 50,
    sortField = 'entryDate',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<{ entries: TimeEntry[]; totalCount: number }> {
    const offset = (page - 1) * limit;
    const conditions = [eq(timeEntries.organizationId, organizationId)];

    // Apply filters
    if (filters.employeeId) {
      conditions.push(eq(timeEntries.employeeId, filters.employeeId));
    }
    if (filters.projectId) {
      conditions.push(eq(timeEntries.projectId, filters.projectId));
    }
    if (filters.costCodeId) {
      conditions.push(eq(timeEntries.costCodeId, filters.costCodeId));
    }
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(timeEntries.status, filters.status));
      } else {
        conditions.push(eq(timeEntries.status, filters.status));
      }
    }
    if (filters.startDate) {
      conditions.push(gte(timeEntries.entryDate, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(timeEntries.entryDate, filters.endDate));
    }
    if (filters.isBillable !== undefined) {
      conditions.push(eq(timeEntries.isBillable, filters.isBillable));
    }
    if (filters.batchId) {
      conditions.push(eq(timeEntries.glPostingBatchId, filters.batchId));
    }

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(timeEntries)
      .where(and(...conditions));

    const totalCount = Number(countResult[0]?.count || 0);

    // Determine sort column
    const sortColumn = this.getSortColumn(sortField);

    // Get results with pagination
    const entries = await this.db
      .select()
      .from(timeEntries)
      .where(and(...conditions))
      .orderBy(sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn))
      .limit(limit)
      .offset(offset);

    return { entries, totalCount };
  }

  /**
   * Find time entry by ID with RLS check
   */
  async findById(id: string, organizationId: string): Promise<TimeEntry | null> {
    const [result] = await this.db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.id, id), eq(timeEntries.organizationId, organizationId)))
      .limit(1);

    return result || null;
  }

  /**
   * Find time entry by ID with related data
   */
  async findByIdWithRelations(
    id: string,
    organizationId: string
  ): Promise<TimeEntryWithRelations | null> {
    const result = await this.db
      .select({
        entry: timeEntries,
        employee: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
        project: {
          id: projects.id,
          name: projects.name,
          projectCode: projects.projectCode,
        },
      })
      .from(timeEntries)
      .leftJoin(users, eq(timeEntries.employeeId, users.id))
      .leftJoin(projects, eq(timeEntries.projectId, projects.id))
      .where(and(eq(timeEntries.id, id), eq(timeEntries.organizationId, organizationId)))
      .limit(1);

    if (!result[0]) return null;

    return {
      ...result[0].entry,
      employee: result[0].employee || undefined,
      project: result[0].project || undefined,
    };
  }

  /**
   * Find time entries by employee for a date range
   */
  async findByEmployeeAndDateRange(
    employeeId: string,
    organizationId: string,
    startDate: string,
    endDate: string
  ): Promise<TimeEntry[]> {
    return await this.db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.employeeId, employeeId),
          eq(timeEntries.organizationId, organizationId),
          gte(timeEntries.entryDate, startDate),
          lte(timeEntries.entryDate, endDate)
        )
      )
      .orderBy(asc(timeEntries.entryDate));
  }

  /**
   * Find pending approval entries for a project or manager
   */
  async findPendingApproval(
    organizationId: string,
    options: { projectId?: string; approverId?: string } = {}
  ): Promise<TimeEntry[]> {
    const conditions = [
      eq(timeEntries.organizationId, organizationId),
      eq(timeEntries.status, 'SUBMITTED'),
    ];

    if (options.projectId) {
      conditions.push(eq(timeEntries.projectId, options.projectId));
    }

    return await this.db
      .select()
      .from(timeEntries)
      .where(and(...conditions))
      .orderBy(asc(timeEntries.submittedAt));
  }

  /**
   * Create a new time entry
   */
  async create(data: NewTimeEntry): Promise<TimeEntry> {
    const [result] = await this.db.insert(timeEntries).values(data).returning();
    return result;
  }

  /**
   * Create multiple time entries
   */
  async createMany(entries: NewTimeEntry[]): Promise<TimeEntry[]> {
    if (entries.length === 0) return [];
    return await this.db.insert(timeEntries).values(entries).returning();
  }

  /**
   * Update a time entry
   */
  async update(
    id: string,
    data: UpdateTimeEntry,
    organizationId: string
  ): Promise<TimeEntry | null> {
    const existing = await this.findById(id, organizationId);
    if (!existing) return null;

    const [result] = await this.db
      .update(timeEntries)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(timeEntries.id, id), eq(timeEntries.organizationId, organizationId)))
      .returning();

    return result;
  }

  /**
   * Delete a time entry (only if in DRAFT status)
   */
  async delete(id: string, organizationId: string): Promise<boolean> {
    const existing = await this.findById(id, organizationId);
    if (!existing || existing.status !== 'DRAFT') {
      return false;
    }

    await this.db
      .delete(timeEntries)
      .where(and(eq(timeEntries.id, id), eq(timeEntries.organizationId, organizationId)));

    return true;
  }

  // --------------------------------------------------------------------------
  // Status Transitions
  // --------------------------------------------------------------------------

  /**
   * Submit time entry for approval
   */
  async submit(
    id: string,
    organizationId: string,
    userId: string
  ): Promise<TimeEntry | null> {
    const existing = await this.findById(id, organizationId);
    if (!existing || existing.status !== 'DRAFT') {
      return null;
    }

    const [result] = await this.db
      .update(timeEntries)
      .set({
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submittedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(timeEntries.id, id), eq(timeEntries.organizationId, organizationId)))
      .returning();

    // Record approval history
    await this.recordApprovalAction(id, 'SUBMITTED', 'DRAFT', 'SUBMITTED', userId);

    return result;
  }

  /**
   * Approve time entry
   */
  async approve(
    id: string,
    organizationId: string,
    approverId: string,
    comments?: string
  ): Promise<TimeEntry | null> {
    const existing = await this.findById(id, organizationId);
    if (!existing || existing.status !== 'SUBMITTED') {
      return null;
    }

    const [result] = await this.db
      .update(timeEntries)
      .set({
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: approverId,
        updatedAt: new Date(),
      })
      .where(and(eq(timeEntries.id, id), eq(timeEntries.organizationId, organizationId)))
      .returning();

    // Record approval history
    await this.recordApprovalAction(id, 'APPROVED', 'SUBMITTED', 'APPROVED', approverId, comments);

    return result;
  }

  /**
   * Reject time entry
   */
  async reject(
    id: string,
    organizationId: string,
    rejectorId: string,
    reason: string
  ): Promise<TimeEntry | null> {
    const existing = await this.findById(id, organizationId);
    if (!existing || existing.status !== 'SUBMITTED') {
      return null;
    }

    const [result] = await this.db
      .update(timeEntries)
      .set({
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedBy: rejectorId,
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(and(eq(timeEntries.id, id), eq(timeEntries.organizationId, organizationId)))
      .returning();

    // Record approval history
    await this.recordApprovalAction(id, 'REJECTED', 'SUBMITTED', 'REJECTED', rejectorId, reason);

    return result;
  }

  /**
   * Return rejected entry to draft for revision
   */
  async returnToDraft(
    id: string,
    organizationId: string,
    userId: string
  ): Promise<TimeEntry | null> {
    const existing = await this.findById(id, organizationId);
    if (!existing || existing.status !== 'REJECTED') {
      return null;
    }

    const [result] = await this.db
      .update(timeEntries)
      .set({
        status: 'DRAFT',
        rejectedAt: null,
        rejectedBy: null,
        rejectionReason: null,
        submittedAt: null,
        submittedBy: null,
        updatedAt: new Date(),
      })
      .where(and(eq(timeEntries.id, id), eq(timeEntries.organizationId, organizationId)))
      .returning();

    // Record approval history
    await this.recordApprovalAction(id, 'REOPENED', 'REJECTED', 'DRAFT', userId);

    return result;
  }

  /**
   * Mark time entry as posted to GL
   */
  async markAsPosted(
    id: string,
    organizationId: string,
    glTransactionId: string,
    glPostingBatchId?: string
  ): Promise<TimeEntry | null> {
    const existing = await this.findById(id, organizationId);
    if (!existing || existing.status !== 'APPROVED') {
      return null;
    }

    const [result] = await this.db
      .update(timeEntries)
      .set({
        status: 'POSTED',
        postedAt: new Date(),
        glTransactionId,
        glPostingBatchId,
        updatedAt: new Date(),
      })
      .where(and(eq(timeEntries.id, id), eq(timeEntries.organizationId, organizationId)))
      .returning();

    return result;
  }

  /**
   * Record an approval action in the audit trail
   */
  private async recordApprovalAction(
    timeEntryId: string,
    action: ApprovalAction,
    previousStatus: TimeEntryStatus | null,
    newStatus: TimeEntryStatus,
    performedBy: string,
    comments?: string
  ): Promise<void> {
    await this.db.insert(timeEntryApprovals).values({
      timeEntryId,
      action,
      previousStatus,
      newStatus,
      performedBy,
      comments,
    });
  }

  // --------------------------------------------------------------------------
  // Labor Cost Rates
  // --------------------------------------------------------------------------

  /**
   * Find applicable labor rate for an employee/project/date
   * Uses priority to select most specific rate
   */
  async findApplicableLaborRate(
    organizationId: string,
    employeeId: string,
    entryDate: string,
    projectId?: string,
    costCodeId?: string
  ): Promise<LaborCostRate | null> {
    const conditions = [
      eq(laborCostRates.organizationId, organizationId),
      eq(laborCostRates.isActive, true),
      lte(laborCostRates.effectiveFrom, entryDate),
      or(isNull(laborCostRates.effectiveTo), gte(laborCostRates.effectiveTo, entryDate)),
    ];

    // Build conditions for employee-specific or general rates
    const employeeConditions = [
      ...conditions,
      or(eq(laborCostRates.employeeId, employeeId), isNull(laborCostRates.employeeId)),
    ];

    if (projectId) {
      employeeConditions.push(
        or(eq(laborCostRates.projectId, projectId), isNull(laborCostRates.projectId))
      );
    }
    if (costCodeId) {
      employeeConditions.push(
        or(eq(laborCostRates.costCodeId, costCodeId), isNull(laborCostRates.costCodeId))
      );
    }

    const [result] = await this.db
      .select()
      .from(laborCostRates)
      .where(and(...employeeConditions))
      .orderBy(desc(laborCostRates.priority), desc(laborCostRates.effectiveFrom))
      .limit(1);

    return result || null;
  }

  /**
   * Find all labor rates with filters
   */
  async findLaborRates(
    organizationId: string,
    filters: LaborRateFilters = {}
  ): Promise<LaborCostRate[]> {
    const conditions = [eq(laborCostRates.organizationId, organizationId)];

    if (filters.employeeId) {
      conditions.push(eq(laborCostRates.employeeId, filters.employeeId));
    }
    if (filters.projectId) {
      conditions.push(eq(laborCostRates.projectId, filters.projectId));
    }
    if (filters.costCodeId) {
      conditions.push(eq(laborCostRates.costCodeId, filters.costCodeId));
    }
    if (filters.laborRole) {
      conditions.push(eq(laborCostRates.laborRole, filters.laborRole));
    }
    if (filters.effectiveDate) {
      conditions.push(lte(laborCostRates.effectiveFrom, filters.effectiveDate));
      const effectiveToCondition = or(isNull(laborCostRates.effectiveTo), gte(laborCostRates.effectiveTo, filters.effectiveDate));
      if (effectiveToCondition) {
        conditions.push(effectiveToCondition);
      }
    }
    if (filters.isActive !== undefined) {
      conditions.push(eq(laborCostRates.isActive, filters.isActive));
    }

    return await this.db
      .select()
      .from(laborCostRates)
      .where(and(...conditions))
      .orderBy(desc(laborCostRates.priority), desc(laborCostRates.effectiveFrom));
  }

  /**
   * Create a labor cost rate
   */
  async createLaborRate(data: NewLaborCostRate): Promise<LaborCostRate> {
    const [result] = await this.db.insert(laborCostRates).values(data).returning();
    return result;
  }

  /**
   * Update a labor cost rate
   */
  async updateLaborRate(
    id: string,
    data: Partial<NewLaborCostRate>,
    organizationId: string
  ): Promise<LaborCostRate | null> {
    const [existing] = await this.db
      .select()
      .from(laborCostRates)
      .where(and(eq(laborCostRates.id, id), eq(laborCostRates.organizationId, organizationId)))
      .limit(1);

    if (!existing) return null;

    const [result] = await this.db
      .update(laborCostRates)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(laborCostRates.id, id), eq(laborCostRates.organizationId, organizationId)))
      .returning();

    return result;
  }

  // --------------------------------------------------------------------------
  // Employee Project Assignments
  // --------------------------------------------------------------------------

  /**
   * Find employee's project assignments
   */
  async findEmployeeAssignments(
    employeeId: string,
    organizationId: string,
    activeOnly = true
  ): Promise<EmployeeProjectAssignment[]> {
    const conditions = [
      eq(employeeProjectAssignments.employeeId, employeeId),
      eq(employeeProjectAssignments.organizationId, organizationId),
    ];

    if (activeOnly) {
      conditions.push(eq(employeeProjectAssignments.isActive, true));
    }

    return await this.db
      .select()
      .from(employeeProjectAssignments)
      .where(and(...conditions));
  }

  /**
   * Check if employee is assigned to a project
   */
  async isEmployeeAssignedToProject(
    employeeId: string,
    projectId: string,
    organizationId: string
  ): Promise<boolean> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(employeeProjectAssignments)
      .where(
        and(
          eq(employeeProjectAssignments.employeeId, employeeId),
          eq(employeeProjectAssignments.projectId, projectId),
          eq(employeeProjectAssignments.organizationId, organizationId),
          eq(employeeProjectAssignments.isActive, true)
        )
      );

    return Number(result?.count || 0) > 0;
  }

  /**
   * Create employee project assignment
   */
  async createAssignment(data: NewEmployeeProjectAssignment): Promise<EmployeeProjectAssignment> {
    const [result] = await this.db.insert(employeeProjectAssignments).values(data).returning();
    return result;
  }

  /**
   * Update employee's actual hours on assignment
   */
  async updateAssignmentHours(
    employeeId: string,
    projectId: string,
    organizationId: string,
    hoursToAdd: number
  ): Promise<void> {
    await this.db
      .update(employeeProjectAssignments)
      .set({
        actualHours: sql`${employeeProjectAssignments.actualHours} + ${hoursToAdd}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(employeeProjectAssignments.employeeId, employeeId),
          eq(employeeProjectAssignments.projectId, projectId),
          eq(employeeProjectAssignments.organizationId, organizationId)
        )
      );
  }

  // --------------------------------------------------------------------------
  // Approval History
  // --------------------------------------------------------------------------

  /**
   * Get approval history for a time entry
   */
  async getApprovalHistory(timeEntryId: string): Promise<TimeEntryApproval[]> {
    return await this.db
      .select()
      .from(timeEntryApprovals)
      .where(eq(timeEntryApprovals.timeEntryId, timeEntryId))
      .orderBy(desc(timeEntryApprovals.performedAt));
  }

  // --------------------------------------------------------------------------
  // Aggregations
  // --------------------------------------------------------------------------

  /**
   * Get total hours for an employee in a date range
   */
  async getTotalHours(
    employeeId: string,
    organizationId: string,
    startDate: string,
    endDate: string,
    status?: TimeEntryStatus[]
  ): Promise<number> {
    const conditions = [
      eq(timeEntries.employeeId, employeeId),
      eq(timeEntries.organizationId, organizationId),
      gte(timeEntries.entryDate, startDate),
      lte(timeEntries.entryDate, endDate),
    ];

    if (status && status.length > 0) {
      conditions.push(inArray(timeEntries.status, status));
    }

    const [result] = await this.db
      .select({ total: sql<string>`COALESCE(SUM(${timeEntries.hours}), 0)` })
      .from(timeEntries)
      .where(and(...conditions));

    return parseFloat(result?.total || '0');
  }

  /**
   * Get total cost for a project
   */
  async getProjectTotalCost(
    projectId: string,
    organizationId: string,
    status?: TimeEntryStatus[]
  ): Promise<{ totalHours: number; totalCost: number }> {
    const conditions = [
      eq(timeEntries.projectId, projectId),
      eq(timeEntries.organizationId, organizationId),
    ];

    if (status && status.length > 0) {
      conditions.push(inArray(timeEntries.status, status));
    }

    const [result] = await this.db
      .select({
        totalHours: sql<string>`COALESCE(SUM(${timeEntries.hours}), 0)`,
        totalCost: sql<string>`COALESCE(SUM(${timeEntries.totalCost}), 0)`,
      })
      .from(timeEntries)
      .where(and(...conditions));

    return {
      totalHours: parseFloat(result?.totalHours || '0'),
      totalCost: parseFloat(result?.totalCost || '0'),
    };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private getSortColumn(sortField: string) {
    switch (sortField) {
      case 'entryDate':
        return timeEntries.entryDate;
      case 'hours':
        return timeEntries.hours;
      case 'status':
        return timeEntries.status;
      case 'submittedAt':
        return timeEntries.submittedAt;
      case 'approvedAt':
        return timeEntries.approvedAt;
      case 'createdAt':
        return timeEntries.createdAt;
      default:
        return timeEntries.entryDate;
    }
  }

  // --------------------------------------------------------------------------
  // Posting Batches
  // --------------------------------------------------------------------------

  /**
   * Create a posting batch for time entries
   */
  async createPostingBatch(data: NewTimeEntryBatch): Promise<TimeEntryBatch> {
    const [result] = await this.db.insert(timeEntryBatches).values(data).returning();
    return result;
  }

  /**
   * Update a posting batch
   */
  async updatePostingBatch(
    id: string,
    organizationId: string,
    data: Partial<TimeEntryBatch>
  ): Promise<TimeEntryBatch | null> {
    const [result] = await this.db
      .update(timeEntryBatches)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(timeEntryBatches.id, id), eq(timeEntryBatches.organizationId, organizationId)))
      .returning();
    return result || null;
  }

  /**
   * Generate a unique batch number
   */
  async generateBatchNumber(organizationId: string): Promise<string> {
    const now = new Date();
    const datePrefix = `LBR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get the count of batches this month
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(timeEntryBatches)
      .where(
        and(
          eq(timeEntryBatches.organizationId, organizationId),
          sql`${timeEntryBatches.batchNumber} LIKE ${datePrefix + '%'}`
        )
      );

    const nextNumber = (Number(countResult?.count || 0) + 1).toString().padStart(4, '0');
    return `${datePrefix}-${nextNumber}`;
  }

  /**
   * Get posting batch by ID
   */
  async getPostingBatch(id: string, organizationId: string): Promise<TimeEntryBatch | null> {
    const [result] = await this.db
      .select()
      .from(timeEntryBatches)
      .where(and(eq(timeEntryBatches.id, id), eq(timeEntryBatches.organizationId, organizationId)))
      .limit(1);
    return result || null;
  }

  /**
   * List posting batches
   */
  async listPostingBatches(
    organizationId: string,
    filters: { status?: TimeEntryStatus } = {},
    page = 1,
    limit = 20
  ): Promise<{ batches: TimeEntryBatch[]; totalCount: number }> {
    const offset = (page - 1) * limit;
    const conditions = [eq(timeEntryBatches.organizationId, organizationId)];

    if (filters.status) {
      conditions.push(eq(timeEntryBatches.status, filters.status));
    }

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(timeEntryBatches)
      .where(and(...conditions));

    const batches = await this.db
      .select()
      .from(timeEntryBatches)
      .where(and(...conditions))
      .orderBy(desc(timeEntryBatches.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      batches,
      totalCount: Number(countResult?.count || 0),
    };
  }
}
