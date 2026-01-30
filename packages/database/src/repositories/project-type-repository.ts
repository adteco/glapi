import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { projectTypes } from '../db/schema/project-types';

export interface ProjectTypePaginationParams {
  page?: number;
  limit?: number;
  sortField?: 'name' | 'code' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ProjectTypeFilters {
  subsidiaryId?: string;
  isActive?: boolean;
  search?: string;
}

export interface CreateProjectTypeData {
  organizationId: string;
  subsidiaryId?: string;
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateProjectTypeData {
  subsidiaryId?: string | null;
  code?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export class ProjectTypeRepository extends BaseRepository {
  /**
   * Find a project type by ID with organization access check
   */
  async findById(id: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(projectTypes)
      .where(and(eq(projectTypes.id, id), eq(projectTypes.organizationId, organizationId)))
      .limit(1);

    return result || null;
  }

  /**
   * Find a project type by code within organization
   */
  async findByCode(code: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(projectTypes)
      .where(and(eq(projectTypes.code, code), eq(projectTypes.organizationId, organizationId)))
      .limit(1);

    return result || null;
  }

  /**
   * Find all project types with pagination and filtering
   */
  async findAll(
    organizationId: string,
    params: ProjectTypePaginationParams = {},
    filters: ProjectTypeFilters = {}
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 50));
    const skip = (page - 1) * limit;

    const whereConditions = [eq(projectTypes.organizationId, organizationId)];

    if (filters.subsidiaryId) {
      whereConditions.push(eq(projectTypes.subsidiaryId, filters.subsidiaryId));
    }

    if (filters.isActive !== undefined) {
      whereConditions.push(eq(projectTypes.isActive, filters.isActive));
    }

    if (filters.search) {
      const term = `%${filters.search}%`;
      whereConditions.push(
        sql`(${ilike(projectTypes.name, term)} OR ${ilike(projectTypes.code, term)} OR ${ilike(projectTypes.description, term)})`
      );
    }

    const whereClause = and(...whereConditions);

    const countResult = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(projectTypes)
      .where(whereClause);

    const count = Number(countResult[0]?.count || 0);

    const sortField = params.sortField || 'name';
    const sortOrder = params.sortOrder || 'asc';

    let orderColumn;
    switch (sortField) {
      case 'code':
        orderColumn = projectTypes.code;
        break;
      case 'createdAt':
        orderColumn = projectTypes.createdAt;
        break;
      default:
        orderColumn = projectTypes.name;
    }

    const orderFunc = sortOrder === 'asc' ? asc : desc;

    const results = await this.db
      .select()
      .from(projectTypes)
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
   * Create a new project type
   */
  async create(data: CreateProjectTypeData) {
    const [result] = await this.db
      .insert(projectTypes)
      .values({
        ...data,
        isActive: data.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return result;
  }

  /**
   * Update a project type
   */
  async update(id: string, organizationId: string, data: UpdateProjectTypeData) {
    const [result] = await this.db
      .update(projectTypes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(projectTypes.id, id), eq(projectTypes.organizationId, organizationId)))
      .returning();

    return result || null;
  }

  /**
   * Delete a project type
   */
  async delete(id: string, organizationId: string) {
    const result = await this.db
      .delete(projectTypes)
      .where(and(eq(projectTypes.id, id), eq(projectTypes.organizationId, organizationId)))
      .returning();

    return result.length > 0;
  }

  /**
   * Check if project type code exists in organization
   */
  async existsByCode(code: string, organizationId: string, excludeId?: string) {
    const conditions = [
      eq(projectTypes.code, code),
      eq(projectTypes.organizationId, organizationId),
    ];

    if (excludeId) {
      conditions.push(sql`${projectTypes.id} != ${excludeId}`);
    }

    const [result] = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(projectTypes)
      .where(and(...conditions));

    return Number(result?.count || 0) > 0;
  }

  /**
   * Find project types by subsidiary
   */
  async findBySubsidiary(subsidiaryId: string, organizationId: string, activeOnly = true) {
    const conditions = [
      eq(projectTypes.organizationId, organizationId),
      eq(projectTypes.subsidiaryId, subsidiaryId),
    ];

    if (activeOnly) {
      conditions.push(eq(projectTypes.isActive, true));
    }

    const results = await this.db
      .select()
      .from(projectTypes)
      .where(and(...conditions))
      .orderBy(asc(projectTypes.name));

    return results;
  }
}
