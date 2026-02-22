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
} from '../../_lib';

const resetConfirmSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = resetConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid reset payload', errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const portalRepo = new CustomerPortalAuthRepository();
    const resetRecord = await portalRepo.findActivePasswordResetByTokenHash(
      hashOpaqueToken(parsed.data.token)
    );
    if (!resetRecord) {
      return NextResponse.json({ message: 'Reset token is invalid or expired' }, { status: 400 });
    }

    const user = await portalRepo.findUserById(resetRecord.portalUserId);
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await portalRepo.updateUser(user.id, {
      passwordHash,
      status: 'active',
    });
    await portalRepo.markPasswordResetUsed(resetRecord.id);

    const sessionToken = createOpaqueToken();
    const sessionHash = hashOpaqueToken(sessionToken);
    const sessionExpiry = buildSessionExpiry(14);

    await portalRepo.createSession({
      organizationId: resetRecord.organizationId,
      portalUserId: user.id,
      tokenHash: sessionHash,
      expiresAt: sessionExpiry,
      ipAddress: getRequestIpAddress(request),
      userAgent: request.headers.get('user-agent'),
    });

    await portalRepo.updateUser(user.id, {
      lastLoginAt: new Date(),
    });

    const memberships = await portalRepo.listActiveMembershipsForUser(
      resetRecord.organizationId,
      user.id
    );

    const response = NextResponse.json({
      success: true,
      organizationId: resetRecord.organizationId,
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
    console.error('Failed to confirm customer portal password reset:', error);
    return NextResponse.json({ message: 'Failed to reset password' }, { status: 500 });
  }
}
