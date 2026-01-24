import { and, asc, desc, eq, gte, lte, sql, inArray, isNull, or, like } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  projectCostCodes,
  projects,
  COST_CODE_TYPE,
  type CostCodeType,
} from '../db/schema/projects';
import { subsidiaries } from '../db/schema/subsidiaries';

export interface CostCodePaginationParams {
  page?: number;
  limit?: number;
  orderBy?: 'costCode' | 'name' | 'sortOrder' | 'createdAt';
  orderDirection?: 'asc' | 'desc';
}

export interface CostCodeFilters {
  projectId?: string;
  costType?: CostCodeType | CostCodeType[];
  isActive?: boolean;
  isBillable?: boolean;
  parentCostCodeId?: string | null; // null for root codes
  search?: string;
}

export interface CreateCostCodeData {
  projectId: string;
  parentCostCodeId?: string;
  activityCodeId?: string;
  costCode: string;
  costType: CostCodeType;
  name: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
  isBillable?: boolean;
  revenueAccountId?: string;
  costAccountId?: string;
  wipAccountId?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface UpdateCostCodeData {
  costCode?: string;
  costType?: CostCodeType;
  name?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
  isBillable?: boolean;
  parentCostCodeId?: string | null;
  activityCodeId?: string | null;
  revenueAccountId?: string | null;
  costAccountId?: string | null;
  wipAccountId?: string | null;
  budgetAmount?: string;
  committedAmount?: string;
  actualAmount?: string;
  metadata?: Record<string, unknown>;
}

export class ProjectCostCodeRepository extends BaseRepository {
  /**
   * Get accessible project IDs based on organization's subsidiaries
   */
  async getAccessibleProjectIds(organizationId: string): Promise<string[]> {
    const results = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.organizationId, organizationId));

