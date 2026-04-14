import { headers } from 'next/headers';
import { PermissionService } from '@glapi/api-service';
import {
  OrganizationRepository,
  AuthEntityRepository,
  withOrganizationContext,
} from '@glapi/database';
import { auth as betterAuth } from '@glapi/auth';
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
  clerkUserId?: ClerkUserId;

  /**
   * Better Auth user ID.
   */
  betterAuthUserId?: string;

  /**
   * Clerk organization ID (original value from header).
   */
  clerkOrganizationId?: ClerkOrgId;

  /**
   * Better Auth organization ID.
   */
  betterAuthOrganizationId?: string;

  /**
   * API key name if authenticated via API key.
   */
  apiKeyName?: string;

  /**
   * Organization name for debugging headers.
   */
  organizationName?: string;

  /**
   * @deprecated Use `clerkUserId` or `betterAuthUserId` instead.
   */
  userId: string;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// Cache for Clerk/BetterAuth org ID to database org ID and name mapping
const orgCache = new Map<string, { id: string; name: string; clerkOrgId?: string; betterAuthOrgId?: string }>();

// Cache for external user ID to entity ID mapping
const entityIdCache = new Map<string, string>();

export function resetAuthCachesForTest() {
  orgCache.clear();
  entityIdCache.clear();
}

interface ResolvedOrganization {
  id: OrganizationId;
  name?: string;
  clerkOrgId?: string;
  betterAuthOrgId?: string;
}

interface VerifiedClerkRequestContext {
  organizationId: OrganizationId;
  organizationName?: string;
  entityId: EntityId;
  clerkUserId: ClerkUserId;
  clerkOrganizationId: ClerkOrgId;
}

interface VerifiedBetterAuthRequestContext {
  organizationId: OrganizationId;
  organizationName?: string;
  entityId: EntityId;
  betterAuthUserId: string;
  betterAuthOrganizationId: string;
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
    // Try to ensure entity for Clerk user if it looks like one, or just treat as Better Auth
    if (rawUserId.startsWith('user_')) {
      resolvedEntityId = await ensureEntityForClerkUser(rawUserId, resolvedOrg.id);
    } else if (!isValidUuid(rawUserId)) {
      resolvedEntityId = await ensureEntityForBetterAuthUser(rawUserId, resolvedOrg.id);
    }
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
    clerkUserId: rawUserId.startsWith('user_') ? unsafeClerkUserId(rawUserId) : undefined,
    betterAuthUserId: !rawUserId.startsWith('user_') && !isValidUuid(rawUserId) ? rawUserId : undefined,
    clerkOrganizationId: rawOrganizationId.startsWith('org_')
      ? unsafeClerkOrgId(rawOrganizationId)
      : undefined,
    betterAuthOrganizationId: resolvedOrg.betterAuthOrgId,
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
  
  // Basic check to avoid verifying Clerk tokens if it's a Better Auth session
  // Better Auth sessions are typically longer random strings or handled via cookies
  if (!token.startsWith('clerk_') && token.length > 50 && !token.includes('.')) {
    return null; // Likely a Better Auth session token, not a Clerk JWT
  }

  const rawOrganizationId = headersList.get('x-organization-id');
  const requestedOrganization = rawOrganizationId
    ? await resolveOrganization(rawOrganizationId)
    : null;

