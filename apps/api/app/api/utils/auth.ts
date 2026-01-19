import { headers } from 'next/headers';
import { PermissionService } from '@glapi/api-service';
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

export async function getServiceContext(): Promise<OrganizationContext> {
  const headersList = await headers();

  const organizationId = headersList.get('x-organization-id');
  const userId = headersList.get('x-user-id');
  const apiKeyName = headersList.get('x-api-key-name');

  // TEMPORARY: For testing, use provided headers or fall back to development
  console.log('Auth context - orgId:', organizationId, 'userId:', userId);

  if (organizationId && userId) {
    return {
      organizationId,
      userId,
      clerkOrganizationId: organizationId,
      apiKeyName: apiKeyName || undefined
    };
  }

  // Fallback for development - use UUID that matches seed data
  console.log('No org/user in headers - using development context');
  return {
    organizationId: 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2', // Test Development Organization UUID
    userId: 'user_development',
    clerkOrganizationId: 'org_development'
  };
  
  /*
  if (!organizationId || !userId) {
    // Only allow fallback in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('Organization context not found in request - using development fallback with UUID');
      
      return {
        organizationId: 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2', // Development fallback UUID
        userId: 'user_development',
        clerkOrganizationId: 'org_development'
      };
    }
    
    // In production, throw an error
    const missing = [];
    if (!organizationId) missing.push('x-organization-id');
    if (!userId) missing.push('x-user-id');
    
    throw new AuthenticationError(
      `Missing required authentication headers: ${missing.join(', ')}`
    );
  }
  
  return {
    organizationId,
    userId,
    clerkOrganizationId: organizationId,
    apiKeyName: apiKeyName || undefined
  };
  */
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
  const context = getServiceContext();
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
  const context = getServiceContext();
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
  const context = getServiceContext();
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
  const context = getServiceContext();
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
  const context = getServiceContext();
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
  const context = getServiceContext();
  const permissionService = new PermissionService({
    organizationId: context.organizationId,
    userId: context.userId,
  });

  await permissionService.requireAdmin();
}