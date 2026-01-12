import { and, asc, desc, eq, gte, lte, sql, inArray, ne, isNull } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  payApplications,
  payApplicationLines,
  retainageReleases,
  retainageReleaseLines,
  payAppApprovalHistory,
  PAY_APP_STATUS,
  PAY_APP_TYPE,
  type PayAppStatus,
  type PayAppType,
} from '../db/schema/pay-applications';
import { projectScheduleOfValues, scheduleOfValueLines } from '../db/schema/schedule-of-values';
import { projects } from '../db/schema/projects';

export interface PayAppPaginationParams {
  page?: number;
  limit?: number;
  orderBy?: 'applicationNumber' | 'applicationDate' | 'status' | 'createdAt';
  orderDirection?: 'asc' | 'desc';
}

export interface PayAppFilters {
  projectId?: string;
  scheduleOfValuesId?: string;
  status?: PayAppStatus | PayAppStatus[];
  payAppType?: PayAppType | PayAppType[];
  periodFrom?: string;
  periodTo?: string;
}

export interface CreatePayAppData {
  organizationId: string;
  projectId: string;
  scheduleOfValuesId: string;
  applicationNumber?: number;
  applicationDate: string;
  periodFrom: string;
  periodTo: string;
  payAppType?: PayAppType;
  contractorId?: string;
  ownerId?: string;
  architectId?: string;
  externalReference?: string;
  notes?: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdatePayAppData {
  applicationDate?: string;
  periodFrom?: string;
  periodTo?: string;
  contractorId?: string;
  ownerId?: string;
  architectId?: string;
  externalReference?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface CreatePayAppLineData {
  payApplicationId: string;
  sovLineId: string;
  lineNumber: number;
  description: string;
  scheduledValue?: string;
  itemNumber?: string;
  thisWorkCompleted: string;
  thisMaterialsStored: string;
  retainagePercent?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdatePayAppLineData {
  thisWorkCompleted?: string;
  thisMaterialsStored?: string;
  retainagePercent?: string;
  approvedWorkCompleted?: string;
  approvedMaterialsStored?: string;
  adjustmentReason?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateRetainageReleaseData {
  organizationId: string;
  projectId: string;
  payApplicationId?: string;
  releaseNumber?: number;
  releaseDate: string;
  releaseType?: string;
  releaseAmount: string;
  releasePercent?: string;
  requiresPunchlistComplete?: boolean;
  requiresLienWaivers?: boolean;
  requiresWarrantyDocuments?: boolean;
  externalReference?: string;
  notes?: string;
  requestedBy?: string;
  metadata?: Record<string, unknown>;
}

export interface PayAppWorkflowData {
  status: PayAppStatus;
  userId: string;
  notes?: string;
  // Approval-specific fields
  approvedAmount?: string;
  // Certification-specific fields
  certificationNumber?: string;
  // Billing-specific fields
  invoiceNumber?: string;
  invoiceDate?: string;
  // Payment-specific fields
  paidAmount?: string;
  paidDate?: string;
  checkNumber?: string;
  paymentReference?: string;
  // Void/Reject-specific fields
  reason?: string;
}

export class PayApplicationRepository extends BaseRepository {
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

  // ========== Pay Application Methods ==========

  /**
   * Find a pay application by ID with access check
   */
  async findById(id: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(payApplications)
      .where(
        and(
          eq(payApplications.id, id),
          eq(payApplications.organizationId, organizationId)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * Find all pay applications with pagination and filtering
   */
  async findAll(
    organizationId: string,
    params: PayAppPaginationParams = {},
    filters: PayAppFilters = {}
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;

    const whereConditions = [eq(payApplications.organizationId, organizationId)];

    if (filters.projectId) {
      whereConditions.push(eq(payApplications.projectId, filters.projectId));
    }

    if (filters.scheduleOfValuesId) {
      whereConditions.push(eq(payApplications.scheduleOfValuesId, filters.scheduleOfValuesId));
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        whereConditions.push(inArray(payApplications.status, filters.status));
      } else {
        whereConditions.push(eq(payApplications.status, filters.status));
      }
    }

    if (filters.payAppType) {
      if (Array.isArray(filters.payAppType)) {
        whereConditions.push(inArray(payApplications.payAppType, filters.payAppType));
      } else {
        whereConditions.push(eq(payApplications.payAppType, filters.payAppType));
      }
    }

    if (filters.periodFrom) {
      whereConditions.push(gte(payApplications.periodTo, filters.periodFrom));
    }

    if (filters.periodTo) {
      whereConditions.push(lte(payApplications.periodFrom, filters.periodTo));
    }

    const whereClause = and(...whereConditions);

    const countResult = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(payApplications)
      .where(whereClause);

    const count = Number(countResult[0]?.count || 0);

    const orderBy = params.orderBy || 'applicationNumber';
    const orderDirection = params.orderDirection || 'desc';

    let orderColumn;
    switch (orderBy) {
      case 'applicationDate':
        orderColumn = payApplications.applicationDate;
        break;
      case 'status':
        orderColumn = payApplications.status;
        break;
      case 'createdAt':
        orderColumn = payApplications.createdAt;
        break;
      default:
        orderColumn = payApplications.applicationNumber;
    }

    const orderFunc = orderDirection === 'asc' ? asc : desc;

    const results = await this.db
      .select()
      .from(payApplications)
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
   * Get the next application number for a project's pay applications
   */
  async getNextApplicationNumber(scheduleOfValuesId: string): Promise<number> {
    const [result] = await this.db
      .select({ maxNum: sql`MAX(${payApplications.applicationNumber})` })
      .from(payApplications)
      .where(eq(payApplications.scheduleOfValuesId, scheduleOfValuesId));

    return (Number(result?.maxNum) || 0) + 1;
  }

  /**
   * Create a new pay application
   */
  async create(data: CreatePayAppData) {
    const [result] = await this.db
      .insert(payApplications)
      .values({
        ...data,
        applicationNumber: data.applicationNumber || 1,
        status: PAY_APP_STATUS.DRAFT,
        payAppType: data.payAppType || PAY_APP_TYPE.PROGRESS,
        // Initialize all financial fields to 0
        originalContractSum: '0',
        netChangeByChangeOrders: '0',
        contractSumToDate: '0',
        totalCompletedAndStoredToDate: '0',
        retainageFromWorkCompleted: '0',
        retainageFromStoredMaterial: '0',
        totalRetainage: '0',
        totalEarnedLessRetainage: '0',
        lessPreviousCertificates: '0',
        currentPaymentDue: '0',
        balanceToFinish: '0',
        retainagePercent: '10',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return result;
  }

  /**
   * Update a pay application
   */
  async update(id: string, organizationId: string, data: UpdatePayAppData) {
    const [result] = await this.db
      .update(payApplications)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(payApplications.id, id),
          eq(payApplications.organizationId, organizationId)
        )
      )
      .returning();

    return result || null;
  }

  /**
   * Update pay application status with workflow tracking
   */
  async updateStatus(
    id: string,
    organizationId: string,
    data: PayAppWorkflowData
  ) {
    const now = new Date();

    const updateData: Record<string, unknown> = {
      status: data.status,
      updatedAt: now,
    };

    // Set workflow tracking fields based on status
    switch (data.status) {
      case PAY_APP_STATUS.SUBMITTED:
        updateData.submittedDate = now;
        updateData.submittedBy = data.userId;
        break;
      case PAY_APP_STATUS.APPROVED:
        updateData.approvedDate = now;
        updateData.approvedBy = data.userId;
        if (data.approvedAmount) {
          updateData.currentPaymentDue = data.approvedAmount;
        }
        break;
      case PAY_APP_STATUS.CERTIFIED:
        updateData.certifiedDate = now;
        updateData.certifiedBy = data.userId;
        if (data.certificationNumber) {
          updateData.certificationNumber = data.certificationNumber;
        }
        break;
      case PAY_APP_STATUS.BILLED:
        updateData.billedDate = now;
        updateData.billedBy = data.userId;
        if (data.invoiceNumber) {
          updateData.invoiceNumber = data.invoiceNumber;
        }
        break;
      case PAY_APP_STATUS.PAID:
        updateData.paidDate = data.paidDate || now;
        if (data.paidAmount) {
          updateData.paidAmount = data.paidAmount;
        }
        if (data.checkNumber) {
          updateData.checkNumber = data.checkNumber;
        }
        if (data.paymentReference) {
          updateData.paymentReference = data.paymentReference;
        }
        break;
      case PAY_APP_STATUS.REJECTED:
        updateData.rejectedDate = now;
        updateData.rejectedBy = data.userId;
        if (data.reason) {
          updateData.rejectionReason = data.reason;
        }
        break;
      case PAY_APP_STATUS.VOIDED:
        updateData.voidedDate = now;
        updateData.voidedBy = data.userId;
        if (data.reason) {
          updateData.voidReason = data.reason;
        }
        break;
    }

    const [result] = await this.db
      .update(payApplications)
      .set(updateData)
      .where(
        and(
          eq(payApplications.id, id),
          eq(payApplications.organizationId, organizationId)
        )
      )
      .returning();

    // Record approval history
    if (result) {
      await this.recordApprovalHistory(id, organizationId, data);
    }

    return result || null;
  }

  /**
   * Delete a pay application (only if DRAFT)
   */
  async delete(id: string, organizationId: string) {
    // First delete all pay app lines
    await this.db
      .delete(payApplicationLines)
      .where(eq(payApplicationLines.payApplicationId, id));

    // Delete approval history
    await this.db
      .delete(payAppApprovalHistory)
      .where(eq(payAppApprovalHistory.payApplicationId, id));

    // Then delete the pay application
    await this.db
      .delete(payApplications)
      .where(
        and(
          eq(payApplications.id, id),
          eq(payApplications.organizationId, organizationId),
          eq(payApplications.status, PAY_APP_STATUS.DRAFT)
        )
      );
  }

  // ========== Pay Application Line Methods ==========

  /**
   * Find a pay app line by ID
   */
  async findLineById(id: string) {
    const [result] = await this.db
      .select()
      .from(payApplicationLines)
      .where(eq(payApplicationLines.id, id))
      .limit(1);

    return result || null;
  }

  /**
   * Find all lines for a pay application
   */
  async findLinesByPayApp(payApplicationId: string) {
    const results = await this.db
      .select()
      .from(payApplicationLines)
      .where(eq(payApplicationLines.payApplicationId, payApplicationId))
      .orderBy(asc(payApplicationLines.lineNumber));

    return results;
  }

  /**
   * Find lines with SOV line details
   */
  async findLinesWithSovDetails(payApplicationId: string) {
    const results = await this.db
      .select({
        line: payApplicationLines,
        sovLine: scheduleOfValueLines,
      })
      .from(payApplicationLines)
      .innerJoin(scheduleOfValueLines, eq(payApplicationLines.sovLineId, scheduleOfValueLines.id))
      .where(eq(payApplicationLines.payApplicationId, payApplicationId))
      .orderBy(asc(payApplicationLines.lineNumber));

    return results;
  }

  /**
   * Create a pay app line
   */
  async createLine(data: CreatePayAppLineData) {
    const [result] = await this.db
      .insert(payApplicationLines)
      .values({
        ...data,
        previousWorkCompleted: '0',
        previousMaterialsStored: '0',
        totalCompletedAndStored: '0',
        percentComplete: '0',
        balanceToFinish: '0',
        retainageAmount: '0',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return result;
  }

  /**
   * Update a pay app line
   */
  async updateLine(id: string, data: UpdatePayAppLineData) {
    const [result] = await this.db
      .update(payApplicationLines)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(payApplicationLines.id, id))
      .returning();

    return result || null;
  }

  /**
   * Delete a pay app line
   */
  async deleteLine(id: string) {
    await this.db.delete(payApplicationLines).where(eq(payApplicationLines.id, id));
  }

  /**
   * Bulk create pay app lines
   */
  async bulkCreateLines(lines: CreatePayAppLineData[]) {
    const linesToCreate = lines.map((line) => ({
      ...line,
      previousWorkCompleted: '0',
      previousMaterialsStored: '0',
      totalCompletedAndStored: '0',
      percentComplete: '0',
      balanceToFinish: '0',
      retainageAmount: '0',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const results = await this.db
      .insert(payApplicationLines)
      .values(linesToCreate)
      .returning();

    return results;
  }

  /**
   * Bulk update pay app lines
   */
  async bulkUpdateLines(
    updates: Array<{ id: string; data: UpdatePayAppLineData }>
  ) {
    const results = [];
    for (const { id, data } of updates) {
      const result = await this.updateLine(id, data);
      if (result) {
        results.push(result);
      }
    }
    return results;
  }

  // ========== Approval History Methods ==========

  /**
   * Record approval history
   */
  async recordApprovalHistory(
    payApplicationId: string,
    organizationId: string,
    data: PayAppWorkflowData
  ) {
    const actionMap: Record<PayAppStatus, string> = {
      [PAY_APP_STATUS.DRAFT]: 'CREATED',
      [PAY_APP_STATUS.SUBMITTED]: 'SUBMITTED',
      [PAY_APP_STATUS.APPROVED]: 'APPROVED',
      [PAY_APP_STATUS.CERTIFIED]: 'CERTIFIED',
      [PAY_APP_STATUS.BILLED]: 'BILLED',
      [PAY_APP_STATUS.PAID]: 'PAID',
      [PAY_APP_STATUS.REJECTED]: 'REJECTED',
      [PAY_APP_STATUS.VOIDED]: 'VOIDED',
    };

    await this.db.insert(payAppApprovalHistory).values({
      payApplicationId,
      action: actionMap[data.status] || data.status,
      performedBy: data.userId,
      performedAt: new Date(),
      fromStatus: 'UNKNOWN', // Could be enhanced to track previous status
      toStatus: data.status,
      comments: data.notes,
      metadata: {
        approvedAmount: data.approvedAmount,
        certificationNumber: data.certificationNumber,
        invoiceNumber: data.invoiceNumber,
        paidAmount: data.paidAmount,
        reason: data.reason,
      },
    });
  }

  /**
   * Get approval history for a pay application
   */
  async getApprovalHistory(payApplicationId: string) {
    const results = await this.db
      .select()
      .from(payAppApprovalHistory)
      .where(eq(payAppApprovalHistory.payApplicationId, payApplicationId))
      .orderBy(desc(payAppApprovalHistory.performedAt));

    return results;
  }

  // ========== Retainage Release Methods ==========

  /**
   * Find a retainage release by ID
   */
  async findRetainageReleaseById(id: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(retainageReleases)
      .where(
        and(
          eq(retainageReleases.id, id),
          eq(retainageReleases.organizationId, organizationId)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * Find all retainage releases for a project
   */
  async findRetainageReleasesByProject(projectId: string, organizationId: string) {
    const results = await this.db
      .select()
      .from(retainageReleases)
      .where(
        and(
          eq(retainageReleases.projectId, projectId),
          eq(retainageReleases.organizationId, organizationId)
        )
      )
      .orderBy(desc(retainageReleases.releaseDate));

    return results;
  }

  /**
   * Get the next release number for a project
   */
  async getNextReleaseNumber(projectId: string, organizationId: string): Promise<number> {
    const [result] = await this.db
      .select({ maxNum: sql`MAX(${retainageReleases.releaseNumber})` })
      .from(retainageReleases)
      .where(
        and(
          eq(retainageReleases.projectId, projectId),
          eq(retainageReleases.organizationId, organizationId)
        )
      );

    return (Number(result?.maxNum) || 0) + 1;
  }

  /**
   * Create a retainage release
   */
  async createRetainageRelease(data: CreateRetainageReleaseData) {
    const [result] = await this.db
      .insert(retainageReleases)
      .values({
        ...data,
        releaseNumber: data.releaseNumber || 1,
        status: 'PENDING',
        totalRetainageHeld: '0',
        retainageRemaining: '0',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return result;
  }

  /**
   * Update retainage release status
   */
  async updateRetainageReleaseStatus(
    id: string,
    organizationId: string,
    status: string,
    userId?: string,
    additionalData?: { approvedAmount?: string; paidDate?: string; paidAmount?: string }
  ) {
    const now = new Date();

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: now,
    };

    if (status === 'APPROVED') {
      updateData.approvalDate = now;
      updateData.approvedBy = userId;
      if (additionalData?.approvedAmount) {
        updateData.approvedAmount = additionalData.approvedAmount;
      }
    }

    if (status === 'PAID') {
      updateData.paidDate = additionalData?.paidDate || now;
      if (additionalData?.paidAmount) {
        updateData.paidAmount = additionalData.paidAmount;
      }
    }

    const [result] = await this.db
      .update(retainageReleases)
      .set(updateData)
      .where(
        and(
          eq(retainageReleases.id, id),
          eq(retainageReleases.organizationId, organizationId)
        )
      )
      .returning();

    return result || null;
  }

  // ========== Summary Methods ==========

  /**
   * Recalculate pay application totals from lines
   */
  async recalculateTotals(id: string) {
    const lines = await this.findLinesByPayApp(id);

    let totalThisWorkCompleted = 0;
    let totalThisMaterialsStored = 0;
    let totalCompletedAndStored = 0;
    let totalRetainage = 0;

    for (const line of lines) {
      totalThisWorkCompleted += parseFloat(line.thisWorkCompleted);
      totalThisMaterialsStored += parseFloat(line.thisMaterialsStored);
      totalCompletedAndStored += parseFloat(line.totalCompletedAndStored);
      totalRetainage += parseFloat(line.retainageAmount);
    }

    // Get SOV for contract sum info
    const [payApp] = await this.db
      .select()
      .from(payApplications)
      .where(eq(payApplications.id, id))
      .limit(1);

    if (payApp) {
      const [sov] = await this.db
        .select()
        .from(projectScheduleOfValues)
        .where(eq(projectScheduleOfValues.id, payApp.scheduleOfValuesId))
        .limit(1);

      if (sov) {
        const contractSumToDate = parseFloat(sov.revisedContractAmount);
        const balanceToFinish = contractSumToDate - totalCompletedAndStored;
        const totalEarnedLessRetainage = totalCompletedAndStored - totalRetainage;

        await this.db
          .update(payApplications)
          .set({
            originalContractSum: sov.originalContractAmount,
            netChangeByChangeOrders: sov.approvedChangeOrders,
            contractSumToDate: sov.revisedContractAmount,
            totalCompletedAndStoredToDate: totalCompletedAndStored.toString(),
            totalRetainage: totalRetainage.toString(),
            totalEarnedLessRetainage: totalEarnedLessRetainage.toString(),
            balanceToFinish: balanceToFinish.toString(),
            currentPaymentDue: totalEarnedLessRetainage.toString(), // Will be adjusted for previous certificates
            updatedAt: new Date(),
          })
          .where(eq(payApplications.id, id));
      }
    }
  }

  /**
   * Calculate previous billing totals for a new pay application
   */
  async calculatePreviousBillingTotals(scheduleOfValuesId: string, excludePayAppId?: string) {
    const whereConditions = [
      eq(payApplications.scheduleOfValuesId, scheduleOfValuesId),
      inArray(payApplications.status, [
        PAY_APP_STATUS.APPROVED,
        PAY_APP_STATUS.CERTIFIED,
        PAY_APP_STATUS.BILLED,
        PAY_APP_STATUS.PAID,
      ]),
    ];

    if (excludePayAppId) {
      whereConditions.push(ne(payApplications.id, excludePayAppId));
    }

    const [result] = await this.db
      .select({
        totalPreviousCertificates: sql`COALESCE(SUM(CAST(${payApplications.currentPaymentDue} AS DECIMAL)), 0)`,
        totalPreviousRetainage: sql`COALESCE(SUM(CAST(${payApplications.totalRetainage} AS DECIMAL)), 0)`,
      })
      .from(payApplications)
      .where(and(...whereConditions));

    return {
      totalPreviousCertificates: result?.totalPreviousCertificates?.toString() || '0',
      totalPreviousRetainage: result?.totalPreviousRetainage?.toString() || '0',
    };
  }

  /**
   * Initialize pay app lines from SOV
   */
  async initializeLinesFromSov(payApplicationId: string, scheduleOfValuesId: string) {
    // Get all SOV lines
    const sovLines = await this.db
      .select()
      .from(scheduleOfValueLines)
      .where(eq(scheduleOfValueLines.scheduleOfValuesId, scheduleOfValuesId))
      .orderBy(asc(scheduleOfValueLines.lineNumber));

    // Create pay app lines for each SOV line
    const linesToCreate = sovLines.map((sovLine, index) => ({
      payApplicationId,
      sovLineId: sovLine.id,
      lineNumber: index + 1,
      itemNumber: sovLine.itemNumber,
      description: sovLine.description,
      scheduledValue: sovLine.revisedScheduledValue,
      thisWorkCompleted: '0',
      thisMaterialsStored: '0',
      previousWorkCompleted: sovLine.currentWorkCompleted,
      previousMaterialsStored: sovLine.currentMaterialsStored,
      totalCompletedAndStored: sovLine.totalCompletedAndStored,
      percentComplete: sovLine.percentComplete,
      balanceToFinish: sovLine.balanceToFinish,
      retainagePercent: sovLine.retainagePercent || '10',
      retainageAmount: '0',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    if (linesToCreate.length > 0) {
      await this.db.insert(payApplicationLines).values(linesToCreate);
    }

    return linesToCreate.length;
  }
}
