import { NextRequest, NextResponse } from 'next/server';
import { OrganizationRepository } from '@glapi/database';
import { getStripeClient } from '../../stripe';
import { AdminAuthError, requireAdminContext, resolveAdminOrganization } from '../../../utils/admin-auth';
import { refreshStripeConnectState } from '../utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { orgId } = await requireAdminContext(request);
    const orgRepo = new OrganizationRepository();
    const organization = await resolveAdminOrganization(orgId);

    if (!organization) {
      return NextResponse.json({ message: 'Organization not found' }, { status: 404 });
    }

    const stripe = getStripeClient();
    const state = await refreshStripeConnectState(orgRepo, organization, stripe);

    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Failed to fetch Stripe Connect status:', error);
    return NextResponse.json({ message: 'Failed to fetch connect status' }, { status: 500 });
  }
}
