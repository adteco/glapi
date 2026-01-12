import { db } from '../index';
import {
  closeTaskTemplates,
  closeChecklists,
  closeTasks,
  varianceThresholds,
  varianceAlerts,
  tieoutTemplates,
  tieoutInstances,
  closeNotifications,
} from '../db/schema/close-management';
import { accountingPeriods } from '../db/schema/accounting-periods';
import { eq, and, inArray, desc, asc, sql, isNull, gte, lte } from 'drizzle-orm';

// Types for repository operations
type CreateTaskTemplateData = typeof closeTaskTemplates.$inferInsert;
type UpdateTaskTemplateData = Partial<Omit<CreateTaskTemplateData, 'id' | 'subsidiaryId' | 'createdAt'>>;

type CreateChecklistData = typeof closeChecklists.$inferInsert;
type UpdateChecklistData = Partial<Omit<CreateChecklistData, 'id' | 'accountingPeriodId' | 'createdAt'>>;

type CreateTaskData = typeof closeTasks.$inferInsert;
type UpdateTaskData = Partial<Omit<CreateTaskData, 'id' | 'checklistId' | 'createdAt'>>;

type CreateVarianceThresholdData = typeof varianceThresholds.$inferInsert;
type UpdateVarianceThresholdData = Partial<Omit<CreateVarianceThresholdData, 'id' | 'subsidiaryId' | 'createdAt'>>;

type CreateVarianceAlertData = typeof varianceAlerts.$inferInsert;
type UpdateVarianceAlertData = Partial<Omit<CreateVarianceAlertData, 'id' | 'accountingPeriodId' | 'createdAt'>>;

type CreateTieoutTemplateData = typeof tieoutTemplates.$inferInsert;
type UpdateTieoutTemplateData = Partial<Omit<CreateTieoutTemplateData, 'id' | 'subsidiaryId' | 'createdAt'>>;

type CreateTieoutInstanceData = typeof tieoutInstances.$inferInsert;
type UpdateTieoutInstanceData = Partial<Omit<CreateTieoutInstanceData, 'id' | 'accountingPeriodId' | 'createdAt'>>;

type CreateNotificationData = typeof closeNotifications.$inferInsert;

export class CloseManagementRepository {
  // ========== Task Templates ==========

