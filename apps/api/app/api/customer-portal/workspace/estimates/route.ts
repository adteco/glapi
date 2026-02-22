import { NextRequest, NextResponse } from 'next/server';
import {
  and,
  businessTransactions,
  db,
  desc,
  eq,
  inArray,
  sql,
  subsidiaries,
  transactionTypes,
} from '@glapi/database';
import {
  applyPortalSessionErrorCookies,
  PortalSessionError,
  requirePortalSession,
} from '../../_lib/session';

export const dynamic = 'force-dynamic';

const allowedStatuses = [
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'CONVERTED',
  'CANCELLED',
] as const;

export async function GET(request: NextRequest) {
  try {
    const session = await requirePortalSession(request);
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || '25')));
    const statusFilter = searchParams.get('status');
    const offset = (page - 1) * limit;

    const conditions = [
      eq(subsidiaries.organizationId, session.organization.id),
      eq(transactionTypes.typeCode, 'ESTIMATE'),
      inArray(businessTransactions.entityId, session.membershipEntityIds),
    ];

    if (statusFilter && (allowedStatuses as readonly string[]).includes(statusFilter)) {
      conditions.push(eq(businessTransactions.status, statusFilter));
    }

    const whereClause = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(businessTransactions)
      .innerJoin(transactionTypes, eq(businessTransactions.transactionTypeId, transactionTypes.id))
      .innerJoin(subsidiaries, eq(businessTransactions.subsidiaryId, subsidiaries.id))
      .where(whereClause);

    const data = await db
      .select({
        id: businessTransactions.id,
        estimateNumber: businessTransactions.transactionNumber,
        transactionDate: businessTransactions.transactionDate,
        estimateValidUntil: businessTransactions.estimateValidUntil,
        status: businessTransactions.status,
        totalAmount: businessTransactions.totalAmount,
        memo: businessTransactions.memo,
      })
      .from(businessTransactions)
      .innerJoin(transactionTypes, eq(businessTransactions.transactionTypeId, transactionTypes.id))
      .innerJoin(subsidiaries, eq(businessTransactions.subsidiaryId, subsidiaries.id))
      .where(whereClause)
      .orderBy(desc(businessTransactions.transactionDate), desc(businessTransactions.createdDate))
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

    console.error('Failed to list customer portal estimates:', error);
    return NextResponse.json({ message: 'Failed to list estimates' }, { status: 500 });
  }
}
