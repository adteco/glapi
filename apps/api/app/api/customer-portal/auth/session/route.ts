import { NextRequest, NextResponse } from 'next/server';
import { CustomerPortalAuthRepository, OrganizationRepository } from '@glapi/database';
import {
  clearCustomerPortalSessionCookie,
  getCustomerPortalSessionToken,
  hashOpaqueToken,
  resolvePortalOrgSlug,
} from '../_lib';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sessionToken = getCustomerPortalSessionToken(request);
  if (!sessionToken) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const portalRepo = new CustomerPortalAuthRepository();
  const session = await portalRepo.findActiveSessionByTokenHash(hashOpaqueToken(sessionToken));
  if (!session) {
    const response = NextResponse.json({ authenticated: false }, { status: 401 });
    clearCustomerPortalSessionCookie(response);
    return response;
  }

  const organizationRepo = new OrganizationRepository();
  const organization = await organizationRepo.findById(session.organizationId);
  if (!organization) {
    const response = NextResponse.json({ authenticated: false }, { status: 401 });
    clearCustomerPortalSessionCookie(response);
    return response;
  }

  const resolvedSlug = resolvePortalOrgSlug(request);
  if (resolvedSlug && resolvedSlug !== organization.slug) {
    const response = NextResponse.json({ authenticated: false }, { status: 403 });
    clearCustomerPortalSessionCookie(response);
    return response;
  }

  if (session.user.status !== 'active') {
    await portalRepo.revokeSession(session.id);
    const response = NextResponse.json({ authenticated: false }, { status: 403 });
    clearCustomerPortalSessionCookie(response);
    return response;
  }

  await portalRepo.touchSession(session.id);
  const memberships = await portalRepo.listActiveMembershipsForUser(
    session.organizationId,
    session.portalUserId
  );

  return NextResponse.json({
    authenticated: true,
    organization: {
      id: organization.id,
      slug: organization.slug,
      name: organization.name,
    },
    user: {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      status: session.user.status,
    },
    memberships,
    expiresAt: session.expiresAt,
  });
}
