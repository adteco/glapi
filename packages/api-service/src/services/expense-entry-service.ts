/**
 * Expense Entry Service
 *
 * Manages expense entries with approval workflows, attachments, and expense reports.
 *
 * @module expense-entry-service
 * @task glapi-0ib.2
 */

import { BaseService } from './base-service';
import { ServiceError } from '../types/common.types';
import {
  ExpenseEntryRepository,
  type ExpenseEntryFilters,
} from '@glapi/database';
import type {
  ExpenseEntry,
  NewExpenseEntry,
  UpdateExpenseEntry,
  ExpenseAttachment,
  NewExpenseAttachment,
  ExpenseReport,
  NewExpenseReport,
  UpdateExpenseReport,
  ExpenseEntryStatus,
  ExpenseCategory,
} from '@glapi/database';

// ============================================================================
// Types
// ============================================================================

export interface ExpenseEntryCreateInput {
  projectId?: string;
  costCodeId?: string;
  expenseDate: string;
  category: ExpenseCategory;
  merchantName?: string;
  description: string;
  amount: string;
  currencyCode?: string;
  taxAmount?: string;
  isTaxDeductible?: boolean;
  paymentMethod?: string;
  requiresReimbursement?: boolean;
  isBillable?: boolean;
  billingMarkup?: string;
  internalNotes?: string;
  externalId?: string;
  externalSource?: string;
  metadata?: Record<string, unknown>;
}

export interface ExpenseEntryUpdateInput {
  projectId?: string | null;
  costCodeId?: string | null;
  expenseDate?: string;
  category?: ExpenseCategory;
  merchantName?: string | null;
  description?: string;
  amount?: string;
  currencyCode?: string;
  taxAmount?: string | null;
  isTaxDeductible?: boolean;
  paymentMethod?: string;
  requiresReimbursement?: boolean;
  isBillable?: boolean;
  billingMarkup?: string | null;
  internalNotes?: string | null;
  externalId?: string | null;
  externalSource?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface SubmitExpensesInput {
  expenseEntryIds: string[];
  comments?: string;
}

export interface ApproveExpensesInput {
  expenseEntryIds: string[];
  comments?: string;
}

export interface RejectExpensesInput {
  expenseEntryIds: string[];
  reason: string;
}

export interface ExpenseReportCreateInput {
  title: string;
  description?: string;
  periodStart: string;
  periodEnd: string;
  businessPurpose?: string;
  projectId?: string;
  expenseEntryIds?: string[];
}

// ============================================================================
// Service
// ============================================================================

export class ExpenseEntryService extends BaseService {
  private repository: ExpenseEntryRepository;

  constructor(context = {}) {
    super(context);
    this.repository = new ExpenseEntryRepository();
  }

  // --------------------------------------------------------------------------
  // CRUD Operations
  // --------------------------------------------------------------------------

  /**
   * List expense entries with filters and pagination
   */
  async list(
    pagination: { page?: number; limit?: number } = {},
    filters: ExpenseEntryFilters = {},
    orderBy = 'expenseDate',
    orderDirection: 'asc' | 'desc' = 'desc'
  ) {
    const organizationId = this.requireOrganizationContext();
    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 50, 100);

    return this.repository.findAll(organizationId, filters, page, limit, orderBy, orderDirection);
  }

  /**
   * Get a single expense entry by ID
   */
  async getById(id: string): Promise<ExpenseEntry | null> {
    const organizationId = this.requireOrganizationContext();
    return this.repository.findById(id, organizationId);
  }

  /**
   * Get expense entry with relations
   */
  async getByIdWithRelations(id: string) {
    const organizationId = this.requireOrganizationContext();
    return this.repository.findByIdWithRelations(id, organizationId);
  }

  /**
   * Get entries pending approval
   */
  async getPendingApprovals(pagination: { page?: number; limit?: number } = {}) {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const entries = await this.repository.findPendingApproval(organizationId);

    // Pagination
    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 50, 100);
    const offset = (page - 1) * limit;
    const paginatedEntries = entries.slice(offset, offset + limit);

