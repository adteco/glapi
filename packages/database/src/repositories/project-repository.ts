import { and, asc, desc, eq, ilike, inArray, sql, or } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { projects, projectParticipants } from '../db/schema/projects';

export interface ProjectPaginationParams {
  page?: number;
  limit?: number;
  orderBy?: 'name' | 'projectCode' | 'status' | 'startDate' | 'createdAt';
  orderDirection?: 'asc' | 'desc';
}

export interface ProjectFilters {
  subsidiaryId?: string;
  status?: string | string[];
  projectType?: string;
  search?: string;
  startDateFrom?: string;
  startDateTo?: string;
}

export interface CreateProjectData {
  organizationId: string;
  subsidiaryId?: string;
  projectCode: string;
  name: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  jobNumber?: string;
  projectType?: string;
  retainagePercent?: string;
  currencyCode?: string;
  description?: string;
  externalSource?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateProjectData {
  subsidiaryId?: string;
  projectCode?: string;
  name?: string;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  jobNumber?: string | null;
  projectType?: string | null;
  retainagePercent?: string;
  currencyCode?: string | null;
  description?: string | null;
  externalSource?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateParticipantData {
  projectId: string;
  entityId?: string;
  participantRole: string;
  isPrimary?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateParticipantData {
  entityId?: string;
  participantRole?: string;
  isPrimary?: boolean;
  metadata?: Record<string, unknown>;
}

export class ProjectRepository extends BaseRepository {
  /**
   * Find a project by ID with organization access check
   */
  async findById(id: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
      .limit(1);

    return result || null;
  }

  /**
   * Find a project by code within organization
   */
  async findByCode(projectCode: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.projectCode, projectCode), eq(projects.organizationId, organizationId)))
      .limit(1);

    return result || null;
  }

  /**
   * Find all projects with pagination and filtering
   */
  async findAll(
    organizationId: string,
    params: ProjectPaginationParams = {},
    filters: ProjectFilters = {}
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 50));
    const skip = (page - 1) * limit;

    const whereConditions = [eq(projects.organizationId, organizationId)];

    if (filters.subsidiaryId) {
      whereConditions.push(eq(projects.subsidiaryId, filters.subsidiaryId));
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        whereConditions.push(inArray(projects.status, filters.status));
      } else {
        whereConditions.push(eq(projects.status, filters.status));
      }
    }

    if (filters.projectType) {
      whereConditions.push(eq(projects.projectType, filters.projectType));
    }

    if (filters.search) {
      const term = `%${filters.search}%`;
      whereConditions.push(
        or(
          ilike(projects.name, term),
          ilike(projects.projectCode, term),
          ilike(projects.description, term),
          ilike(projects.jobNumber, term)
        )!
      );
    }

    if (filters.startDateFrom) {
      whereConditions.push(sql`${projects.startDate} >= ${filters.startDateFrom}`);
    }

    if (filters.startDateTo) {
      whereConditions.push(sql`${projects.startDate} <= ${filters.startDateTo}`);
    }

    const whereClause = and(...whereConditions);

    const countResult = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(projects)
      .where(whereClause);

    const count = Number(countResult[0]?.count || 0);

    const orderBy = params.orderBy || 'name';
    const orderDirection = params.orderDirection || 'asc';

    let orderColumn;
    switch (orderBy) {
      case 'projectCode':
        orderColumn = projects.projectCode;
        break;
      case 'status':
        orderColumn = projects.status;
        break;
      case 'startDate':
        orderColumn = projects.startDate;
        break;
      case 'createdAt':
        orderColumn = projects.createdAt;
        break;
      default:
        orderColumn = projects.name;
    }

    const orderFunc = orderDirection === 'asc' ? asc : desc;

    const results = await this.db
      .select()
      .from(projects)
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
   * Create a new project
   */
  async create(data: CreateProjectData) {
    const [result] = await this.db
      .insert(projects)
      .values({
        ...data,
        status: data.status || 'planning',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return result;
  }

  /**
   * Update a project
   */
  async update(id: string, organizationId: string, data: UpdateProjectData) {
    const [result] = await this.db
      .update(projects)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
      .returning();

    return result || null;
  }

  /**
   * Delete a project
   */
  async delete(id: string, organizationId: string) {
    await this.db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)));
  }

  /**
   * Check if project code exists in organization
   */
  async existsByCode(projectCode: string, organizationId: string, excludeId?: string) {
    const conditions = [
      eq(projects.projectCode, projectCode),
      eq(projects.organizationId, organizationId),
    ];

    if (excludeId) {
      conditions.push(sql`${projects.id} != ${excludeId}`);
    }

    const [result] = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(projects)
      .where(and(...conditions));

    return Number(result?.count || 0) > 0;
  }

  // ========== Participant Methods ==========

  /**
   * Find participants for a project
   */
  async findParticipants(projectId: string) {
    const results = await this.db
      .select()
      .from(projectParticipants)
      .where(eq(projectParticipants.projectId, projectId))
      .orderBy(desc(projectParticipants.isPrimary), asc(projectParticipants.participantRole));

    return results;
  }

  /**
   * Find a participant by ID
   */
  async findParticipantById(id: string) {
    const [result] = await this.db
      .select()
      .from(projectParticipants)
      .where(eq(projectParticipants.id, id))
      .limit(1);

    return result || null;
  }

  /**
   * Add a participant to a project
   */
  async createParticipant(data: CreateParticipantData) {
    const [result] = await this.db
      .insert(projectParticipants)
      .values({
        ...data,
        isPrimary: data.isPrimary ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return result;
  }

  /**
   * Update a participant
   */
  async updateParticipant(id: string, data: UpdateParticipantData) {
    const [result] = await this.db
      .update(projectParticipants)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(projectParticipants.id, id))
      .returning();

    return result || null;
  }

  /**
   * Remove a participant
   */
  async deleteParticipant(id: string) {
    await this.db.delete(projectParticipants).where(eq(projectParticipants.id, id));
  }

  /**
   * Check if participant exists (by role and entity)
   */
  async participantExists(projectId: string, participantRole: string, entityId?: string) {
    const conditions = [
      eq(projectParticipants.projectId, projectId),
      eq(projectParticipants.participantRole, participantRole),
    ];

    if (entityId) {
      conditions.push(eq(projectParticipants.entityId, entityId));
    }

    const [result] = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(projectParticipants)
      .where(and(...conditions));

    return Number(result?.count || 0) > 0;
  }
}
