import { headers } from 'next/headers';
import { PermissionService } from '@glapi/api-service';
import { OrganizationRepository, AuthEntityRepository } from '@glapi/database';
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
const orgCache = new Map<string, { id: string; name: string }>();

// Cache for Clerk user ID to entity ID mapping
const entityIdCache = new Map<string, string>();

interface ResolvedOrganization {
  id: OrganizationId;
  name?: string;
}

/**
 * Resolve a Clerk org ID (org_xxxxx) to a database organization UUID and name
 */
async function resolveOrganization(clerkOrgId: string): Promise<ResolvedOrganization | null> {
  // Check cache first
  if (orgCache.has(clerkOrgId)) {
    const cached = orgCache.get(clerkOrgId)!;
    return { id: unsafeOrganizationId(cached.id), name: cached.name };
  }

  // If it's already a UUID format, look up org by ID to get the name
  if (isValidUuid(clerkOrgId)) {
    try {
      const orgRepo = new OrganizationRepository();
      const org = await orgRepo.findById(clerkOrgId);
      if (org) {
        const resolved = { id: org.id, name: org.name };
        orgCache.set(clerkOrgId, resolved);
        return { id: unsafeOrganizationId(org.id), name: org.name };
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
      const resolved = { id: org.id, name: org.name };
      orgCache.set(clerkOrgId, resolved);
      return { id: unsafeOrganizationId(org.id), name: org.name };
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
async function resolveEntityId(clerkUserId: string): Promise<EntityId | null> {
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
    const authEntityRepo = new AuthEntityRepository();
    const entity = await authEntityRepo.findByClerkId(clerkUserId);

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
    const authEntityRepo = new AuthEntityRepository();
    const existing = await authEntityRepo.findByClerkId(clerkUserId);

    if (existing) {
      if (existing.organizationId !== organizationId) {
        console.error('[auth] Clerk user is linked to a different organization', {
          clerkUserId,
          expectedOrganizationId: organizationId,
          actualOrganizationId: existing.organizationId,
        });
        return null;
      }

      entityIdCache.set(clerkUserId, existing.id);
      return unsafeEntityId(existing.id);
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

    entityIdCache.set(clerkUserId, created.id);
    return unsafeEntityId(created.id);
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

  const resolvedOrg = rawOrganizationId ? await resolveOrganization(rawOrganizationId) : null;
  let resolvedEntityId = rawUserId ? await resolveEntityId(rawUserId) : null;

  const isProduction = process.env.NODE_ENV === 'production';

  // In production, organization + user context MUST be present and resolvable.
  // IMPORTANT: audit fields in many tables are UUIDs; therefore, `x-user-id` must
  // resolve to an entity UUID (or itself be a UUID).
  if (isProduction) {
    if (!rawOrganizationId || !rawUserId) {
      throw new AuthenticationError(
        'Organization context required. Ensure x-organization-id and x-user-id headers are set.'
      );
    }
    if (!resolvedOrg) {
      throw new AuthenticationError(`Could not resolve organization ID: ${rawOrganizationId}`);
    }

    // If Clerk webhooks missed user provisioning, auto-create the auth entity once.
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
      apiKeyName: apiKeyName || undefined,
      // Deprecated alias - kept for backward compatibility in service layer.
      // Always a UUID in production.
      userId: dbUserId,
    };
  }

  // Development fallback: allow partial headers, but always produce UUID-safe IDs so
  // writes with UUID audit columns (e.g. sales_orders.created_by) don't explode.
  const devOrgId = unsafeOrganizationId(DEV_ORG_ID);
  const devEntityId = unsafeEntityId(DEV_USER_ID);

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

  if (!rawOrganizationId || !rawUserId) {
    return null;
  }

  // Resolve Clerk org ID to database UUID
  const resolvedOrg = await resolveOrganization(rawOrganizationId);
  if (!resolvedOrg) {
    return null;
  }

  // Resolve Clerk user ID to entity UUID
  const entityId = await resolveEntityId(rawUserId);
  const clerkUserId = unsafeClerkUserId(rawUserId);

  return {
    organizationId: resolvedOrg.id,
    organizationName: resolvedOrg.name,
    entityId: entityId,
    clerkUserId: clerkUserId,
    clerkOrganizationId: rawOrganizationId.startsWith('org_')
      ? unsafeClerkOrgId(rawOrganizationId)
      : undefined,
    apiKeyName: apiKeyName || undefined,
    // Deprecated alias
    userId: entityId || rawUserId,
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
