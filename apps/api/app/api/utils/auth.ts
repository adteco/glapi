import { headers } from 'next/headers';
import { PermissionService } from '@glapi/api-service';
import { OrganizationRepository, AuthEntityRepository } from '@glapi/database';
import type { ResourceType, Action, AccessLevel } from '@glapi/api-service';

export interface OrganizationContext {
  organizationId: string;
  userId: string;
  clerkOrganizationId?: string;
  apiKeyName?: string;
  organizationName?: string; // Organization name for debugging headers
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
  id: string;
  name?: string;
}

/**
 * Resolve a Clerk org ID (org_xxxxx) to a database organization UUID and name
 */
async function resolveOrganization(clerkOrgId: string): Promise<ResolvedOrganization | null> {
  // Check cache first
  if (orgCache.has(clerkOrgId)) {
    return orgCache.get(clerkOrgId)!;
  }

  // If it's already a UUID format, look up org by ID to get the name
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(clerkOrgId)) {
    try {
      const orgRepo = new OrganizationRepository();
      const org = await orgRepo.findById(clerkOrgId);
      if (org) {
        const resolved = { id: org.id, name: org.name };
        orgCache.set(clerkOrgId, resolved);
        return resolved;
      }
    } catch (error) {
      console.error('Failed to look up organization by UUID:', error);
    }
    return { id: clerkOrgId };
  }

  // Look up by Clerk org ID
  try {
    const orgRepo = new OrganizationRepository();
    const org = await orgRepo.findByClerkId(clerkOrgId);

    if (org) {
      const resolved = { id: org.id, name: org.name };
      orgCache.set(clerkOrgId, resolved);
      return resolved;
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
async function resolveEntityId(clerkUserId: string): Promise<string | null> {
  // Check cache first
  if (entityIdCache.has(clerkUserId)) {
    return entityIdCache.get(clerkUserId)!;
  }

  // If it's already a UUID format, return as-is
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(clerkUserId)) {
    return clerkUserId;
  }

  // Look up by Clerk user ID
  try {
    const authEntityRepo = new AuthEntityRepository();
    const entity = await authEntityRepo.findByClerkId(clerkUserId);

    if (entity) {
      entityIdCache.set(clerkUserId, entity.id);
      return entity.id;
    }
  } catch (error) {
    console.error('Failed to resolve entity ID from Clerk user ID:', error);
  }

  return null;
}

export async function getServiceContext(): Promise<OrganizationContext> {
  const headersList = await headers();

  const rawOrganizationId = headersList.get('x-organization-id');
  const rawUserId = headersList.get('x-user-id');
  const apiKeyName = headersList.get('x-api-key-name');

  console.log('Auth context - rawOrgId:', rawOrganizationId, 'rawUserId:', rawUserId);

  if (rawOrganizationId && rawUserId) {
    // Resolve Clerk org ID to database UUID and get organization name
    const resolvedOrg = await resolveOrganization(rawOrganizationId);

    // Resolve Clerk user ID to entity UUID
    // This supports the consolidated auth model where entities (Employee) serve as users
    const entityId = await resolveEntityId(rawUserId);

    if (resolvedOrg) {
      return {
        organizationId: resolvedOrg.id,
        organizationName: resolvedOrg.name,
        // Use entity ID if resolved, otherwise fall back to raw user ID
        userId: entityId || rawUserId,
        clerkOrganizationId: rawOrganizationId,
        apiKeyName: apiKeyName || undefined
      };
    }

    console.warn(`Could not resolve organization ID: ${rawOrganizationId}`);
  }

  // CRITICAL SECURITY: Never fallback to dev org in production - this would be a data breach
  if (process.env.NODE_ENV === 'production') {
    throw new AuthenticationError(
      'Organization context required. Ensure x-organization-id and x-user-id headers are set.'
    );
  }

  // Development fallback only - NEVER happens in production
  console.warn('[DEV ONLY] Using development context - this should never appear in production logs');
  return {
    organizationId: 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2', // Adteco dev org UUID
    organizationName: 'Development',
    userId: rawUserId || 'user_development',
    clerkOrganizationId: rawOrganizationId || 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2'
  };
}

// For routes that might be partially public (like health checks)
export async function getOptionalServiceContext(): Promise<OrganizationContext | null> {
  const headersList = await headers();

  const organizationId = headersList.get('x-organization-id');
  const userId = headersList.get('x-user-id');
  const apiKeyName = headersList.get('x-api-key-name');

  if (!organizationId || !userId) {
    return null;
  }

  return {
    organizationId,
    userId,
    clerkOrganizationId: organizationId,
    apiKeyName: apiKeyName || undefined
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