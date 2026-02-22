import { NextRequest, NextResponse } from 'next/server';
import {
  and,
  db,
  eq,
  inArray,
  invoices,
  projects,
  salesOrders,
  sql,
  timeEntries,
} from '@glapi/database';
import {
  applyPortalSessionErrorCookies,
  PortalSessionError,
  requirePortalSession,
} from '../../_lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await requirePortalSession(request);

    const [invoiceSummary] = await db
      .select({
        totalInvoices: sql<number>`COUNT(*)::int`,
        openInvoices: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} IN ('sent', 'partial', 'overdue'))::int`,
        totalAmount: sql<string>`COALESCE(SUM(${invoices.totalAmount}), 0)::text`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, session.organization.id),
          inArray(invoices.entityId, session.membershipEntityIds)
        )
      );

    const [orderSummary] = await db
      .select({
        totalOrders: sql<number>`COUNT(*)::int`,
        activeOrders: sql<number>`COUNT(*) FILTER (WHERE ${salesOrders.status} IN ('SUBMITTED', 'APPROVED', 'PARTIALLY_FULFILLED', 'ON_HOLD'))::int`,
        totalOrderAmount: sql<string>`COALESCE(SUM(${salesOrders.totalAmount}), 0)::text`,
      })
      .from(salesOrders)
      .where(
        and(
          eq(salesOrders.organizationId, session.organization.id),
          inArray(salesOrders.entityId, session.membershipEntityIds)
        )
      );

    const [projectSummary] = await db
      .select({
        totalProjects: sql<number>`COUNT(*)::int`,
        activeProjects: sql<number>`COUNT(*) FILTER (WHERE ${projects.status} NOT IN ('completed', 'archived', 'closed'))::int`,
      })
      .from(projects)
      .where(
        and(
          eq(projects.organizationId, session.organization.id),
          inArray(projects.customerId, session.membershipEntityIds)
        )
      );

    const [timeSummary] = await db
      .select({
        submittedEntries: sql<number>`COUNT(*) FILTER (WHERE ${timeEntries.status} = 'SUBMITTED')::int`,
        approvedEntries: sql<number>`COUNT(*) FILTER (WHERE ${timeEntries.status} = 'APPROVED')::int`,
        totalHours: sql<string>`COALESCE(SUM(${timeEntries.hours}), 0)::text`,
      })
      .from(timeEntries)
      .innerJoin(projects, eq(timeEntries.projectId, projects.id))
      .where(
        and(
          eq(timeEntries.organizationId, session.organization.id),
          inArray(projects.customerId, session.membershipEntityIds)
        )
      );

    return NextResponse.json({
      organization: session.organization,
      memberships: session.memberships.map((membership) => ({
        id: membership.id,
        entityId: membership.entityId,
        role: membership.role,
      })),
      invoices: invoiceSummary,
      orders: orderSummary,
      projects: projectSummary,
      timeEntries: timeSummary,
    });
  } catch (error) {
    if (error instanceof PortalSessionError) {
      const response = NextResponse.json({ message: error.message }, { status: error.status });
      applyPortalSessionErrorCookies(response, error);
      return response;
    }

    console.error('Failed to load customer portal workspace overview:', error);
    return NextResponse.json({ message: 'Failed to load overview' }, { status: 500 });
  }
}
