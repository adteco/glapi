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

    const stripe = getStripeClient();
    const customerId = await ensureStripeCustomerId(organization, clerkOrgId);

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });

    if (!setupIntent.client_secret) {
      return NextResponse.json({ message: 'Missing setup intent secret' }, { status: 500 });
    }

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Failed to create Stripe setup intent:', error);
    return NextResponse.json({ message: 'Failed to create setup intent' }, { status: 500 });
  }
}
