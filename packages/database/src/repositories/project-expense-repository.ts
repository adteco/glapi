import { and, asc, desc, eq, gte, lte, inArray, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  projectExpenseEntries,
  projectExpenseApprovals,
  projectExpenseAttachments,
  type ProjectExpenseEntry,
  type NewProjectExpenseEntry,
  type ProjectExpenseAttachment,
  type NewProjectExpenseAttachment,
} from '../db/schema/project-expenses';

export interface ProjectExpenseFilters {
  employeeId?: string;
  projectId?: string;
  projectTaskId?: string;
  costCodeId?: string;
  status?: string | string[];
  startDate?: string;
  endDate?: string;
}

export class ProjectExpenseRepository extends BaseRepository {
  async findAll(
    organizationId: string,
    filters: ProjectExpenseFilters = {},
    page = 1,
    limit = 50,
    orderBy: 'expenseDate' | 'createdAt' | 'amount' = 'expenseDate',
    orderDirection: 'asc' | 'desc' = 'desc'
  ): Promise<{ data: ProjectExpenseEntry[]; total: number }> {
    const conditions = [eq(projectExpenseEntries.organizationId, organizationId)];
    if (filters.employeeId) conditions.push(eq(projectExpenseEntries.employeeId, filters.employeeId));
    if (filters.projectId) conditions.push(eq(projectExpenseEntries.projectId, filters.projectId));
    if (filters.projectTaskId) conditions.push(eq(projectExpenseEntries.projectTaskId, filters.projectTaskId));
    if (filters.costCodeId) conditions.push(eq(projectExpenseEntries.costCodeId, filters.costCodeId));
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(projectExpenseEntries.status, filters.status));
      } else {
        conditions.push(eq(projectExpenseEntries.status, filters.status));
      }
    }
    if (filters.startDate) conditions.push(gte(projectExpenseEntries.expenseDate, filters.startDate));
    if (filters.endDate) conditions.push(lte(projectExpenseEntries.expenseDate, filters.endDate));

    const offset = (Math.max(page, 1) - 1) * limit;
    const countResult = await this.db
      .select({ count: projectExpenseEntries.id })
      .from(projectExpenseEntries)
      .where(and(...conditions));

    const column =
      orderBy === 'amount'
        ? projectExpenseEntries.amount
        : orderBy === 'createdAt'
        ? projectExpenseEntries.createdAt
        : projectExpenseEntries.expenseDate;
    const orderFn = orderDirection === 'asc' ? asc : desc;

    const rows = await this.db
      .select()
      .from(projectExpenseEntries)
      .where(and(...conditions))
      .orderBy(orderFn(column))
      .limit(limit)
      .offset(offset);

    return {
      data: rows,
      total: Number(countResult[0]?.count || 0),
    };
  }

  async findById(id: string, organizationId: string): Promise<ProjectExpenseEntry | null> {
    const [result] = await this.db
      .select()
      .from(projectExpenseEntries)
      .where(and(eq(projectExpenseEntries.id, id), eq(projectExpenseEntries.organizationId, organizationId)))
      .limit(1);
    return result || null;
  }

  async create(data: NewProjectExpenseEntry): Promise<ProjectExpenseEntry> {
    const [result] = await this.db.insert(projectExpenseEntries).values(data).returning();
    return result;
  }

  async update(id: string, updates: Partial<ProjectExpenseEntry>, organizationId: string): Promise<ProjectExpenseEntry | null> {
    const [result] = await this.db
      .update(projectExpenseEntries)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(projectExpenseEntries.id, id), eq(projectExpenseEntries.organizationId, organizationId)))
      .returning();
    return result || null;
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const res = await this.db
      .delete(projectExpenseEntries)
      .where(and(eq(projectExpenseEntries.id, id), eq(projectExpenseEntries.organizationId, organizationId)));
    return (res.rowCount || 0) > 0;
  }

  async markAsPosted(id: string, organizationId: string, glTransactionId: string): Promise<ProjectExpenseEntry | null> {
    const [result] = await this.db
      .update(projectExpenseEntries)
      .set({
        status: 'POSTED',
        postedAt: new Date(),
        metadata: sql`COALESCE(${projectExpenseEntries.metadata}, '{}'::jsonb) || jsonb_build_object('glTransactionId', ${glTransactionId})`,
        updatedAt: new Date(),
      })
      .where(and(eq(projectExpenseEntries.id, id), eq(projectExpenseEntries.organizationId, organizationId), eq(projectExpenseEntries.status, 'APPROVED')))
      .returning();

    return result || null;
  }

  async recordApproval(expenseId: string, action: string, previous: string | null, next: string, performedBy: string, comments?: string) {
    await this.db.insert(projectExpenseApprovals).values({
      expenseId,
      action: next,
      previousStatus: previous,
      newStatus: next,
      performedBy,
      comments: comments || null,
    });
  }

  async listAttachments(expenseId: string, organizationId: string): Promise<ProjectExpenseAttachment[]> {
    return this.db
      .select()
      .from(projectExpenseAttachments)
      .where(and(eq(projectExpenseAttachments.expenseId, expenseId), eq(projectExpenseAttachments.organizationId, organizationId)))
      .orderBy(desc(projectExpenseAttachments.uploadedAt));
  }

  async addAttachment(data: NewProjectExpenseAttachment): Promise<ProjectExpenseAttachment> {
    const [result] = await this.db.insert(projectExpenseAttachments).values(data).returning();
    return result;
  }

  async deleteAttachment(id: string, organizationId: string): Promise<boolean> {
    const res = await this.db
      .delete(projectExpenseAttachments)
      .where(and(eq(projectExpenseAttachments.id, id), eq(projectExpenseAttachments.organizationId, organizationId)));
    return (res.rowCount || 0) > 0;
  }
}
