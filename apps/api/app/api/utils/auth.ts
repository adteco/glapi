import { headers } from 'next/headers';
import { PermissionService } from '@glapi/api-service';
import { OrganizationRepository } from '@glapi/database';
import type { ResourceType, Action, AccessLevel } from '@glapi/api-service';

export interface OrganizationContext {
  organizationId: string;
  userId: string;
  clerkOrganizationId?: string;
  apiKeyName?: string;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// Cache for Clerk org ID to database org ID mapping
const orgIdCache = new Map<string, string>();

/**
 * Resolve a Clerk org ID (org_xxxxx) to a database organization UUID
 */
async function resolveOrganizationId(clerkOrgId: string): Promise<string | null> {
  // Check cache first
  if (orgIdCache.has(clerkOrgId)) {
    return orgIdCache.get(clerkOrgId)!;
  }

  // If it's already a UUID format, return as-is
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(clerkOrgId)) {
    return clerkOrgId;
  }

  // Look up by Clerk org ID
  const orgRepo = new OrganizationRepository();
  const org = await orgRepo.findByClerkId(clerkOrgId);

  if (org) {
    orgIdCache.set(clerkOrgId, org.id);
    return org.id;
  }

  return null;
}

export async function getServiceContext(): Promise<OrganizationContext> {
  const headersList = await headers();

  const rawOrganizationId = headersList.get('x-organization-id');
  const userId = headersList.get('x-user-id');
  const apiKeyName = headersList.get('x-api-key-name');

  console.log('Auth context - rawOrgId:', rawOrganizationId, 'userId:', userId);

  if (rawOrganizationId && userId) {
    // Resolve Clerk org ID to database UUID
    const organizationId = await resolveOrganizationId(rawOrganizationId);

    if (organizationId) {
      return {
        organizationId,
        userId,
        clerkOrganizationId: rawOrganizationId,
        apiKeyName: apiKeyName || undefined
      };
    }

    console.warn(`Could not resolve organization ID: ${rawOrganizationId}`);
  }

  // Fallback for development - use valid UUID matching the test API key's org
  console.log('No org/user in headers or unresolved org - using development context');
  return {
    organizationId: 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2', // Adteco dev org UUID
    userId: userId || 'user_development',
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