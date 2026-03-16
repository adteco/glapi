import { headers } from 'next/headers';
import { PermissionService } from '@glapi/api-service';
import {
  OrganizationRepository,
  AuthEntityRepository,
  withOrganizationContext,
} from '@glapi/database';
import type { ResourceType, Action, AccessLevel } from '@glapi/api-service';
import type {
  ClerkUserId,
  ClerkOrgId,
  EntityId,
  OrganizationId,
} from '@glapi/shared-types';
import {
  isValidUuid,
  unsafeClerkUserId,
  unsafeClerkOrgId,
  unsafeEntityId,
  unsafeOrganizationId,
} from '@glapi/shared-types';
import { extractBearerToken } from './request-auth';
import {
  getClerkOrganization,
  getClerkOrganizationMembership,
  getClerkSecretKey,
  verifyClerkBearerToken,
} from './clerk-token';

export interface OrganizationContext {
  /**
   * Database organization UUID for RLS context.
   */
  organizationId: OrganizationId;

  /**
   * Database entity UUID for audit fields (created_by, modified_by).
   * May be null if user doesn't have an entity record yet.
   */
  entityId: EntityId | null;

  /**
   * Clerk user ID for external reference and logging.
   */
  clerkUserId: ClerkUserId;

  /**
   * Clerk organization ID (original value from header).
   */
  clerkOrganizationId?: ClerkOrgId;

  /**
   * API key name if authenticated via API key.
   */
  apiKeyName?: string;

  /**
   * Organization name for debugging headers.
   */
  organizationName?: string;

