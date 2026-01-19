import { and, asc, desc, eq, inArray, isNull, like, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { ProjectAccessError } from './project-repository';
import {
  projectTasks,
  projects,
  projectCostCodes,
} from '../db/schema/projects';

export interface TaskPaginationParams {
  page?: number;
  limit?: number;
  orderBy?: 'sortOrder' | 'startDate' | 'endDate' | 'createdAt';
  orderDirection?: 'asc' | 'desc';
}

export interface ProjectTaskFilters {
  status?: string | string[];
  parentTaskId?: string | null;
  assignedEntityId?: string;
  search?: string;
}

export interface CreateProjectTaskData {
  projectId: string;
  parentTaskId?: string | null;
  projectCostCodeId?: string | null;
  taskCode: string;
  name: string;
  description?: string | null;
  status?: string;
  priority?: string;
  startDate?: string | null;
  endDate?: string | null;
  durationDays?: number | null;
  percentComplete?: string | null;
  isMilestone?: boolean;
  sortOrder?: number;
  assignedEntityId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
}

export interface UpdateProjectTaskData extends Omit<CreateProjectTaskData, 'projectId' | 'taskCode'> {
  taskCode?: string;
}

export class ProjectTaskRepository extends BaseRepository {
  async getAccessibleProjectIds(organizationId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.organizationId, organizationId));

    return rows.map((row) => row.id);
  }

  async ensureProjectAccess(projectId: string, organizationId: string) {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)));

    if (Number(result[0]?.count || 0) === 0) {
      throw new ProjectAccessError();
    }
  }

  async existsByTaskCode(projectId: string, taskCode: string): Promise<boolean> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(projectTasks)
      .where(and(eq(projectTasks.projectId, projectId), eq(projectTasks.taskCode, taskCode)));

    return Number(result[0]?.count || 0) > 0;
  }

  async findById(id: string, projectIds: string[]) {
    const [row] = await this.db
      .select()
      .from(projectTasks)
      .where(and(eq(projectTasks.id, id), inArray(projectTasks.projectId, projectIds)))
      .limit(1);

    return row || null;
  }

  async findByProject(
    projectId: string,
    projectIds: string[],
    params: TaskPaginationParams = {},
    filters: ProjectTaskFilters = {}
  ) {
    if (!projectIds.includes(projectId)) {
      throw new ProjectAccessError();
    }

    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(200, params.limit || 50));
    const offset = (page - 1) * limit;

    const conditions = [eq(projectTasks.projectId, projectId)];

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(projectTasks.status, filters.status));
      } else {
        conditions.push(eq(projectTasks.status, filters.status));
      }
    }

    if (filters.parentTaskId === null) {
      conditions.push(isNull(projectTasks.parentTaskId));
    } else if (filters.parentTaskId) {
      conditions.push(eq(projectTasks.parentTaskId, filters.parentTaskId));
    }

    if (filters.assignedEntityId) {
      conditions.push(eq(projectTasks.assignedEntityId, filters.assignedEntityId));
    }

    if (filters.search) {
      const pattern = `%${filters.search}%`;
      conditions.push(
        or(
          like(projectTasks.taskCode, pattern),
          like(projectTasks.name, pattern),
          like(projectTasks.description, pattern)
        )!
      );
    }

    const whereClause = and(...conditions);

    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(projectTasks)
      .where(whereClause);

    const orderBy = params.orderBy || 'sortOrder';
    const orderDirection = params.orderDirection || 'asc';

    let orderColumn;
    switch (orderBy) {
      case 'startDate':
        orderColumn = projectTasks.startDate;
        break;
      case 'endDate':
        orderColumn = projectTasks.endDate;
        break;
      case 'createdAt':
        orderColumn = projectTasks.createdAt;
        break;
      default:
        orderColumn = projectTasks.sortOrder;
    }

    const orderFn = orderDirection === 'asc' ? asc : desc;

    const rows = await this.db
      .select()
      .from(projectTasks)
      .where(whereClause)
      .orderBy(orderFn(orderColumn))
      .limit(limit)
      .offset(offset);

    return {
      data: rows,
      total: Number(countResult[0]?.count || 0),
      page,
      limit,
      totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limit),
    };
  }

  async findAllForProject(projectId: string, projectIds: string[]) {
    if (!projectIds.includes(projectId)) {
      throw new ProjectAccessError();
    }

    return this.db
      .select()
      .from(projectTasks)
      .where(eq(projectTasks.projectId, projectId))
      .orderBy(asc(projectTasks.sortOrder));
  }

  async findChildren(taskId: string, projectIds: string[]) {
    return this.db
      .select()
      .from(projectTasks)
      .where(and(eq(projectTasks.parentTaskId, taskId), inArray(projectTasks.projectId, projectIds)))
      .orderBy(asc(projectTasks.sortOrder));
  }

  async create(data: CreateProjectTaskData) {
    const [inserted] = await this.db
      .insert(projectTasks)
      .values({
        projectId: data.projectId,
        parentTaskId: data.parentTaskId ?? null,
        projectCostCodeId: data.projectCostCodeId ?? null,
        taskCode: data.taskCode,
        name: data.name,
        description: data.description ?? null,
        status: data.status ?? 'NOT_STARTED',
        priority: data.priority ?? 'MEDIUM',
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        durationDays: data.durationDays ?? null,
        percentComplete: data.percentComplete ?? '0',
        isMilestone: data.isMilestone ?? false,
        sortOrder: data.sortOrder ?? 0,
        assignedEntityId: data.assignedEntityId ?? null,
        metadata: data.metadata ?? null,
        createdBy: data.createdBy ?? null,
      })
      .returning();

    return inserted;
  }

  async update(id: string, projectIds: string[], data: UpdateProjectTaskData) {
    const [updated] = await this.db
      .update(projectTasks)
      .set({
        parentTaskId: data.parentTaskId === undefined ? undefined : data.parentTaskId,
        projectCostCodeId: data.projectCostCodeId === undefined ? undefined : data.projectCostCodeId,
        taskCode: data.taskCode ?? undefined,
        name: data.name ?? undefined,
        description: data.description === undefined ? undefined : data.description,
        status: data.status ?? undefined,
        priority: data.priority ?? undefined,
        startDate: data.startDate === undefined ? undefined : data.startDate,
        endDate: data.endDate === undefined ? undefined : data.endDate,
        durationDays: data.durationDays === undefined ? undefined : data.durationDays,
        percentComplete: data.percentComplete ?? undefined,
        isMilestone: data.isMilestone ?? undefined,
        sortOrder: data.sortOrder ?? undefined,
        assignedEntityId: data.assignedEntityId === undefined ? undefined : data.assignedEntityId,
        metadata: data.metadata === undefined ? undefined : data.metadata,
        updatedAt: new Date(),
      })
      .where(and(eq(projectTasks.id, id), inArray(projectTasks.projectId, projectIds)))
      .returning();

    return updated || null;
  }

  async delete(id: string, projectIds: string[]) {
    const [removed] = await this.db
      .delete(projectTasks)
      .where(and(eq(projectTasks.id, id), inArray(projectTasks.projectId, projectIds)))
      .returning({ id: projectTasks.id });

    return removed ?? null;
  }
}
