/**
 * Project Task Repository
 *
 * Database operations for project tasks, milestones, templates, and project templates.
 *
 * @module project-task-repository
 */

import { db as globalDb } from '../index';
import type { ContextualDatabase } from '../context';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  projectMilestones,
  projectTaskTemplates,
  projectTasks,
  projectTemplates,
  projectTemplateTasks,
} from '../db/schema/project-tasks';
import { projects } from '../db/schema/projects';
import { organizations } from '../db/schema/organizations';
import { entities } from '../db/schema/entities';
import { activityCodes } from '../db/schema/activity-codes';
import { items } from '../db/schema/items';
import { eq, and, inArray, desc, asc, sql, or, like, lte, gte, isNull } from 'drizzle-orm';

// Types for repository operations
type CreateMilestoneData = typeof projectMilestones.$inferInsert;
type UpdateMilestoneData = Partial<Omit<CreateMilestoneData, 'id' | 'projectId' | 'organizationId' | 'createdAt'>>;

type CreateTaskTemplateData = typeof projectTaskTemplates.$inferInsert;
type UpdateTaskTemplateData = Partial<Omit<CreateTaskTemplateData, 'id' | 'organizationId' | 'createdAt'>>;

type CreateTaskData = typeof projectTasks.$inferInsert;
type UpdateTaskData = Partial<Omit<CreateTaskData, 'id' | 'projectId' | 'organizationId' | 'createdAt'>>;

type CreateProjectTemplateData = typeof projectTemplates.$inferInsert;
type UpdateProjectTemplateData = Partial<Omit<CreateProjectTemplateData, 'id' | 'organizationId' | 'createdAt'>>;

type CreateProjectTemplateTaskData = typeof projectTemplateTasks.$inferInsert;

export class ProjectTaskRepository {
  private db: NodePgDatabase<any>;

  constructor(db?: ContextualDatabase | NodePgDatabase<any>) {
    this.db = db ?? globalDb;
  }
  // ============================================================================
  // Project Milestones
  // ============================================================================

