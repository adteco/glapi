import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  CustomerPortalAuthRepository,
  EntityRepository,
} from '@glapi/database';
import { AdminAuthError, requireAdminContext, resolveAdminOrganization } from '../../../utils/admin-auth';

const createMembershipSchema = z.object({
  portalUserId: z.string().uuid(),
  entityId: z.string().uuid(),
  role: z.enum(['billing_viewer', 'payer', 'billing_admin']),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createMembershipSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid membership payload', errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { orgId } = await requireAdminContext(request);
    const organization = await resolveAdminOrganization(orgId);
    if (!organization) {
      return NextResponse.json({ message: 'Organization not found' }, { status: 404 });
    }

    const portalRepo = new CustomerPortalAuthRepository();
    const portalUser = await portalRepo.findUserById(parsed.data.portalUserId);
    if (!portalUser || portalUser.organizationId !== organization.id) {
      return NextResponse.json({ message: 'Portal user not found' }, { status: 404 });
    }

    const entityRepo = new EntityRepository();
    const entity = await entityRepo.findById(parsed.data.entityId, organization.id);
    if (!entity) {
      return NextResponse.json({ message: 'Customer entity not found' }, { status: 404 });
    }

    const membership = await portalRepo.upsertMembership({
      organizationId: organization.id,
      portalUserId: parsed.data.portalUserId,
      entityId: parsed.data.entityId,
      role: parsed.data.role,
    });

    return NextResponse.json({ membership });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Failed to create customer portal membership:', error);
    return NextResponse.json({ message: 'Failed to create membership' }, { status: 500 });
  }
}
