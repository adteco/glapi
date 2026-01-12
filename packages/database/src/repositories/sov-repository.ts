import { and, asc, desc, eq, gte, lte, sql, inArray, ne, isNull } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  projectScheduleOfValues,
  scheduleOfValueLines,
  sovChangeOrders,
  sovChangeOrderLines,
  SOV_STATUS,
  type SovStatus,
  type SovLineType,
} from '../db/schema/schedule-of-values';
import { projects } from '../db/schema/projects';

export interface SovPaginationParams {
  page?: number;
  limit?: number;
  orderBy?: 'sovNumber' | 'versionNumber' | 'status' | 'createdAt' | 'effectiveDate';
  orderDirection?: 'asc' | 'desc';
}

export interface SovFilters {
  projectId?: string;
  status?: SovStatus | SovStatus[];
  search?: string;
}

export interface CreateSovData {
  organizationId: string;
  projectId: string;
  sovNumber: string;
  versionNumber?: number;
  effectiveDate?: string;
  contractNumber?: string;
  contractDate?: string;
  description?: string;
  notes?: string;
  retainagePercent?: string;
  retainageCapAmount?: string;
  retainageReducedPercent?: string;
  retainageReducedThreshold?: string;
  originalContractAmount?: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateSovData {
  sovNumber?: string;
  effectiveDate?: string;
  contractNumber?: string;
  contractDate?: string;
  description?: string;
  notes?: string;
  retainagePercent?: string;
  retainageCapAmount?: string;
  retainageReducedPercent?: string;
  retainageReducedThreshold?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateSovLineData {
  scheduleOfValuesId: string;
  lineNumber: number;
  itemNumber?: string;
  description: string;
  originalScheduledValue: string;
  lineType?: SovLineType;
  projectCostCodeId?: string;
  retainagePercent?: string;
  sortOrder?: number;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateSovLineData {
  lineNumber?: number;
  itemNumber?: string;
  description?: string;
  originalScheduledValue?: string;
  lineType?: SovLineType;
  retainagePercent?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateChangeOrderData {
  scheduleOfValuesId: string;
  changeOrderNumber: string;
  description: string;
  amount: string;
  effectiveDate?: string;
  requestedBy?: string;
  requestedDate?: string;
  externalReference?: string;
  documentUrl?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface BillingProgressData {
  previousWorkCompleted?: string;
  previousMaterialsStored?: string;
  currentWorkCompleted?: string;
  currentMaterialsStored?: string;
  totalCompletedAndStored?: string;
  percentComplete?: string;
  balanceToFinish?: string;
  currentRetainagePercent?: string;
  retainageAmount?: string;
}

export class SovRepository extends BaseRepository {
  /**
   * Get accessible project IDs based on organization
   */
  async getAccessibleProjectIds(organizationId: string): Promise<string[]> {
    const results = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.organizationId, organizationId));

    return results.map((r) => r.id);
  }

  // ========== SOV Methods ==========

  /**
   * Find an SOV by ID with access check
   */
  async findById(id: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(projectScheduleOfValues)
      .where(
        and(
          eq(projectScheduleOfValues.id, id),
          eq(projectScheduleOfValues.organizationId, organizationId)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * Find all SOVs with pagination and filtering
   */
  async findAll(
    organizationId: string,
    params: SovPaginationParams = {},
    filters: SovFilters = {}
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;

    const whereConditions = [eq(projectScheduleOfValues.organizationId, organizationId)];

    if (filters.projectId) {
      whereConditions.push(eq(projectScheduleOfValues.projectId, filters.projectId));
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        whereConditions.push(inArray(projectScheduleOfValues.status, filters.status));
      } else {
        whereConditions.push(eq(projectScheduleOfValues.status, filters.status));
      }
    }

    const whereClause = and(...whereConditions);

    const countResult = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(projectScheduleOfValues)
      .where(whereClause);

    const count = Number(countResult[0]?.count || 0);

    const orderBy = params.orderBy || 'createdAt';
    const orderDirection = params.orderDirection || 'desc';

    let orderColumn;
    switch (orderBy) {
      case 'sovNumber':
        orderColumn = projectScheduleOfValues.sovNumber;
        break;
      case 'versionNumber':
        orderColumn = projectScheduleOfValues.versionNumber;
        break;
      case 'status':
        orderColumn = projectScheduleOfValues.status;
        break;
      case 'effectiveDate':
        orderColumn = projectScheduleOfValues.effectiveDate;
        break;
      default:
        orderColumn = projectScheduleOfValues.createdAt;
    }

    const orderFunc = orderDirection === 'asc' ? asc : desc;

    const results = await this.db
      .select()
      .from(projectScheduleOfValues)
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
   * Find the active SOV for a project
   */
  async findActiveByProject(projectId: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(projectScheduleOfValues)
      .where(
        and(
          eq(projectScheduleOfValues.projectId, projectId),
          eq(projectScheduleOfValues.organizationId, organizationId),
          eq(projectScheduleOfValues.status, SOV_STATUS.ACTIVE)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * Get the next version number for a project's SOV
   */
  async getNextVersionNumber(projectId: string, organizationId: string): Promise<number> {
    const [result] = await this.db
      .select({ maxVersion: sql`MAX(${projectScheduleOfValues.versionNumber})` })
      .from(projectScheduleOfValues)
      .where(
        and(
          eq(projectScheduleOfValues.projectId, projectId),
          eq(projectScheduleOfValues.organizationId, organizationId)
        )
      );

    return (Number(result?.maxVersion) || 0) + 1;
  }

  /**
   * Create a new SOV
   */
  async create(data: CreateSovData) {
    const [result] = await this.db
      .insert(projectScheduleOfValues)
      .values({
        ...data,
        versionNumber: data.versionNumber || 1,
        status: SOV_STATUS.DRAFT,
        originalContractAmount: data.originalContractAmount || '0',
        approvedChangeOrders: '0',
        revisedContractAmount: data.originalContractAmount || '0',
        totalScheduledValue: '0',
        totalBilledToDate: '0',
        totalRetainageHeld: '0',
        totalRetainageReleased: '0',
        balanceToFinish: data.originalContractAmount || '0',
        percentComplete: '0',
        defaultRetainagePercent: data.retainagePercent || '10',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return result;
  }

  /**
   * Update an SOV
   */
  async update(id: string, organizationId: string, data: UpdateSovData) {
    const [result] = await this.db
      .update(projectScheduleOfValues)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectScheduleOfValues.id, id),
          eq(projectScheduleOfValues.organizationId, organizationId)
        )
      )
      .returning();

    return result || null;
  }

  /**
   * Update SOV status with workflow tracking
   */
  async updateStatus(
    id: string,
    organizationId: string,
    status: SovStatus,
    userId?: string
  ) {
    const now = new Date();

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: now,
    };

    // Set workflow tracking fields based on status
    switch (status) {
      case SOV_STATUS.ACTIVE:
        updateData.approvedDate = now;
        updateData.approvedBy = userId;
        break;
      case SOV_STATUS.CLOSED:
        updateData.closedDate = now;
        updateData.closedBy = userId;
        break;
    }

    const [result] = await this.db
      .update(projectScheduleOfValues)
      .set(updateData)
      .where(
        and(
          eq(projectScheduleOfValues.id, id),
          eq(projectScheduleOfValues.organizationId, organizationId)
        )
      )
      .returning();

    return result || null;
  }

  /**
   * Delete an SOV (only if DRAFT)
   */
  async delete(id: string, organizationId: string) {
    // First delete all SOV lines
    await this.db
      .delete(scheduleOfValueLines)
      .where(eq(scheduleOfValueLines.scheduleOfValuesId, id));

    // Delete change order lines and change orders
    const changeOrders = await this.db
      .select({ id: sovChangeOrders.id })
      .from(sovChangeOrders)
      .where(eq(sovChangeOrders.scheduleOfValuesId, id));

    for (const co of changeOrders) {
      await this.db
        .delete(sovChangeOrderLines)
        .where(eq(sovChangeOrderLines.changeOrderId, co.id));
    }

    await this.db
      .delete(sovChangeOrders)
      .where(eq(sovChangeOrders.scheduleOfValuesId, id));

    // Then delete the SOV
    await this.db
      .delete(projectScheduleOfValues)
      .where(
        and(
          eq(projectScheduleOfValues.id, id),
          eq(projectScheduleOfValues.organizationId, organizationId),
          eq(projectScheduleOfValues.status, SOV_STATUS.DRAFT)
        )
      );
  }

  // ========== SOV Line Methods ==========

  /**
   * Find an SOV line by ID
   */
  async findLineById(id: string) {
    const [result] = await this.db
      .select()
      .from(scheduleOfValueLines)
      .where(eq(scheduleOfValueLines.id, id))
      .limit(1);

    return result || null;
  }

  /**
   * Find all lines for an SOV
   */
  async findLinesBySov(scheduleOfValuesId: string) {
    const results = await this.db
      .select()
      .from(scheduleOfValueLines)
      .where(eq(scheduleOfValueLines.scheduleOfValuesId, scheduleOfValuesId))
      .orderBy(asc(scheduleOfValueLines.lineNumber));

    return results;
  }

  /**
   * Create an SOV line
   */
  async createLine(data: CreateSovLineData) {
    const [result] = await this.db
      .insert(scheduleOfValueLines)
      .values({
        ...data,
        revisedScheduledValue: data.originalScheduledValue,
        changeOrderAmount: '0',
        previousWorkCompleted: '0',
        previousMaterialsStored: '0',
        currentWorkCompleted: '0',
        currentMaterialsStored: '0',
        totalCompletedAndStored: '0',
        percentComplete: '0',
        balanceToFinish: data.originalScheduledValue,
        retainageHeld: '0',
        retainageReleased: '0',
        netRetainage: '0',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return result;
  }

  /**
   * Update an SOV line
   */
  async updateLine(id: string, data: UpdateSovLineData) {
    const [result] = await this.db
      .update(scheduleOfValueLines)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(scheduleOfValueLines.id, id))
      .returning();

    return result || null;
  }

  /**
   * Update billing progress for an SOV line
   */
  async updateLineBillingProgress(id: string, data: BillingProgressData) {
    const [result] = await this.db
      .update(scheduleOfValueLines)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(scheduleOfValueLines.id, id))
      .returning();

    return result || null;
  }

  /**
   * Delete an SOV line
   */
  async deleteLine(id: string) {
    await this.db.delete(scheduleOfValueLines).where(eq(scheduleOfValueLines.id, id));
  }

  /**
   * Bulk create SOV lines
   */
  async bulkCreateLines(lines: CreateSovLineData[]) {
    const linesToCreate = lines.map((line) => ({
      ...line,
      revisedScheduledValue: line.originalScheduledValue,
      previousWorkCompleted: '0',
      previousMaterialsStored: '0',
      currentWorkCompleted: '0',
      currentMaterialsStored: '0',
      totalCompletedAndStored: '0',
      percentComplete: '0',
      balanceToFinish: line.originalScheduledValue,
      retainageHeld: '0',
      retainageReleased: '0',
      netRetainage: '0',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const results = await this.db
      .insert(scheduleOfValueLines)
      .values(linesToCreate)
      .returning();

    return results;
  }

  /**
   * Get the next line number for an SOV
   */
  async getNextLineNumber(scheduleOfValuesId: string): Promise<number> {
    const [result] = await this.db
      .select({ maxLine: sql`MAX(${scheduleOfValueLines.lineNumber})` })
      .from(scheduleOfValueLines)
      .where(eq(scheduleOfValueLines.scheduleOfValuesId, scheduleOfValuesId));

    return (Number(result?.maxLine) || 0) + 1;
  }

  // ========== Change Order Methods ==========

  /**
   * Find a change order by ID
   */
  async findChangeOrderById(id: string) {
    const [result] = await this.db
      .select()
      .from(sovChangeOrders)
      .where(eq(sovChangeOrders.id, id))
      .limit(1);

    return result || null;
  }

  /**
   * Find all change orders for an SOV
   */
  async findChangeOrdersBySov(scheduleOfValuesId: string) {
    const results = await this.db
      .select()
      .from(sovChangeOrders)
      .where(eq(sovChangeOrders.scheduleOfValuesId, scheduleOfValuesId))
      .orderBy(asc(sovChangeOrders.changeOrderNumber));

    return results;
  }

  /**
   * Create a change order
   */
  async createChangeOrder(data: CreateChangeOrderData) {
    const [result] = await this.db
      .insert(sovChangeOrders)
      .values({
        scheduleOfValuesId: data.scheduleOfValuesId,
        changeOrderNumber: data.changeOrderNumber,
        description: data.description,
        amount: data.amount,
        effectiveDate: data.effectiveDate,
        requestedBy: data.requestedBy,
        requestedDate: data.requestedDate ? new Date(data.requestedDate) : undefined,
        externalReference: data.externalReference,
        documentUrl: data.documentUrl,
        notes: data.notes,
        metadata: data.metadata,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return result;
  }

  /**
   * Update change order status
   */
  async updateChangeOrderStatus(
    id: string,
    status: string,
    approvedBy?: string
  ) {
    const now = new Date();

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: now,
    };

    if (status === 'APPROVED') {
      updateData.approvedDate = now;
      updateData.approvedBy = approvedBy;
    }

    const [result] = await this.db
      .update(sovChangeOrders)
      .set(updateData)
      .where(eq(sovChangeOrders.id, id))
      .returning();

    return result || null;
  }

  // ========== Summary Methods ==========

  /**
   * Recalculate SOV totals from lines
   */
  async recalculateTotals(id: string) {
    const lines = await this.findLinesBySov(id);

    let totalScheduledValue = 0;
    let totalCompletedAndStored = 0;
    let totalRetainageHeld = 0;

    for (const line of lines) {
      totalScheduledValue += parseFloat(line.revisedScheduledValue);
      totalCompletedAndStored += parseFloat(line.totalCompletedAndStored);
      totalRetainageHeld += parseFloat(line.retainageHeld);
    }

    const balanceToFinish = totalScheduledValue - totalCompletedAndStored;
    const percentComplete =
      totalScheduledValue > 0 ? (totalCompletedAndStored / totalScheduledValue) * 100 : 0;

    await this.db
      .update(projectScheduleOfValues)
      .set({
        totalScheduledValue: totalScheduledValue.toString(),
        totalBilledToDate: totalCompletedAndStored.toString(),
        totalRetainageHeld: totalRetainageHeld.toString(),
        balanceToFinish: balanceToFinish.toString(),
        percentComplete: percentComplete.toFixed(4),
        updatedAt: new Date(),
      })
      .where(eq(projectScheduleOfValues.id, id));
  }

  /**
   * Apply approved change orders to SOV
   */
  async applyApprovedChangeOrders(scheduleOfValuesId: string) {
    const changeOrders = await this.db
      .select()
      .from(sovChangeOrders)
      .where(
        and(
          eq(sovChangeOrders.scheduleOfValuesId, scheduleOfValuesId),
          eq(sovChangeOrders.status, 'APPROVED')
        )
      );

    let totalApprovedChanges = 0;
    for (const co of changeOrders) {
      totalApprovedChanges += parseFloat(co.amount);
    }

    // Get original contract amount
    const [sov] = await this.db
      .select()
      .from(projectScheduleOfValues)
      .where(eq(projectScheduleOfValues.id, scheduleOfValuesId))
      .limit(1);

    if (sov) {
      const originalAmount = parseFloat(sov.originalContractAmount);
      const revisedContractAmount = originalAmount + totalApprovedChanges;

      await this.db
        .update(projectScheduleOfValues)
        .set({
          approvedChangeOrders: totalApprovedChanges.toString(),
          revisedContractAmount: revisedContractAmount.toString(),
          updatedAt: new Date(),
        })
        .where(eq(projectScheduleOfValues.id, scheduleOfValuesId));
    }
  }
}
