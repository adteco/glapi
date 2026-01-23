import { BaseService } from './base-service';
import { ServiceError } from '../types';
import { permissionRepository } from '@glapi/database';
import type {
  ResourceType,
  Action,
  AccessLevel,
  Permission,
  PermissionResult,
  UserPermissionSummary,
} from '../types/rbac.types';
import { generatePermissionName } from '../types/rbac.types';

/**
 * Permission cache entry
 */
interface PermissionCacheEntry {
  permissions: Permission[];
  cachedAt: number;
}

/**
 * Service for checking user permissions
 * Used by API routes and middleware to enforce RBAC
 */
export class PermissionService extends BaseService {
  // In-memory cache for user permissions (per request lifecycle)
  private static permissionCache: Map<string, PermissionCacheEntry> = new Map();
  private static CACHE_TTL_MS = 60000; // 1 minute cache

  /**
   * Check if the current user has a specific permission
   */
  async checkPermission(
    resourceType: ResourceType,
    action: Action,
    subsidiaryId?: string
  ): Promise<boolean> {
    const userId = this.requireUserContext();

    return permissionRepository.hasPermission(
      userId,
      resourceType,
      action,
      subsidiaryId
    );
  }

  /**
   * Check permission and return detailed result
   */
  async checkPermissionWithDetails(
    resourceType: ResourceType,
    action: Action,
    subsidiaryId?: string
  ): Promise<PermissionResult> {
    const userId = this.requireUserContext();

    const hasPermission = await permissionRepository.hasPermission(
      userId,
      resourceType,
      action,
      subsidiaryId
    );

    if (hasPermission) {
      return { allowed: true };
    }

    const permissionName = generatePermissionName(resourceType, action);
    return {
      allowed: false,
      reason: `User does not have required permission: ${permissionName}`,
      missingPermission: permissionName,
    };
  }

  /**
   * Require a specific permission - throws if not authorized
   */
  async requirePermission(
    resourceType: ResourceType,
    action: Action,
    subsidiaryId?: string
  ): Promise<void> {
    const result = await this.checkPermissionWithDetails(resourceType, action, subsidiaryId);

    if (!result.allowed) {
      throw new ServiceError(
        result.reason || 'Permission denied',
        'PERMISSION_DENIED',
        403,
        { missingPermission: result.missingPermission }
      );
    }
  }

  /**
   * Check multiple permissions at once (all must pass)
   */
  async checkAllPermissions(
    checks: Array<{ resourceType: ResourceType; action: Action; subsidiaryId?: string }>
  ): Promise<boolean> {
    const userId = this.requireUserContext();

    for (const check of checks) {
      const hasPermission = await permissionRepository.hasPermission(
        userId,
        check.resourceType,
        check.action,
        check.subsidiaryId
      );

      if (!hasPermission) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check multiple permissions at once (any one must pass)
   */
  async checkAnyPermission(
    checks: Array<{ resourceType: ResourceType; action: Action; subsidiaryId?: string }>
  ): Promise<boolean> {
    const userId = this.requireUserContext();

    for (const check of checks) {
      const hasPermission = await permissionRepository.hasPermission(
        userId,
        check.resourceType,
        check.action,
        check.subsidiaryId
      );

      if (hasPermission) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all permissions for the current user
   */
  async getUserPermissions(subsidiaryId?: string): Promise<Permission[]> {
    const userId = this.requireUserContext();

    // Check cache first
    const cacheKey = `${userId}:${subsidiaryId || 'global'}`;
    const cached = PermissionService.permissionCache.get(cacheKey);

    if (cached && Date.now() - cached.cachedAt < PermissionService.CACHE_TTL_MS) {
      return cached.permissions;
    }

    // Fetch from database
    const permissions = await permissionRepository.findEntityPermissions(userId, subsidiaryId);

    // Update cache
    PermissionService.permissionCache.set(cacheKey, {
      permissions,
      cachedAt: Date.now(),
    });

    return permissions;
  }

  /**
   * Get a summary of the current user's permissions
   */
  async getUserPermissionSummary(): Promise<UserPermissionSummary> {
    const entityId = this.requireUserContext();

    const [roles, permissions, subsidiaryAccess] = await Promise.all([
      permissionRepository.findEntityRoles(entityId),
      permissionRepository.findEntityPermissions(entityId),
      permissionRepository.findEntitySubsidiaryAccess(entityId),
    ]);

    return {
      entityId,
      roles,
      permissions,
      subsidiaryAccess: subsidiaryAccess.map((sa) => ({
        subsidiaryId: sa.subsidiaryId,
        accessLevel: sa.accessLevel as AccessLevel,
      })),
    };
  }

  /**
   * Check if user has required access level to a subsidiary
   */
  async checkSubsidiaryAccess(
    subsidiaryId: string,
    requiredLevel: AccessLevel
  ): Promise<boolean> {
    const userId = this.requireUserContext();

    return permissionRepository.hasSubsidiaryAccess(userId, subsidiaryId, requiredLevel);
  }

  /**
   * Require subsidiary access - throws if not authorized
   */
  async requireSubsidiaryAccess(
    subsidiaryId: string,
    requiredLevel: AccessLevel
  ): Promise<void> {
    const hasAccess = await this.checkSubsidiaryAccess(subsidiaryId, requiredLevel);

    if (!hasAccess) {
      throw new ServiceError(
        `Insufficient access level for subsidiary. Required: ${requiredLevel}`,
        'SUBSIDIARY_ACCESS_DENIED',
        403,
        { subsidiaryId, requiredLevel }
      );
    }
  }

  /**
   * Check if user has admin role (shortcut for common admin checks)
   */
  async isAdmin(): Promise<boolean> {
    const userId = this.requireUserContext();

    const roles = await permissionRepository.findEntityRoles(userId);
    return roles.some((r) => r.role?.roleName === 'ADMIN');
  }

  /**
   * Require admin role - throws if not admin
   */
  async requireAdmin(): Promise<void> {
    const isAdmin = await this.isAdmin();

    if (!isAdmin) {
      throw new ServiceError(
        'Administrator access required',
        'ADMIN_REQUIRED',
        403
      );
    }
  }

  /**
   * Clear permission cache for a specific user (call after role changes)
   */
  static clearUserCache(userId: string): void {
    for (const key of PermissionService.permissionCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        PermissionService.permissionCache.delete(key);
      }
    }
  }

  /**
   * Clear all permission cache
   */
  static clearAllCache(): void {
    PermissionService.permissionCache.clear();
  }
}