  async findAllTemplates(
    subsidiaryIds: string[],
    options: {
      page?: number;
      limit?: number;
      orderBy?: 'sortOrder' | 'taskCode' | 'taskName' | 'createdAt';
      orderDirection?: 'asc' | 'desc';
    } = {},
    filters: {
      category?: string;
      isActive?: boolean;
      search?: string;
    } = {}
  ) {
    const { page = 1, limit = 50, orderBy = 'sortOrder', orderDirection = 'asc' } = options;
    const offset = (page - 1) * limit;

    const conditions = [inArray(closeTaskTemplates.subsidiaryId, subsidiaryIds)];

    if (filters.category) {
      conditions.push(eq(closeTaskTemplates.category, filters.category));
    }
    if (filters.isActive !== undefined) {
      conditions.push(eq(closeTaskTemplates.isActive, filters.isActive));
    }

    const orderColumn = {
      sortOrder: closeTaskTemplates.sortOrder,
      taskCode: closeTaskTemplates.taskCode,
      taskName: closeTaskTemplates.taskName,
      createdAt: closeTaskTemplates.createdAt,
    }[orderBy];

    const orderFn = orderDirection === 'desc' ? desc : asc;

    const [templates, countResult] = await Promise.all([
      db.select()
        .from(closeTaskTemplates)
        .where(and(...conditions))
        .orderBy(orderFn(orderColumn))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(closeTaskTemplates)
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

  async findTemplateById(id: string, subsidiaryIds: string[]) {
    const [template] = await db.select()
      .from(closeTaskTemplates)
      .where(and(
        eq(closeTaskTemplates.id, id),
        inArray(closeTaskTemplates.subsidiaryId, subsidiaryIds)
      ))
      .limit(1);
    return template ?? null;
  }

  async createTemplate(data: CreateTaskTemplateData) {
    const [template] = await db.insert(closeTaskTemplates).values(data).returning();
    return template;
  }

  async updateTemplate(id: string, subsidiaryIds: string[], data: UpdateTaskTemplateData) {
    const [template] = await db.update(closeTaskTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(closeTaskTemplates.id, id),
        inArray(closeTaskTemplates.subsidiaryId, subsidiaryIds)
      ))
      .returning();
    return template ?? null;
  }

  async deleteTemplate(id: string, subsidiaryIds: string[]) {
    await db.update(closeTaskTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(closeTaskTemplates.id, id),
        inArray(closeTaskTemplates.subsidiaryId, subsidiaryIds)
      ));
  }

  // ========== Checklists ==========

  async findAllChecklists(
    subsidiaryIds: string[],
    options: {
      page?: number;
      limit?: number;
      orderBy?: 'targetCloseDate' | 'createdAt' | 'checklistName';
      orderDirection?: 'asc' | 'desc';
    } = {},
    filters: {
      status?: string | string[];
      periodId?: string;
    } = {}
  ) {
    const { page = 1, limit = 20, orderBy = 'targetCloseDate', orderDirection = 'desc' } = options;
    const offset = (page - 1) * limit;

    const conditions = [inArray(closeChecklists.subsidiaryId, subsidiaryIds)];

    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      conditions.push(inArray(closeChecklists.status, statuses));
    }
    if (filters.periodId) {
      conditions.push(eq(closeChecklists.accountingPeriodId, filters.periodId));
    }

    const orderColumn = {
      targetCloseDate: closeChecklists.targetCloseDate,
      createdAt: closeChecklists.createdAt,
      checklistName: closeChecklists.checklistName,
    }[orderBy];

    const orderFn = orderDirection === 'desc' ? desc : asc;

    const [checklists, countResult] = await Promise.all([
      db.select()
        .from(closeChecklists)
        .where(and(...conditions))
        .orderBy(orderFn(orderColumn))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(closeChecklists)
        .where(and(...conditions)),
    ]);

    return {
      data: checklists,
      total: Number(countResult[0]?.count ?? 0),
      page,
      limit,
      totalPages: Math.ceil(Number(countResult[0]?.count ?? 0) / limit),
    };
  }

  async findChecklistById(id: string, subsidiaryIds: string[]) {
    const [checklist] = await db.select()
      .from(closeChecklists)
      .where(and(
        eq(closeChecklists.id, id),
        inArray(closeChecklists.subsidiaryId, subsidiaryIds)
      ))
      .limit(1);
    return checklist ?? null;
  }

  async findChecklistByPeriod(periodId: string, subsidiaryIds: string[]) {
    const [checklist] = await db.select()
      .from(closeChecklists)
      .where(and(
        eq(closeChecklists.accountingPeriodId, periodId),
        inArray(closeChecklists.subsidiaryId, subsidiaryIds)
      ))
      .limit(1);
    return checklist ?? null;
  }

  async createChecklist(data: CreateChecklistData) {
    const [checklist] = await db.insert(closeChecklists).values(data).returning();
    return checklist;
  }

