import { headers } from 'next/headers';
import { PermissionService } from '@glapi/api-service';
import {
  OrganizationRepository,
  AuthEntityRepository,
  PermissionRepository,
  withOrganizationContext,
} from '@glapi/database';
import { auth as betterAuth } from '@glapi/auth';
import type { ResourceType, Action, AccessLevel } from '@glapi/api-service';
import type { EntityId, OrganizationId } from '@glapi/shared-types';
import { isValidUuid, unsafeEntityId, unsafeOrganizationId } from '@glapi/shared-types';
import { extractBearerToken } from './request-auth';

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
   * Better Auth user ID.
   */
  betterAuthUserId?: string;

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
   * Entity role resolved from entity_roles table.
   * Used by tRPC adminProcedure to check admin access.
   */
  role?: 'user' | 'admin';

  /**
   * @deprecated Use `betterAuthUserId` instead.
   */
  userId: string;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// Cache for BetterAuth org ID to database org ID and name mapping
const orgCache = new Map<string, { id: string; name: string; betterAuthOrgId?: string }>();

// Cache for external user ID to entity ID mapping
const entityIdCache = new Map<string, string>();

const AUTH_MAPPING_RECONCILIATION_COMMAND =
  'pnpm --filter @glapi/database reconcile:better-auth -- --write';

function parseBooleanEnvFlag(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  switch (value.trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
      return true;
    case '0':
    case 'false':
    case 'no':
      return false;
    default:
      return undefined;
  }
}

function canAutoProvisionExternalAuthRecords(): boolean {
  const explicitOverride = parseBooleanEnvFlag(
    process.env.AUTH_ALLOW_AUTO_PROVISION_MISSING_MAPPINGS
  );

  if (explicitOverride !== undefined) {
    return explicitOverride;
  }

  return process.env.NODE_ENV !== 'production';
}

function buildAuthDebugInfo(
  headersList: Awaited<ReturnType<typeof headers>>
) {
  return {
    mode: 'better-auth',
    requestPath:
      headersList.get('next-url') ??
      headersList.get('x-invoke-path') ??
      headersList.get('referer') ??
      'unknown',
    hasAuthorizationHeader: Boolean(extractBearerToken(headersList)),
    hasCookieHeader: Boolean(headersList.get('cookie')),
    headerOrganizationId: headersList.get('x-organization-id') ?? undefined,
    headerUserId: headersList.get('x-user-id') ?? undefined,
  };
}

function logAuthFailure(
  provider: 'better-auth' | 'final',
  error: unknown,
  debugInfo: ReturnType<typeof buildAuthDebugInfo>
) {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown auth error';

  console.warn('[auth] Request authentication failed', {
    provider,
    message,
    ...debugInfo,
  });
}

function createMissingOrganizationMappingError(
  providerLabel: 'Better Auth organization',
  externalOrganizationId: string
): AuthenticationError {
  return new AuthenticationError(
    `No internal organization mapping exists for ${providerLabel} ${externalOrganizationId}. Run \`${AUTH_MAPPING_RECONCILIATION_COMMAND}\` before enabling production authentication.`
  );
}

function createMissingEntityMappingError(
  providerLabel: 'Better Auth user',
  externalUserId: string
): AuthenticationError {
  return new AuthenticationError(
    `No internal entity mapping exists for ${providerLabel} ${externalUserId}. Run \`${AUTH_MAPPING_RECONCILIATION_COMMAND}\` before enabling production authentication.`
  );
}

export function resetAuthCachesForTest() {
  orgCache.clear();
  entityIdCache.clear();
}

interface ResolvedOrganization {
  id: OrganizationId;
  name?: string;
  betterAuthOrgId?: string;
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
    if (!canAutoProvisionExternalAuthRecords() && !isValidUuid(rawUserId)) {
      throw createMissingEntityMappingError(
        'Better Auth user',
        rawUserId
      );
    }

    if (!isValidUuid(rawUserId)) {
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
    betterAuthUserId: !isValidUuid(rawUserId) ? rawUserId : undefined,
    betterAuthOrganizationId: resolvedOrg.betterAuthOrgId,
    apiKeyName,
    userId: dbUserId,
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
        throw createMissingOrganizationMappingError(
          'Better Auth organization',
          betterAuthOrganizationId
        );
    }

    let resolvedEntityId = await resolveEntityId(betterAuthUserId, resolvedOrg.id);
    if (!resolvedEntityId) {
        if (!canAutoProvisionExternalAuthRecords()) {
          throw createMissingEntityMappingError('Better Auth user', betterAuthUserId);
        }

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
            betterAuthOrgId: org.betterAuthOrgId || undefined
        };
        orgCache.set(orgId, resolved);
        if (org.betterAuthOrgId) orgCache.set(org.betterAuthOrgId, resolved);
        
