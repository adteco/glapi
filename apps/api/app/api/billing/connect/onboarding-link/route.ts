import { NextRequest, NextResponse } from 'next/server';
import { OrganizationRepository } from '@glapi/database';
import { getStripeClient } from '../../stripe';
import { AdminAuthError, requireAdminContext } from '../../../utils/admin-auth';
import { ensureStripeConnectAccountId, getConnectRedirectUrls } from '../utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { clerkOrgId } = await requireAdminContext(request);
    const orgRepo = new OrganizationRepository();
    const organization = await orgRepo.findByClerkId(clerkOrgId);

    if (!organization) {
      return NextResponse.json({ message: 'Organization not found' }, { status: 404 });
    }

    const stripe = getStripeClient();
    const stripeAccountId = await ensureStripeConnectAccountId(
      orgRepo,
      organization,
      clerkOrgId,
      stripe,
    );
    const { returnUrl, refreshUrl } = getConnectRedirectUrls(request);

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      type: 'account_onboarding',
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });

    return NextResponse.json({
      stripeAccountId,
      onboardingUrl: accountLink.url,
      expiresAt: accountLink.expires_at,
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Failed to create Stripe Connect onboarding link:', error);
    return NextResponse.json({ message: 'Failed to create onboarding link' }, { status: 500 });
  }
}
