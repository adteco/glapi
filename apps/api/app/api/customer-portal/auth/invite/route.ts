import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AuthEntityRepository,
  CustomerPortalAuthRepository,
  EntityRepository,
  OrganizationRepository,
} from '@glapi/database';
import { AdminAuthError, requireAdminContext } from '../../../utils/admin-auth';
import { buildTokenExpiry, createOpaqueToken, hashOpaqueToken } from '../_lib';

const inviteSchema = z.object({
  entityId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['billing_viewer', 'payer', 'billing_admin']).default('billing_viewer'),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid invite payload', errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const admin = await requireAdminContext(request);
    const organizationRepo = new OrganizationRepository();
    const organization = await organizationRepo.findByClerkId(admin.clerkOrgId);
    if (!organization) {
      return NextResponse.json({ message: 'Organization not found' }, { status: 404 });
    }

    const entityRepo = new EntityRepository();
    const entity = await entityRepo.findById(parsed.data.entityId, organization.id);
    if (!entity) {
      return NextResponse.json({ message: 'Customer entity not found' }, { status: 404 });
    }

    const token = createOpaqueToken();
    const tokenHash = hashOpaqueToken(token);
    const authEntityRepo = new AuthEntityRepository();
    const invitedByEntity = await authEntityRepo.findByClerkId(admin.clerkUserId);

    const portalRepo = new CustomerPortalAuthRepository();
    const invite = await portalRepo.createInvite({
      organizationId: organization.id,
      entityId: parsed.data.entityId,
      email: parsed.data.email,
      role: parsed.data.role,
      tokenHash,
      invitedByEntityId: invitedByEntity?.id ?? null,
      expiresAt: buildTokenExpiry(72),
    });

    const portalBaseUrl =
      process.env.CUSTOMER_PORTAL_BASE_URL || process.env.APP_URL || 'https://app.glapi.com';
    const inviteLink = `${portalBaseUrl}/customer-portal/accept-invite?token=${token}`;

    return NextResponse.json({
      inviteId: invite.id,
      organizationId: organization.id,
      organizationSlug: organization.slug,
      entityId: invite.entityId,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      inviteLink,
      token: process.env.NODE_ENV === 'production' ? undefined : token,
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Failed to create customer portal invite:', error);
    return NextResponse.json({ message: 'Failed to create invite' }, { status: 500 });
  }
}
