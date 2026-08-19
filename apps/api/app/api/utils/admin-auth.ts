import type { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth as betterAuth } from '@glapi/auth';
import {
  OrganizationRepository,
  PermissionRepository,
  withOrganizationContext,
} from '@glapi/database';
import { unsafeOrganizationId } from '@glapi/shared-types';

const ADMIN_ROLES = new Set(['admin', 'owner', 'org:admin', 'org:owner']);
const ADMIN_RBAC_ROLES = new Set(['ADMIN', 'OWNER', 'SUPER_ADMIN']);

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
}

/**
 * Verify that the request is from an admin user.
 * Supports Better Auth session cookies.
 */
export async function requireAdminContext(request: NextRequest): Promise<AdminContext> {
  try {
    return await verifyBetterAuthAdmin(request);
  } catch (error) {
    throw new AdminAuthError(
      error instanceof Error ? error.message : 'Missing or invalid authorization',
      error instanceof AdminAuthError ? error.status : 401
    );
  }
}

/**
 * Resolve an organization from an admin context orgId.
 * Handles database UUIDs or Better Auth IDs.
 */
export async function resolveAdminOrganization(orgId: string) {
  const orgRepo = new OrganizationRepository();

  // Try by database UUID
  const byId = await orgRepo.findById(orgId);
  if (byId) return byId;

  // Fallback: try Better Auth ID
  const byBetterAuth = await orgRepo.findByBetterAuthId(orgId);
  if (byBetterAuth) return byBetterAuth;

  return null;
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
    role: 'admin',
  };
}