  /**
   * @deprecated Use `clerkUserId` instead. Kept for backward compatibility.
   */
  userId: string;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// Cache for Clerk org ID to database org ID and name mapping
const orgCache = new Map<string, { id: string; name: string; clerkOrgId?: string }>();

// Cache for Clerk user ID to entity ID mapping
const entityIdCache = new Map<string, string>();

export function resetAuthCachesForTest() {
  orgCache.clear();
  entityIdCache.clear();
}

interface ResolvedOrganization {
  id: OrganizationId;
  name?: string;
  clerkOrgId?: string;
}

interface VerifiedClerkRequestContext {
  organizationId: OrganizationId;
  organizationName?: string;
  entityId: EntityId;
  clerkUserId: ClerkUserId;
  clerkOrganizationId: ClerkOrgId;
}

async function resolveHeaderBackedContext(
  rawOrganizationId: string | null,
  rawUserId: string | null,
  apiKeyName?: string
): Promise<OrganizationContext> {
  const resolvedOrg = rawOrganizationId ? await resolveOrganization(rawOrganizationId) : null;
  let resolvedEntityId =
    rawUserId && resolvedOrg
      ? await resolveEntityId(rawUserId, resolvedOrg.id)
      : rawUserId
        ? await resolveEntityId(rawUserId)
        : null;

  if (!rawOrganizationId || !rawUserId) {
    throw new AuthenticationError(
      'Organization context required. Ensure trusted x-organization-id and x-user-id headers are set.'
    );
  }

  if (!resolvedOrg) {
    throw new AuthenticationError(`Could not resolve organization ID: ${rawOrganizationId}`);
  }

  if (!resolvedEntityId && rawUserId) {
    resolvedEntityId = await ensureEntityForClerkUser(rawUserId, resolvedOrg.id);
  }

  const dbUserId =
    resolvedEntityId ??
    (isValidUuid(rawUserId) ? unsafeEntityId(rawUserId) : null);

  if (!dbUserId) {
    throw new AuthenticationError(
      'Invalid user context. x-user-id must be an entity UUID or map to an entity record.'
    );
  }

  return {
    organizationId: resolvedOrg.id,
    organizationName: resolvedOrg.name,
    entityId: resolvedEntityId ?? (isValidUuid(rawUserId) ? unsafeEntityId(rawUserId) : null),
    clerkUserId: unsafeClerkUserId(rawUserId),
    clerkOrganizationId: rawOrganizationId.startsWith('org_')
      ? unsafeClerkOrgId(rawOrganizationId)
      : undefined,
    apiKeyName,
    userId: dbUserId,
  };
}

async function verifyClerkRequest(
  headersList: Awaited<ReturnType<typeof headers>>
): Promise<VerifiedClerkRequestContext | null> {
  const token = extractBearerToken(headersList);
  if (!token) {
    return null;
  }
  const rawOrganizationId = headersList.get('x-organization-id');
  const requestedOrganization = rawOrganizationId
    ? await resolveOrganization(rawOrganizationId)
    : null;

  let verifiedToken;
  try {
    verifiedToken = await verifyClerkBearerToken(token);
  } catch (error) {
    console.error('[auth] Failed to verify Clerk token', error);
    throw new AuthenticationError(
      error instanceof Error ? error.message : 'Invalid or expired bearer token'
    );
  }

  let tokenOrganizationId = verifiedToken.organizationId;
  let resolvedOrg =
    tokenOrganizationId ? await resolveOrganization(tokenOrganizationId) : null;

  if (!tokenOrganizationId && requestedOrganization?.clerkOrgId) {
    const membership = await getClerkOrganizationMembership(
      verifiedToken.userId,
      requestedOrganization.clerkOrgId
    );

    if (!membership) {
      throw new AuthenticationError(
        'Authenticated user is not a member of the requested organization.'
      );
    }

    tokenOrganizationId = membership.clerkOrgId;
    resolvedOrg = requestedOrganization;
  }

  if (!resolvedOrg) {
    if (tokenOrganizationId) {
      throw new AuthenticationError(
        `Could not resolve organization ID from token: ${tokenOrganizationId}`
      );
    }

    throw new AuthenticationError(
      'No organization context found in bearer token or verified request headers'
    );
  }

  let resolvedEntityId = await resolveEntityId(verifiedToken.userId, resolvedOrg.id);
  if (!resolvedEntityId) {
    resolvedEntityId = await ensureEntityForClerkUser(verifiedToken.userId, resolvedOrg.id);
  }

  if (!resolvedEntityId) {
    throw new AuthenticationError(
      'Authenticated user could not be resolved to an entity record.'
    );
  }

  if (rawOrganizationId) {
    if (!requestedOrganization || requestedOrganization.id !== resolvedOrg.id) {
      throw new AuthenticationError(
        'Organization header does not match authenticated token context.'
      );
    }
  }

  const rawUserId = headersList.get('x-user-id');
  if (rawUserId && rawUserId !== verifiedToken.userId && rawUserId !== resolvedEntityId) {
    throw new AuthenticationError('User header does not match authenticated token context.');
  }

  return {
    organizationId: resolvedOrg.id,
    organizationName: resolvedOrg.name,
    entityId: resolvedEntityId,
    clerkUserId: unsafeClerkUserId(verifiedToken.userId),
    clerkOrganizationId: tokenOrganizationId.startsWith('org_')
      ? unsafeClerkOrgId(tokenOrganizationId)
      : undefined,
  };
}

/**
 * Resolve a Clerk org ID (org_xxxxx) to a database organization UUID and name
 */
async function resolveOrganization(clerkOrgId: string): Promise<ResolvedOrganization | null> {
  // Check cache first
  if (orgCache.has(clerkOrgId)) {
    const cached = orgCache.get(clerkOrgId)!;
    return {
      id: unsafeOrganizationId(cached.id),
      name: cached.name,
      clerkOrgId: cached.clerkOrgId,
    };
  }

  // If it's already a UUID format, look up org by ID to get the name
  if (isValidUuid(clerkOrgId)) {
    try {
      const orgRepo = new OrganizationRepository();
      const org = await orgRepo.findById(clerkOrgId);
      if (org) {
        const resolved = { id: org.id, name: org.name, clerkOrgId: org.clerkOrgId || undefined };
        orgCache.set(clerkOrgId, resolved);
        if (org.clerkOrgId) {
          orgCache.set(org.clerkOrgId, resolved);
        }
        return {
          id: unsafeOrganizationId(org.id),
          name: org.name,
          clerkOrgId: org.clerkOrgId || undefined,
        };
      }
    } catch (error) {
      console.error('Failed to look up organization by UUID:', error);
    }
    return { id: unsafeOrganizationId(clerkOrgId) };
  }

  // Look up by Clerk org ID
  try {
    const orgRepo = new OrganizationRepository();
    const org = await orgRepo.findByClerkId(clerkOrgId);

    if (org) {
      const resolved = { id: org.id, name: org.name, clerkOrgId: org.clerkOrgId || undefined };
      orgCache.set(clerkOrgId, resolved);
      orgCache.set(org.id, resolved);
      return {
        id: unsafeOrganizationId(org.id),
        name: org.name,
        clerkOrgId: org.clerkOrgId || undefined,
      };
    }

    // Self-healing: if the organization exists in Clerk but not in our database,
    // provision it now. This handles the case where webhooks are delayed or failed.
    if (clerkOrgId.startsWith('org_')) {
      const clerkOrg = await getClerkOrganization(clerkOrgId);
      if (clerkOrg) {
        const created = await orgRepo.createFromClerk({
          clerkOrgId,
          name: clerkOrg.name,
          slug: clerkOrg.slug || clerkOrg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        });

        console.warn('[auth] Auto-provisioned missing organization from Clerk API', {
          clerkOrgId,
          orgId: created.id,
        });

        const resolved = { id: created.id, name: created.name, clerkOrgId: created.clerkOrgId || undefined };
        orgCache.set(clerkOrgId, resolved);
        orgCache.set(created.id, resolved);
        return {
          id: unsafeOrganizationId(created.id),
          name: created.name,
          clerkOrgId: created.clerkOrgId || undefined,
        };
      }
    }
  } catch (error) {
    console.error('Failed to resolve organization ID:', error);
  }

  return null;
}

/**
 * Resolve a Clerk user ID (user_xxxxx) to a database entity UUID
 * This supports the consolidated auth model where entities serve as authenticated users
 */
async function resolveEntityId(
  clerkUserId: string,
  organizationId?: OrganizationId
): Promise<EntityId | null> {
  // Check cache first
  if (entityIdCache.has(clerkUserId)) {
    return unsafeEntityId(entityIdCache.get(clerkUserId)!);
  }

  // If it's already a UUID format, return as-is (already an entity ID)
  if (isValidUuid(clerkUserId)) {
    return unsafeEntityId(clerkUserId);
  }

  // Look up by Clerk user ID
  try {
    const entity = organizationId
      ? await withOrganizationContext({ organizationId }, async (contextDb) => {
          const authEntityRepo = new AuthEntityRepository(contextDb);
          return authEntityRepo.findByClerkId(clerkUserId);
        })
      : await new AuthEntityRepository().findByClerkId(clerkUserId);

    if (entity) {
      entityIdCache.set(clerkUserId, entity.id);
      return unsafeEntityId(entity.id);
    }
  } catch (error) {
    console.error('Failed to resolve entity ID from Clerk user ID:', error);
  }

  return null;
}

/**
 * Ensure a Clerk user has an auth-enabled entity row for the organization.
 * This is a self-healing path for environments where Clerk webhooks were not delivered.
 */
async function ensureEntityForClerkUser(
  clerkUserId: string,
  organizationId: OrganizationId
): Promise<EntityId | null> {
  if (!clerkUserId.startsWith('user_')) {
    return null;
  }

  try {
    const entityId = await withOrganizationContext(
      { organizationId },
      async (contextDb) => {
        const authEntityRepo = new AuthEntityRepository(contextDb);
        const existing = await authEntityRepo.findByClerkId(clerkUserId);

        if (existing) {
          return existing.id;
        }

        // Placeholder profile values; Clerk webhook sync can update profile details later.
        const created = await authEntityRepo.createUserEntity({
          clerkUserId,
          email: `${clerkUserId}@placeholder.local`,
          name: `User ${clerkUserId.slice(-8)}`,
          displayName: null,
          organizationId,
          role: 'user',
        });

        console.warn('[auth] Auto-provisioned missing auth entity for Clerk user', {
          clerkUserId,
          organizationId,
          entityId: created.id,
        });

        return created.id;
      }
    );

    entityIdCache.set(clerkUserId, entityId);
    return unsafeEntityId(entityId);
  } catch (error) {
    console.error('[auth] Failed to auto-provision auth entity', {
      clerkUserId,
      organizationId,
      error,
    });

    return null;
  }
}

export async function getServiceContext(): Promise<OrganizationContext> {
  const headersList = await headers();

  const rawOrganizationId = headersList.get('x-organization-id');
  const rawUserId = headersList.get('x-user-id');
  const apiKeyName = headersList.get('x-api-key-name');

  const DEV_ORG_ID = 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2';
  // Stable UUID used for dev/test contexts (Karate defaults to this value).
  const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

  const isProduction = process.env.NODE_ENV === 'production';

  if (apiKeyName) {
    return resolveHeaderBackedContext(rawOrganizationId, rawUserId, apiKeyName || undefined);
  }

  const clerkSecret = getClerkSecretKey();
  if (clerkSecret) {
    try {
      const verifiedClerkContext = await verifyClerkRequest(headersList);
      if (verifiedClerkContext) {
        return {
          organizationId: verifiedClerkContext.organizationId,
          organizationName: verifiedClerkContext.organizationName,
          entityId: verifiedClerkContext.entityId,
          clerkUserId: verifiedClerkContext.clerkUserId,
          clerkOrganizationId: verifiedClerkContext.clerkOrganizationId,
          userId: verifiedClerkContext.entityId,
        };
      }
    } catch (error) {
      if (isProduction) throw error;
      console.warn('[auth] Clerk authentication failed:', error instanceof Error ? error.message : error);
    }
  }

  if (isProduction) {
    throw new AuthenticationError(
      'Authentication required. Provide a valid Clerk bearer token with organization context.'
    );
  }

  // Development fallback: allow partial headers, but always produce UUID-safe IDs so
  // writes with UUID audit columns (e.g. sales_orders.created_by) don't explode.
  const devOrgId = unsafeOrganizationId(DEV_ORG_ID);
  const devEntityId = unsafeEntityId(DEV_USER_ID);

  const resolvedOrg = rawOrganizationId ? await resolveOrganization(rawOrganizationId) : null;
  const resolvedEntityId =
    rawUserId && resolvedOrg
      ? await resolveEntityId(rawUserId, resolvedOrg.id)
      : rawUserId
        ? await resolveEntityId(rawUserId)
        : null;

  const organizationId = resolvedOrg?.id ?? devOrgId;
  const organizationName = resolvedOrg?.name ?? 'Development';

  // If the caller provided a UUID, treat it as an entity ID. Otherwise, use a stable dev UUID.
  const entityId =
    resolvedEntityId ??
    (rawUserId && isValidUuid(rawUserId) ? unsafeEntityId(rawUserId) : devEntityId);

  const dbUserId = entityId;
  const clerkUserId = unsafeClerkUserId(rawUserId || DEV_USER_ID);

  if (!rawOrganizationId || !rawUserId) {
    console.warn('[DEV ONLY] Using development context - missing auth headers');
  } else if (!resolvedOrg) {
    console.warn(`[DEV ONLY] Could not resolve organization ID: ${rawOrganizationId}; falling back to dev org`);
  }

  return {
    organizationId,
    organizationName,
    entityId,
    clerkUserId,
    clerkOrganizationId: undefined,
    // Deprecated alias
    userId: dbUserId,
  };
}

// For routes that might be partially public (like health checks)
export async function getOptionalServiceContext(): Promise<OrganizationContext | null> {
  const headersList = await headers();

  const rawOrganizationId = headersList.get('x-organization-id');
  const rawUserId = headersList.get('x-user-id');
  const apiKeyName = headersList.get('x-api-key-name');

  const isProduction = process.env.NODE_ENV === 'production';

  if (apiKeyName) {
    try {
      return await resolveHeaderBackedContext(rawOrganizationId, rawUserId, apiKeyName || undefined);
    } catch (error) {
      if (isProduction) return null;
      console.warn('[auth] Optional API key context failed:', error instanceof Error ? error.message : error);
    }
  }

  const clerkSecret = getClerkSecretKey();
  if (clerkSecret) {
    try {
      const verifiedClerkContext = await verifyClerkRequest(headersList);
      if (verifiedClerkContext) {
        return {
          organizationId: verifiedClerkContext.organizationId,
          organizationName: verifiedClerkContext.organizationName,
          entityId: verifiedClerkContext.entityId,
          clerkUserId: verifiedClerkContext.clerkUserId,
          clerkOrganizationId: verifiedClerkContext.clerkOrganizationId,
          userId: verifiedClerkContext.entityId,
        };
      }
    } catch (error) {
      // In production, an auth error should result in no context for optional routes.
      // In development, we want to know why it failed but might still want to fall through.
      if (isProduction) return null;
      console.warn('[auth] Optional Clerk context failed:', error instanceof Error ? error.message : error);
    }
  }

  // Final fallthrough for development: if we haven't returned yet, 
  // and we are NOT in production, return a stable dev context.
  if (isProduction) return null;

  console.warn('[auth] Establish fallback development context - authentication failed or missing');

  const resolvedOrg = rawOrganizationId ? await resolveOrganization(rawOrganizationId) : null;
  const entityId = rawUserId ? await resolveEntityId(rawUserId, resolvedOrg?.id) : null;
  const clerkUserId = unsafeClerkUserId(rawUserId || 'user_dev_fallback');

  const finalOrgId = resolvedOrg?.id || 
    (rawOrganizationId && isValidUuid(rawOrganizationId) ? unsafeOrganizationId(rawOrganizationId) : unsafeOrganizationId('ba3b8cdf-efc1-4a60-88be-ac203d263fe2'));

  return {
    organizationId: finalOrgId,
    organizationName: resolvedOrg?.name ?? 'Development (Fallback)',
    entityId: entityId || unsafeEntityId('00000000-0000-0000-0000-000000000001'),
    clerkUserId: clerkUserId,
    clerkOrganizationId: rawOrganizationId?.startsWith('org_')
      ? unsafeClerkOrgId(rawOrganizationId)
      : undefined,
    apiKeyName: apiKeyName || undefined,
    // Deprecated alias
    userId: entityId || rawUserId || '00000000-0000-0000-0000-000000000001',
  };
}

// ============ RBAC Permission Helpers ============

/**
 * Check if the current user has the specified permission
 * @param resourceType The type of resource (e.g., 'GL_TRANSACTION', 'ACCOUNT')
 * @param action The action to check (e.g., 'CREATE', 'READ', 'UPDATE', 'DELETE')
 * @param subsidiaryId Optional subsidiary ID for subsidiary-scoped permissions
 * @returns true if user has permission, false otherwise
 */
export async function checkPermission(
  resourceType: ResourceType,
  action: Action,
  subsidiaryId?: string
): Promise<boolean> {
  const context = await getServiceContext();
  const permissionService = new PermissionService({
    organizationId: context.organizationId,
    userId: context.userId,
  });

  return permissionService.checkPermission(resourceType, action, subsidiaryId);
}

/**
 * Require the current user to have the specified permission
 * Throws a 403 error if permission is denied
 * @param resourceType The type of resource (e.g., 'GL_TRANSACTION', 'ACCOUNT')
 * @param action The action to check (e.g., 'CREATE', 'READ', 'UPDATE', 'DELETE')
 * @param subsidiaryId Optional subsidiary ID for subsidiary-scoped permissions
 * @throws ServiceError with code 'PERMISSION_DENIED' if user lacks permission
 */
export async function requirePermission(
  resourceType: ResourceType,
  action: Action,
  subsidiaryId?: string
): Promise<void> {
  const context = await getServiceContext();
  const permissionService = new PermissionService({
    organizationId: context.organizationId,
    userId: context.userId,
  });

  await permissionService.requirePermission(resourceType, action, subsidiaryId);
}

/**
 * Check if the current user has the specified subsidiary access level
 * @param subsidiaryId The subsidiary ID to check
 * @param requiredLevel The minimum access level required ('read', 'write', 'admin')
 * @returns true if user has required access, false otherwise
 */
export async function checkSubsidiaryAccess(
  subsidiaryId: string,
  requiredLevel: AccessLevel
): Promise<boolean> {
  const context = await getServiceContext();
  const permissionService = new PermissionService({
    organizationId: context.organizationId,
    userId: context.userId,
  });

  return permissionService.checkSubsidiaryAccess(subsidiaryId, requiredLevel);
}

/**
 * Require the current user to have the specified subsidiary access level
 * Throws a 403 error if access is denied
 * @param subsidiaryId The subsidiary ID to check
 * @param requiredLevel The minimum access level required ('read', 'write', 'admin')
 * @throws ServiceError with code 'SUBSIDIARY_ACCESS_DENIED' if access is insufficient
 */
export async function requireSubsidiaryAccess(
  subsidiaryId: string,
  requiredLevel: AccessLevel
): Promise<void> {
  const context = await getServiceContext();
  const permissionService = new PermissionService({
    organizationId: context.organizationId,
    userId: context.userId,
  });

  await permissionService.requireSubsidiaryAccess(subsidiaryId, requiredLevel);
}

/**
 * Check if the current user has admin role
 * @returns true if user is admin, false otherwise
 */
export async function isAdmin(): Promise<boolean> {
  const context = await getServiceContext();
  const permissionService = new PermissionService({
    organizationId: context.organizationId,
    userId: context.userId,
  });

  return permissionService.isAdmin();
}

/**
 * Require the current user to have admin role
 * Throws a 403 error if user is not admin
 * @throws ServiceError with code 'ADMIN_REQUIRED' if user is not admin
 */
export async function requireAdmin(): Promise<void> {
  const context = await getServiceContext();
  const permissionService = new PermissionService({
    organizationId: context.organizationId,
    userId: context.userId,
  });

  await permissionService.requireAdmin();
}
