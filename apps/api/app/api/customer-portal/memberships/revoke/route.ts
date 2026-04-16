import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CustomerPortalAuthRepository } from '@glapi/database';
import { AdminAuthError, requireAdminContext, resolveAdminOrganization } from '../../../utils/admin-auth';

const revokeMembershipSchema = z.object({
  membershipId: z.string().uuid(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = revokeMembershipSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid revoke payload', errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { orgId } = await requireAdminContext(request);
    const organization = await resolveAdminOrganization(orgId);
    if (!organization) {
      return NextResponse.json({ message: 'Organization not found' }, { status: 404 });
    }

    const portalRepo = new CustomerPortalAuthRepository();
    const membership = await portalRepo.revokeMembership(
      organization.id,
      parsed.data.membershipId
    );
    if (!membership) {
      return NextResponse.json({ message: 'Membership not found' }, { status: 404 });
    }

    return NextResponse.json({ membership });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Failed to revoke customer portal membership:', error);
    return NextResponse.json({ message: 'Failed to revoke membership' }, { status: 500 });
  }
}
