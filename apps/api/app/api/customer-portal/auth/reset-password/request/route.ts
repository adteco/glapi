import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CustomerPortalAuthRepository, OrganizationRepository } from '@glapi/database';
import {
  buildTokenExpiry,
  createOpaqueToken,
  hashOpaqueToken,
  resolvePortalOrgSlug,
} from '../../_lib';

const resetRequestSchema = z.object({
  orgSlug: z.string().min(1).optional(),
  email: z.string().email(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = resetRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid reset request payload', errors: parsed.error.flatten() },
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
      return NextResponse.json({ success: true });
    }

    const portalRepo = new CustomerPortalAuthRepository();
    const user = await portalRepo.findUserByEmail(organization.id, parsed.data.email);

    let resetToken: string | undefined;
    if (user && user.status !== 'suspended') {
      resetToken = createOpaqueToken();
      await portalRepo.createPasswordReset({
        organizationId: organization.id,
        portalUserId: user.id,
        tokenHash: hashOpaqueToken(resetToken),
        expiresAt: buildTokenExpiry(2),
      });
    }

    const responsePayload: Record<string, unknown> = { success: true };
    if (resetToken && process.env.NODE_ENV !== 'production') {
      responsePayload.resetToken = resetToken;
      responsePayload.resetLink = `${
        process.env.CUSTOMER_PORTAL_BASE_URL || process.env.APP_URL || 'https://app.glapi.com'
      }/customer-portal/reset-password?token=${resetToken}`;
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Failed to process customer portal reset request:', error);
    return NextResponse.json({ message: 'Failed to process reset request' }, { status: 500 });
  }
}
