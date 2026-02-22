import { NextRequest, NextResponse } from 'next/server';
import { CustomerPortalAuthRepository } from '@glapi/database';
import {
  clearCustomerPortalSessionCookie,
  getCustomerPortalSessionToken,
  hashOpaqueToken,
} from '../_lib';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const sessionToken = getCustomerPortalSessionToken(request);
  const response = NextResponse.json({ success: true });

  if (!sessionToken) {
    clearCustomerPortalSessionCookie(response);
    return response;
  }

  const portalRepo = new CustomerPortalAuthRepository();
  const session = await portalRepo.findActiveSessionByTokenHash(hashOpaqueToken(sessionToken));
  if (session) {
    await portalRepo.revokeSession(session.id);
  }

  clearCustomerPortalSessionCookie(response);
  return response;
}
