import { NextRequest, NextResponse } from 'next/server';
import { and, db, eq, invoices, inArray } from '@glapi/database';
import { InvoiceService } from '@glapi/api-service';
import {
  applyPortalSessionErrorCookies,
  PortalSessionError,
  requirePortalSession,
} from '../../../../_lib/session';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  try {
    const session = await requirePortalSession(request);
    const { invoiceId } = params;

    const [invoice] = await db
      .select({
        id: invoices.id,
        entityId: invoices.entityId,
        organizationId: invoices.organizationId,
        status: invoices.status,
        paymentLinkUrl: invoices.paymentLinkUrl,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.id, invoiceId),
          eq(invoices.organizationId, session.organization.id),
          inArray(invoices.entityId, session.membershipEntityIds)
        )
      )
      .limit(1);

    if (!invoice) {
      return NextResponse.json({ message: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ message: 'Invoice is already paid' }, { status: 400 });
    }
    if (invoice.status === 'void' || invoice.status === 'cancelled') {
      return NextResponse.json({ message: 'Invoice is not payable' }, { status: 400 });
    }

    if (invoice.paymentLinkUrl) {
      return NextResponse.json({
        invoiceId: invoice.id,
        paymentLinkUrl: invoice.paymentLinkUrl,
        reused: true,
      });
    }

    const invoiceService = new InvoiceService({
      organizationId: session.organization.id,
      userId: session.portalUser.id,
    });
    const sent = await invoiceService.sendWithPaymentLink(invoice.id);

    return NextResponse.json({
      invoiceId: sent.invoice.id,
      paymentLinkUrl: sent.paymentLinkUrl,
      stripeCheckoutSessionId: sent.stripeCheckoutSessionId,
      reused: false,
    });
  } catch (error) {
    if (error instanceof PortalSessionError) {
      const response = NextResponse.json({ message: error.message }, { status: error.status });
      applyPortalSessionErrorCookies(response, error);
      return response;
    }

    console.error('Failed to generate customer portal pay link:', error);
    return NextResponse.json({ message: 'Failed to create pay link' }, { status: 500 });
  }
}
