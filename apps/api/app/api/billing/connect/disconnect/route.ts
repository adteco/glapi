import { NextRequest, NextResponse } from 'next/server';
import { OrganizationRepository } from '@glapi/database';
import { AdminAuthError, requireAdminContext } from '../../../utils/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { clerkOrgId } = await requireAdminContext(request);
    const orgRepo = new OrganizationRepository();
    const organization = await orgRepo.findByClerkId(clerkOrgId);

    if (!organization) {
      return NextResponse.json({ message: 'Organization not found' }, { status: 404 });
    }

    await orgRepo.update(organization.id, {
      stripeAccountId: null,
      stripeConnectStatus: 'not_connected',
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      stripeOnboardingCompletedAt: null,
    });

    return NextResponse.json({
      status: 'not_connected',
      stripeAccountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Failed to disconnect Stripe Connect account:', error);
    return NextResponse.json({ message: 'Failed to disconnect Stripe Connect account' }, { status: 500 });
  }
}
