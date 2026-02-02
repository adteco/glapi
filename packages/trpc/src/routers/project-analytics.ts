import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { db as globalDb } from '@glapi/database';
import { projects, timeEntries, entities, businessTransactions, transactionTypes } from '@glapi/database/schema';
import { eq, and, sql, inArray, isNotNull, ne } from 'drizzle-orm';

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
    const billedMap = new Map<string | null, number>(billedByProject.map((b: { projectId: string | null; totalBilled: string }) => [b.projectId, parseFloat(b.totalBilled) || 0]));
    const pendingMap = new Map<string | null, number>(pendingByProject.map((p: { projectId: string | null; totalPending: string }) => [p.projectId, parseFloat(p.totalPending) || 0]));

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

    type UnbilledEntry = { customerId: string | null; customerName: string | null; unbilledAmount: string; unbilledHours: string };
    type ResultEntry = { customerId: string; customerName: string; unbilledAmount: number; unbilledHours: number };

    const results = unbilledEntries
      .filter((e: UnbilledEntry) => e.customerId)
      .map((e: UnbilledEntry) => ({
        customerId: e.customerId!,
        customerName: e.customerName || 'Unknown',
        unbilledAmount: parseFloat(e.unbilledAmount) || 0,
        unbilledHours: parseFloat(e.unbilledHours) || 0,
      }))
      .filter((e: ResultEntry) => e.unbilledAmount > 0)
      .sort((a: ResultEntry, b: ResultEntry) => b.unbilledAmount - a.unbilledAmount);

    const total = results.reduce((sum: number, c: ResultEntry) => sum + c.unbilledAmount, 0);
    const totalHours = results.reduce((sum: number, c: ResultEntry) => sum + c.unbilledHours, 0);

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

    type SummaryEntry = { customerId: string | null; customerName: string | null; totalBudgetRevenue: string; totalBudgetCost: string; projectCount: string; avgPercentComplete: string };
    type SummaryResult = { customerId: string; customerName: string; totalBudgetRevenue: number; totalBudgetCost: number; projectCount: number; avgPercentComplete: number };

    const results = projectSummary
      .filter((s: SummaryEntry) => s.customerId)
      .map((s: SummaryEntry) => ({
        customerId: s.customerId!,
        customerName: s.customerName || 'Unknown',
        totalBudgetRevenue: parseFloat(s.totalBudgetRevenue) || 0,
        totalBudgetCost: parseFloat(s.totalBudgetCost) || 0,
        projectCount: parseInt(s.projectCount) || 0,
        avgPercentComplete: parseFloat(s.avgPercentComplete) || 0,
      }))
      .sort((a: SummaryResult, b: SummaryResult) => b.totalBudgetRevenue - a.totalBudgetRevenue);

    return {
      data: results,
    };
  }),

  /**
   * Get unfulfilled sales orders by customer
   * Unfulfilled = total sales order amount - total invoiced amount (where invoice.parentTransactionId = salesOrder.id)
   */
  getUnfulfilledSalesOrdersByCustomer: authenticatedProcedure.query(async ({ ctx }) => {
    const db = ctx.db || globalDb;

    // Get SALES_ORDER transaction type ID
    const salesOrderType = await db
      .select({ id: transactionTypes.id })
      .from(transactionTypes)
      .where(eq(transactionTypes.typeCode, 'SALES_ORDER'))
      .limit(1);

    if (!salesOrderType.length) {
      return { data: [], total: 0 };
    }

    // Get INVOICE transaction type ID
    const invoiceType = await db
      .select({ id: transactionTypes.id })
      .from(transactionTypes)
      .where(eq(transactionTypes.typeCode, 'INVOICE'))
      .limit(1);

    const salesOrderTypeId = salesOrderType[0].id;
    const invoiceTypeId = invoiceType[0]?.id;

    // Get all open sales orders with their total amounts
    const salesOrders = await db
      .select({
        id: businessTransactions.id,
        entityId: businessTransactions.entityId,
        totalAmount: businessTransactions.totalAmount,
        status: businessTransactions.status,
      })
      .from(businessTransactions)
      .where(
        and(
          eq(businessTransactions.transactionTypeId, salesOrderTypeId),
          eq(businessTransactions.subsidiaryId, ctx.organizationId),
          ne(businessTransactions.status, 'CANCELLED'),
          ne(businessTransactions.status, 'CLOSED')
        )
      );

    if (!salesOrders.length) {
      return { data: [], total: 0 };
    }

    // Get invoiced amounts for each sales order (invoices linked via parentTransactionId)
    const invoicedAmounts = invoiceTypeId ? await db
      .select({
        parentId: businessTransactions.parentTransactionId,
        invoicedAmount: sql<string>`SUM(${businessTransactions.totalAmount})`.as('invoicedAmount'),
      })
      .from(businessTransactions)
      .where(
        and(
          eq(businessTransactions.transactionTypeId, invoiceTypeId),
          ne(businessTransactions.status, 'CANCELLED'),
          inArray(
            businessTransactions.parentTransactionId,
            salesOrders.map((so: { id: string }) => so.id)
          )
        )
      )
      .groupBy(businessTransactions.parentTransactionId) : [];

    // Create lookup map for invoiced amounts
    type InvoicedAmount = { parentId: string | null; invoicedAmount: string };
    const invoicedMap = new Map<string, number>(
      invoicedAmounts
        .filter((inv: InvoicedAmount) => inv.parentId)
        .map((inv: InvoicedAmount) => [inv.parentId!, parseFloat(inv.invoicedAmount) || 0])
    );

    // Get entity names
    type SalesOrder = { id: string; entityId: string | null; totalAmount: string | null };
    const entityIds = [...new Set(salesOrders.map((so: SalesOrder) => so.entityId).filter(Boolean))];
    const entityList = entityIds.length > 0 ? await db
      .select({ id: entities.id, name: entities.name })
      .from(entities)
      .where(inArray(entities.id, entityIds as string[])) : [];

    const entityMap = new Map<string, string | null>(entityList.map((e: { id: string; name: string | null }) => [e.id, e.name]));

    // Aggregate by customer
    const customerData = new Map<string, {
      customerId: string;
      customerName: string;
      orderCount: number;
      totalOrdered: number;
      totalInvoiced: number;
      unfulfilledAmount: number;
    }>();

    for (const so of salesOrders) {
      if (!so.entityId) continue;

      const ordered = parseFloat(so.totalAmount || '0') || 0;
      const invoiced = invoicedMap.get(so.id) || 0;
      const unfulfilled = ordered - invoiced;

      if (unfulfilled <= 0) continue; // Skip fully invoiced orders

      const existing = customerData.get(so.entityId);
      if (existing) {
        existing.orderCount += 1;
        existing.totalOrdered += ordered;
        existing.totalInvoiced += invoiced;
        existing.unfulfilledAmount += unfulfilled;
      } else {
        customerData.set(so.entityId, {
          customerId: so.entityId,
          customerName: entityMap.get(so.entityId) || 'Unknown',
          orderCount: 1,
          totalOrdered: ordered,
          totalInvoiced: invoiced,
          unfulfilledAmount: unfulfilled,
        });
      }
    }

    const results = Array.from(customerData.values())
      .sort((a, b) => b.unfulfilledAmount - a.unfulfilledAmount);

    const total = results.reduce((sum, c) => sum + c.unfulfilledAmount, 0);

    return {
      data: results,
      total,
    };
  }),
});