    return results.map((r) => r.id);
  }

  /**
   * Find a cost code by ID with access check
   */
  async findById(id: string, projectIds: string[]) {
    const [result] = await this.db
      .select()
      .from(projectCostCodes)
      .where(
        and(
          eq(projectCostCodes.id, id),
          inArray(projectCostCodes.projectId, projectIds)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * Find all cost codes for accessible projects with pagination and filtering
   */
  async findAll(
    projectIds: string[],
    params: CostCodePaginationParams = {},
    filters: CostCodeFilters = {}
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 50));
    const skip = (page - 1) * limit;

    // Build where conditions
    const whereConditions = [inArray(projectCostCodes.projectId, projectIds)];

    if (filters.projectId) {
      whereConditions.push(eq(projectCostCodes.projectId, filters.projectId));
    }

    if (filters.costType) {
      if (Array.isArray(filters.costType)) {
        whereConditions.push(inArray(projectCostCodes.costType, filters.costType));
      } else {
        whereConditions.push(eq(projectCostCodes.costType, filters.costType));
      }
    }

    if (filters.isActive !== undefined) {
      whereConditions.push(eq(projectCostCodes.isActive, filters.isActive));
    }

    if (filters.isBillable !== undefined) {
      whereConditions.push(eq(projectCostCodes.isBillable, filters.isBillable));
    }

    if (filters.parentCostCodeId === null) {
      whereConditions.push(isNull(projectCostCodes.parentCostCodeId));
    } else if (filters.parentCostCodeId) {
      whereConditions.push(eq(projectCostCodes.parentCostCodeId, filters.parentCostCodeId));
    }

    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      whereConditions.push(
        or(
          like(projectCostCodes.costCode, searchPattern),
          like(projectCostCodes.name, searchPattern),
          like(projectCostCodes.description, searchPattern)
        )!
      );
    }

    const whereClause = and(...whereConditions);

    // Get total count
    const countResult = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(projectCostCodes)
      .where(whereClause);

    const count = Number(countResult[0]?.count || 0);

    // Determine ordering
    const orderBy = params.orderBy || 'sortOrder';
    const orderDirection = params.orderDirection || 'asc';

    let orderColumn;
    switch (orderBy) {
      case 'costCode':
        orderColumn = projectCostCodes.costCode;
        break;
      case 'name':
        orderColumn = projectCostCodes.name;
        break;
      case 'createdAt':
        orderColumn = projectCostCodes.createdAt;
        break;
      default:
        orderColumn = projectCostCodes.sortOrder;
    }

    const orderFunc = orderDirection === 'asc' ? asc : desc;

    // Get paginated results
    const results = await this.db
      .select()
      .from(projectCostCodes)
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
   * Find cost codes by project as a hierarchical tree
   */
  async findTreeByProject(projectId: string, projectIds: string[]) {
    if (!projectIds.includes(projectId)) {
      return [];
    }

    const results = await this.db
      .select()
      .from(projectCostCodes)
      .where(
        and(
          eq(projectCostCodes.projectId, projectId),
          eq(projectCostCodes.isActive, true)
        )
      )
      .orderBy(asc(projectCostCodes.sortOrder), asc(projectCostCodes.costCode));

    return results;
  }

  /**
   * Find children of a cost code
   */
  async findChildren(parentId: string, projectIds: string[]) {
    const results = await this.db
      .select()
      .from(projectCostCodes)
      .where(
        and(
          eq(projectCostCodes.parentCostCodeId, parentId),
          inArray(projectCostCodes.projectId, projectIds)
        )
      )
      .orderBy(asc(projectCostCodes.sortOrder), asc(projectCostCodes.costCode));

    return results;
  }

  /**
   * Create a new cost code
   */
  async create(data: CreateCostCodeData) {
    const [result] = await this.db
      .insert(projectCostCodes)
      .values({
        ...data,
        isActive: data.isActive ?? true,
        isBillable: data.isBillable ?? true,
        sortOrder: data.sortOrder ?? 0,
        budgetAmount: '0',
        committedAmount: '0',
        actualAmount: '0',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return result;
  }

  /**
   * Update a cost code
   */
  async update(id: string, projectIds: string[], data: UpdateCostCodeData) {
    const [result] = await this.db
      .update(projectCostCodes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectCostCodes.id, id),
          inArray(projectCostCodes.projectId, projectIds)
        )
      )
      .returning();

    return result || null;
  }

  /**
   * Delete a cost code (soft delete by setting isActive = false)
   */
  async softDelete(id: string, projectIds: string[]) {
    const [result] = await this.db
      .update(projectCostCodes)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectCostCodes.id, id),
          inArray(projectCostCodes.projectId, projectIds)
        )
      )
      .returning();

    return result || null;
  }

  /**
   * Hard delete a cost code (only if no budget lines reference it)
   */
  async delete(id: string, projectIds: string[]) {
    await this.db
      .delete(projectCostCodes)
      .where(
        and(
          eq(projectCostCodes.id, id),
          inArray(projectCostCodes.projectId, projectIds)
        )
      );
  }

  /**
   * Check if a cost code exists for project
   */
  async existsByCode(projectId: string, costCode: string, excludeId?: string) {
    const whereConditions = [
      eq(projectCostCodes.projectId, projectId),
      eq(projectCostCodes.costCode, costCode),
    ];

    if (excludeId) {
      whereConditions.push(sql`${projectCostCodes.id} != ${excludeId}`);
    }

    const [result] = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(projectCostCodes)
      .where(and(...whereConditions));

    return Number(result?.count || 0) > 0;
  }

  /**
   * Update amounts for a cost code (called when transactions are posted)
   * Requires projectIds for organization access validation
   */
  async updateAmounts(
    id: string,
    projectIds: string[],
    amounts: {
      budgetAmount?: string;
      committedAmount?: string;
      actualAmount?: string;
    }
  ) {
    const [result] = await this.db
      .update(projectCostCodes)
      .set({
        ...amounts,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectCostCodes.id, id),
          inArray(projectCostCodes.projectId, projectIds)
        )
      )
      .returning();

    return result || null;
  }

  /**
   * Bulk create cost codes with organization access validation
   * Only creates cost codes for projects that exist in the provided projectIds
   */
  async bulkCreate(codes: CreateCostCodeData[], projectIds: string[]) {
    // Filter out any codes for projects not in the accessible list
    const validCodes = codes.filter((c) => projectIds.includes(c.projectId));

    if (validCodes.length === 0) {
      return [];
    }

    const codesToCreate = validCodes.map((c) => ({
      ...c,
      isActive: c.isActive ?? true,
      isBillable: c.isBillable ?? true,
      sortOrder: c.sortOrder ?? 0,
      budgetAmount: '0',
      committedAmount: '0',
      actualAmount: '0',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const results = await this.db
      .insert(projectCostCodes)
      .values(codesToCreate)
      .returning();

    return results;
  }

  /**
   * Get cost code types summary for a project
   */
  async getCostTypeSummary(projectId: string) {
    const results = await this.db
      .select({
        costType: projectCostCodes.costType,
        count: sql`COUNT(*)`,
        totalBudget: sql`SUM(${projectCostCodes.budgetAmount})`,
        totalCommitted: sql`SUM(${projectCostCodes.committedAmount})`,
        totalActual: sql`SUM(${projectCostCodes.actualAmount})`,
      })
      .from(projectCostCodes)
      .where(
        and(
          eq(projectCostCodes.projectId, projectId),
          eq(projectCostCodes.isActive, true)
        )
      )
      .groupBy(projectCostCodes.costType);

    return results;
  }
}
