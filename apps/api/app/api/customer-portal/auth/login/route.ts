import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CustomerPortalAuthRepository, OrganizationRepository } from '@glapi/database';
import {
  buildSessionExpiry,
  clearCustomerPortalSessionCookie,
  createOpaqueToken,
  getRequestIpAddress,
  hashOpaqueToken,
  resolvePortalOrgSlug,
  setCustomerPortalSessionCookie,
  verifyPassword,
} from '../_lib';

const loginSchema = z.object({
  orgSlug: z.string().min(1).optional(),
  email: z.string().email(),
  password: z.string().min(8),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid login payload', errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const orgSlug = resolvePortalOrgSlug(request, parsed.data.orgSlug);
    if (!orgSlug) {
      return NextResponse.json({ message: 'Unable to resolve tenant' }, { status: 400 });
    }

    const organizationRepo = new OrganizationRepository();
    const organization = await organizationRepo.findBySlug(orgSlug);
    if (!organization) {
      return NextResponse.json({ message: 'Tenant not found' }, { status: 404 });
    }

    const portalRepo = new CustomerPortalAuthRepository();
    const user = await portalRepo.findUserByEmail(organization.id, parsed.data.email);
    if (!user) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    if (user.status === 'suspended') {
      return NextResponse.json({ message: 'User is suspended' }, { status: 403 });
    }

    const passwordIsValid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!passwordIsValid) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const sessionToken = createOpaqueToken();
    const sessionHash = hashOpaqueToken(sessionToken);
    const sessionExpiry = buildSessionExpiry(14);

    await portalRepo.createSession({
      organizationId: organization.id,
      portalUserId: user.id,
      tokenHash: sessionHash,
      expiresAt: sessionExpiry,
      ipAddress: getRequestIpAddress(request),
      userAgent: request.headers.get('user-agent'),
    });

    await portalRepo.updateUser(user.id, {
      status: 'active',
      lastLoginAt: new Date(),
    });

    const memberships = await portalRepo.listActiveMembershipsForUser(organization.id, user.id);

    const response = NextResponse.json({
      success: true,
      organization: {
        id: organization.id,
        slug: organization.slug,
        name: organization.name,
      },
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      memberships,
    });
    clearCustomerPortalSessionCookie(response);
    setCustomerPortalSessionCookie(response, sessionToken, sessionExpiry);

    return response;
  } catch (error) {
    console.error('Failed to log into customer portal:', error);
    return NextResponse.json({ message: 'Failed to login' }, { status: 500 });
  }
}