  let verifiedToken;
  try {
    verifiedToken = await verifyClerkBearerToken(token);
  } catch (error) {
    // If it's not a valid Clerk token, it might be a Better Auth token
    return null;
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

async function verifyBetterAuthRequest(
  headersList: Awaited<ReturnType<typeof headers>>
): Promise<VerifiedBetterAuthRequestContext | null> {
  try {
    const session = await betterAuth.api.getSession({
        headers: headersList
    });

    if (!session) return null;

    const betterAuthUserId = session.user.id;
    const betterAuthOrganizationId = session.session.activeOrganizationId;

    if (!betterAuthOrganizationId) {
        throw new AuthenticationError('Active organization context required for Better Auth session');
    }

    const resolvedOrg = await resolveOrganization(betterAuthOrganizationId);
    if (!resolvedOrg) {
        throw new AuthenticationError(`Could not resolve Better Auth organization: ${betterAuthOrganizationId}`);
    }

    let resolvedEntityId = await resolveEntityId(betterAuthUserId, resolvedOrg.id);
    if (!resolvedEntityId) {
        resolvedEntityId = await ensureEntityForBetterAuthUser(betterAuthUserId, resolvedOrg.id);
    }

    if (!resolvedEntityId) {
        throw new AuthenticationError('Authenticated user could not be resolved to an entity record.');
    }

    return {
        organizationId: resolvedOrg.id,
        organizationName: resolvedOrg.name,
        entityId: resolvedEntityId,
        betterAuthUserId,
        betterAuthOrganizationId,
    };
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    console.error('[auth] Better Auth verification error:', error);
    return null;
  }
}

/**
 * Resolve an external org ID to a database organization UUID and name
 */
async function resolveOrganization(orgId: string): Promise<ResolvedOrganization | null> {
  // Check cache first
  if (orgCache.has(orgId)) {
    const cached = orgCache.get(orgId)!;
    return {
      id: unsafeOrganizationId(cached.id),
      name: cached.name,
      clerkOrgId: cached.clerkOrgId,
      betterAuthOrgId: cached.betterAuthOrgId,
    };
  }

  const orgRepo = new OrganizationRepository();

  // If it's already a UUID format, look up org by ID to get the name
  if (isValidUuid(orgId)) {
    try {
      const org = await orgRepo.findById(orgId);
      if (org) {
        const resolved = { 
            id: org.id, 
            name: org.name, 
            clerkOrgId: org.clerkOrgId || undefined,
            betterAuthOrgId: org.betterAuthOrgId || undefined
        };
        orgCache.set(orgId, resolved);
        if (org.clerkOrgId) orgCache.set(org.clerkOrgId, resolved);
        if (org.betterAuthOrgId) orgCache.set(org.betterAuthOrgId, resolved);
        
        return {
          id: unsafeOrganizationId(org.id),
          name: org.name,
          clerkOrgId: org.clerkOrgId || undefined,
          betterAuthOrgId: org.betterAuthOrgId || undefined
        };
      }
    } catch (error) {
      console.error('Failed to look up organization by UUID:', error);
    }
    return { id: unsafeOrganizationId(orgId) };
  }

  // Look up by Clerk org ID
  if (orgId.startsWith('org_')) {
      const org = await orgRepo.findByClerkId(orgId);
      if (org) {
          const resolved = { 
              id: org.id, 
              name: org.name, 
              clerkOrgId: org.clerkOrgId || undefined,
              betterAuthOrgId: org.betterAuthOrgId || undefined
          };
          orgCache.set(orgId, resolved);
          orgCache.set(org.id, resolved);
          return {
              id: unsafeOrganizationId(org.id),
              name: org.name,
              clerkOrgId: org.clerkOrgId || undefined,
              betterAuthOrgId: org.betterAuthOrgId || undefined
          };
      }
      
      // Auto-provision Clerk
      const clerkOrg = await getClerkOrganization(orgId);
      if (clerkOrg) {
        const created = await orgRepo.createFromClerk({
          clerkOrgId: orgId,
          name: clerkOrg.name,
          slug: clerkOrg.slug || clerkOrg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        });
        const resolved = { id: created.id, name: created.name, clerkOrgId: created.clerkOrgId || undefined };
        orgCache.set(orgId, resolved);
        orgCache.set(created.id, resolved);
        return {
          id: unsafeOrganizationId(created.id),
          name: created.name,
          clerkOrgId: created.clerkOrgId || undefined,
        };
      }
  }

  // Look up by Better Auth org ID
  const org = await orgRepo.findByBetterAuthId(orgId);
  if (org) {
      const resolved = { 
          id: org.id, 
          name: org.name, 
          clerkOrgId: org.clerkOrgId || undefined,
          betterAuthOrgId: org.betterAuthOrgId || undefined
      };
      orgCache.set(orgId, resolved);
      orgCache.set(org.id, resolved);
      return {
          id: unsafeOrganizationId(org.id),
          name: org.name,
          clerkOrgId: org.clerkOrgId || undefined,
          betterAuthOrgId: org.betterAuthOrgId || undefined
      };
  }

  return null;
}

/**
 * Resolve an external user ID to a database entity UUID
 */
async function resolveEntityId(
  externalUserId: string,
  organizationId?: OrganizationId
): Promise<EntityId | null> {
  if (entityIdCache.has(externalUserId)) {
    return unsafeEntityId(entityIdCache.get(externalUserId)!);
  }

  if (isValidUuid(externalUserId)) {
    return unsafeEntityId(externalUserId);
  }

  try {
    const authEntityRepo = new AuthEntityRepository();
    let entity;

    if (externalUserId.startsWith('user_')) {
        entity = await authEntityRepo.findByClerkId(externalUserId);
    } else {
        entity = await authEntityRepo.findByBetterAuthId(externalUserId);
    }

    if (entity) {
      entityIdCache.set(externalUserId, entity.id);
      return unsafeEntityId(entity.id);
    }
  } catch (error) {
    console.error('Failed to resolve entity ID:', error);
  }

  return null;
}

/**
 * Ensure a Clerk user has an auth-enabled entity row
 */
async function ensureEntityForClerkUser(
  clerkUserId: string,
  organizationId: OrganizationId
): Promise<EntityId | null> {
  try {
    const entityId = await withOrganizationContext({ organizationId }, async (contextDb) => {
        const authEntityRepo = new AuthEntityRepository(contextDb);
        const existing = await authEntityRepo.findByClerkId(clerkUserId);
        if (existing) return existing.id;

        const created = await authEntityRepo.createUserEntity({
          clerkUserId,
          email: `${clerkUserId}@placeholder.local`,
          name: `User ${clerkUserId.slice(-8)}`,
          organizationId,
          role: 'user',
        });
        return created.id;
    });

    entityIdCache.set(clerkUserId, entityId);
    return unsafeEntityId(entityId);
  } catch (error) {
    console.error('[auth] Failed to auto-provision Clerk auth entity', error);
    return null;
  }
}

/**
 * Ensure a Better Auth user has an auth-enabled entity row
 */
async function ensureEntityForBetterAuthUser(
  betterAuthUserId: string,
  organizationId: OrganizationId
): Promise<EntityId | null> {
  try {
    const entityId = await withOrganizationContext({ organizationId }, async (contextDb) => {
        const authEntityRepo = new AuthEntityRepository(contextDb);
        const existing = await authEntityRepo.findByBetterAuthId(betterAuthUserId);
        if (existing) return existing.id;

        const created = await authEntityRepo.createUserEntity({
          betterAuthUserId,
          email: `${betterAuthUserId}@placeholder.local`,
          name: `User ${betterAuthUserId.slice(-8)}`,
          organizationId,
          role: 'user',
        });
        return created.id;
    });

    entityIdCache.set(betterAuthUserId, entityId);
    return unsafeEntityId(entityId);
  } catch (error) {
    console.error('[auth] Failed to auto-provision Better Auth auth entity', error);
    return null;
  }
}

export async function getServiceContext(): Promise<OrganizationContext> {
  const headersList = await headers();

  const rawOrganizationId = headersList.get('x-organization-id');
  const rawUserId = headersList.get('x-user-id');
  const apiKeyName = headersList.get('x-api-key-name');

  const isProduction = process.env.NODE_ENV === 'production';

  if (apiKeyName) {
    return resolveHeaderBackedContext(rawOrganizationId, rawUserId, apiKeyName || undefined);
  }

  // 1. Try Better Auth
  try {
      const betterAuthContext = await verifyBetterAuthRequest(headersList);
      if (betterAuthContext) {
          return {
              organizationId: betterAuthContext.organizationId,
              organizationName: betterAuthContext.organizationName,
              entityId: betterAuthContext.entityId,
              betterAuthUserId: betterAuthContext.betterAuthUserId,
              betterAuthOrganizationId: betterAuthContext.betterAuthOrganizationId,
              userId: betterAuthContext.entityId,
          };
      }
  } catch (error) {
      if (isProduction) throw error;
      console.warn('[auth] Better Auth authentication failed:', error);
  }

  // 2. Try Clerk
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
      'Authentication required. Provide a valid session or bearer token.'
    );
  }

  // Development fallback
  const DEV_ORG_ID = 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2';
  const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';
  
  const devOrgId = unsafeOrganizationId(DEV_ORG_ID);
  const devEntityId = unsafeEntityId(DEV_USER_ID);

  const resolvedOrg = rawOrganizationId ? await resolveOrganization(rawOrganizationId) : null;
  const resolvedEntityId = rawUserId ? await resolveEntityId(rawUserId, resolvedOrg?.id) : null;

  return {
    organizationId: resolvedOrg?.id ?? devOrgId,
    organizationName: resolvedOrg?.name ?? 'Development',
    entityId: resolvedEntityId ?? (rawUserId && isValidUuid(rawUserId) ? unsafeEntityId(rawUserId) : devEntityId),
    userId: (resolvedEntityId ?? (rawUserId && isValidUuid(rawUserId) ? unsafeEntityId(rawUserId) : devEntityId)) as string,
  };
}

export async function getOptionalServiceContext(): Promise<OrganizationContext | null> {
    try {
        return await getServiceContext();
    } catch (error) {
        return null;
    }
}

// ============ RBAC Permission Helpers ============
// (Unchanged)


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