  async findAllMilestones(
    organizationId: string,
    options: {
      page?: number;
      limit?: number;
      orderBy?: 'sortOrder' | 'targetDate' | 'name' | 'createdAt';
      orderDirection?: 'asc' | 'desc';
    } = {},
    filters: {
      projectId?: string;
      status?: string | string[];
      isBillingMilestone?: boolean;
    } = {}
  ) {
    const { page = 1, limit = 50, orderBy = 'sortOrder', orderDirection = 'asc' } = options;
    const offset = (page - 1) * limit;

    const conditions = [eq(projectMilestones.organizationId, organizationId)];

    if (filters.projectId) {
      conditions.push(eq(projectMilestones.projectId, filters.projectId));
    }
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(projectMilestones.status, filters.status as any[]));
      } else {
        conditions.push(eq(projectMilestones.status, filters.status as any));
      }
    }
    if (filters.isBillingMilestone !== undefined) {
      conditions.push(eq(projectMilestones.isBillingMilestone, filters.isBillingMilestone));
    }

    const orderColumn = {
      sortOrder: projectMilestones.sortOrder,
      targetDate: projectMilestones.targetDate,
      name: projectMilestones.name,
      createdAt: projectMilestones.createdAt,
    }[orderBy];

    const orderFn = orderDirection === 'desc' ? desc : asc;

    const [milestones, countResult] = await Promise.all([
      this.db.select()
        .from(projectMilestones)
        .where(and(...conditions))
        .orderBy(orderFn(orderColumn))
        .limit(limit)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)` })
        .from(projectMilestones)
        .where(and(...conditions)),
    ]);

    return {
      data: milestones,
      total: Number(countResult[0]?.count ?? 0),
      page,
      limit,
      totalPages: Math.ceil(Number(countResult[0]?.count ?? 0) / limit),
    };
  }

  async findMilestoneById(id: string, organizationId: string) {
    const [milestone] = await this.db.select()
      .from(projectMilestones)
      .where(and(
        eq(projectMilestones.id, id),
        eq(projectMilestones.organizationId, organizationId)
      ))
      .limit(1);
    return milestone ?? null;
  }

  async findMilestonesByProject(projectId: string, organizationId: string) {
    return this.db.select()
      .from(projectMilestones)
      .where(and(
        eq(projectMilestones.projectId, projectId),
        eq(projectMilestones.organizationId, organizationId)
      ))
      .orderBy(asc(projectMilestones.sortOrder));
  }

  async createMilestone(data: CreateMilestoneData) {
    const [milestone] = await this.db.insert(projectMilestones).values(data).returning();
    return milestone;
  }

  async createMilestonesBulk(data: CreateMilestoneData[]) {
    if (data.length === 0) return [];
    return this.db.insert(projectMilestones).values(data).returning();
  }

  async updateMilestone(id: string, organizationId: string, data: UpdateMilestoneData) {
    const [milestone] = await this.db.update(projectMilestones)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(projectMilestones.id, id),
        eq(projectMilestones.organizationId, organizationId)
      ))
      .returning();
    return milestone ?? null;
  }

  async deleteMilestone(id: string, organizationId: string) {
    await this.db.delete(projectMilestones)
      .where(and(
        eq(projectMilestones.id, id),
        eq(projectMilestones.organizationId, organizationId)
      ));
  }

  // ============================================================================
  // Project Task Templates
  // ============================================================================

  async findAllTaskTemplates(
    organizationId: string,
    options: {
      page?: number;
      limit?: number;
      orderBy?: 'sortOrder' | 'templateCode' | 'templateName' | 'createdAt';
      orderDirection?: 'asc' | 'desc';
    } = {},
    filters: {
      category?: string;
      isActive?: boolean;
      subsidiaryId?: string;
      search?: string;
    } = {}
  ) {
    const { page = 1, limit = 50, orderBy = 'sortOrder', orderDirection = 'asc' } = options;
    const offset = (page - 1) * limit;

    const conditions = [eq(projectTaskTemplates.organizationId, organizationId)];

    if (filters.category) {
      conditions.push(eq(projectTaskTemplates.category, filters.category));
    }
    if (filters.isActive !== undefined) {
      conditions.push(eq(projectTaskTemplates.isActive, filters.isActive));
    }
    if (filters.subsidiaryId) {
      conditions.push(eq(projectTaskTemplates.subsidiaryId, filters.subsidiaryId));
    }
    if (filters.search) {
      conditions.push(
        or(
          like(projectTaskTemplates.templateName, `%${filters.search}%`),
          like(projectTaskTemplates.templateCode, `%${filters.search}%`)
        )!
      );
    }

    const orderColumn = {
      sortOrder: projectTaskTemplates.sortOrder,
      templateCode: projectTaskTemplates.templateCode,
      templateName: projectTaskTemplates.templateName,
      createdAt: projectTaskTemplates.createdAt,
    }[orderBy];

    const orderFn = orderDirection === 'desc' ? desc : asc;

    const [templates, countResult] = await Promise.all([
      this.db.select()
        .from(projectTaskTemplates)
        .where(and(...conditions))
        .orderBy(orderFn(orderColumn))
        .limit(limit)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)` })
        .from(projectTaskTemplates)
        .where(and(...conditions)),
    ]);

    return {
      data: templates,
      total: Number(countResult[0]?.count ?? 0),
      page,
      limit,
      totalPages: Math.ceil(Number(countResult[0]?.count ?? 0) / limit),
    };
  }

  async findTaskTemplateById(id: string, organizationId: string) {
    const [template] = await this.db.select()
      .from(projectTaskTemplates)
      .where(and(
        eq(projectTaskTemplates.id, id),
        eq(projectTaskTemplates.organizationId, organizationId)
      ))
      .limit(1);
    return template ?? null;
  }

  async findTaskTemplateByCode(templateCode: string, organizationId: string) {
    const [template] = await this.db.select()
      .from(projectTaskTemplates)
      .where(and(
        eq(projectTaskTemplates.templateCode, templateCode),
        eq(projectTaskTemplates.organizationId, organizationId)
      ))
      .limit(1);
    return template ?? null;
  }

  async createTaskTemplate(data: CreateTaskTemplateData) {
    const [template] = await this.db.insert(projectTaskTemplates).values(data).returning();
    return template;
  }

  async updateTaskTemplate(id: string, organizationId: string, data: UpdateTaskTemplateData) {
    const [template] = await this.db.update(projectTaskTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(projectTaskTemplates.id, id),
        eq(projectTaskTemplates.organizationId, organizationId)
      ))
      .returning();
    return template ?? null;
  }

  async deleteTaskTemplate(id: string, organizationId: string) {
    // Soft delete by setting isActive to false
    await this.db.update(projectTaskTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(projectTaskTemplates.id, id),
        eq(projectTaskTemplates.organizationId, organizationId)
      ));
  }

  // ============================================================================
  // Project Tasks
  // ============================================================================

  async findAllTasks(
    organizationId: string,
    options: {
      page?: number;
      limit?: number;
      orderBy?: 'sortOrder' | 'dueDate' | 'taskName' | 'createdAt' | 'priority';
      orderDirection?: 'asc' | 'desc';
    } = {},
    filters: {
      projectId?: string;
      milestoneId?: string;
      status?: string | string[];
      priority?: string | string[];
      assigneeId?: string;
      category?: string;
      isBillable?: boolean;
      dueBefore?: Date;
      dueAfter?: Date;
      search?: string;
    } = {}
  ) {
    const { page = 1, limit = 50, orderBy = 'sortOrder', orderDirection = 'asc' } = options;
    const offset = (page - 1) * limit;

    const conditions = [eq(projectTasks.organizationId, organizationId)];

    if (filters.projectId) {
      conditions.push(eq(projectTasks.projectId, filters.projectId));
    }
    if (filters.milestoneId) {
      conditions.push(eq(projectTasks.milestoneId, filters.milestoneId));
    }
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(projectTasks.status, filters.status as any[]));
      } else {
        conditions.push(eq(projectTasks.status, filters.status as any));
      }
    }
    if (filters.priority) {
      if (Array.isArray(filters.priority)) {
        conditions.push(inArray(projectTasks.priority, filters.priority as any[]));
      } else {
        conditions.push(eq(projectTasks.priority, filters.priority as any));
      }
    }
    if (filters.assigneeId) {
      conditions.push(eq(projectTasks.assigneeId, filters.assigneeId));
    }
    if (filters.category) {
      conditions.push(eq(projectTasks.category, filters.category));
    }
    if (filters.isBillable !== undefined) {
      conditions.push(eq(projectTasks.isBillable, filters.isBillable));
    }
    if (filters.dueBefore) {
      conditions.push(lte(projectTasks.dueDate, filters.dueBefore));
    }
    if (filters.dueAfter) {
      conditions.push(gte(projectTasks.dueDate, filters.dueAfter));
    }
    if (filters.search) {
      conditions.push(
        or(
          like(projectTasks.taskName, `%${filters.search}%`),
          like(projectTasks.taskCode, `%${filters.search}%`)
        )!
      );
    }

    const orderColumn = {
      sortOrder: projectTasks.sortOrder,
      dueDate: projectTasks.dueDate,
      taskName: projectTasks.taskName,
      createdAt: projectTasks.createdAt,
      priority: projectTasks.priority,
    }[orderBy];

    const orderFn = orderDirection === 'desc' ? desc : asc;

    const [tasks, countResult] = await Promise.all([
      this.db.select()
        .from(projectTasks)
        .where(and(...conditions))
        .orderBy(orderFn(orderColumn))
        .limit(limit)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)` })
        .from(projectTasks)
        .where(and(...conditions)),
    ]);

    return {
      data: tasks,
      total: Number(countResult[0]?.count ?? 0),
      page,
      limit,
      totalPages: Math.ceil(Number(countResult[0]?.count ?? 0) / limit),
    };
  }

  async findTaskById(id: string, organizationId: string) {
    const [task] = await this.db.select()
      .from(projectTasks)
      .where(and(
        eq(projectTasks.id, id),
        eq(projectTasks.organizationId, organizationId)
      ))
      .limit(1);
    return task ?? null;
  }

  async findTasksByProject(projectId: string, organizationId: string) {
    return this.db.select()
      .from(projectTasks)
      .where(and(
        eq(projectTasks.projectId, projectId),
        eq(projectTasks.organizationId, organizationId)
      ))
      .orderBy(asc(projectTasks.sortOrder));
  }

  async findTasksByMilestone(milestoneId: string) {
    return this.db.select()
      .from(projectTasks)
      .where(eq(projectTasks.milestoneId, milestoneId))
      .orderBy(asc(projectTasks.sortOrder));
  }

  async findTasksByAssignee(assigneeId: string, organizationId: string, filters: { status?: string | string[] } = {}) {
    const conditions = [
      eq(projectTasks.assigneeId, assigneeId),
      eq(projectTasks.organizationId, organizationId),
    ];

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(projectTasks.status, filters.status as any[]));
      } else {
        conditions.push(eq(projectTasks.status, filters.status as any));
      }
    }

    return this.db.select()
      .from(projectTasks)
      .where(and(...conditions))
      .orderBy(asc(projectTasks.dueDate));
  }

  async findChildTasks(parentTaskId: string) {
    return this.db.select()
      .from(projectTasks)
      .where(eq(projectTasks.parentTaskId, parentTaskId))
      .orderBy(asc(projectTasks.sortOrder));
  }

  async findOverdueTasks(organizationId: string) {
    const now = new Date();
    return this.db.select()
      .from(projectTasks)
      .where(and(
        eq(projectTasks.organizationId, organizationId),
        lte(projectTasks.dueDate, now),
        inArray(projectTasks.status, ['NOT_STARTED', 'IN_PROGRESS', 'PENDING_REVIEW', 'BLOCKED'])
      ))
      .orderBy(asc(projectTasks.dueDate));
  }

  async createTask(data: CreateTaskData) {
    const [task] = await this.db.insert(projectTasks).values(data).returning();
    return task;
  }

  async createTasksBulk(data: CreateTaskData[]) {
    if (data.length === 0) return [];
    return this.db.insert(projectTasks).values(data).returning();
  }

  async updateTask(id: string, organizationId: string, data: UpdateTaskData) {
    const [task] = await this.db.update(projectTasks)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(projectTasks.id, id),
        eq(projectTasks.organizationId, organizationId)
      ))
      .returning();
    return task ?? null;
  }

  async updateTaskStatus(id: string, organizationId: string, status: string, userId?: string) {
    const updates: any = { status, updatedAt: new Date() };

    // Set timestamps based on status
    if (status === 'IN_PROGRESS') {
      updates.startedAt = new Date();
    } else if (status === 'COMPLETED') {
      updates.completedAt = new Date();
    } else if (status === 'PENDING_REVIEW') {
      updates.completedAt = new Date();
    }

    const [task] = await this.db.update(projectTasks)
      .set(updates)
      .where(and(
        eq(projectTasks.id, id),
        eq(projectTasks.organizationId, organizationId)
      ))
      .returning();
    return task ?? null;
  }

  async deleteTask(id: string, organizationId: string) {
    await this.db.delete(projectTasks)
      .where(and(
        eq(projectTasks.id, id),
        eq(projectTasks.organizationId, organizationId)
      ));
  }

  async getTaskSummaryByProject(projectId: string, organizationId: string) {
    const result = await this.db.select({
      total: sql<number>`count(*)`,
      completed: sql<number>`sum(case when status = 'COMPLETED' then 1 else 0 end)`,
      inProgress: sql<number>`sum(case when status = 'IN_PROGRESS' then 1 else 0 end)`,
      blocked: sql<number>`sum(case when status = 'BLOCKED' then 1 else 0 end)`,
      notStarted: sql<number>`sum(case when status = 'NOT_STARTED' then 1 else 0 end)`,
      pendingReview: sql<number>`sum(case when status = 'PENDING_REVIEW' then 1 else 0 end)`,
      totalEstimatedHours: sql<number>`coalesce(sum(estimated_hours), 0)`,
      totalActualHours: sql<number>`coalesce(sum(actual_hours), 0)`,
    })
      .from(projectTasks)
      .where(and(
        eq(projectTasks.projectId, projectId),
        eq(projectTasks.organizationId, organizationId)
      ));

    return result[0] ?? null;
  }

  // ============================================================================
  // Project Templates
  // ============================================================================

  async findAllProjectTemplates(
    organizationId: string,
    options: {
      page?: number;
      limit?: number;
      orderBy?: 'sortOrder' | 'templateCode' | 'templateName' | 'createdAt';
      orderDirection?: 'asc' | 'desc';
    } = {},
    filters: {
      projectType?: string;
      isActive?: boolean;
      subsidiaryId?: string;
      search?: string;
    } = {}
  ) {
    const { page = 1, limit = 50, orderBy = 'sortOrder', orderDirection = 'asc' } = options;
    const offset = (page - 1) * limit;

    const conditions = [eq(projectTemplates.organizationId, organizationId)];

    if (filters.projectType) {
      conditions.push(eq(projectTemplates.projectType, filters.projectType));
    }
    if (filters.isActive !== undefined) {
      conditions.push(eq(projectTemplates.isActive, filters.isActive));
    }
    if (filters.subsidiaryId) {
      conditions.push(eq(projectTemplates.subsidiaryId, filters.subsidiaryId));
    }
    if (filters.search) {
      conditions.push(
        or(
          like(projectTemplates.templateName, `%${filters.search}%`),
          like(projectTemplates.templateCode, `%${filters.search}%`)
        )!
      );
    }

    const orderColumn = {
      sortOrder: projectTemplates.sortOrder,
      templateCode: projectTemplates.templateCode,
      templateName: projectTemplates.templateName,
      createdAt: projectTemplates.createdAt,
    }[orderBy];

    const orderFn = orderDirection === 'desc' ? desc : asc;

    const [templates, countResult] = await Promise.all([
      this.db.select()
        .from(projectTemplates)
        .where(and(...conditions))
        .orderBy(orderFn(orderColumn))
        .limit(limit)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)` })
        .from(projectTemplates)
        .where(and(...conditions)),
    ]);

    return {
      data: templates,
      total: Number(countResult[0]?.count ?? 0),
      page,
      limit,
      totalPages: Math.ceil(Number(countResult[0]?.count ?? 0) / limit),
    };
  }

  async findProjectTemplateById(id: string, organizationId: string) {
    const [template] = await this.db.select()
      .from(projectTemplates)
      .where(and(
        eq(projectTemplates.id, id),
        eq(projectTemplates.organizationId, organizationId)
      ))
      .limit(1);
    return template ?? null;
  }

  async findProjectTemplateByCode(templateCode: string, organizationId: string) {
    const [template] = await this.db.select()
      .from(projectTemplates)
      .where(and(
        eq(projectTemplates.templateCode, templateCode),
        eq(projectTemplates.organizationId, organizationId)
      ))
      .limit(1);
    return template ?? null;
  }

  async createProjectTemplate(data: CreateProjectTemplateData) {
    const [template] = await this.db.insert(projectTemplates).values(data).returning();
    return template;
  }

  async updateProjectTemplate(id: string, organizationId: string, data: UpdateProjectTemplateData) {
    const [template] = await this.db.update(projectTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(projectTemplates.id, id),
        eq(projectTemplates.organizationId, organizationId)
      ))
      .returning();
    return template ?? null;
  }

  async deleteProjectTemplate(id: string, organizationId: string) {
    // Soft delete by setting isActive to false
    await this.db.update(projectTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(projectTemplates.id, id),
        eq(projectTemplates.organizationId, organizationId)
      ));
  }

  // ============================================================================
  // Project Template Tasks
  // ============================================================================

  async findTemplateTasksByProjectTemplate(projectTemplateId: string) {
    return this.db.select()
      .from(projectTemplateTasks)
      .where(eq(projectTemplateTasks.projectTemplateId, projectTemplateId))
      .orderBy(asc(projectTemplateTasks.sortOrder));
  }

  async findTemplateTasksWithDetails(projectTemplateId: string) {
    return this.db.select({
      templateTask: projectTemplateTasks,
      taskTemplate: projectTaskTemplates,
    })
      .from(projectTemplateTasks)
      .innerJoin(projectTaskTemplates, eq(projectTemplateTasks.taskTemplateId, projectTaskTemplates.id))
      .where(eq(projectTemplateTasks.projectTemplateId, projectTemplateId))
      .orderBy(asc(projectTemplateTasks.sortOrder));
  }

  async createProjectTemplateTask(data: CreateProjectTemplateTaskData) {
    const [templateTask] = await this.db.insert(projectTemplateTasks).values(data).returning();
    return templateTask;
  }

  async createProjectTemplateTasksBulk(data: CreateProjectTemplateTaskData[]) {
    if (data.length === 0) return [];
    return this.db.insert(projectTemplateTasks).values(data).returning();
  }

  async deleteProjectTemplateTask(id: string) {
    await this.db.delete(projectTemplateTasks)
      .where(eq(projectTemplateTasks.id, id));
  }

  async deleteProjectTemplateTasksByTemplate(projectTemplateId: string) {
    await this.db.delete(projectTemplateTasks)
      .where(eq(projectTemplateTasks.projectTemplateId, projectTemplateId));
  }
}
