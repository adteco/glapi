import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { OrganizationRepository } from '@glapi/database';
import { getStripeClient } from '../stripe';
import { AdminAuthError, requireAdminContext } from '../../utils/admin-auth';

export const dynamic = 'force-dynamic';

type PaymentMethodSummary = {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
};

function getDefaultPaymentMethodId(
  organization: { stripeDefaultPaymentMethodId?: string | null },
  customer: Stripe.Customer
) {
  if (organization.stripeDefaultPaymentMethodId) {
    return organization.stripeDefaultPaymentMethodId;
  }

  const defaultMethod = customer.invoice_settings?.default_payment_method;
  if (!defaultMethod) return undefined;

  return typeof defaultMethod === 'string' ? defaultMethod : defaultMethod.id;
}

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

export async function GET(request: NextRequest) {
  try {
    const { clerkOrgId } = await requireAdminContext(request);
    const orgRepo = new OrganizationRepository();
    const organization = await orgRepo.findByClerkId(clerkOrgId);

    if (!organization) {
      return NextResponse.json({ message: 'Organization not found' }, { status: 404 });
    }

    const stripe = getStripeClient();
    let customerId = await ensureStripeCustomerId(organization, clerkOrgId);
    let customer = await stripe.customers.retrieve(customerId);

    if ((customer as Stripe.DeletedCustomer).deleted) {
      const recreatedCustomer = await stripe.customers.create({
        name: organization.name,
        metadata: {
          organizationId: organization.id,
          clerkOrgId,
        },
      });
      customerId = recreatedCustomer.id;
      customer = recreatedCustomer;
      await orgRepo.update(organization.id, { stripeCustomerId: customerId });
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    const defaultPaymentMethodId = getDefaultPaymentMethodId(
      organization,
      customer as Stripe.Customer
    );

    return NextResponse.json({
      customerId,
      defaultPaymentMethodId,
      paymentMethods: paymentMethods.data.map((method): PaymentMethodSummary => ({
        id: method.id,
        brand: method.card?.brand ?? null,
        last4: method.card?.last4 ?? null,
        expMonth: method.card?.exp_month ?? null,
        expYear: method.card?.exp_year ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Failed to fetch Stripe payment methods:', error);
    return NextResponse.json({ message: 'Failed to fetch payment methods' }, { status: 500 });
  }
}
