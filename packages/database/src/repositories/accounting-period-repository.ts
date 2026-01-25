import { and, asc, desc, eq, gte, lte, sql, inArray, or, between } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { accountingPeriods, PERIOD_STATUS, type PeriodStatus } from '../db/schema/accounting-periods';
import { subsidiaries } from '../db/schema/subsidiaries';

export interface AccountingPeriodPaginationParams {
  page?: number;
  limit?: number;
  orderBy?: 'periodName' | 'startDate' | 'fiscalYear' | 'status';
  orderDirection?: 'asc' | 'desc';
}

export interface AccountingPeriodFilters {
  status?: PeriodStatus | PeriodStatus[];
  fiscalYear?: string;
  periodType?: string;
  isAdjustmentPeriod?: boolean;
  startDateFrom?: string;
  startDateTo?: string;
}

export interface CreateAccountingPeriodData {
  organizationId: string;
  subsidiaryId: string;
  periodName: string;
  fiscalYear: string;
  periodNumber: number;
  startDate: string;
  endDate: string;
  periodType: string;
  isAdjustmentPeriod?: boolean;
  createdBy?: string;
}

export interface UpdatePeriodStatusData {
  status: PeriodStatus;
  userId: string;
}

export class AccountingPeriodRepository extends BaseRepository {
  /**
   * Find a period by ID with subsidiary access check
   */
  async findById(id: string, subsidiaryIds: string[]) {
    const [result] = await this.db
      .select()
      .from(accountingPeriods)
      .where(
        and(
          eq(accountingPeriods.id, id),
          inArray(accountingPeriods.subsidiaryId, subsidiaryIds)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * Find all periods for accessible subsidiaries with pagination and filtering
   */
  async findAll(
    subsidiaryIds: string[],
    params: AccountingPeriodPaginationParams = {},
    filters: AccountingPeriodFilters = {}
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;

    // Build where conditions
    const whereConditions = [inArray(accountingPeriods.subsidiaryId, subsidiaryIds)];

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        whereConditions.push(inArray(accountingPeriods.status, filters.status));
      } else {
        whereConditions.push(eq(accountingPeriods.status, filters.status));
      }
    }

    if (filters.fiscalYear) {
      whereConditions.push(eq(accountingPeriods.fiscalYear, filters.fiscalYear));
    }

    if (filters.periodType) {
      whereConditions.push(eq(accountingPeriods.periodType, filters.periodType));
    }

    if (filters.isAdjustmentPeriod !== undefined) {
      whereConditions.push(eq(accountingPeriods.isAdjustmentPeriod, filters.isAdjustmentPeriod));
    }

    if (filters.startDateFrom) {
      whereConditions.push(gte(accountingPeriods.startDate, filters.startDateFrom));
    }

    if (filters.startDateTo) {
      whereConditions.push(lte(accountingPeriods.startDate, filters.startDateTo));
    }

    const whereClause = and(...whereConditions);

    // Get total count
    const countResult = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(accountingPeriods)
      .where(whereClause);

    const count = Number(countResult[0]?.count || 0);

    // Determine ordering
    const orderBy = params.orderBy || 'startDate';
    const orderDirection = params.orderDirection || 'desc';

    let orderColumn;
    switch (orderBy) {
      case 'periodName':
        orderColumn = accountingPeriods.periodName;
        break;
      case 'fiscalYear':
        orderColumn = accountingPeriods.fiscalYear;
        break;
      case 'status':
        orderColumn = accountingPeriods.status;
        break;
      default:
        orderColumn = accountingPeriods.startDate;
    }

    const orderFunc = orderDirection === 'asc' ? asc : desc;

    // Get paginated results
    const results = await this.db
      .select()
      .from(accountingPeriods)
      .where(whereClause)
      .orderBy(orderFunc(orderColumn))
      .limit(limit)
      .offset(skip);

    return {
      data: results,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  /**
   * Find period by date for a subsidiary
   */
  async findByDate(subsidiaryId: string, date: string) {
    const [result] = await this.db
      .select()
      .from(accountingPeriods)
      .where(
        and(
          eq(accountingPeriods.subsidiaryId, subsidiaryId),
          lte(accountingPeriods.startDate, date),
          gte(accountingPeriods.endDate, date)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * Find open period for a date (for posting validation)
   */
  async findOpenPeriodForDate(subsidiaryId: string, date: string) {
    const [result] = await this.db
      .select()
      .from(accountingPeriods)
      .where(
        and(
          eq(accountingPeriods.subsidiaryId, subsidiaryId),
          eq(accountingPeriods.status, PERIOD_STATUS.OPEN),
          lte(accountingPeriods.startDate, date),
          gte(accountingPeriods.endDate, date)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * Check if a period allows posting (OPEN or SOFT_CLOSED for adjustments)
   */
  async canPostToDate(subsidiaryId: string, date: string, isAdjustment: boolean = false): Promise<{
    canPost: boolean;
    period: typeof accountingPeriods.$inferSelect | null;
    reason?: string;
  }> {
    const period = await this.findByDate(subsidiaryId, date);

    if (!period) {
      return { canPost: false, period: null, reason: 'No accounting period found for this date' };
    }

    if (period.status === PERIOD_STATUS.LOCKED) {
      return { canPost: false, period, reason: 'Period is locked - no transactions allowed' };
    }

    if (period.status === PERIOD_STATUS.CLOSED) {
      if (isAdjustment) {
        return { canPost: true, period, reason: 'Adjustment entry allowed in closed period' };
      }
      return { canPost: false, period, reason: 'Period is closed - only adjustment entries allowed' };
    }

    if (period.status === PERIOD_STATUS.SOFT_CLOSED) {
      if (isAdjustment) {
        return { canPost: true, period };
      }
      return { canPost: false, period, reason: 'Period is soft-closed - only adjustment entries allowed' };
    }

    return { canPost: true, period };
  }

  /**
   * Create a new accounting period
   */
  async create(data: CreateAccountingPeriodData) {
    const [result] = await this.db
      .insert(accountingPeriods)
      .values({
        ...data,
        status: PERIOD_STATUS.OPEN,
        createdDate: new Date(),
      })
      .returning();

    return result;
  }

  /**
   * Update period status with proper tracking
   */
  async updateStatus(id: string, subsidiaryIds: string[], data: UpdatePeriodStatusData) {
    const now = new Date();

    // Build update object based on new status
    const updateData: Record<string, any> = {
      status: data.status,
      modifiedBy: data.userId,
      modifiedDate: now,
    };

    // Set appropriate tracking fields based on status transition
    switch (data.status) {
      case PERIOD_STATUS.SOFT_CLOSED:
        updateData.softClosedBy = data.userId;
        updateData.softClosedDate = now;
        break;
      case PERIOD_STATUS.CLOSED:
        updateData.closedBy = data.userId;
        updateData.closedDate = now;
        break;
      case PERIOD_STATUS.LOCKED:
        updateData.lockedBy = data.userId;
        updateData.lockedDate = now;
        break;
      case PERIOD_STATUS.OPEN:
        // Clear close/lock tracking when reopening
        updateData.softClosedBy = null;
        updateData.softClosedDate = null;
        updateData.closedBy = null;
        updateData.closedDate = null;
        updateData.lockedBy = null;
        updateData.lockedDate = null;
        break;
    }

    const [result] = await this.db
      .update(accountingPeriods)
      .set(updateData)
      .where(
        and(
          eq(accountingPeriods.id, id),
          inArray(accountingPeriods.subsidiaryId, subsidiaryIds)
        )
      )
      .returning();

    return result || null;
  }

  /**
   * Delete an accounting period (only if OPEN and no transactions)
   */
  async delete(id: string, subsidiaryIds: string[]) {
    await this.db
      .delete(accountingPeriods)
      .where(
        and(
          eq(accountingPeriods.id, id),
          inArray(accountingPeriods.subsidiaryId, subsidiaryIds),
          eq(accountingPeriods.status, PERIOD_STATUS.OPEN)
        )
      );
  }

  /**
   * Get all fiscal years for accessible subsidiaries
   */
  async getFiscalYears(subsidiaryIds: string[]) {
    const results = await this.db
      .selectDistinct({ fiscalYear: accountingPeriods.fiscalYear })
      .from(accountingPeriods)
      .where(inArray(accountingPeriods.subsidiaryId, subsidiaryIds))
      .orderBy(desc(accountingPeriods.fiscalYear));

    return results.map(r => r.fiscalYear);
  }

  /**
   * Get current open period for a subsidiary
   */
  async getCurrentOpenPeriod(subsidiaryId: string) {
    const today = new Date().toISOString().split('T')[0];
    return this.findOpenPeriodForDate(subsidiaryId, today);
  }

  /**
   * Bulk create periods for a fiscal year
   */
  async createFiscalYearPeriods(
    organizationId: string,
    subsidiaryId: string,
    fiscalYear: string,
    periods: Omit<CreateAccountingPeriodData, 'organizationId' | 'subsidiaryId' | 'fiscalYear'>[]
  ) {
    const periodsToCreate = periods.map(p => ({
      ...p,
      organizationId,
      subsidiaryId,
      fiscalYear,
      status: PERIOD_STATUS.OPEN,
      createdDate: new Date(),
    }));

    const results = await this.db
      .insert(accountingPeriods)
      .values(periodsToCreate)
      .returning();

    return results;
  }

  /**
   * Get subsidiaries accessible by organization (for RLS)
   */
  async getAccessibleSubsidiaryIds(organizationId: string): Promise<string[]> {
    const results = await this.db
      .select({ id: subsidiaries.id })
      .from(subsidiaries)
      .where(eq(subsidiaries.organizationId, organizationId));

    return results.map(r => r.id);
  }

  /**
   * Find a period by ID using organization context
   */
  async findByIdForOrganization(id: string, organizationId: string) {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds(organizationId);
    if (subsidiaryIds.length === 0) return null;
    return this.findById(id, subsidiaryIds);
  }

  /**
   * Find current period for an organization (first open period by date)
   */
  async findCurrentPeriod(organizationId: string) {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds(organizationId);
    if (subsidiaryIds.length === 0) return null;

    const today = new Date().toISOString().split('T')[0];
    const [result] = await this.db
      .select()
      .from(accountingPeriods)
      .where(
        and(
          inArray(accountingPeriods.subsidiaryId, subsidiaryIds),
          eq(accountingPeriods.status, PERIOD_STATUS.OPEN),
          lte(accountingPeriods.startDate, today),
          gte(accountingPeriods.endDate, today)
        )
      )
      .orderBy(desc(accountingPeriods.startDate))
      .limit(1);

    return result || null;
  }

  /**
   * Find previous period relative to a given period
   */
  async findPreviousPeriod(currentPeriodId: string, organizationId: string) {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds(organizationId);
    if (subsidiaryIds.length === 0) return null;

    const currentPeriod = await this.findById(currentPeriodId, subsidiaryIds);
    if (!currentPeriod) return null;

    const [result] = await this.db
      .select()
      .from(accountingPeriods)
      .where(
        and(
          inArray(accountingPeriods.subsidiaryId, subsidiaryIds),
          lte(accountingPeriods.endDate, currentPeriod.startDate)
        )
      )
      .orderBy(desc(accountingPeriods.endDate))
      .limit(1);

    return result || null;
  }

  /**
   * Find periods within a date range
   */
  async findByDateRange(organizationId: string, fromDate: string, toDate: string) {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds(organizationId);
    if (subsidiaryIds.length === 0) return [];

    return this.db
      .select()
      .from(accountingPeriods)
      .where(
        and(
          inArray(accountingPeriods.subsidiaryId, subsidiaryIds),
          or(
            between(accountingPeriods.startDate, fromDate, toDate),
            between(accountingPeriods.endDate, fromDate, toDate)
          )
        )
      )
      .orderBy(asc(accountingPeriods.startDate));
  }

  /**
   * Find recent periods for an organization
   */
  async findRecentPeriods(organizationId: string, count: number = 12) {
    const subsidiaryIds = await this.getAccessibleSubsidiaryIds(organizationId);
    if (subsidiaryIds.length === 0) return [];

    return this.db
      .select()
      .from(accountingPeriods)
      .where(inArray(accountingPeriods.subsidiaryId, subsidiaryIds))
      .orderBy(desc(accountingPeriods.startDate))
      .limit(count);
  }
}
