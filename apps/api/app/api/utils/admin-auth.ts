import type { NextRequest } from 'next/server';
import { extractBearerToken } from './request-auth';
import {
  getClerkOrganizationMembership,
  verifyClerkBearerToken,
} from './clerk-token';

const ADMIN_ROLES = new Set(['admin', 'owner', 'org:admin', 'org:owner']);

export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminAuthError';
    this.status = status;
  }
}

export async function requireAdminContext(request: NextRequest): Promise<{
  clerkOrgId: string;
  clerkUserId: string;
  role?: string;
}> {
  const token = extractBearerToken(request.headers);
  if (!token) {
    throw new AdminAuthError('Missing or invalid authorization header', 401);
  }
  const requestedOrganizationId = request.headers.get('x-organization-id');

  let verifiedToken;
  try {
    verifiedToken = await verifyClerkBearerToken(token);
  } catch (error) {
    console.error('Failed to verify Clerk token:', error);
    throw new AdminAuthError(
      error instanceof Error ? error.message : 'Invalid or expired token',
      401
    );
  }

  let clerkOrgId = verifiedToken.organizationId;
  if (!clerkOrgId && requestedOrganizationId?.startsWith('org_')) {
    const membership = await getClerkOrganizationMembership(
      verifiedToken.userId,
      requestedOrganizationId
    );

    if (!membership) {
      throw new AdminAuthError(
        'Authenticated user is not a member of the requested organization',
        403
      );
    }

    clerkOrgId = membership.clerkOrgId;
    verifiedToken.role = verifiedToken.role || membership.role;
  }

  if (!clerkOrgId) {
    throw new AdminAuthError(
      'No organization context found in token or verified request headers',
      401
    );
  }

  const role = verifiedToken.role;

  if (!role || !ADMIN_ROLES.has(role)) {
    throw new AdminAuthError('Admin role required', 403);
  }

  return {
    clerkOrgId,
    clerkUserId: verifiedToken.userId,
    role,
  };
}
