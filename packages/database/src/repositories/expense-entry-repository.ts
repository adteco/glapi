/**
 * Expense Entry Repository
 *
 * Repository for managing expense entries with support for:
 * - CRUD operations with RLS
 * - Status transitions and approval workflow
 * - Attachment management
 * - Expense reports/batches
 *
 * @module expense-entry-repository
 * @task glapi-0ib.2
 */

import { and, eq, sql, desc, asc, gte, lte, inArray, or, isNull } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  expenseEntries,
  expenseAttachments,
  expenseEntryApprovals,
  expenseReports,
  expenseReportItems,
  expensePolicies,
  type ExpenseEntry,
  type NewExpenseEntry,
  type UpdateExpenseEntry,
  type ExpenseAttachment,
  type NewExpenseAttachment,
  type ExpenseEntryApproval,
  type NewExpenseEntryApproval,
  type ExpenseReport,
  type NewExpenseReport,
  type UpdateExpenseReport,
  type ExpenseReportItem,
  type NewExpenseReportItem,
  type ExpensePolicy,
  type ExpenseEntryStatus,
  type ExpenseCategory,
} from '../db/schema/expense-entries';
import { approvalActionEnum, type ApprovalAction } from '../db/schema/time-entries';
import { projects } from '../db/schema/projects';
import { users } from '../db/schema/users';

// ============================================================================
// Types
// ============================================================================

export interface ExpenseEntryFilters {
  employeeId?: string;
  projectId?: string;
  costCodeId?: string;
  status?: ExpenseEntryStatus | ExpenseEntryStatus[];
  category?: ExpenseCategory | ExpenseCategory[];
  startDate?: string;
  endDate?: string;
  isBillable?: boolean;
  requiresReimbursement?: boolean;
  reportId?: string;
}

export interface ExpenseEntryWithRelations extends ExpenseEntry {
  employee?: { id: string; email: string; firstName?: string | null; lastName?: string | null };
  project?: { id: string; name: string; projectCode: string };
  approver?: { id: string; email: string; firstName?: string | null; lastName?: string | null };
  attachments?: ExpenseAttachment[];
}

export interface ExpenseSummary {
  totalAmount: number;
  totalReimbursable: number;
  totalBillable: number;
  entryCount: number;
  byCategory: Record<ExpenseCategory, number>;
}

// ============================================================================
// Expense Entry Repository
// ============================================================================

export class ExpenseEntryRepository extends BaseRepository {
  // --------------------------------------------------------------------------
  // Expense Entry CRUD
  // --------------------------------------------------------------------------

