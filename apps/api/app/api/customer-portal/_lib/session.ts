import type { NextRequest, NextResponse } from 'next/server';
import {
  CustomerPortalAuthRepository,
  OrganizationRepository,
  type CustomerPortalMembership,
  type CustomerPortalUser,
} from '@glapi/database';
import {
  clearCustomerPortalSessionCookie,
  getCustomerPortalSessionToken,
  hashOpaqueToken,
  resolvePortalOrgSlug,
} from '../auth/_lib';

export class PortalSessionError extends Error {
  status: number;
  clearCookie: boolean;

  constructor(message: string, status: number, clearCookie = false) {
    super(message);
    this.name = 'PortalSessionError';
    this.status = status;
    this.clearCookie = clearCookie;
  }
}

export interface PortalSessionContext {
  organization: {
    id: string;
    slug: string;
    name: string;
  };
  portalUser: CustomerPortalUser;
  memberships: CustomerPortalMembership[];
  membershipEntityIds: string[];
}

export async function requirePortalSession(
  request: NextRequest
): Promise<PortalSessionContext> {
  const sessionToken = getCustomerPortalSessionToken(request);
  if (!sessionToken) {
    throw new PortalSessionError('Missing customer portal session', 401);
  }

  const portalRepo = new CustomerPortalAuthRepository();
  const session = await portalRepo.findActiveSessionByTokenHash(hashOpaqueToken(sessionToken));
  if (!session) {
    throw new PortalSessionError('Session is invalid or expired', 401, true);
  }

  const organizationRepo = new OrganizationRepository();
  const organization = await organizationRepo.findById(session.organizationId);
  if (!organization) {
    throw new PortalSessionError('Organization not found', 404, true);
  }

  const resolvedSlug = resolvePortalOrgSlug(request);
  if (resolvedSlug && resolvedSlug !== organization.slug) {
    throw new PortalSessionError('Tenant mismatch', 403, true);
  }

  if (session.user.status !== 'active') {
    await portalRepo.revokeSession(session.id);
    throw new PortalSessionError('User is not active', 403, true);
  }

  await portalRepo.touchSession(session.id);
  const membershipsWithEntity = await portalRepo.listActiveMembershipsForUser(
    organization.id,
    session.portalUserId
  );

  const memberships = membershipsWithEntity.map((membership) => ({
    ...membership,
  }));
  const membershipEntityIds = memberships.map((membership) => membership.entityId);
  if (membershipEntityIds.length === 0) {
    throw new PortalSessionError('No active customer memberships found', 403);
  }

  return {
    organization: {
      id: organization.id,
      slug: organization.slug,
      name: organization.name,
    },
    portalUser: session.user,
    memberships,
    membershipEntityIds,
  };
}

export function applyPortalSessionErrorCookies(
  response: NextResponse,
  error: PortalSessionError
): void {
  if (error.clearCookie) {
    clearCustomerPortalSessionCookie(response);
  }
}
