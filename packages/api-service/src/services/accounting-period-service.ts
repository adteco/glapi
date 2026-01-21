import { BaseService } from './base-service';
import {
  AccountingPeriod,
  CreateAccountingPeriodInput,
  UpdatePeriodStatusInput,
  PeriodFilters,
  CheckPostingAllowedInput,
  PostingCheckResult,
  CreateFiscalYearPeriodsInput,
  VALID_STATUS_TRANSITIONS,
  PeriodStatus,
} from '../types/accounting-periods.types';
import { PaginationParams, PaginatedResult, ServiceError } from '../types';
import { AccountingPeriodRepository } from '@glapi/database';

export class AccountingPeriodService extends BaseService {
  private periodRepository: AccountingPeriodRepository;

  constructor(context = {}) {
    super(context);
    this.periodRepository = new AccountingPeriodRepository();
  }

  /**
   * Get accessible subsidiary IDs for the current organization
   */
  private async getAccessibleSubsidiaryIds(): Promise<string[]> {
    const organizationId = this.requireOrganizationContext();
    return this.periodRepository.getAccessibleSubsidiaryIds(organizationId);
  }

  /**
   * Transform database period to service layer type
   */
  private transformPeriod(dbPeriod: any): AccountingPeriod {
    return {
      id: dbPeriod.id,
      subsidiaryId: dbPeriod.subsidiaryId,
      periodName: dbPeriod.periodName,
      fiscalYear: dbPeriod.fiscalYear,
      periodNumber: dbPeriod.periodNumber,
      startDate: dbPeriod.startDate,
      endDate: dbPeriod.endDate,
      periodType: dbPeriod.periodType,
      status: dbPeriod.status,
      isAdjustmentPeriod: dbPeriod.isAdjustmentPeriod,
      softClosedBy: dbPeriod.softClosedBy,
      softClosedDate: dbPeriod.softClosedDate,
      closedBy: dbPeriod.closedBy,
      closedDate: dbPeriod.closedDate,
      lockedBy: dbPeriod.lockedBy,
      lockedDate: dbPeriod.lockedDate,
      createdBy: dbPeriod.createdBy,
      createdDate: dbPeriod.createdDate,
      modifiedBy: dbPeriod.modifiedBy,
      modifiedDate: dbPeriod.modifiedDate,
    };
  }

