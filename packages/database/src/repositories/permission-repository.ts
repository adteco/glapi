import { and, eq, isNull, sql, or, gt } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  roles,
  permissions,
  rolePermissions,
  entityRoles,
  entitySubsidiaryAccess,
} from '../db/schema/rls-access-control';

export interface Role {
  id: string;
  roleName: string;
  roleDescription: string | null;
  isSystemRole: boolean;
  createdDate: Date;
}

export interface Permission {
  id: string;
  permissionName: string;
  resourceType: string | null;
  action: string | null;
  description: string | null;
  createdDate: Date;
}

export interface EntityRole {
  entityId: string;
  roleId: string;
  subsidiaryId: string | null;
  grantedBy: string | null;
  grantedDate: Date;
  expiresDate: Date | null;
  role?: Role;
}

export interface EntitySubsidiaryAccess {
  entityId: string;
  subsidiaryId: string;
  accessLevel: string;
  grantedBy: string | null;
  grantedDate: Date;
  expiresDate: Date | null;
}

// Legacy aliases for backward compatibility
export type UserRole = EntityRole;
export type UserSubsidiaryAccess = EntitySubsidiaryAccess;

export interface NewRole {
  roleName: string;
  roleDescription?: string | null;
  isSystemRole?: boolean;
}

export interface NewPermission {
  permissionName: string;
  resourceType?: string | null;
  action?: string | null;
  description?: string | null;
}

export class PermissionRepository extends BaseRepository {
  // ============ Role Operations ============

  /**
   * Find a role by ID
   */
  async findRoleById(roleId: string): Promise<Role | null> {
    const [result] = await this.db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);

