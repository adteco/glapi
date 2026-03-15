import { NextRequest, NextResponse } from 'next/server';
import { OrganizationRepository } from '@glapi/database';
import { getStripeClient } from '../stripe';
import { AdminAuthError, requireAdminContext } from '../../utils/admin-auth';

export const dynamic = 'force-dynamic';

async function ensureStripeCustomerId(
  organization: { id: string; name: string; stripeCustomerId?: string | null },
  clerkOrgId: string
) {
  const stripe = getStripeClient();
  const orgRepo = new OrganizationRepository();

  if (organization.stripeCustomerId) {
    return organization.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    name: organization.name,
    metadata: {
      organizationId: organization.id,
      clerkOrgId,
    },
  });

  await orgRepo.update(organization.id, {
    stripeCustomerId: customer.id,
  });

  return customer.id;
}

export async function POST(request: NextRequest) {
  try {
    const { clerkOrgId } = await requireAdminContext(request);
    const orgRepo = new OrganizationRepository();
    const organization = await orgRepo.findByClerkId(clerkOrgId);

    if (!organization) {
      return NextResponse.json({ message: 'Organization not found' }, { status: 404 });
    }

    const body = await request.json();
    const paymentMethodId = body?.paymentMethodId as string | undefined;

    if (!paymentMethodId) {
      return NextResponse.json({ message: 'paymentMethodId is required' }, { status: 400 });
    }

    const stripe = getStripeClient();
    const customerId = await ensureStripeCustomerId(organization, clerkOrgId);

    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    await orgRepo.update(organization.id, {
      stripeDefaultPaymentMethodId: paymentMethodId,
    });

    return NextResponse.json({
      customerId,
      defaultPaymentMethodId: paymentMethodId,
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Failed to update Stripe default payment method:', error);
    if (error instanceof Error && error.message.includes('STRIPE_SECRET_KEY is not configured')) {
      return NextResponse.json(
        { message: 'Stripe billing is not configured on the API server.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to update default payment method' },
      { status: 500 }
    );
  }
}
