import { NextRequest, NextResponse } from 'next/server';
import {
  and,
  db,
  desc,
  eq,
  inArray,
  projects,
  sql,
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
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || '25')));
    const statusFilter = searchParams.get('status');
    const offset = (page - 1) * limit;

    const conditions = [
      eq(projects.organizationId, session.organization.id),
      inArray(projects.customerId, session.membershipEntityIds),
    ];
    if (statusFilter) {
      conditions.push(eq(projects.status, statusFilter));
    }

    const whereClause = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(projects)
      .where(whereClause);

    const data = await db
      .select({
        id: projects.id,
        customerId: projects.customerId,
        projectCode: projects.projectCode,
        name: projects.name,
        status: projects.status,
        startDate: projects.startDate,
        endDate: projects.endDate,
        budgetRevenue: projects.budgetRevenue,
        budgetCost: projects.budgetCost,
        percentComplete: projects.percentComplete,
      })
      .from(projects)
      .where(whereClause)
      .orderBy(desc(projects.updatedAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: Number(count || 0),
        totalPages: Math.ceil(Number(count || 0) / limit),
      },
    });
  } catch (error) {
    if (error instanceof PortalSessionError) {
      const response = NextResponse.json({ message: error.message }, { status: error.status });
      applyPortalSessionErrorCookies(response, error);
      return response;
    }

    console.error('Failed to list customer portal projects:', error);
    return NextResponse.json({ message: 'Failed to list projects' }, { status: 500 });
  }
}
