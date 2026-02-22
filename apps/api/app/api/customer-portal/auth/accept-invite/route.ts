import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CustomerPortalAuthRepository } from '@glapi/database';
import {
  buildSessionExpiry,
  clearCustomerPortalSessionCookie,
  createOpaqueToken,
  getRequestIpAddress,
  hashOpaqueToken,
  hashPassword,
  setCustomerPortalSessionCookie,
} from '../_lib';

const acceptInviteSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
  fullName: z.string().min(1).max(255).optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = acceptInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid accept invite payload', errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const portalRepo = new CustomerPortalAuthRepository();
    const invite = await portalRepo.findInviteByTokenHash(hashOpaqueToken(parsed.data.token));
    if (!invite) {
      return NextResponse.json({ message: 'Invite is invalid or expired' }, { status: 400 });
    }

    const existingUser = await portalRepo.findUserByEmail(invite.organizationId, invite.email);
    if (existingUser?.status === 'suspended') {
      return NextResponse.json({ message: 'User is suspended' }, { status: 403 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const portalUser =
      existingUser ??
      (await portalRepo.createUser({
        organizationId: invite.organizationId,
        email: invite.email,
        fullName: parsed.data.fullName || null,
        passwordHash,
        status: 'active',
      }));

    if (existingUser) {
      await portalRepo.updateUser(existingUser.id, {
        fullName: parsed.data.fullName || existingUser.fullName,
        passwordHash,
        status: 'active',
      });
    }

    await portalRepo.upsertMembership({
      organizationId: invite.organizationId,
      portalUserId: portalUser.id,
      entityId: invite.entityId,
      role: invite.role,
    });
    await portalRepo.markInviteAccepted(invite.id);

    const sessionToken = createOpaqueToken();
    const sessionHash = hashOpaqueToken(sessionToken);
    const sessionExpiry = buildSessionExpiry(14);

    await portalRepo.createSession({
      organizationId: invite.organizationId,
      portalUserId: portalUser.id,
      tokenHash: sessionHash,
      expiresAt: sessionExpiry,
      ipAddress: getRequestIpAddress(request),
      userAgent: request.headers.get('user-agent'),
    });

    await portalRepo.updateUser(portalUser.id, {
      status: 'active',
      lastLoginAt: new Date(),
    });

    const memberships = await portalRepo.listActiveMembershipsForUser(
      invite.organizationId,
      portalUser.id
    );

    const response = NextResponse.json({
      success: true,
      organizationId: invite.organizationId,
      user: {
        id: portalUser.id,
        email: portalUser.email,
        fullName: parsed.data.fullName || portalUser.fullName,
      },
      memberships,
    });
    clearCustomerPortalSessionCookie(response);
    setCustomerPortalSessionCookie(response, sessionToken, sessionExpiry);

    return response;
  } catch (error) {
    console.error('Failed to accept customer portal invite:', error);
    return NextResponse.json({ message: 'Failed to accept invite' }, { status: 500 });
  }
}
