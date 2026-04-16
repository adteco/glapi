import type { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { extractBearerToken } from './request-auth';
import {
  getClerkOrganizationMembership,
  getClerkSecretKey,
  verifyClerkBearerToken,
} from './clerk-token';
import { auth as betterAuth } from '@glapi/auth';
import {
  OrganizationRepository,
  PermissionRepository,
  withOrganizationContext,
} from '@glapi/database';

const ADMIN_ROLES = new Set(['admin', 'owner', 'org:admin', 'org:owner']);
const ADMIN_RBAC_ROLES = new Set(['ADMIN', 'OWNER', 'SUPER_ADMIN']);

type AuthProviderMode = 'clerk' | 'dual' | 'better-auth';

function getAuthProviderMode(): AuthProviderMode {
  const configuredMode = process.env.AUTH_PROVIDER_MODE?.trim().toLowerCase();
  switch (configuredMode) {
    case 'dual': return 'dual';
    case 'better-auth':
    case 'better_auth': return 'better-auth';
    case 'clerk':
    case undefined:
    case '': return 'clerk';
    default: return 'clerk';
  }
}

export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminAuthError';
    this.status = status;
  }
}

export interface AdminContext {
  orgId: string;
  userId: string;
  role?: string;
  /** @deprecated Use orgId */
  clerkOrgId: string;
  /** @deprecated Use userId */
  clerkUserId: string;
}

/**
 * Verify that the request is from an admin user.
 * Supports both Clerk bearer tokens and Better Auth session cookies.
 */
export async function requireAdminContext(request: NextRequest): Promise<AdminContext> {
  const authMode = getAuthProviderMode();
  const token = extractBearerToken(request.headers);

  // 1. Try Clerk bearer token (when available and mode allows it)
  if (token && authMode !== 'better-auth') {
    const clerkSecret = getClerkSecretKey();
    if (clerkSecret) {
      try {
        return await verifyClerkAdmin(token, request);
      } catch (error) {
        // In dual mode, fall through to Better Auth
        if (authMode !== 'dual') throw error;
        console.warn('[admin-auth] Clerk verification failed, trying Better Auth:',
          error instanceof Error ? error.message : error);
      }
    }
  }

  // 2. Try Better Auth session cookie (when mode allows it)
  if (authMode === 'dual' || authMode === 'better-auth') {
    try {
      return await verifyBetterAuthAdmin(request);
    } catch (error) {
      if (authMode === 'better-auth') throw error;
      console.warn('[admin-auth] Better Auth verification failed:',
        error instanceof Error ? error.message : error);
    }
  }

  // 3. No valid auth found
  throw new AdminAuthError('Missing or invalid authorization', 401);
}

/**
 * Verify admin access using Clerk bearer token (existing logic)
 */
async function verifyClerkAdmin(token: string, request: NextRequest): Promise<AdminContext> {
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

  const requestedOrganizationId = request.headers.get('x-organization-id');
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
    orgId: clerkOrgId,
    userId: verifiedToken.userId,
    clerkOrgId,
    clerkUserId: verifiedToken.userId,
    role,
  };
}

/**
 * Resolve an organization from an admin context orgId.
 * Handles both Clerk org IDs (org_xxx) and database UUIDs.
 * Use this in billing/admin routes instead of orgRepo.findByClerkId().
 */
export async function resolveAdminOrganization(orgId: string) {
  const orgRepo = new OrganizationRepository();

  // Try by Clerk ID first (org_xxx format)
  if (orgId.startsWith('org_')) {
    return orgRepo.findByClerkId(orgId);
  }

  // Try by database UUID
  const byId = await orgRepo.findById(orgId);
  if (byId) return byId;

  // Fallback: try Better Auth ID
  const byBetterAuth = await orgRepo.findByBetterAuthId(orgId);
  if (byBetterAuth) return byBetterAuth;

  // Last resort: try Clerk ID anyway (might be a non-standard format)
  return orgRepo.findByClerkId(orgId);
}

/**
 * Verify admin access using Better Auth session cookie
 */
async function verifyBetterAuthAdmin(request: NextRequest): Promise<AdminContext> {
  // Get session from Better Auth using request headers (includes cookies)
  const headersList = await headers();
  const session = await betterAuth.api.getSession({ headers: headersList });

  if (!session) {
    throw new AdminAuthError('No valid Better Auth session found', 401);
  }

  const betterAuthUserId = session.user.id;
  const betterAuthOrgId = session.session.activeOrganizationId;

  if (!betterAuthOrgId) {
    throw new AdminAuthError('No active organization in Better Auth session', 401);
  }

  // Check if user is admin in the Better Auth organization
  const memberResponse = await betterAuth.api.getFullOrganization({
    headers: headersList,
  });

  let isAdmin = false;
  if (memberResponse) {
    const currentMember = memberResponse.members?.find(
      (m: any) => m.userId === betterAuthUserId
    );
    if (currentMember) {
      isAdmin = ADMIN_ROLES.has(currentMember.role);
    }
  }

  // Also check RBAC roles in our database
  if (!isAdmin) {
    try {
      const orgRepo = new OrganizationRepository();
      const dbOrg = await orgRepo.findByBetterAuthId(betterAuthOrgId);

      if (dbOrg) {
        const { unsafeOrganizationId } = await import('@glapi/shared-types');
        const orgId = unsafeOrganizationId(dbOrg.id);

        isAdmin = await withOrganizationContext({ organizationId: orgId }, async (contextDb) => {
          const permRepo = new PermissionRepository(contextDb);
          // Look up entity by Better Auth user ID
          const { AuthEntityRepository } = await import('@glapi/database');
          const authEntityRepo = new AuthEntityRepository(contextDb);
          const entity = await authEntityRepo.findByBetterAuthId(betterAuthUserId);

          if (!entity) return false;

          const entityRoles = await permRepo.findEntityRoles(entity.id);
          return entityRoles.some((er) => er.role && ADMIN_RBAC_ROLES.has(er.role.roleName));
        });
      }
    } catch (error) {
      console.warn('[admin-auth] RBAC role check failed:', error);
    }
  }

  if (!isAdmin) {
    throw new AdminAuthError('Admin role required', 403);
  }

  // Resolve database org ID for downstream use
  const orgRepo = new OrganizationRepository();
  const dbOrg = await orgRepo.findByBetterAuthId(betterAuthOrgId);
  const resolvedOrgId = dbOrg?.id ?? betterAuthOrgId;

  return {
    orgId: resolvedOrgId,
    userId: betterAuthUserId,
    clerkOrgId: resolvedOrgId, // backward compat
    clerkUserId: betterAuthUserId, // backward compat
    role: 'admin',
  };
}
