import { NextRequest, NextResponse } from 'next/server';
import {
  and,
  db,
  desc,
  eq,
  inArray,
  invoices,
  payments,
  sql,
  type Invoice,
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
      eq(invoices.organizationId, session.organization.id),
      inArray(invoices.entityId, session.membershipEntityIds),
    ];

    const allowedStatuses: Array<Invoice['status']> = [
      'draft',
      'sent',
      'paid',
      'partial',
      'overdue',
      'cancelled',
      'void',
    ];
    if (statusFilter && allowedStatuses.includes(statusFilter as Invoice['status'])) {
      conditions.push(eq(invoices.status, statusFilter as Invoice['status']));
    }

    const whereClause = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(invoices)
      .where(whereClause);

    const rows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        entityId: invoices.entityId,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        totalAmount: invoices.totalAmount,
        status: invoices.status,
        paymentLinkUrl: invoices.paymentLinkUrl,
        paidAmount: sql<string>`
          COALESCE(
            (
              SELECT SUM(${payments.amount})
              FROM ${payments}
              WHERE ${payments.invoiceId} = ${invoices.id}
                AND ${payments.status} = 'completed'
            ),
            0
          )::text
        `,
      })
      .from(invoices)
      .where(whereClause)
      .orderBy(desc(invoices.invoiceDate))
      .limit(limit)
      .offset(offset);

    const data = rows.map((row) => {
      const total = Number(row.totalAmount || 0);
      const paid = Number(row.paidAmount || 0);
      const balanceDue = Math.max(0, total - paid);

      return {
        ...row,
        balanceDue: balanceDue.toFixed(2),
      };
    });

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

    console.error('Failed to list customer portal invoices:', error);
    return NextResponse.json({ message: 'Failed to list invoices' }, { status: 500 });
  }
}