    return result || null;
  }

  /**
   * Find a role by name
   */
  async findRoleByName(roleName: string): Promise<Role | null> {
    const [result] = await this.db
      .select()
      .from(roles)
      .where(eq(roles.roleName, roleName))
      .limit(1);

    return result || null;
  }

  /**
   * Find all roles
   */
  async findAllRoles(): Promise<Role[]> {
    return await this.db
      .select()
      .from(roles)
      .orderBy(roles.roleName);
  }

  /**
   * Create a new role
   */
  async createRole(data: NewRole): Promise<Role> {
    const [result] = await this.db
      .insert(roles)
      .values({
        roleName: data.roleName,
        roleDescription: data.roleDescription,
        isSystemRole: data.isSystemRole ?? false,
      })
      .returning();

    return result;
  }

  /**
   * Update a role
   */
  async updateRole(roleId: string, data: Partial<NewRole>): Promise<Role | null> {
    const [result] = await this.db
      .update(roles)
      .set(data)
      .where(eq(roles.id, roleId))
      .returning();

    return result || null;
  }

  /**
   * Delete a role (only non-system roles)
   */
  async deleteRole(roleId: string): Promise<boolean> {
    const result = await this.db
      .delete(roles)
      .where(
        and(
          eq(roles.id, roleId),
          eq(roles.isSystemRole, false)
        )
      );

    return (result.rowCount ?? 0) > 0;
  }

  // ============ Permission Operations ============

  /**
   * Find a permission by ID
   */
  async findPermissionById(permissionId: string): Promise<Permission | null> {
    const [result] = await this.db
      .select()
      .from(permissions)
      .where(eq(permissions.id, permissionId))
      .limit(1);

    return result || null;
  }

  /**
   * Find a permission by name
   */
  async findPermissionByName(permissionName: string): Promise<Permission | null> {
    const [result] = await this.db
      .select()
      .from(permissions)
      .where(eq(permissions.permissionName, permissionName))
      .limit(1);

    return result || null;
  }

  /**
   * Find all permissions
   */
  async findAllPermissions(): Promise<Permission[]> {
    return await this.db
      .select()
      .from(permissions)
      .orderBy(permissions.resourceType, permissions.action);
  }

  /**
   * Find permissions by resource type
   */
  async findPermissionsByResourceType(resourceType: string): Promise<Permission[]> {
    return await this.db
      .select()
      .from(permissions)
      .where(eq(permissions.resourceType, resourceType))
      .orderBy(permissions.action);
  }

  /**
   * Create a new permission
   */
  async createPermission(data: NewPermission): Promise<Permission> {
    const [result] = await this.db
      .insert(permissions)
      .values({
        permissionName: data.permissionName,
        resourceType: data.resourceType,
        action: data.action,
        description: data.description,
      })
      .returning();

    return result;
  }

  // ============ Role-Permission Mapping ============

  /**
   * Find all permissions for a role
   */
  async findPermissionsByRole(roleId: string): Promise<Permission[]> {
    const results = await this.db
      .select({
        id: permissions.id,
        permissionName: permissions.permissionName,
        resourceType: permissions.resourceType,
        action: permissions.action,
        description: permissions.description,
        createdDate: permissions.createdDate,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));

    return results;
  }

  /**
   * Assign a permission to a role
   */
  async assignPermissionToRole(roleId: string, permissionId: string): Promise<void> {
    await this.db
      .insert(rolePermissions)
      .values({
        roleId,
        permissionId,
      })
      .onConflictDoNothing();
  }

  /**
   * Revoke a permission from a role
   */
  async revokePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    await this.db
      .delete(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, roleId),
          eq(rolePermissions.permissionId, permissionId)
        )
      );
  }

  // ============ User-Role Assignment ============

  /**
   * Find all roles for a user, optionally filtered by subsidiary
   * Only returns non-expired roles
   */
  async findEntityRoles(
    entityId: string,
    subsidiaryId?: string | null
  ): Promise<UserRole[]> {
    const now = new Date();

    let whereClause = and(
      eq(entityRoles.entityId, entityId),
      or(
        isNull(entityRoles.expiresDate),
        gt(entityRoles.expiresDate, now)
      )
    );

    // If subsidiaryId provided, include global roles (null subsidiary) and specific subsidiary roles
    if (subsidiaryId !== undefined) {
      if (subsidiaryId === null) {
        // Only global roles
        whereClause = and(whereClause, isNull(entityRoles.subsidiaryId));
      } else {
        // Global roles OR specific subsidiary roles
        whereClause = and(
          whereClause,
          or(
            isNull(entityRoles.subsidiaryId),
            eq(entityRoles.subsidiaryId, subsidiaryId)
          )
        );
      }
    }

    const results = await this.db
      .select({
        entityId: entityRoles.entityId,
        roleId: entityRoles.roleId,
        subsidiaryId: entityRoles.subsidiaryId,
        grantedBy: entityRoles.grantedBy,
        grantedDate: entityRoles.grantedDate,
        expiresDate: entityRoles.expiresDate,
        role: {
          id: roles.id,
          roleName: roles.roleName,
          roleDescription: roles.roleDescription,
          isSystemRole: roles.isSystemRole,
          createdDate: roles.createdDate,
        },
      })
      .from(entityRoles)
      .innerJoin(roles, eq(entityRoles.roleId, roles.id))
      .where(whereClause);

    return results;
  }

  /**
   * Assign a role to a user
   */
  async assignRoleToEntity(
    entityId: string,
    roleId: string,
    grantedBy: string,
    subsidiaryId?: string | null,
    expiresDate?: Date | null
  ): Promise<void> {
    await this.db
      .insert(entityRoles)
      .values({
        entityId,
        roleId,
        subsidiaryId: subsidiaryId ?? null,
        grantedBy,
        expiresDate: expiresDate ?? null,
      })
      .onConflictDoNothing();
  }

  /**
   * Revoke a role from a user
   */
  async revokeRoleFromEntity(
    entityId: string,
    roleId: string,
    subsidiaryId?: string | null
  ): Promise<void> {
    let whereClause = and(
      eq(entityRoles.entityId, entityId),
      eq(entityRoles.roleId, roleId)
    );

    if (subsidiaryId !== undefined) {
      if (subsidiaryId === null) {
        whereClause = and(whereClause, isNull(entityRoles.subsidiaryId));
      } else {
        whereClause = and(whereClause, eq(entityRoles.subsidiaryId, subsidiaryId));
      }
    }

    await this.db.delete(entityRoles).where(whereClause);
  }

  // ============ Permission Checking ============

  /**
   * Get all permissions for a user (aggregated from all their roles)
   * Considers role expiration and subsidiary scope
   */
  async findEntityPermissions(
    entityId: string,
    subsidiaryId?: string | null
  ): Promise<Permission[]> {
    const now = new Date();

    // Build subsidiary filter
    let subsidiaryFilter;
    if (subsidiaryId !== undefined && subsidiaryId !== null) {
      // Include global roles (null subsidiary) and specific subsidiary roles
      subsidiaryFilter = or(
        isNull(entityRoles.subsidiaryId),
        eq(entityRoles.subsidiaryId, subsidiaryId)
      );
    } else {
      // Only global roles
      subsidiaryFilter = isNull(entityRoles.subsidiaryId);
    }

    const results = await this.db
      .selectDistinct({
        id: permissions.id,
        permissionName: permissions.permissionName,
        resourceType: permissions.resourceType,
        action: permissions.action,
        description: permissions.description,
        createdDate: permissions.createdDate,
      })
      .from(entityRoles)
      .innerJoin(rolePermissions, eq(entityRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(entityRoles.entityId, entityId),
          subsidiaryFilter,
          or(
            isNull(entityRoles.expiresDate),
            gt(entityRoles.expiresDate, now)
          )
        )
      );

    return results;
  }

  /**
   * Check if a user has a specific permission
   */
  async hasPermission(
    entityId: string,
    resourceType: string,
    action: string,
    subsidiaryId?: string | null
  ): Promise<boolean> {
    const now = new Date();

    // Build subsidiary filter
    let subsidiaryFilter;
    if (subsidiaryId !== undefined && subsidiaryId !== null) {
      subsidiaryFilter = or(
        isNull(entityRoles.subsidiaryId),
        eq(entityRoles.subsidiaryId, subsidiaryId)
      );
    } else {
      subsidiaryFilter = isNull(entityRoles.subsidiaryId);
    }

    const [result] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(entityRoles)
      .innerJoin(rolePermissions, eq(entityRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(entityRoles.entityId, entityId),
          eq(permissions.resourceType, resourceType),
          eq(permissions.action, action),
          subsidiaryFilter,
          or(
            isNull(entityRoles.expiresDate),
            gt(entityRoles.expiresDate, now)
          )
        )
      )
      .limit(1);

    return (result?.count ?? 0) > 0;
  }

  // ============ Subsidiary Access ============

  /**
   * Get user's subsidiary access levels
   */
  async findEntitySubsidiaryAccess(entityId: string): Promise<UserSubsidiaryAccess[]> {
    const now = new Date();

    return await this.db
      .select()
      .from(entitySubsidiaryAccess)
      .where(
        and(
          eq(entitySubsidiaryAccess.entityId, entityId),
          or(
            isNull(entitySubsidiaryAccess.expiresDate),
            gt(entitySubsidiaryAccess.expiresDate, now)
          )
        )
      );
  }

  /**
   * Check if user has required access level to a subsidiary
   */
  async hasSubsidiaryAccess(
    entityId: string,
    subsidiaryId: string,
    requiredLevel: 'read' | 'write' | 'admin'
  ): Promise<boolean> {
    const now = new Date();
    const levelHierarchy = { read: 1, write: 2, admin: 3 };

    const [result] = await this.db
      .select()
      .from(entitySubsidiaryAccess)
      .where(
        and(
          eq(entitySubsidiaryAccess.entityId, entityId),
          eq(entitySubsidiaryAccess.subsidiaryId, subsidiaryId),
          or(
            isNull(entitySubsidiaryAccess.expiresDate),
            gt(entitySubsidiaryAccess.expiresDate, now)
          )
        )
      )
      .limit(1);

    if (!result) return false;

    const userLevel = levelHierarchy[result.accessLevel as keyof typeof levelHierarchy] ?? 0;
    const required = levelHierarchy[requiredLevel];

    return userLevel >= required;
  }

  /**
   * Grant subsidiary access to a user
   */
  async grantSubsidiaryAccess(
    entityId: string,
    subsidiaryId: string,
    accessLevel: 'read' | 'write' | 'admin',
    grantedBy: string,
    expiresDate?: Date | null
  ): Promise<void> {
    await this.db
      .insert(entitySubsidiaryAccess)
      .values({
        entityId,
        subsidiaryId,
        accessLevel,
        grantedBy,
        expiresDate: expiresDate ?? null,
      })
      .onConflictDoUpdate({
        target: [entitySubsidiaryAccess.entityId, entitySubsidiaryAccess.subsidiaryId],
        set: {
          accessLevel,
          grantedBy,
          grantedDate: new Date(),
          expiresDate: expiresDate ?? null,
        },
      });
  }

  /**
   * Revoke subsidiary access from a user
   */
  async revokeSubsidiaryAccess(entityId: string, subsidiaryId: string): Promise<void> {
    await this.db
      .delete(entitySubsidiaryAccess)
      .where(
        and(
          eq(entitySubsidiaryAccess.entityId, entityId),
          eq(entitySubsidiaryAccess.subsidiaryId, subsidiaryId)
        )
      );
  }
}

// Export singleton instance
export const permissionRepository = new PermissionRepository();
