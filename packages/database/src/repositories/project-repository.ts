import { and, asc, desc, eq, gte, ilike, lte, or, sql, inArray } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  projects,
  projectParticipants,
  projectAddresses,
  PROJECT_STATUS,
} from '../db/schema/projects';
import { entities } from '../db/schema/entities';

export interface ProjectPaginationParams {
  page?: number;
  limit?: number;
  orderBy?: 'name' | 'projectCode' | 'startDate' | 'createdAt';
  orderDirection?: 'asc' | 'desc';
}

export interface ProjectFilters {
  status?: string | string[];
  subsidiaryId?: string;
  search?: string;
  startDateFrom?: string;
  startDateTo?: string;
  endDateFrom?: string;
  endDateTo?: string;
}

export interface CreateProjectData {
  organizationId: string;
  subsidiaryId?: string | null;
  projectCode: string;
  name: string;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  externalSource?: string | null;
  jobNumber?: string | null;
  projectType?: string | null;
  retainagePercent?: string | null;
  currencyCode?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateProjectData extends Omit<CreateProjectData, 'organizationId' | 'projectCode'> {
  projectCode?: string;
}

export interface ParticipantData {
  entityId?: string | null;
  participantRole: string;
  isPrimary?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface AddressData {
  addressType: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class ProjectAccessError extends Error {
  constructor() {
    super('PROJECT_ACCESS_DENIED');
    this.name = 'ProjectAccessError';
  }
}

export class ProjectRepository extends BaseRepository {
  async getAccessibleProjectIds(organizationId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.organizationId, organizationId));

    return rows.map((row) => row.id);
  }

  async existsByCode(organizationId: string, projectCode: string, excludeId?: string): Promise<boolean> {
    const where = excludeId
      ? and(
          eq(projects.organizationId, organizationId),
          eq(projects.projectCode, projectCode),
          sql`${projects.id} != ${excludeId}`
        )
      : and(eq(projects.organizationId, organizationId), eq(projects.projectCode, projectCode));

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(where);

    return Number(result[0]?.count || 0) > 0;
  }

  async findAll(
    organizationId: string,
    params: ProjectPaginationParams = {},
    filters: ProjectFilters = {}
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const offset = (page - 1) * limit;

    const conditions = [eq(projects.organizationId, organizationId)];

    if (filters.subsidiaryId) {
      conditions.push(eq(projects.subsidiaryId, filters.subsidiaryId));
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(projects.status, filters.status));
      } else {
        conditions.push(eq(projects.status, filters.status));
      }
    }

