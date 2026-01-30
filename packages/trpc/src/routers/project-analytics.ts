import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { db as globalDb } from '@glapi/database';
import { projects, timeEntries, entities } from '@glapi/database/schema';
import { eq, and, sql, inArray, isNotNull } from 'drizzle-orm';

/**
 * Project Analytics Router
 * Provides endpoints for project backlog and unbilled time analytics by customer
 */
export const projectAnalyticsRouter = router({
  /**
   * Get backlog by customer
   * Backlog = budgetRevenue - pendingBilling - actualBilled
   * - pendingBilling = APPROVED time entries (billable hours * billing rate)
   * - actualBilled = POSTED time entries (billable hours * billing rate)
   */
  getBacklogByCustomer: authenticatedProcedure.query(async ({ ctx }) => {
    const db = ctx.db || globalDb;

    // Get all projects with budget revenue and customer info
    const projectsWithCustomers = await db
      .select({
        projectId: projects.id,
        customerId: projects.customerId,
        customerName: entities.name,
        budgetRevenue: projects.budgetRevenue,
        percentComplete: projects.percentComplete,
      })
      .from(projects)
      .leftJoin(entities, eq(projects.customerId, entities.id))
      .where(
        and(
          eq(projects.organizationId, ctx.organizationId),
          isNotNull(projects.customerId)
        )
      );

    // Get billed amounts (POSTED time entries) by project
    const billedByProject = await db
      .select({
        projectId: timeEntries.projectId,
        totalBilled: sql<string>`COALESCE(SUM(CASE WHEN ${timeEntries.isBillable} = true THEN ${timeEntries.hours} * COALESCE(${timeEntries.billingRate}, 0) ELSE 0 END), 0)`,
      })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.organizationId, ctx.organizationId),
          eq(timeEntries.status, 'POSTED')
        )
      )
      .groupBy(timeEntries.projectId);

    // Get pending billing (APPROVED but not POSTED time entries) by project
    const pendingByProject = await db
      .select({
        projectId: timeEntries.projectId,
        totalPending: sql<string>`COALESCE(SUM(CASE WHEN ${timeEntries.isBillable} = true THEN ${timeEntries.hours} * COALESCE(${timeEntries.billingRate}, 0) ELSE 0 END), 0)`,
      })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.organizationId, ctx.organizationId),
          eq(timeEntries.status, 'APPROVED')
        )
      )
      .groupBy(timeEntries.projectId);

    // Create lookup maps
    const billedMap = new Map(billedByProject.map(b => [b.projectId, parseFloat(b.totalBilled) || 0]));
    const pendingMap = new Map(pendingByProject.map(p => [p.projectId, parseFloat(p.totalPending) || 0]));

    // Aggregate by customer
    const customerBacklog = new Map<string, { customerId: string; customerName: string; backlogValue: number; projectCount: number }>();

    for (const project of projectsWithCustomers) {
      if (!project.customerId) continue;

      const budgetRevenue = parseFloat(project.budgetRevenue || '0') || 0;
      const billed = billedMap.get(project.projectId) || 0;
      const pending = pendingMap.get(project.projectId) || 0;
      const backlog = budgetRevenue - billed - pending;

      const existing = customerBacklog.get(project.customerId);
      if (existing) {
        existing.backlogValue += backlog;
        existing.projectCount += 1;
      } else {
        customerBacklog.set(project.customerId, {
          customerId: project.customerId,
          customerName: project.customerName || 'Unknown',
          backlogValue: backlog,
          projectCount: 1,
        });
      }
    }

    const results = Array.from(customerBacklog.values())
      .filter(c => c.backlogValue > 0)
      .sort((a, b) => b.backlogValue - a.backlogValue);

    const total = results.reduce((sum, c) => sum + c.backlogValue, 0);

    return {
      data: results,
      total,
    };
  }),

  /**
   * Get unbilled time by customer
   * Unbilled = APPROVED time entries that have not been POSTED (billed)
   */
  getUnbilledTimeByCustomer: authenticatedProcedure.query(async ({ ctx }) => {
    const db = ctx.db || globalDb;

    // Get unbilled (APPROVED but not POSTED) time entries with project and customer info
    const unbilledEntries = await db
      .select({
        customerId: projects.customerId,
        customerName: entities.name,
        unbilledAmount: sql<string>`COALESCE(SUM(CASE WHEN ${timeEntries.isBillable} = true THEN ${timeEntries.hours} * COALESCE(${timeEntries.billingRate}, 0) ELSE 0 END), 0)`,
        unbilledHours: sql<string>`COALESCE(SUM(CASE WHEN ${timeEntries.isBillable} = true THEN ${timeEntries.hours} ELSE 0 END), 0)`,
      })
      .from(timeEntries)
      .innerJoin(projects, eq(timeEntries.projectId, projects.id))
      .leftJoin(entities, eq(projects.customerId, entities.id))
      .where(
        and(
          eq(timeEntries.organizationId, ctx.organizationId),
          eq(timeEntries.status, 'APPROVED'),
          isNotNull(projects.customerId)
        )
      )
      .groupBy(projects.customerId, entities.name);

    const results = unbilledEntries
      .filter(e => e.customerId)
      .map(e => ({
        customerId: e.customerId!,
        customerName: e.customerName || 'Unknown',
        unbilledAmount: parseFloat(e.unbilledAmount) || 0,
        unbilledHours: parseFloat(e.unbilledHours) || 0,
      }))
      .filter(e => e.unbilledAmount > 0)
      .sort((a, b) => b.unbilledAmount - a.unbilledAmount);

    const total = results.reduce((sum, c) => sum + c.unbilledAmount, 0);
    const totalHours = results.reduce((sum, c) => sum + c.unbilledHours, 0);

    return {
      data: results,
      total,
      totalHours,
    };
  }),

  /**
   * Get project summary by customer
   * Shows total budget, billed, unbilled, and backlog per customer
   */
  getProjectSummaryByCustomer: authenticatedProcedure.query(async ({ ctx }) => {
    const db = ctx.db || globalDb;

    // Get projects grouped by customer with their budgets
    const projectSummary = await db
      .select({
        customerId: projects.customerId,
        customerName: entities.name,
        totalBudgetRevenue: sql<string>`COALESCE(SUM(${projects.budgetRevenue}), 0)`,
        totalBudgetCost: sql<string>`COALESCE(SUM(${projects.budgetCost}), 0)`,
        projectCount: sql<string>`COUNT(${projects.id})`,
        avgPercentComplete: sql<string>`AVG(COALESCE(${projects.percentComplete}, 0))`,
      })
      .from(projects)
      .leftJoin(entities, eq(projects.customerId, entities.id))
      .where(
        and(
          eq(projects.organizationId, ctx.organizationId),
          isNotNull(projects.customerId)
        )
      )
      .groupBy(projects.customerId, entities.name);

    const results = projectSummary
      .filter(s => s.customerId)
      .map(s => ({
        customerId: s.customerId!,
        customerName: s.customerName || 'Unknown',
        totalBudgetRevenue: parseFloat(s.totalBudgetRevenue) || 0,
        totalBudgetCost: parseFloat(s.totalBudgetCost) || 0,
        projectCount: parseInt(s.projectCount) || 0,
        avgPercentComplete: parseFloat(s.avgPercentComplete) || 0,
      }))
      .sort((a, b) => b.totalBudgetRevenue - a.totalBudgetRevenue);

    return {
      data: results,
    };
  }),
});