  async updateChecklist(id: string, subsidiaryIds: string[], data: UpdateChecklistData) {
    const [checklist] = await db.update(closeChecklists)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(closeChecklists.id, id),
        inArray(closeChecklists.subsidiaryId, subsidiaryIds)
      ))
      .returning();
    return checklist ?? null;
  }

  async updateChecklistProgress(checklistId: string) {
    // Calculate progress from tasks
    const stats = await db.select({
      total: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where status = 'COMPLETED')`,
      blocked: sql<number>`count(*) filter (where status = 'BLOCKED')`,
    })
      .from(closeTasks)
      .where(eq(closeTasks.checklistId, checklistId));

    const { total, completed, blocked } = stats[0] ?? { total: 0, completed: 0, blocked: 0 };

    await db.update(closeChecklists)
      .set({
        totalTasks: Number(total),
        completedTasks: Number(completed),
        blockedTasks: Number(blocked),
        updatedAt: new Date(),
      })
      .where(eq(closeChecklists.id, checklistId));
  }

  // ========== Tasks ==========

  async findTasksByChecklist(checklistId: string) {
    return db.select()
      .from(closeTasks)
      .where(eq(closeTasks.checklistId, checklistId))
      .orderBy(asc(closeTasks.sortOrder), asc(closeTasks.taskCode));
  }

  async findTaskById(id: string) {
    const [task] = await db.select()
      .from(closeTasks)
      .where(eq(closeTasks.id, id))
      .limit(1);
    return task ?? null;
  }

  async findTasksByAssignee(
    assigneeId: string,
    options: { status?: string | string[]; limit?: number } = {}
  ) {
    const conditions = [eq(closeTasks.assigneeId, assigneeId)];

    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      conditions.push(inArray(closeTasks.status, statuses));
    }

    return db.select()
      .from(closeTasks)
      .where(and(...conditions))
      .orderBy(asc(closeTasks.dueDate), asc(closeTasks.priority))
      .limit(options.limit ?? 50);
  }

  async createTask(data: CreateTaskData) {
    const [task] = await db.insert(closeTasks).values(data).returning();
    return task;
  }

  async bulkCreateTasks(tasks: CreateTaskData[]) {
    if (tasks.length === 0) return [];
    return db.insert(closeTasks).values(tasks).returning();
  }

  async updateTask(id: string, data: UpdateTaskData) {
    const [task] = await db.update(closeTasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(closeTasks.id, id))
      .returning();
    return task ?? null;
  }

  async updateTaskStatus(id: string, status: string, userId: string) {
    const updates: Partial<typeof closeTasks.$inferInsert> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'IN_PROGRESS' && !updates.startedAt) {
      updates.startedAt = new Date();
    }
    if (status === 'COMPLETED') {
      updates.completedAt = new Date();
    }

    const [task] = await db.update(closeTasks)
      .set(updates)
      .where(eq(closeTasks.id, id))
      .returning();
    return task ?? null;
  }

  async deleteTask(id: string) {
    await db.delete(closeTasks).where(eq(closeTasks.id, id));
  }

  // ========== Variance Thresholds ==========

  async findAllThresholds(subsidiaryIds: string[], filters: { isActive?: boolean } = {}) {
    const conditions = [inArray(varianceThresholds.subsidiaryId, subsidiaryIds)];

    if (filters.isActive !== undefined) {
      conditions.push(eq(varianceThresholds.isActive, filters.isActive));
    }

    return db.select()
      .from(varianceThresholds)
      .where(and(...conditions))
      .orderBy(asc(varianceThresholds.name));
  }

  async findThresholdById(id: string, subsidiaryIds: string[]) {
    const [threshold] = await db.select()
      .from(varianceThresholds)
      .where(and(
        eq(varianceThresholds.id, id),
        inArray(varianceThresholds.subsidiaryId, subsidiaryIds)
      ))
      .limit(1);
    return threshold ?? null;
  }

  async createThreshold(data: CreateVarianceThresholdData) {
    const [threshold] = await db.insert(varianceThresholds).values(data).returning();
    return threshold;
  }

  async updateThreshold(id: string, subsidiaryIds: string[], data: UpdateVarianceThresholdData) {
    const [threshold] = await db.update(varianceThresholds)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(varianceThresholds.id, id),
        inArray(varianceThresholds.subsidiaryId, subsidiaryIds)
      ))
      .returning();
    return threshold ?? null;
  }

  async deleteThreshold(id: string, subsidiaryIds: string[]) {
    await db.update(varianceThresholds)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(varianceThresholds.id, id),
        inArray(varianceThresholds.subsidiaryId, subsidiaryIds)
      ));
  }

  // ========== Variance Alerts ==========

  async findAlertsByPeriod(periodId: string, filters: { status?: string | string[]; severity?: string } = {}) {
    const conditions = [eq(varianceAlerts.accountingPeriodId, periodId)];

    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      conditions.push(inArray(varianceAlerts.status, statuses));
    }
    if (filters.severity) {
      conditions.push(eq(varianceAlerts.severity, filters.severity));
    }

    return db.select()
      .from(varianceAlerts)
      .where(and(...conditions))
      .orderBy(desc(varianceAlerts.createdAt));
  }

  async findAlertsByChecklist(checklistId: string) {
    return db.select()
      .from(varianceAlerts)
      .where(eq(varianceAlerts.checklistId, checklistId))
      .orderBy(desc(varianceAlerts.severity), desc(varianceAlerts.createdAt));
  }

  async findAlertById(id: string) {
    const [alert] = await db.select()
      .from(varianceAlerts)
      .where(eq(varianceAlerts.id, id))
      .limit(1);
    return alert ?? null;
  }

  async createAlert(data: CreateVarianceAlertData) {
    const [alert] = await db.insert(varianceAlerts).values(data).returning();
    return alert;
  }

  async bulkCreateAlerts(alerts: CreateVarianceAlertData[]) {
    if (alerts.length === 0) return [];
    return db.insert(varianceAlerts).values(alerts).returning();
  }

  async updateAlert(id: string, data: UpdateVarianceAlertData) {
    const [alert] = await db.update(varianceAlerts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(varianceAlerts.id, id))
      .returning();
    return alert ?? null;
  }

  async acknowledgeAlert(id: string, userId: string) {
    const [alert] = await db.update(varianceAlerts)
      .set({
        status: 'ACKNOWLEDGED',
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(varianceAlerts.id, id))
      .returning();
    return alert ?? null;
  }

  async resolveAlert(id: string, userId: string, resolutionNotes: string) {
    const [alert] = await db.update(varianceAlerts)
      .set({
        status: 'RESOLVED',
        resolvedBy: userId,
        resolvedAt: new Date(),
        resolutionNotes,
        updatedAt: new Date(),
      })
      .where(eq(varianceAlerts.id, id))
      .returning();
    return alert ?? null;
  }

  // ========== Tie-out Templates ==========

  async findAllTieoutTemplates(subsidiaryIds: string[], filters: { isActive?: boolean } = {}) {
    const conditions = [inArray(tieoutTemplates.subsidiaryId, subsidiaryIds)];

    if (filters.isActive !== undefined) {
      conditions.push(eq(tieoutTemplates.isActive, filters.isActive));
    }

    return db.select()
      .from(tieoutTemplates)
      .where(and(...conditions))
      .orderBy(asc(tieoutTemplates.sortOrder), asc(tieoutTemplates.templateCode));
  }

  async findTieoutTemplateById(id: string, subsidiaryIds: string[]) {
    const [template] = await db.select()
      .from(tieoutTemplates)
      .where(and(
        eq(tieoutTemplates.id, id),
        inArray(tieoutTemplates.subsidiaryId, subsidiaryIds)
      ))
      .limit(1);
    return template ?? null;
  }

  async createTieoutTemplate(data: CreateTieoutTemplateData) {
    const [template] = await db.insert(tieoutTemplates).values(data).returning();
    return template;
  }

  async updateTieoutTemplate(id: string, subsidiaryIds: string[], data: UpdateTieoutTemplateData) {
    const [template] = await db.update(tieoutTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(tieoutTemplates.id, id),
        inArray(tieoutTemplates.subsidiaryId, subsidiaryIds)
      ))
      .returning();
    return template ?? null;
  }

  // ========== Tie-out Instances ==========

  async findTieoutsByPeriod(periodId: string, filters: { status?: string | string[] } = {}) {
    const conditions = [eq(tieoutInstances.accountingPeriodId, periodId)];

    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      conditions.push(inArray(tieoutInstances.status, statuses));
    }

    return db.select()
      .from(tieoutInstances)
      .where(and(...conditions))
      .orderBy(asc(tieoutInstances.tieoutName));
  }

  async findTieoutsByChecklist(checklistId: string) {
    return db.select()
      .from(tieoutInstances)
      .where(eq(tieoutInstances.checklistId, checklistId))
      .orderBy(asc(tieoutInstances.tieoutName));
  }

  async findTieoutById(id: string) {
    const [tieout] = await db.select()
      .from(tieoutInstances)
      .where(eq(tieoutInstances.id, id))
      .limit(1);
    return tieout ?? null;
  }

  async createTieout(data: CreateTieoutInstanceData) {
    const [tieout] = await db.insert(tieoutInstances).values(data).returning();
    return tieout;
  }

  async bulkCreateTieouts(tieouts: CreateTieoutInstanceData[]) {
    if (tieouts.length === 0) return [];
    return db.insert(tieoutInstances).values(tieouts).returning();
  }

  async updateTieout(id: string, data: UpdateTieoutInstanceData) {
    const [tieout] = await db.update(tieoutInstances)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tieoutInstances.id, id))
      .returning();
    return tieout ?? null;
  }

  async approveTieout(id: string, userId: string) {
    const [tieout] = await db.update(tieoutInstances)
      .set({
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tieoutInstances.id, id))
      .returning();
    return tieout ?? null;
  }

  // ========== Notifications ==========

  async findNotificationsByUser(
    userId: string,
    options: { isRead?: boolean; limit?: number } = {}
  ) {
    const conditions = [
      eq(closeNotifications.userId, userId),
      eq(closeNotifications.isDismissed, false),
    ];

    if (options.isRead !== undefined) {
      conditions.push(eq(closeNotifications.isRead, options.isRead));
    }

    return db.select()
      .from(closeNotifications)
      .where(and(...conditions))
      .orderBy(desc(closeNotifications.createdAt))
      .limit(options.limit ?? 50);
  }

  async createNotification(data: CreateNotificationData) {
    const [notification] = await db.insert(closeNotifications).values(data).returning();
    return notification;
  }

  async bulkCreateNotifications(notifications: CreateNotificationData[]) {
    if (notifications.length === 0) return [];
    return db.insert(closeNotifications).values(notifications).returning();
  }

  async markNotificationRead(id: string, userId: string) {
    await db.update(closeNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(closeNotifications.id, id),
        eq(closeNotifications.userId, userId)
      ));
  }

  async markAllNotificationsRead(userId: string) {
    await db.update(closeNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(closeNotifications.userId, userId),
        eq(closeNotifications.isRead, false)
      ));
  }

  async dismissNotification(id: string, userId: string) {
    await db.update(closeNotifications)
      .set({ isDismissed: true, dismissedAt: new Date() })
      .where(and(
        eq(closeNotifications.id, id),
        eq(closeNotifications.userId, userId)
      ));
  }

  // ========== Dashboard / Summary ==========

  async getCloseStatusSummary(subsidiaryIds: string[], periodId: string) {
    const [summary] = await db.select({
      totalTasks: sql<number>`count(*)`,
      notStarted: sql<number>`count(*) filter (where ${closeTasks.status} = 'NOT_STARTED')`,
      inProgress: sql<number>`count(*) filter (where ${closeTasks.status} = 'IN_PROGRESS')`,
      pendingReview: sql<number>`count(*) filter (where ${closeTasks.status} = 'PENDING_REVIEW')`,
      completed: sql<number>`count(*) filter (where ${closeTasks.status} = 'COMPLETED')`,
      blocked: sql<number>`count(*) filter (where ${closeTasks.status} = 'BLOCKED')`,
      skipped: sql<number>`count(*) filter (where ${closeTasks.status} = 'SKIPPED')`,
    })
      .from(closeTasks)
      .innerJoin(closeChecklists, eq(closeTasks.checklistId, closeChecklists.id))
      .where(and(
        eq(closeChecklists.accountingPeriodId, periodId),
        inArray(closeChecklists.subsidiaryId, subsidiaryIds)
      ));

    return summary;
  }

  async getOverdueTasks(subsidiaryIds: string[]) {
    const now = new Date();

    return db.select()
      .from(closeTasks)
      .innerJoin(closeChecklists, eq(closeTasks.checklistId, closeChecklists.id))
      .where(and(
        inArray(closeChecklists.subsidiaryId, subsidiaryIds),
        lte(closeTasks.dueDate, now),
        inArray(closeTasks.status, ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED'])
      ))
      .orderBy(asc(closeTasks.dueDate));
  }

  // ========== Helper: Get accessible subsidiary IDs ==========

  async getAccessibleSubsidiaryIds(organizationId: string): Promise<string[]> {
    // This would typically join with organizations/subsidiaries
    // For now, returning a simple query
    const result = await db.execute(
      sql`SELECT id FROM subsidiaries WHERE organization_id = ${organizationId}`
    );
    return (result.rows as { id: string }[]).map(r => r.id);
  }
}
