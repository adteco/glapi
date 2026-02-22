import { NextRequest, NextResponse } from 'next/server';
import {
  and,
  db,
  desc,
  eq,
  inArray,
  salesOrders,
  sql,
  type SalesOrderStatusValue,
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
      eq(salesOrders.organizationId, session.organization.id),
      inArray(salesOrders.entityId, session.membershipEntityIds),
    ];
    const allowedStatuses: SalesOrderStatusValue[] = [
      'DRAFT',
      'SUBMITTED',
      'APPROVED',
      'REJECTED',
      'PARTIALLY_FULFILLED',
      'FULFILLED',
      'CLOSED',
      'CANCELLED',
      'ON_HOLD',
    ];
    if (statusFilter && allowedStatuses.includes(statusFilter as SalesOrderStatusValue)) {
      conditions.push(eq(salesOrders.status, statusFilter as SalesOrderStatusValue));
    }

    const whereClause = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(salesOrders)
      .where(whereClause);

    const data = await db
      .select({
        id: salesOrders.id,
        orderNumber: salesOrders.orderNumber,
        entityId: salesOrders.entityId,
        orderDate: salesOrders.orderDate,
        status: salesOrders.status,
        subtotal: salesOrders.subtotal,
        totalAmount: salesOrders.totalAmount,
        invoicedAmount: salesOrders.invoicedAmount,
        remainingAmount: salesOrders.remainingAmount,
      })
      .from(salesOrders)
      .where(whereClause)
      .orderBy(desc(salesOrders.orderDate))
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

    console.error('Failed to list customer portal orders:', error);
    return NextResponse.json({ message: 'Failed to list orders' }, { status: 500 });
  }
}
