import { and, asc, desc, eq, gte, lte, sql, inArray, ne } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  projectBudgetVersions,
  projectBudgetLines,
  projectCostCodes,
  projects,
  BUDGET_VERSION_STATUS,
  type BudgetVersionStatus,
} from '../db/schema/projects';

export interface BudgetVersionPaginationParams {
  page?: number;
  limit?: number;
  orderBy?: 'versionNumber' | 'versionName' | 'status' | 'createdAt' | 'effectiveDate';
  orderDirection?: 'asc' | 'desc';
}

export interface BudgetVersionFilters {
  projectId?: string;
  status?: BudgetVersionStatus | BudgetVersionStatus[];
  isCurrent?: boolean;
}

export interface CreateBudgetVersionData {
  projectId: string;
  versionNumber: number;
  versionName: string;
  description?: string;
  effectiveDate?: string;
  notes?: string;
  createdBy?: string;
  importSource?: string;
  importFileName?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateBudgetVersionData {
  versionName?: string;
  description?: string;
  effectiveDate?: string;
  expirationDate?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateBudgetVersionStatusData {
  status: BudgetVersionStatus;
  userId: string;
}

export interface CreateBudgetLineData {
  budgetVersionId: string;
  projectCostCodeId: string;
  lineNumber: number;
  description?: string;
  originalBudgetAmount: string;
  revisedBudgetAmount?: string;
  budgetUnits?: string;
  unitOfMeasure?: string;
  unitRate?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateBudgetLineData {
  description?: string;
  originalBudgetAmount?: string;
  revisedBudgetAmount?: string;
  approvedChanges?: string;
  pendingChanges?: string;
  forecastAmount?: string;
  estimateToComplete?: string;
  budgetUnits?: string;
  actualUnits?: string;
  unitOfMeasure?: string;
  unitRate?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export class ProjectBudgetRepository extends BaseRepository {
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

  // ========== Budget Version Methods ==========

  /**
   * Find a budget version by ID with access check
   */
  async findVersionById(id: string, projectIds: string[]) {
    const [result] = await this.db
      .select()
      .from(projectBudgetVersions)
      .where(
        and(
          eq(projectBudgetVersions.id, id),
          inArray(projectBudgetVersions.projectId, projectIds)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * Find all budget versions with pagination and filtering
   */
  async findAllVersions(
    projectIds: string[],
    params: BudgetVersionPaginationParams = {},
    filters: BudgetVersionFilters = {}
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;

    const whereConditions = [inArray(projectBudgetVersions.projectId, projectIds)];

    if (filters.projectId) {
      whereConditions.push(eq(projectBudgetVersions.projectId, filters.projectId));
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        whereConditions.push(inArray(projectBudgetVersions.status, filters.status));
      } else {
        whereConditions.push(eq(projectBudgetVersions.status, filters.status));
      }
    }

    if (filters.isCurrent !== undefined) {
      whereConditions.push(eq(projectBudgetVersions.isCurrent, filters.isCurrent));
    }

    const whereClause = and(...whereConditions);

    const countResult = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(projectBudgetVersions)
      .where(whereClause);

    const count = Number(countResult[0]?.count || 0);

    const orderBy = params.orderBy || 'versionNumber';
    const orderDirection = params.orderDirection || 'desc';

    let orderColumn;
    switch (orderBy) {
      case 'versionName':
        orderColumn = projectBudgetVersions.versionName;
        break;
      case 'status':
        orderColumn = projectBudgetVersions.status;
        break;
      case 'effectiveDate':
        orderColumn = projectBudgetVersions.effectiveDate;
        break;
      case 'createdAt':
        orderColumn = projectBudgetVersions.createdAt;
        break;
      default:
        orderColumn = projectBudgetVersions.versionNumber;
    }

    const orderFunc = orderDirection === 'asc' ? asc : desc;

    const results = await this.db
      .select()
      .from(projectBudgetVersions)
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
   * Get the current budget version for a project
   */
  async getCurrentVersion(projectId: string, projectIds: string[]) {
    if (!projectIds.includes(projectId)) {
      return null;
    }

    const [result] = await this.db
      .select()
      .from(projectBudgetVersions)
      .where(
        and(
          eq(projectBudgetVersions.projectId, projectId),
          eq(projectBudgetVersions.isCurrent, true)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * Get the next version number for a project
   */
  async getNextVersionNumber(projectId: string): Promise<number> {
    const [result] = await this.db
      .select({ maxVersion: sql`MAX(${projectBudgetVersions.versionNumber})` })
      .from(projectBudgetVersions)
      .where(eq(projectBudgetVersions.projectId, projectId));

    return (Number(result?.maxVersion) || 0) + 1;
  }

  /**
   * Create a new budget version
   */
  async createVersion(data: CreateBudgetVersionData) {
    const [result] = await this.db
      .insert(projectBudgetVersions)
      .values({
        ...data,
        status: BUDGET_VERSION_STATUS.DRAFT,
        isCurrent: false,
        totalBudgetAmount: '0',
        totalLaborAmount: '0',
        totalMaterialAmount: '0',
        totalEquipmentAmount: '0',
        totalSubcontractAmount: '0',
        totalOtherAmount: '0',
        importDate: data.importSource ? new Date() : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return result;
  }

  /**
   * Update a budget version
   */
  async updateVersion(id: string, projectIds: string[], data: UpdateBudgetVersionData) {
    const [result] = await this.db
      .update(projectBudgetVersions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectBudgetVersions.id, id),
          inArray(projectBudgetVersions.projectId, projectIds)
        )
      )
      .returning();

    return result || null;
  }

  /**
   * Update budget version status with workflow tracking
   */
  async updateVersionStatus(id: string, projectIds: string[], data: UpdateBudgetVersionStatusData) {
    const now = new Date();

    const updateData: Record<string, unknown> = {
      status: data.status,
      updatedAt: now,
    };

    // Set workflow tracking fields based on status
    switch (data.status) {
      case BUDGET_VERSION_STATUS.SUBMITTED:
        updateData.submittedBy = data.userId;
        updateData.submittedDate = now;
        break;
      case BUDGET_VERSION_STATUS.APPROVED:
        updateData.approvedBy = data.userId;
        updateData.approvedDate = now;
        break;
      case BUDGET_VERSION_STATUS.LOCKED:
        updateData.lockedBy = data.userId;
        updateData.lockedDate = now;
        break;
    }

    const [result] = await this.db
      .update(projectBudgetVersions)
      .set(updateData)
      .where(
        and(
          eq(projectBudgetVersions.id, id),
          inArray(projectBudgetVersions.projectId, projectIds)
        )
      )
      .returning();

    return result || null;
  }

  /**
   * Set a budget version as the current one for a project
   */
  async setCurrentVersion(id: string, projectId: string, projectIds: string[]) {
    if (!projectIds.includes(projectId)) {
      return null;
    }

    // First, unset current flag on all other versions
    await this.db
      .update(projectBudgetVersions)
      .set({ isCurrent: false, updatedAt: new Date() })
      .where(
        and(
          eq(projectBudgetVersions.projectId, projectId),
          ne(projectBudgetVersions.id, id)
        )
      );

    // Then set current flag on the target version
    const [result] = await this.db
      .update(projectBudgetVersions)
      .set({ isCurrent: true, updatedAt: new Date() })
      .where(
        and(
          eq(projectBudgetVersions.id, id),
          eq(projectBudgetVersions.projectId, projectId)
        )
      )
      .returning();

    return result || null;
  }

  /**
   * Delete a budget version (only if DRAFT)
   */
  async deleteVersion(id: string, projectIds: string[]) {
    // First delete all budget lines
    await this.db
      .delete(projectBudgetLines)
      .where(eq(projectBudgetLines.budgetVersionId, id));

    // Then delete the version
    await this.db
      .delete(projectBudgetVersions)
      .where(
        and(
          eq(projectBudgetVersions.id, id),
          inArray(projectBudgetVersions.projectId, projectIds),
          eq(projectBudgetVersions.status, BUDGET_VERSION_STATUS.DRAFT)
        )
      );
  }

  /**
   * Copy a budget version to create a new draft
   */
  async copyVersion(sourceId: string, projectIds: string[], newVersionName: string, createdBy: string) {
    const source = await this.findVersionById(sourceId, projectIds);
    if (!source) {
      return null;
    }

    const nextVersionNumber = await this.getNextVersionNumber(source.projectId);

    // Create new version
    const newVersion = await this.createVersion({
      projectId: source.projectId,
      versionNumber: nextVersionNumber,
      versionName: newVersionName,
      description: `Copy of ${source.versionName}`,
      effectiveDate: source.effectiveDate || undefined,
      notes: source.notes || undefined,
      createdBy,
    });

    // Copy budget lines
    const sourceLines = await this.findLinesByVersion(sourceId);

    if (sourceLines.length > 0) {
      const linesToCreate = sourceLines.map((line) => ({
        budgetVersionId: newVersion.id,
        projectCostCodeId: line.projectCostCodeId,
        lineNumber: line.lineNumber,
        description: line.description,
        originalBudgetAmount: line.originalBudgetAmount,
        revisedBudgetAmount: line.originalBudgetAmount, // Reset revised to original
        approvedChanges: '0',
        pendingChanges: '0',
        committedAmount: '0',
        actualAmount: '0',
        encumberedAmount: '0',
        forecastAmount: line.forecastAmount,
        estimateToComplete: line.estimateToComplete,
        estimateAtCompletion: line.estimateAtCompletion,
        varianceAmount: '0',
        budgetUnits: line.budgetUnits,
        actualUnits: null,
        unitOfMeasure: line.unitOfMeasure,
        unitRate: line.unitRate,
        notes: line.notes,
        metadata: line.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await this.db.insert(projectBudgetLines).values(linesToCreate);
    }

    // Recalculate totals
    await this.recalculateVersionTotals(newVersion.id);

    return this.findVersionById(newVersion.id, projectIds);
  }

  // ========== Budget Line Methods ==========

  /**
   * Find a budget line by ID
   */
  async findLineById(id: string) {
    const [result] = await this.db
      .select()
      .from(projectBudgetLines)
      .where(eq(projectBudgetLines.id, id))
      .limit(1);

    return result || null;
  }

  /**
   * Find all budget lines for a version
   */
  async findLinesByVersion(budgetVersionId: string) {
    const results = await this.db
      .select()
      .from(projectBudgetLines)
      .where(eq(projectBudgetLines.budgetVersionId, budgetVersionId))
      .orderBy(asc(projectBudgetLines.lineNumber));

    return results;
  }

  /**
   * Find budget lines with cost code details
   */
  async findLinesWithCostCodes(budgetVersionId: string) {
    const results = await this.db
      .select({
        line: projectBudgetLines,
        costCode: projectCostCodes,
      })
      .from(projectBudgetLines)
      .innerJoin(projectCostCodes, eq(projectBudgetLines.projectCostCodeId, projectCostCodes.id))
      .where(eq(projectBudgetLines.budgetVersionId, budgetVersionId))
      .orderBy(asc(projectBudgetLines.lineNumber));

    return results;
  }

  /**
   * Create a budget line
   */
  async createLine(data: CreateBudgetLineData) {
    const [result] = await this.db
      .insert(projectBudgetLines)
      .values({
        ...data,
        revisedBudgetAmount: data.revisedBudgetAmount || data.originalBudgetAmount,
        approvedChanges: '0',
        pendingChanges: '0',
        committedAmount: '0',
        actualAmount: '0',
        encumberedAmount: '0',
        forecastAmount: '0',
        estimateToComplete: '0',
        estimateAtCompletion: '0',
        varianceAmount: '0',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return result;
  }

  /**
   * Update a budget line
   */
  async updateLine(id: string, data: UpdateBudgetLineData) {
    const [result] = await this.db
      .update(projectBudgetLines)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(projectBudgetLines.id, id))
      .returning();

    return result || null;
  }

  /**
   * Delete a budget line
   */
  async deleteLine(id: string) {
    await this.db.delete(projectBudgetLines).where(eq(projectBudgetLines.id, id));
  }

  /**
   * Bulk create budget lines
   */
  async bulkCreateLines(lines: CreateBudgetLineData[]) {
    const linesToCreate = lines.map((line) => ({
      ...line,
      revisedBudgetAmount: line.revisedBudgetAmount || line.originalBudgetAmount,
      approvedChanges: '0',
      pendingChanges: '0',
      committedAmount: '0',
      actualAmount: '0',
      encumberedAmount: '0',
      forecastAmount: '0',
      estimateToComplete: '0',
      estimateAtCompletion: '0',
      varianceAmount: '0',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const results = await this.db
      .insert(projectBudgetLines)
      .values(linesToCreate)
      .returning();

    return results;
  }

  /**
   * Update tracking amounts for a budget line (called when transactions are posted)
   */
  async updateLineAmounts(
    id: string,
    amounts: {
      committedAmount?: string;
      actualAmount?: string;
      encumberedAmount?: string;
    }
  ) {
    // Get current line to calculate variance
    const currentLine = await this.findLineById(id);
    if (!currentLine) {
      return null;
    }

    const revisedBudget = parseFloat(currentLine.revisedBudgetAmount);
    const actualAmount = amounts.actualAmount
      ? parseFloat(amounts.actualAmount)
      : parseFloat(currentLine.actualAmount);

    const varianceAmount = revisedBudget - actualAmount;
    const variancePercent = revisedBudget !== 0 ? (varianceAmount / revisedBudget) * 100 : 0;

    const [result] = await this.db
      .update(projectBudgetLines)
      .set({
        ...amounts,
        varianceAmount: varianceAmount.toString(),
        variancePercent: variancePercent.toFixed(4),
        updatedAt: new Date(),
      })
      .where(eq(projectBudgetLines.id, id))
      .returning();

    return result || null;
  }

  /**
   * Recalculate totals for a budget version
   */
  async recalculateVersionTotals(budgetVersionId: string) {
    // Get all lines with their cost code types
    const linesWithTypes = await this.db
      .select({
        costType: projectCostCodes.costType,
        originalBudgetAmount: projectBudgetLines.originalBudgetAmount,
      })
      .from(projectBudgetLines)
      .innerJoin(projectCostCodes, eq(projectBudgetLines.projectCostCodeId, projectCostCodes.id))
      .where(eq(projectBudgetLines.budgetVersionId, budgetVersionId));

    let totalBudget = 0;
    let totalLabor = 0;
    let totalMaterial = 0;
    let totalEquipment = 0;
    let totalSubcontract = 0;
    let totalOther = 0;

    for (const line of linesWithTypes) {
      const amount = parseFloat(line.originalBudgetAmount);
      totalBudget += amount;

      switch (line.costType) {
        case 'LABOR':
          totalLabor += amount;
          break;
        case 'MATERIAL':
          totalMaterial += amount;
          break;
        case 'EQUIPMENT':
          totalEquipment += amount;
          break;
        case 'SUBCONTRACT':
          totalSubcontract += amount;
          break;
        default:
          totalOther += amount;
      }
    }

    await this.db
      .update(projectBudgetVersions)
      .set({
        totalBudgetAmount: totalBudget.toString(),
        totalLaborAmount: totalLabor.toString(),
        totalMaterialAmount: totalMaterial.toString(),
        totalEquipmentAmount: totalEquipment.toString(),
        totalSubcontractAmount: totalSubcontract.toString(),
        totalOtherAmount: totalOther.toString(),
        updatedAt: new Date(),
      })
      .where(eq(projectBudgetVersions.id, budgetVersionId));
  }

  /**
   * Get budget variance summary for a version
   */
  async getVarianceSummary(budgetVersionId: string) {
    const results = await this.db
      .select({
        costType: projectCostCodes.costType,
        totalBudget: sql`SUM(${projectBudgetLines.revisedBudgetAmount})`,
        totalActual: sql`SUM(${projectBudgetLines.actualAmount})`,
        totalCommitted: sql`SUM(${projectBudgetLines.committedAmount})`,
        totalVariance: sql`SUM(${projectBudgetLines.varianceAmount})`,
      })
      .from(projectBudgetLines)
      .innerJoin(projectCostCodes, eq(projectBudgetLines.projectCostCodeId, projectCostCodes.id))
      .where(eq(projectBudgetLines.budgetVersionId, budgetVersionId))
      .groupBy(projectCostCodes.costType);

    return results;
  }
}