  /**
   * List accounting periods with filters and pagination
   */
  async listPeriods(
    params: PaginationParams = {},
    filters: PeriodFilters = {},
    orderBy: 'periodName' | 'startDate' | 'fiscalYear' | 'status' = 'startDate',
    orderDirection: 'asc' | 'desc' = 'desc'
  ): Promise<PaginatedResult<AccountingPeriod>> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      return this.createPaginatedResult([], 0, params.page || 1, params.limit || 20);
    }

    const result = await this.periodRepository.findAll(
      subsidiaryIds,
      { page: params.page, limit: params.limit, orderBy, orderDirection },
      filters
    );

    return {
      ...result,
      data: result.data.map(p => this.transformPeriod(p)),
    };
  }

  /**
   * Get a period by ID
   */
  async getPeriodById(id: string): Promise<AccountingPeriod | null> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      return null;
    }

    const period = await this.periodRepository.findById(id, subsidiaryIds);
    return period ? this.transformPeriod(period) : null;
  }

  /**
   * Get period for a specific date (subsidiary-specific)
   */
  async getPeriodForDate(subsidiaryId: string, date: string): Promise<AccountingPeriod | null> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (!subsidiaryIds.includes(subsidiaryId)) {
      throw new ServiceError(
        'Access denied to this subsidiary',
        'SUBSIDIARY_ACCESS_DENIED',
        403
      );
    }

    const period = await this.periodRepository.findByDate(subsidiaryId, date);
    return period ? this.transformPeriod(period) : null;
  }

  /**
   * Find any open period containing the given date across all accessible subsidiaries
   * This is useful for invoice posting when the subsidiary is not yet known
   */
  async findPeriodForDate(date: string): Promise<AccountingPeriod | null> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      return null;
    }

    // Try to find a period containing this date in any accessible subsidiary
    for (const subsidiaryId of subsidiaryIds) {
      const period = await this.periodRepository.findByDate(subsidiaryId, date);
      if (period && (period.status === 'OPEN' || period.status === 'SOFT_CLOSED')) {
        return this.transformPeriod(period);
      }
    }

    return null;
  }

  /**
   * Check if posting is allowed for a date
   */
  async checkPostingAllowed(input: CheckPostingAllowedInput): Promise<PostingCheckResult> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (!subsidiaryIds.includes(input.subsidiaryId)) {
      return {
        canPost: false,
        period: null,
        reason: 'Access denied to this subsidiary',
      };
    }

    const result = await this.periodRepository.canPostToDate(
      input.subsidiaryId,
      input.postingDate,
      input.isAdjustment
    );

    return {
      canPost: result.canPost,
      period: result.period ? this.transformPeriod(result.period) : null,
      reason: result.reason,
    };
  }

  /**
   * Create a new accounting period
   */
  async createPeriod(data: CreateAccountingPeriodInput): Promise<AccountingPeriod> {
    const userId = this.requireUserContext();
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (!subsidiaryIds.includes(data.subsidiaryId)) {
      throw new ServiceError(
        'Access denied to this subsidiary',
        'SUBSIDIARY_ACCESS_DENIED',
        403
      );
    }

    // Validate date range
    if (data.startDate >= data.endDate) {
      throw new ServiceError(
        'Start date must be before end date',
        'INVALID_DATE_RANGE',
        400
      );
    }

    const period = await this.periodRepository.create({
      subsidiaryId: data.subsidiaryId,
      periodName: data.periodName,
      fiscalYear: data.fiscalYear,
      periodNumber: data.periodNumber,
      startDate: data.startDate,
      endDate: data.endDate,
      periodType: data.periodType,
      isAdjustmentPeriod: data.isAdjustmentPeriod,
      createdBy: userId,
    });

    return this.transformPeriod(period);
  }

  /**
   * Update period status with validation
   */
  async updatePeriodStatus(
    id: string,
    input: UpdatePeriodStatusInput
  ): Promise<AccountingPeriod> {
    const userId = this.requireUserContext();
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      throw new ServiceError(
        'No accessible subsidiaries',
        'NO_SUBSIDIARY_ACCESS',
        403
      );
    }

    // Get current period
    const currentPeriod = await this.periodRepository.findById(id, subsidiaryIds);

    if (!currentPeriod) {
      throw new ServiceError(
        `Accounting period with ID "${id}" not found`,
        'PERIOD_NOT_FOUND',
        404
      );
    }

    // Validate status transition
    const currentStatus = currentPeriod.status as PeriodStatus;
    const newStatus = input.status;

    const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus];

    if (!validTransitions.includes(newStatus)) {
      throw new ServiceError(
        `Invalid status transition from ${currentStatus} to ${newStatus}. Valid transitions: ${validTransitions.join(', ') || 'none'}`,
        'INVALID_STATUS_TRANSITION',
        400
      );
    }

    const updated = await this.periodRepository.updateStatus(id, subsidiaryIds, {
      status: newStatus,
      userId,
    });

    if (!updated) {
      throw new ServiceError(
        'Failed to update period status',
        'UPDATE_FAILED',
        500
      );
    }

    return this.transformPeriod(updated);
  }

  /**
   * Soft close a period
   */
  async softClosePeriod(id: string): Promise<AccountingPeriod> {
    return this.updatePeriodStatus(id, { status: 'SOFT_CLOSED' });
  }

  /**
   * Hard close a period
   */
  async closePeriod(id: string): Promise<AccountingPeriod> {
    return this.updatePeriodStatus(id, { status: 'CLOSED' });
  }

  /**
   * Lock a period (permanent, no further changes)
   */
  async lockPeriod(id: string): Promise<AccountingPeriod> {
    return this.updatePeriodStatus(id, { status: 'LOCKED' });
  }

  /**
   * Reopen a soft-closed period
   */
  async reopenPeriod(id: string): Promise<AccountingPeriod> {
    return this.updatePeriodStatus(id, { status: 'OPEN' });
  }

  /**
   * Delete a period (only if OPEN and no transactions)
   */
  async deletePeriod(id: string): Promise<void> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      throw new ServiceError(
        'No accessible subsidiaries',
        'NO_SUBSIDIARY_ACCESS',
        403
      );
    }

    const period = await this.periodRepository.findById(id, subsidiaryIds);

    if (!period) {
      throw new ServiceError(
        `Accounting period with ID "${id}" not found`,
        'PERIOD_NOT_FOUND',
        404
      );
    }

    if (period.status !== 'OPEN') {
      throw new ServiceError(
        'Only OPEN periods can be deleted',
        'PERIOD_NOT_OPEN',
        400
      );
    }

    // TODO: Check for existing transactions in this period before deletion

    await this.periodRepository.delete(id, subsidiaryIds);
  }

  /**
   * Get available fiscal years
   */
  async getFiscalYears(): Promise<string[]> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (subsidiaryIds.length === 0) {
      return [];
    }

    return this.periodRepository.getFiscalYears(subsidiaryIds);
  }

  /**
   * Get current open period for a subsidiary
   */
  async getCurrentOpenPeriod(subsidiaryId: string): Promise<AccountingPeriod | null> {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (!subsidiaryIds.includes(subsidiaryId)) {
      throw new ServiceError(
        'Access denied to this subsidiary',
        'SUBSIDIARY_ACCESS_DENIED',
        403
      );
    }

    const period = await this.periodRepository.getCurrentOpenPeriod(subsidiaryId);
    return period ? this.transformPeriod(period) : null;
  }

  /**
   * Create periods for an entire fiscal year
   */
  async createFiscalYearPeriods(input: CreateFiscalYearPeriodsInput): Promise<AccountingPeriod[]> {
    const userId = this.requireUserContext();
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds();

    if (!subsidiaryIds.includes(input.subsidiaryId)) {
      throw new ServiceError(
        'Access denied to this subsidiary',
        'SUBSIDIARY_ACCESS_DENIED',
        403
      );
    }

    // Parse the year start date
    const yearStart = new Date(input.yearStartDate);
    const periods: Array<{
      periodName: string;
      periodNumber: number;
      startDate: string;
      endDate: string;
      periodType: string;
      isAdjustmentPeriod: boolean;
      createdBy: string;
    }> = [];

    // Generate 12 monthly periods
    for (let i = 0; i < 12; i++) {
      const periodStart = new Date(yearStart);
      periodStart.setMonth(yearStart.getMonth() + i);

      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      periodEnd.setDate(periodEnd.getDate() - 1);

      const monthName = periodStart.toLocaleString('default', { month: 'long' });

      periods.push({
        periodName: `${monthName} ${input.fiscalYear}`,
        periodNumber: i + 1,
        startDate: periodStart.toISOString().split('T')[0],
        endDate: periodEnd.toISOString().split('T')[0],
        periodType: 'MONTH',
        isAdjustmentPeriod: false,
        createdBy: userId,
      });
    }

    // Add adjustment period if requested
    if (input.includeAdjustmentPeriod) {
      const lastPeriod = periods[periods.length - 1];
      periods.push({
        periodName: `Adjustment Period ${input.fiscalYear}`,
        periodNumber: 13,
        startDate: lastPeriod.endDate,
        endDate: lastPeriod.endDate,
        periodType: 'ADJUSTMENT',
        isAdjustmentPeriod: true,
        createdBy: userId,
      });
    }

    const created = await this.periodRepository.createFiscalYearPeriods(
      input.subsidiaryId,
      input.fiscalYear,
      periods
    );

    return created.map(p => this.transformPeriod(p));
  }
}
