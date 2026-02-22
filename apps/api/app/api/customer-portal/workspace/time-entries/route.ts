import { NextRequest, NextResponse } from 'next/server';
import {
  and,
  db,
  desc,
  entities,
  eq,
  inArray,
  projects,
  sql,
  timeEntries,
  type TimeEntryStatus,
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
      eq(timeEntries.organizationId, session.organization.id),
      inArray(projects.customerId, session.membershipEntityIds),
    ];
    const allowedStatuses: TimeEntryStatus[] = [
      'DRAFT',
      'SUBMITTED',
      'APPROVED',
      'REJECTED',
      'POSTED',
      'CANCELLED',
    ];
    if (statusFilter && allowedStatuses.includes(statusFilter as TimeEntryStatus)) {
      conditions.push(eq(timeEntries.status, statusFilter as TimeEntryStatus));
    }

    const whereClause = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(timeEntries)
      .innerJoin(projects, eq(timeEntries.projectId, projects.id))
      .where(whereClause);

    const data = await db
      .select({
        id: timeEntries.id,
        projectId: timeEntries.projectId,
        projectCode: projects.projectCode,
        projectName: projects.name,
        employeeId: timeEntries.employeeId,
        employeeName: entities.name,
        entryDate: timeEntries.entryDate,
        hours: timeEntries.hours,
        status: timeEntries.status,
        description: timeEntries.description,
        isBillable: timeEntries.isBillable,
        submittedAt: timeEntries.submittedAt,
        approvedAt: timeEntries.approvedAt,
      })
      .from(timeEntries)
      .innerJoin(projects, eq(timeEntries.projectId, projects.id))
      .leftJoin(entities, eq(timeEntries.employeeId, entities.id))
      .where(whereClause)
      .orderBy(desc(timeEntries.entryDate), desc(timeEntries.createdAt))
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

    console.error('Failed to list customer portal time entries:', error);
    return NextResponse.json({ message: 'Failed to list time entries' }, { status: 500 });
  }
}
