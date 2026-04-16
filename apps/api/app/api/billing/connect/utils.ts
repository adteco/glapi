import type Stripe from 'stripe';
import type { NextRequest } from 'next/server';
import { OrganizationRepository } from '@glapi/database';

export type StripeConnectStatus = 'not_connected' | 'pending' | 'active' | 'restricted';

export function deriveStripeConnectStatus(account: Stripe.Account): StripeConnectStatus {
  const requirements = account.requirements;
  const hasOutstandingRequirements =
    (requirements?.currently_due?.length ?? 0) > 0 ||
    (requirements?.past_due?.length ?? 0) > 0;

  if (account.charges_enabled && account.payouts_enabled && !hasOutstandingRequirements) {
    return 'active';
  }

  if (requirements?.disabled_reason) {
    return 'restricted';
  }

  return 'pending';
}

export function getConnectRedirectUrls(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const defaultBase = `${origin}/settings/billing`;

  const returnBaseUrl = process.env.STRIPE_CONNECT_RETURN_URL || defaultBase;
  const refreshBaseUrl = process.env.STRIPE_CONNECT_REFRESH_URL || defaultBase;

  return {
    returnUrl: `${returnBaseUrl}?connect=onboarding_return`,
    refreshUrl: `${refreshBaseUrl}?connect=onboarding_refresh`,
  };
}

export async function ensureStripeConnectAccountId(
  orgRepo: OrganizationRepository,
  organization: { id: string; stripeAccountId?: string | null },
  orgId: string,
  stripe: Stripe,
): Promise<string> {
  if (organization.stripeAccountId) {
    return organization.stripeAccountId;
  }

  const account = await stripe.accounts.create({
    type: 'express',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: {
      organizationId: organization.id,
      orgId,
    },
  });

  await orgRepo.update(organization.id, {
    stripeAccountId: account.id,
    stripeConnectStatus: 'pending',
    stripeChargesEnabled: false,
    stripePayoutsEnabled: false,
  });

  return account.id;
}

export async function refreshStripeConnectState(
  orgRepo: OrganizationRepository,
  organization: {
    id: string;
    stripeAccountId?: string | null;
    stripeOnboardingCompletedAt?: Date | string | null;
  },
  stripe: Stripe,
) {
  if (!organization.stripeAccountId) {
    await orgRepo.update(organization.id, {
      stripeConnectStatus: 'not_connected',
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      stripeOnboardingCompletedAt: null,
    });

    return {
      status: 'not_connected' as StripeConnectStatus,
      stripeAccountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      requirementsCurrentlyDueCount: 0,
      onboardingCompletedAt: null as string | null,
    };
  }

  const account = await stripe.accounts.retrieve(organization.stripeAccountId);
  const status = deriveStripeConnectStatus(account);
  const onboardingCompletedAt =
    status === 'active'
      ? organization.stripeOnboardingCompletedAt || new Date()
      : organization.stripeOnboardingCompletedAt || null;

  await orgRepo.update(organization.id, {
    stripeConnectStatus: status,
    stripeChargesEnabled: !!account.charges_enabled,
    stripePayoutsEnabled: !!account.payouts_enabled,
    stripeOnboardingCompletedAt: onboardingCompletedAt,
  });

  return {
    status,
    stripeAccountId: account.id,
    chargesEnabled: !!account.charges_enabled,
    payoutsEnabled: !!account.payouts_enabled,
    requirementsCurrentlyDueCount: account.requirements?.currently_due?.length ?? 0,
    onboardingCompletedAt: onboardingCompletedAt
      ? new Date(onboardingCompletedAt).toISOString()
      : null,
  };
}