        return {
          id: unsafeOrganizationId(org.id),
          name: org.name,
          betterAuthOrgId: org.betterAuthOrgId || undefined
        };
      }
    } catch (error) {
      console.error('Failed to look up organization by UUID:', error);
    }
    return { id: unsafeOrganizationId(orgId) };
  }

  // Look up by Better Auth org ID
  const org = await orgRepo.findByBetterAuthId(orgId);
  if (org) {
      const resolved = { 
          id: org.id, 
          name: org.name, 
          betterAuthOrgId: org.betterAuthOrgId || undefined
      };
      orgCache.set(orgId, resolved);
      orgCache.set(org.id, resolved);
      return {
          id: unsafeOrganizationId(org.id),
          name: org.name,
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
    const entity = await authEntityRepo.findByBetterAuthId(externalUserId);

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

    // Auto-assign default RBAC role on entity provisioning
    await assignDefaultRoleIfMissing(entityId, organizationId);

    return unsafeEntityId(entityId);
  } catch (error) {
    console.error('[auth] Failed to auto-provision Better Auth auth entity', error);
    return null;
  }
}

/**
 * Assign the default USER role to an entity if they have no roles.
 * This ensures auto-provisioned entities can pass RBAC checks.
 */
async function assignDefaultRoleIfMissing(
  entityId: string,
  organizationId: OrganizationId,
): Promise<void> {
  try {
    await withOrganizationContext({ organizationId }, async (contextDb) => {
      const permRepo = new PermissionRepository(contextDb);
      const existingRoles = await permRepo.findEntityRoles(entityId);
      if (existingRoles.length > 0) return;

      const userRole = await permRepo.findRoleByName('USER');
      if (!userRole) {
        console.warn('[auth] No USER role found in database -- cannot assign default role');
        return;
      }

      await permRepo.assignRoleToEntity(entityId, userRole.id, entityId);
      console.log(`[auth] Assigned default USER role to entity ${entityId}`);
    });
  } catch (error) {
    console.warn('[auth] Failed to assign default role:', error);
  }
}

/**
 * Resolve the highest-priority role for an entity from entity_roles.
 * Returns 'admin' if any admin-level role is found, 'user' otherwise.
 */
const ADMIN_ROLE_NAMES = new Set(['ADMIN', 'OWNER', 'SUPER_ADMIN']);

async function resolveEntityRole(
  entityId: string | null,
  organizationId: OrganizationId,
): Promise<'user' | 'admin'> {
  if (!entityId) return 'user';

  try {
    const role = await withOrganizationContext({ organizationId }, async (contextDb) => {
      const permRepo = new PermissionRepository(contextDb);
      const entityRoles = await permRepo.findEntityRoles(entityId);

      for (const er of entityRoles) {
        if (er.role && ADMIN_ROLE_NAMES.has(er.role.roleName)) {
          return 'admin' as const;
        }
      }
      return 'user' as const;
    });
    return role;
  } catch {
    return 'user';
  }
}

export async function getServiceContext(): Promise<OrganizationContext> {
  const headersList = await headers();

  const rawOrganizationId = headersList.get('x-organization-id');
  const rawUserId = headersList.get('x-user-id');
  const apiKeyName = headersList.get('x-api-key-name');

  const isProduction = process.env.NODE_ENV === 'production';
  const authDebugInfo = buildAuthDebugInfo(headersList);

  const attemptTrace: { provider: 'better-auth'; outcome: 'null' | 'error' | 'success'; error?: string }[] = [];

  if (apiKeyName) {
    return resolveHeaderBackedContext(rawOrganizationId, rawUserId, apiKeyName || undefined);
  }

  try {
    const betterAuthContext = await verifyBetterAuthRequest(headersList);
    if (!betterAuthContext) {
      attemptTrace.push({ provider: 'better-auth', outcome: 'null' });
    }
    if (betterAuthContext) {
        if (
          rawUserId &&
          rawUserId !== betterAuthContext.betterAuthUserId &&
          rawUserId !== betterAuthContext.entityId
        ) {
          throw new AuthenticationError(
            'User header does not match authenticated token context.'
          );
        }

        const betterAuthRole = await resolveEntityRole(
          betterAuthContext.entityId,
          betterAuthContext.organizationId,
        );

        return {
            organizationId: betterAuthContext.organizationId,
            organizationName: betterAuthContext.organizationName,
            entityId: betterAuthContext.entityId,
            betterAuthUserId: betterAuthContext.betterAuthUserId,
            betterAuthOrganizationId: betterAuthContext.betterAuthOrganizationId,
            role: betterAuthRole,
            userId: betterAuthContext.entityId,
        };
    }
  } catch (error) {
    attemptTrace.push({
      provider: 'better-auth',
      outcome: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
    logAuthFailure('better-auth', error, authDebugInfo);

    if (isProduction) {
      throw error;
    }

    console.warn('[auth] Better Auth authentication failed:', error);
  }

  if (isProduction) {
    const finalError = new AuthenticationError(
      'Authentication required. Provide a valid session or bearer token.'
    );
    console.warn('[auth] No provider authenticated the request', {
      ...authDebugInfo,
      attemptTrace,
    });
    logAuthFailure('final', finalError, authDebugInfo);
    throw finalError;
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