    if (filters.search) {
      const pattern = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(projects.projectCode, pattern),
          ilike(projects.name, pattern),
          ilike(projects.description, pattern)
        )!
      );
    }

    if (filters.startDateFrom) {
      conditions.push(gte(projects.startDate, filters.startDateFrom));
    }

    if (filters.startDateTo) {
      conditions.push(lte(projects.startDate, filters.startDateTo));
    }

    if (filters.endDateFrom) {
      conditions.push(gte(projects.endDate, filters.endDateFrom));
    }

    if (filters.endDateTo) {
      conditions.push(lte(projects.endDate, filters.endDateTo));
    }

    const whereClause = and(...conditions);

    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(whereClause);

    const orderBy = params.orderBy || 'createdAt';
    const orderDirection = params.orderDirection || 'desc';

    let orderColumn;
    switch (orderBy) {
      case 'name':
        orderColumn = projects.name;
        break;
      case 'projectCode':
        orderColumn = projects.projectCode;
        break;
      case 'startDate':
        orderColumn = projects.startDate;
        break;
      default:
        orderColumn = projects.createdAt;
    }

    const orderFn = orderDirection === 'asc' ? asc : desc;

    const data = await this.db
      .select()
      .from(projects)
      .where(whereClause)
      .orderBy(orderFn(orderColumn))
      .limit(limit)
      .offset(offset);

    return {
      data,
      total: Number(countResult[0]?.count || 0),
      page,
      limit,
      totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limit),
    };
  }

  async findById(id: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
      .limit(1);

    return result || null;
  }

  async findByCode(organizationId: string, projectCode: string) {
    const [result] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.organizationId, organizationId), eq(projects.projectCode, projectCode)))
      .limit(1);

    return result || null;
  }

  async create(data: CreateProjectData) {
    const [result] = await this.db
      .insert(projects)
      .values({
        organizationId: data.organizationId,
        subsidiaryId: data.subsidiaryId ?? null,
        projectCode: data.projectCode,
        name: data.name,
        status: data.status ?? PROJECT_STATUS.PLANNING,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        externalSource: data.externalSource ?? null,
        jobNumber: data.jobNumber ?? null,
        projectType: data.projectType ?? null,
        retainagePercent: data.retainagePercent ?? '0',
        currencyCode: data.currencyCode ?? null,
        description: data.description ?? null,
        metadata: data.metadata ?? null,
      })
      .returning();

    return result;
  }

  async update(id: string, organizationId: string, data: UpdateProjectData) {
    const [result] = await this.db
      .update(projects)
      .set({
        subsidiaryId: data.subsidiaryId ?? null,
        projectCode: data.projectCode ?? undefined,
        name: data.name ?? undefined,
        status: data.status ?? undefined,
        startDate: data.startDate ?? undefined,
        endDate: data.endDate ?? undefined,
        externalSource: data.externalSource ?? undefined,
        jobNumber: data.jobNumber ?? undefined,
        projectType: data.projectType ?? undefined,
        retainagePercent: data.retainagePercent ?? undefined,
        currencyCode: data.currencyCode ?? undefined,
        description: data.description ?? undefined,
        metadata: data.metadata ?? undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
      .returning();

    return result || null;
  }

  async delete(id: string, organizationId: string) {
    const [deleted] = await this.db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
      .returning({ id: projects.id });

    return deleted ?? null;
  }

  async listParticipants(projectId: string, organizationId: string) {
    return this.db
      .select({
        ...projectParticipants,
        entityName: entities.displayName,
        entityType: entities.entityType,
        entityExternalId: entities.externalId,
      })
      .from(projectParticipants)
      .innerJoin(projects, and(eq(projects.id, projectParticipants.projectId), eq(projects.organizationId, organizationId)))
      .leftJoin(entities, eq(projectParticipants.entityId, entities.id))
      .where(eq(projectParticipants.projectId, projectId));
  }

  async upsertParticipant(projectId: string, organizationId: string, data: ParticipantData) {
    await this.ensureProjectAccess(projectId, organizationId);

    const [result] = await this.db
      .insert(projectParticipants)
      .values({
        projectId,
        entityId: data.entityId ?? null,
        participantRole: data.participantRole,
        isPrimary: data.isPrimary ?? false,
        metadata: data.metadata ?? null,
      })
      .onConflictDoUpdate({
        target: [projectParticipants.projectId, projectParticipants.participantRole, projectParticipants.entityId],
        set: {
          isPrimary: data.isPrimary ?? false,
          metadata: data.metadata ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result;
  }

  async removeParticipant(participantId: string, organizationId: string) {
    const [removed] = await this.db
      .delete(projectParticipants)
      .using(projects)
      .where(
        and(
          eq(projectParticipants.id, participantId),
          eq(projectParticipants.projectId, projects.id),
          eq(projects.organizationId, organizationId)
        )
      )
      .returning({ id: projectParticipants.id });

    return removed ?? null;
  }

  async listAddresses(projectId: string, organizationId: string) {
    const rows = await this.db
      .select({ address: projectAddresses })
      .from(projectAddresses)
      .innerJoin(projects, and(eq(projects.id, projectAddresses.projectId), eq(projects.organizationId, organizationId)))
      .where(eq(projectAddresses.projectId, projectId));

    return rows.map((row) => row.address);
  }

  async upsertAddress(projectId: string, organizationId: string, data: AddressData) {
    await this.ensureProjectAccess(projectId, organizationId);

    const [result] = await this.db
      .insert(projectAddresses)
      .values({
        projectId,
        addressType: data.addressType,
        addressLine1: data.addressLine1 ?? null,
        addressLine2: data.addressLine2 ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        postalCode: data.postalCode ?? null,
        country: data.country ?? null,
        metadata: data.metadata ?? null,
      })
      .onConflictDoUpdate({
        target: [projectAddresses.projectId, projectAddresses.addressType],
        set: {
          addressLine1: data.addressLine1 ?? null,
          addressLine2: data.addressLine2 ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
          postalCode: data.postalCode ?? null,
          country: data.country ?? null,
          metadata: data.metadata ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result;
  }

  async deleteAddress(addressId: string, organizationId: string) {
    const [deleted] = await this.db
      .delete(projectAddresses)
      .using(projects)
      .where(
        and(
          eq(projectAddresses.id, addressId),
          eq(projectAddresses.projectId, projects.id),
          eq(projects.organizationId, organizationId)
        )
      )
      .returning({ id: projectAddresses.id });

    return deleted ?? null;
  }

  private async ensureProjectAccess(projectId: string, organizationId: string) {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)));

    if (Number(result[0]?.count || 0) === 0) {
      throw new ProjectAccessError();
    }
  }
}
