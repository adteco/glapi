import { NextRequest, NextResponse } from 'next/server';
import { InvoiceRepository, PaymentRepository } from '@glapi/database';
import {
  applyPortalSessionErrorCookies,
  PortalSessionError,
  requirePortalSession,
} from '../../../_lib/session';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  try {
    const session = await requirePortalSession(request);
    const { invoiceId } = params;

    const invoiceRepo = new InvoiceRepository();
    const invoice = await invoiceRepo.findByIdWithDetails(invoiceId);
    if (!invoice || invoice.organizationId !== session.organization.id) {
      return NextResponse.json({ message: 'Invoice not found' }, { status: 404 });
    }
    if (!session.membershipEntityIds.includes(invoice.entityId)) {
      return NextResponse.json({ message: 'Access denied' }, { status: 403 });
    }

    const paymentRepo = new PaymentRepository();
    const payments = await paymentRepo.getByInvoice(invoiceId);

    return NextResponse.json({
      invoice,
      payments,
    });
  } catch (error) {
    if (error instanceof PortalSessionError) {
      const response = NextResponse.json({ message: error.message }, { status: error.status });
      applyPortalSessionErrorCookies(response, error);
      return response;
    }

    console.error('Failed to fetch customer portal invoice detail:', error);
    return NextResponse.json({ message: 'Failed to fetch invoice detail' }, { status: 500 });
  }
}