    return {
      entries: paginatedEntries,
      totalCount: entries.length,
    };
  }

  /**
   * Create a new expense entry
   */
  async create(input: ExpenseEntryCreateInput): Promise<ExpenseEntry> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Calculate billable amount if applicable
    let billableAmount: string | undefined;
    if (input.isBillable && input.amount) {
      const amount = parseFloat(input.amount);
      const markup = input.billingMarkup ? parseFloat(input.billingMarkup) : 0;
      billableAmount = (amount * (1 + markup)).toFixed(4);
    }

    // Calculate reimbursement amount
    const reimbursementAmount = input.requiresReimbursement !== false ? input.amount : undefined;

    const entry: NewExpenseEntry = {
      organizationId,
      employeeId: userId,
      projectId: input.projectId,
      costCodeId: input.costCodeId,
      expenseDate: input.expenseDate,
      category: input.category,
      merchantName: input.merchantName,
      description: input.description,
      amount: input.amount,
      currencyCode: input.currencyCode || 'USD',
      amountInBaseCurrency: input.amount, // Simplified, would need FX rates
      taxAmount: input.taxAmount,
      isTaxDeductible: input.isTaxDeductible ?? true,
      paymentMethod: (input.paymentMethod as any) || 'PERSONAL_CARD',
      requiresReimbursement: input.requiresReimbursement ?? true,
      reimbursementAmount,
      isBillable: input.isBillable ?? false,
      billingMarkup: input.billingMarkup,
      billableAmount,
      internalNotes: input.internalNotes,
      status: 'DRAFT',
      externalId: input.externalId,
      externalSource: input.externalSource,
      metadata: input.metadata,
      createdBy: userId,
    };

    return this.repository.create(entry);
  }

  /**
   * Update an expense entry (DRAFT only)
   */
  async update(id: string, input: ExpenseEntryUpdateInput): Promise<ExpenseEntry> {
    const organizationId = this.requireOrganizationContext();

    const existing = await this.repository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError('Expense entry not found', 'NOT_FOUND', 404);
    }

    if (existing.status !== 'DRAFT') {
      throw new ServiceError('Can only update DRAFT expense entries', 'INVALID_STATUS', 400);
    }

    // Recalculate billable amount if needed
    let billableAmount = existing.billableAmount;
    if (input.isBillable !== undefined || input.amount !== undefined || input.billingMarkup !== undefined) {
      const isBillable = input.isBillable ?? existing.isBillable;
      const amount = parseFloat(input.amount ?? existing.amount);
      const markup = parseFloat(input.billingMarkup ?? existing.billingMarkup ?? '0');
      billableAmount = isBillable ? (amount * (1 + markup)).toFixed(4) : null;
    }

    const updates: UpdateExpenseEntry = {
      ...input,
      billableAmount,
    };

    const result = await this.repository.update(id, updates, organizationId);
    if (!result) {
      throw new ServiceError('Failed to update expense entry', 'UPDATE_FAILED', 500);
    }

    return result;
  }

  /**
   * Delete an expense entry (DRAFT only)
   */
  async delete(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    const success = await this.repository.delete(id, organizationId);
    if (!success) {
      throw new ServiceError('Cannot delete expense entry (not found or not in DRAFT status)', 'DELETE_FAILED', 400);
    }
  }

  // --------------------------------------------------------------------------
  // Approval Workflow
  // --------------------------------------------------------------------------

  /**
   * Submit expense entries for approval
   */
  async submit(input: SubmitExpensesInput) {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const entryId of input.expenseEntryIds) {
      const result = await this.repository.submit(entryId, organizationId, userId);
      results.push({
        id: entryId,
        success: result !== null,
        error: result === null ? 'Entry not found or not in DRAFT status' : undefined,
      });
    }

    return { results };
  }

  /**
   * Approve expense entries
   */
  async approve(input: ApproveExpensesInput) {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const entryId of input.expenseEntryIds) {
      const result = await this.repository.approve(entryId, organizationId, userId, input.comments);
      results.push({
        id: entryId,
        success: result !== null,
        error: result === null ? 'Entry not found or not in SUBMITTED status' : undefined,
      });
    }

    return { results };
  }

  /**
   * Reject expense entries
   */
  async reject(input: RejectExpensesInput) {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const entryId of input.expenseEntryIds) {
      const result = await this.repository.reject(entryId, organizationId, userId, input.reason);
      results.push({
        id: entryId,
        success: result !== null,
        error: result === null ? 'Entry not found or not in SUBMITTED status' : undefined,
      });
    }

    return { results };
  }

  /**
   * Return rejected entries to draft
   */
  async returnToDraft(expenseEntryIds: string[]) {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const entryId of expenseEntryIds) {
      const result = await this.repository.returnToDraft(entryId, organizationId, userId);
      results.push({
        id: entryId,
        success: result !== null,
        error: result === null ? 'Entry not found or not in REJECTED status' : undefined,
      });
    }

    return { results };
  }

  // --------------------------------------------------------------------------
  // Attachments
  // --------------------------------------------------------------------------

  /**
   * Add attachment to expense entry
   */
  async addAttachment(
    expenseEntryId: string,
    attachment: {
      fileName: string;
      fileType: string;
      fileSize: number;
      mimeType?: string;
      storageKey: string;
      storageProvider?: string;
      publicUrl?: string;
      documentType?: string;
    }
  ): Promise<ExpenseAttachment> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const entry = await this.repository.findById(expenseEntryId, organizationId);
    if (!entry) {
      throw new ServiceError('Expense entry not found', 'NOT_FOUND', 404);
    }

    if (!['DRAFT', 'SUBMITTED'].includes(entry.status)) {
      throw new ServiceError('Cannot add attachments to entries that are not DRAFT or SUBMITTED', 'INVALID_STATUS', 400);
    }

    const attachmentData: NewExpenseAttachment = {
      expenseEntryId,
      organizationId,
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      storageKey: attachment.storageKey,
      storageProvider: attachment.storageProvider || 's3',
      publicUrl: attachment.publicUrl,
      documentType: attachment.documentType || 'RECEIPT',
      uploadedBy: userId,
    };

    return this.repository.addAttachment(attachmentData);
  }

  /**
   * Get attachments for an expense entry
   */
  async getAttachments(expenseEntryId: string): Promise<ExpenseAttachment[]> {
    const organizationId = this.requireOrganizationContext();

    const entry = await this.repository.findById(expenseEntryId, organizationId);
    if (!entry) {
      throw new ServiceError('Expense entry not found', 'NOT_FOUND', 404);
    }

    return this.repository.getAttachments(expenseEntryId);
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(attachmentId: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    const success = await this.repository.deleteAttachment(attachmentId, organizationId);
    if (!success) {
      throw new ServiceError('Attachment not found', 'NOT_FOUND', 404);
    }
  }

  // --------------------------------------------------------------------------
  // Expense Reports
  // --------------------------------------------------------------------------

  /**
   * Create an expense report
   */
  async createReport(input: ExpenseReportCreateInput): Promise<ExpenseReport> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const reportNumber = await this.repository.generateReportNumber(organizationId);

    const report: NewExpenseReport = {
      organizationId,
      employeeId: userId,
      reportNumber,
      title: input.title,
      description: input.description,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      businessPurpose: input.businessPurpose,
      projectId: input.projectId,
      status: 'DRAFT',
      createdBy: userId,
    };

    const created = await this.repository.createReport(report);

    // Add entries to report if provided
    if (input.expenseEntryIds?.length) {
      for (let i = 0; i < input.expenseEntryIds.length; i++) {
        await this.repository.addEntryToReport(created.id, input.expenseEntryIds[i], i + 1);
      }
    }

    return created;
  }

  /**
   * List expense reports
   */
  async listReports(
    pagination: { page?: number; limit?: number } = {},
    filters: { status?: ExpenseEntryStatus } = {}
  ) {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 20, 100);

    return this.repository.listReports(organizationId, { employeeId: userId, ...filters }, page, limit);
  }

  /**
   * Get a report with its entries
   */
  async getReportWithEntries(reportId: string) {
    const organizationId = this.requireOrganizationContext();

    const report = await this.repository.findReportById(reportId, organizationId);
    if (!report) {
      throw new ServiceError('Expense report not found', 'NOT_FOUND', 404);
    }

    const entries = await this.repository.getReportEntries(reportId);

    return { report, entries };
  }

  // --------------------------------------------------------------------------
  // Reporting
  // --------------------------------------------------------------------------

  /**
   * Get expense summary for current user
   */
  async getMySummary(startDate: string, endDate: string, status?: ExpenseEntryStatus[]) {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    return this.repository.getEmployeeSummary(userId, organizationId, startDate, endDate, status);
  }

  /**
   * Get project expense totals
   */
  async getProjectTotals(projectId: string, status?: ExpenseEntryStatus[]) {
    const organizationId = this.requireOrganizationContext();
    return this.repository.getProjectTotals(projectId, organizationId, status);
  }

  /**
   * Get approval history for an entry
   */
  async getApprovalHistory(expenseEntryId: string) {
    const organizationId = this.requireOrganizationContext();

    const entry = await this.repository.findById(expenseEntryId, organizationId);
    if (!entry) {
      throw new ServiceError('Expense entry not found', 'NOT_FOUND', 404);
    }

    return this.repository.getApprovalHistory(expenseEntryId);
  }
}