  /**
   * Find all expense entries with filters and pagination
   */
  async findAll(
    organizationId: string,
    filters: ExpenseEntryFilters = {},
    page = 1,
    limit = 50,
    sortField = 'expenseDate',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<{ entries: ExpenseEntry[]; totalCount: number }> {
    const offset = (page - 1) * limit;
    const conditions = [eq(expenseEntries.organizationId, organizationId)];

    // Apply filters
    if (filters.employeeId) {
      conditions.push(eq(expenseEntries.employeeId, filters.employeeId));
    }
    if (filters.projectId) {
      conditions.push(eq(expenseEntries.projectId, filters.projectId));
    }
    if (filters.costCodeId) {
      conditions.push(eq(expenseEntries.costCodeId, filters.costCodeId));
    }
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(expenseEntries.status, filters.status));
      } else {
        conditions.push(eq(expenseEntries.status, filters.status));
      }
    }
    if (filters.category) {
      if (Array.isArray(filters.category)) {
        conditions.push(inArray(expenseEntries.category, filters.category));
      } else {
        conditions.push(eq(expenseEntries.category, filters.category));
      }
    }
    if (filters.startDate) {
      conditions.push(gte(expenseEntries.expenseDate, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(expenseEntries.expenseDate, filters.endDate));
    }
    if (filters.isBillable !== undefined) {
      conditions.push(eq(expenseEntries.isBillable, filters.isBillable));
    }
    if (filters.requiresReimbursement !== undefined) {
      conditions.push(eq(expenseEntries.requiresReimbursement, filters.requiresReimbursement));
    }

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(expenseEntries)
      .where(and(...conditions));

    const totalCount = Number(countResult[0]?.count || 0);

    // Determine sort column
    const sortColumn = this.getSortColumn(sortField);

    // Get results with pagination
    const entries = await this.db
      .select()
      .from(expenseEntries)
      .where(and(...conditions))
      .orderBy(sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn))
      .limit(limit)
      .offset(offset);

    return { entries, totalCount };
  }

  /**
   * Find expense entry by ID with RLS check
   */
  async findById(id: string, organizationId: string): Promise<ExpenseEntry | null> {
    const [result] = await this.db
      .select()
      .from(expenseEntries)
      .where(and(eq(expenseEntries.id, id), eq(expenseEntries.organizationId, organizationId)))
      .limit(1);

    return result || null;
  }

  /**
   * Find expense entry by ID with related data
   */
  async findByIdWithRelations(
    id: string,
    organizationId: string
  ): Promise<ExpenseEntryWithRelations | null> {
    const result = await this.db
      .select({
        entry: expenseEntries,
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
      .from(expenseEntries)
      .leftJoin(users, eq(expenseEntries.employeeId, users.id))
      .leftJoin(projects, eq(expenseEntries.projectId, projects.id))
      .where(and(eq(expenseEntries.id, id), eq(expenseEntries.organizationId, organizationId)))
      .limit(1);

    if (!result[0]) return null;

    // Get attachments
    const attachments = await this.getAttachments(id);

    return {
      ...result[0].entry,
      employee: result[0].employee || undefined,
      project: result[0].project || undefined,
      attachments,
    };
  }

  /**
   * Find pending approval entries
   */
  async findPendingApproval(
    organizationId: string,
    options: { projectId?: string; approverId?: string } = {}
  ): Promise<ExpenseEntry[]> {
    const conditions = [
      eq(expenseEntries.organizationId, organizationId),
      eq(expenseEntries.status, 'SUBMITTED'),
    ];

    if (options.projectId) {
      conditions.push(eq(expenseEntries.projectId, options.projectId));
    }

    return await this.db
      .select()
      .from(expenseEntries)
      .where(and(...conditions))
      .orderBy(asc(expenseEntries.submittedAt));
  }

  /**
   * Create a new expense entry
   */
  async create(data: NewExpenseEntry): Promise<ExpenseEntry> {
    const [result] = await this.db.insert(expenseEntries).values(data).returning();
    return result;
  }

  /**
   * Create multiple expense entries
   */
  async createMany(entries: NewExpenseEntry[]): Promise<ExpenseEntry[]> {
    if (entries.length === 0) return [];
    return await this.db.insert(expenseEntries).values(entries).returning();
  }

  /**
   * Update an expense entry
   */
  async update(
    id: string,
    data: UpdateExpenseEntry,
    organizationId: string
  ): Promise<ExpenseEntry | null> {
    const existing = await this.findById(id, organizationId);
    if (!existing) return null;

    const [result] = await this.db
      .update(expenseEntries)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(expenseEntries.id, id), eq(expenseEntries.organizationId, organizationId)))
      .returning();

    return result;
  }

  /**
   * Delete an expense entry (only if in DRAFT status)
   */
  async delete(id: string, organizationId: string): Promise<boolean> {
    const existing = await this.findById(id, organizationId);
    if (!existing || existing.status !== 'DRAFT') {
      return false;
    }

    // Delete attachments first
    await this.db
      .delete(expenseAttachments)
      .where(eq(expenseAttachments.expenseEntryId, id));

    await this.db
      .delete(expenseEntries)
      .where(and(eq(expenseEntries.id, id), eq(expenseEntries.organizationId, organizationId)));

    return true;
  }

  // --------------------------------------------------------------------------
  // Status Transitions
  // --------------------------------------------------------------------------

  /**
   * Submit expense entry for approval
   */
  async submit(
    id: string,
    organizationId: string,
    userId: string
  ): Promise<ExpenseEntry | null> {
    const existing = await this.findById(id, organizationId);
    if (!existing || existing.status !== 'DRAFT') {
      return null;
    }

    const [result] = await this.db
      .update(expenseEntries)
      .set({
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submittedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(expenseEntries.id, id), eq(expenseEntries.organizationId, organizationId)))
      .returning();

    // Record approval history
    await this.recordApprovalAction(id, 'SUBMITTED', 'DRAFT', 'SUBMITTED', userId);

    return result;
  }

  /**
   * Approve expense entry
   */
  async approve(
    id: string,
    organizationId: string,
    approverId: string,
    comments?: string
  ): Promise<ExpenseEntry | null> {
    const existing = await this.findById(id, organizationId);
    if (!existing || existing.status !== 'SUBMITTED') {
      return null;
    }

    const [result] = await this.db
      .update(expenseEntries)
      .set({
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: approverId,
        updatedAt: new Date(),
      })
      .where(and(eq(expenseEntries.id, id), eq(expenseEntries.organizationId, organizationId)))
      .returning();

    // Record approval history
    await this.recordApprovalAction(id, 'APPROVED', 'SUBMITTED', 'APPROVED', approverId, comments);

    return result;
  }

  /**
   * Reject expense entry
   */
  async reject(
    id: string,
    organizationId: string,
    rejectorId: string,
    reason: string
  ): Promise<ExpenseEntry | null> {
    const existing = await this.findById(id, organizationId);
    if (!existing || existing.status !== 'SUBMITTED') {
      return null;
    }

    const [result] = await this.db
      .update(expenseEntries)
      .set({
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedBy: rejectorId,
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(and(eq(expenseEntries.id, id), eq(expenseEntries.organizationId, organizationId)))
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
  ): Promise<ExpenseEntry | null> {
    const existing = await this.findById(id, organizationId);
    if (!existing || existing.status !== 'REJECTED') {
      return null;
    }

    const [result] = await this.db
      .update(expenseEntries)
      .set({
        status: 'DRAFT',
        rejectedAt: null,
        rejectedBy: null,
        rejectionReason: null,
        submittedAt: null,
        submittedBy: null,
        updatedAt: new Date(),
      })
      .where(and(eq(expenseEntries.id, id), eq(expenseEntries.organizationId, organizationId)))
      .returning();

    // Record approval history
    await this.recordApprovalAction(id, 'REOPENED', 'REJECTED', 'DRAFT', userId);

    return result;
  }

  /**
   * Mark expense as reimbursed
   */
  async markAsReimbursed(
    id: string,
    organizationId: string
  ): Promise<ExpenseEntry | null> {
    const existing = await this.findById(id, organizationId);
    if (!existing || existing.status !== 'APPROVED') {
      return null;
    }

    const [result] = await this.db
      .update(expenseEntries)
      .set({
        status: 'REIMBURSED',
        reimbursedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(expenseEntries.id, id), eq(expenseEntries.organizationId, organizationId)))
      .returning();

    return result;
  }

  /**
   * Mark expense entry as posted to GL
   */
  async markAsPosted(
    id: string,
    organizationId: string,
    glTransactionId: string,
    glPostingBatchId?: string
  ): Promise<ExpenseEntry | null> {
    const existing = await this.findById(id, organizationId);
    if (!existing || !['APPROVED', 'REIMBURSED'].includes(existing.status)) {
      return null;
    }

    const [result] = await this.db
      .update(expenseEntries)
      .set({
        status: 'POSTED',
        postedAt: new Date(),
        glTransactionId,
        glPostingBatchId,
        updatedAt: new Date(),
      })
      .where(and(eq(expenseEntries.id, id), eq(expenseEntries.organizationId, organizationId)))
      .returning();

    return result;
  }

  /**
   * Record an approval action in the audit trail
   */
  private async recordApprovalAction(
    expenseEntryId: string,
    action: ApprovalAction,
    previousStatus: ExpenseEntryStatus | null,
    newStatus: ExpenseEntryStatus,
    performedBy: string,
    comments?: string
  ): Promise<void> {
    await this.db.insert(expenseEntryApprovals).values({
      expenseEntryId,
      action,
      previousStatus,
      newStatus,
      performedBy,
      comments,
    });
  }

  // --------------------------------------------------------------------------
  // Attachments
  // --------------------------------------------------------------------------

  /**
   * Add attachment to expense entry
   */
  async addAttachment(data: NewExpenseAttachment): Promise<ExpenseAttachment> {
    const [result] = await this.db.insert(expenseAttachments).values(data).returning();
    return result;
  }

  /**
   * Get attachments for an expense entry
   */
  async getAttachments(expenseEntryId: string): Promise<ExpenseAttachment[]> {
    return await this.db
      .select()
      .from(expenseAttachments)
      .where(eq(expenseAttachments.expenseEntryId, expenseEntryId))
      .orderBy(desc(expenseAttachments.createdAt));
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(id: string, organizationId: string): Promise<boolean> {
    const [attachment] = await this.db
      .select()
      .from(expenseAttachments)
      .where(and(
        eq(expenseAttachments.id, id),
        eq(expenseAttachments.organizationId, organizationId)
      ))
      .limit(1);

    if (!attachment) return false;

    await this.db
      .delete(expenseAttachments)
      .where(eq(expenseAttachments.id, id));

    return true;
  }

  // --------------------------------------------------------------------------
  // Expense Reports
  // --------------------------------------------------------------------------

  /**
   * Create an expense report
   */
  async createReport(data: NewExpenseReport): Promise<ExpenseReport> {
    const [result] = await this.db.insert(expenseReports).values(data).returning();
    return result;
  }

  /**
   * Find expense report by ID
   */
  async findReportById(id: string, organizationId: string): Promise<ExpenseReport | null> {
    const [result] = await this.db
      .select()
      .from(expenseReports)
      .where(and(eq(expenseReports.id, id), eq(expenseReports.organizationId, organizationId)))
      .limit(1);

    return result || null;
  }

  /**
   * Update an expense report
   */
  async updateReport(
    id: string,
    data: UpdateExpenseReport,
    organizationId: string
  ): Promise<ExpenseReport | null> {
    const existing = await this.findReportById(id, organizationId);
    if (!existing) return null;

    const [result] = await this.db
      .update(expenseReports)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(expenseReports.id, id), eq(expenseReports.organizationId, organizationId)))
      .returning();

    return result;
  }

  /**
   * Add expense entry to report
   */
  async addEntryToReport(
    reportId: string,
    entryId: string,
    lineNumber: number
  ): Promise<ExpenseReportItem> {
    const [result] = await this.db
      .insert(expenseReportItems)
      .values({ expenseReportId: reportId, expenseEntryId: entryId, lineNumber })
      .returning();
    return result;
  }

  /**
   * Remove expense entry from report
   */
  async removeEntryFromReport(reportId: string, entryId: string): Promise<boolean> {
    await this.db
      .delete(expenseReportItems)
      .where(and(
        eq(expenseReportItems.expenseReportId, reportId),
        eq(expenseReportItems.expenseEntryId, entryId)
      ));
    return true;
  }

  /**
   * Get entries in a report
   */
  async getReportEntries(reportId: string): Promise<ExpenseEntry[]> {
    const items = await this.db
      .select({
        entry: expenseEntries,
      })
      .from(expenseReportItems)
      .innerJoin(expenseEntries, eq(expenseReportItems.expenseEntryId, expenseEntries.id))
      .where(eq(expenseReportItems.expenseReportId, reportId))
      .orderBy(asc(expenseReportItems.lineNumber));

    return items.map(i => i.entry);
  }

  /**
   * Generate a unique report number
   */
  async generateReportNumber(organizationId: string): Promise<string> {
    const now = new Date();
    const datePrefix = `EXP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get the count of reports this month
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(expenseReports)
      .where(
        and(
          eq(expenseReports.organizationId, organizationId),
          sql`${expenseReports.reportNumber} LIKE ${datePrefix + '%'}`
        )
      );

    const nextNumber = (Number(countResult?.count || 0) + 1).toString().padStart(4, '0');
    return `${datePrefix}-${nextNumber}`;
  }

  /**
   * List expense reports
   */
  async listReports(
    organizationId: string,
    filters: { employeeId?: string; status?: ExpenseEntryStatus } = {},
    page = 1,
    limit = 20
  ): Promise<{ reports: ExpenseReport[]; totalCount: number }> {
    const offset = (page - 1) * limit;
    const conditions = [eq(expenseReports.organizationId, organizationId)];

    if (filters.employeeId) {
      conditions.push(eq(expenseReports.employeeId, filters.employeeId));
    }
    if (filters.status) {
      conditions.push(eq(expenseReports.status, filters.status));
    }

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(expenseReports)
      .where(and(...conditions));

    const reports = await this.db
      .select()
      .from(expenseReports)
      .where(and(...conditions))
      .orderBy(desc(expenseReports.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      reports,
      totalCount: Number(countResult?.count || 0),
    };
  }

  // --------------------------------------------------------------------------
  // Expense Policies
  // --------------------------------------------------------------------------

  /**
   * Find applicable expense policy
   */
  async findApplicablePolicy(
    organizationId: string,
    category: ExpenseCategory,
    subsidiaryId?: string
  ): Promise<ExpensePolicy | null> {
    const conditions = [
      eq(expensePolicies.organizationId, organizationId),
      eq(expensePolicies.isActive, true),
      or(eq(expensePolicies.category, category), isNull(expensePolicies.category)),
    ];

    if (subsidiaryId) {
      conditions.push(
        or(eq(expensePolicies.subsidiaryId, subsidiaryId), isNull(expensePolicies.subsidiaryId))
      );
    }

    const [result] = await this.db
      .select()
      .from(expensePolicies)
      .where(and(...conditions))
      .orderBy(desc(expensePolicies.priority))
      .limit(1);

    return result || null;
  }

  // --------------------------------------------------------------------------
  // Approval History
  // --------------------------------------------------------------------------

  /**
   * Get approval history for an expense entry
   */
  async getApprovalHistory(expenseEntryId: string): Promise<ExpenseEntryApproval[]> {
    return await this.db
      .select()
      .from(expenseEntryApprovals)
      .where(eq(expenseEntryApprovals.expenseEntryId, expenseEntryId))
      .orderBy(desc(expenseEntryApprovals.performedAt));
  }

  // --------------------------------------------------------------------------
  // Aggregations
  // --------------------------------------------------------------------------

  /**
   * Get expense summary for an employee in a date range
   */
  async getEmployeeSummary(
    employeeId: string,
    organizationId: string,
    startDate: string,
    endDate: string,
    status?: ExpenseEntryStatus[]
  ): Promise<ExpenseSummary> {
    const conditions = [
      eq(expenseEntries.employeeId, employeeId),
      eq(expenseEntries.organizationId, organizationId),
      gte(expenseEntries.expenseDate, startDate),
      lte(expenseEntries.expenseDate, endDate),
    ];

    if (status && status.length > 0) {
      conditions.push(inArray(expenseEntries.status, status));
    }

    const [totals] = await this.db
      .select({
        totalAmount: sql<string>`COALESCE(SUM(${expenseEntries.amount}), 0)`,
        totalReimbursable: sql<string>`COALESCE(SUM(CASE WHEN ${expenseEntries.requiresReimbursement} THEN ${expenseEntries.reimbursementAmount} ELSE 0 END), 0)`,
        totalBillable: sql<string>`COALESCE(SUM(CASE WHEN ${expenseEntries.isBillable} THEN ${expenseEntries.billableAmount} ELSE 0 END), 0)`,
        entryCount: sql<number>`count(*)`,
      })
      .from(expenseEntries)
      .where(and(...conditions));

    // Get by category
    const categoryTotals = await this.db
      .select({
        category: expenseEntries.category,
        total: sql<string>`COALESCE(SUM(${expenseEntries.amount}), 0)`,
      })
      .from(expenseEntries)
      .where(and(...conditions))
      .groupBy(expenseEntries.category);

    const byCategory = categoryTotals.reduce((acc, row) => {
      acc[row.category] = parseFloat(row.total);
      return acc;
    }, {} as Record<ExpenseCategory, number>);

    return {
      totalAmount: parseFloat(totals?.totalAmount || '0'),
      totalReimbursable: parseFloat(totals?.totalReimbursable || '0'),
      totalBillable: parseFloat(totals?.totalBillable || '0'),
      entryCount: Number(totals?.entryCount || 0),
      byCategory,
    };
  }

  /**
   * Get project expense totals
   */
  async getProjectTotals(
    projectId: string,
    organizationId: string,
    status?: ExpenseEntryStatus[]
  ): Promise<{ totalAmount: number; totalBillable: number; entryCount: number }> {
    const conditions = [
      eq(expenseEntries.projectId, projectId),
      eq(expenseEntries.organizationId, organizationId),
    ];

    if (status && status.length > 0) {
      conditions.push(inArray(expenseEntries.status, status));
    }

    const [result] = await this.db
      .select({
        totalAmount: sql<string>`COALESCE(SUM(${expenseEntries.amount}), 0)`,
        totalBillable: sql<string>`COALESCE(SUM(CASE WHEN ${expenseEntries.isBillable} THEN ${expenseEntries.billableAmount} ELSE 0 END), 0)`,
        entryCount: sql<number>`count(*)`,
      })
      .from(expenseEntries)
      .where(and(...conditions));

    return {
      totalAmount: parseFloat(result?.totalAmount || '0'),
      totalBillable: parseFloat(result?.totalBillable || '0'),
      entryCount: Number(result?.entryCount || 0),
    };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private getSortColumn(sortField: string) {
    switch (sortField) {
      case 'expenseDate':
        return expenseEntries.expenseDate;
      case 'amount':
        return expenseEntries.amount;
      case 'status':
        return expenseEntries.status;
      case 'category':
        return expenseEntries.category;
      case 'submittedAt':
        return expenseEntries.submittedAt;
      case 'approvedAt':
        return expenseEntries.approvedAt;
      case 'createdAt':
        return expenseEntries.createdAt;
      default:
        return expenseEntries.expenseDate;
    }
  }
}
