import { BaseService } from './base-service';
import { ServiceError, PaginatedResult } from '../types';
import { permissionRepository, auditLogRepository } from '@glapi/database';
import { PermissionService } from './permission-service';
import type {
  Role,
  Permission,
  UserRole,
  RoleWithPermissions,
  CreateRoleInput,
  UpdateRoleInput,
  CreatePermissionInput,
  AssignRoleInput,
  GrantSubsidiaryAccessInput,
  AccessLevel,
} from '../types/rbac.types';
import { ResourceTypes, Actions, generatePermissionName } from '../types/rbac.types';

/**
 * Service for managing roles, permissions, and user role assignments
 * Requires admin permissions for most operations
 */
export class RoleManagementService extends BaseService {
  private permissionService: PermissionService;

  constructor(context = {}) {
    super(context);
    this.permissionService = new PermissionService(context);
  }

  // ============ Role Management ============

  /**
   * List all roles
   */
  async listRoles(): Promise<Role[]> {
    await this.permissionService.requirePermission(ResourceTypes.ROLE, Actions.READ);
    return permissionRepository.findAllRoles();
  }

  /**
   * Get a role by ID with its permissions
   */
  async getRoleById(roleId: string): Promise<RoleWithPermissions | null> {
    await this.permissionService.requirePermission(ResourceTypes.ROLE, Actions.READ);

    const role = await permissionRepository.findRoleById(roleId);
    if (!role) return null;

    const permissions = await permissionRepository.findPermissionsByRole(roleId);

    return {
      ...role,
      permissions,
    };
  }

  /**
   * Get a role by name
   */
  async getRoleByName(roleName: string): Promise<Role | null> {
    await this.permissionService.requirePermission(ResourceTypes.ROLE, Actions.READ);
    return permissionRepository.findRoleByName(roleName);
  }

  /**
   * Create a new role
   */
  async createRole(data: CreateRoleInput): Promise<Role> {
    await this.permissionService.requirePermission(ResourceTypes.ROLE, Actions.CREATE);
    const userId = this.requireUserContext();

    // Check if role name already exists
    const existing = await permissionRepository.findRoleByName(data.roleName);
    if (existing) {
      throw new ServiceError(
        `Role with name "${data.roleName}" already exists`,
        'ROLE_ALREADY_EXISTS',
        409
      );
    }

    const role = await permissionRepository.createRole({
      roleName: data.roleName,
      roleDescription: data.roleDescription,
      isSystemRole: data.isSystemRole,
    });

    // Audit log
    await auditLogRepository.logRoleChange(role.id, 'INSERT', userId);

    return role;
  }

  /**
   * Update an existing role
   */
  async updateRole(roleId: string, data: UpdateRoleInput): Promise<Role> {
    await this.permissionService.requirePermission(ResourceTypes.ROLE, Actions.UPDATE);
    const userId = this.requireUserContext();

    const existing = await permissionRepository.findRoleById(roleId);
    if (!existing) {
      throw new ServiceError(`Role not found: ${roleId}`, 'ROLE_NOT_FOUND', 404);
    }

    // Prevent modifying system roles (except description)
    if (existing.isSystemRole && data.roleName && data.roleName !== existing.roleName) {
      throw new ServiceError(
        'Cannot rename system roles',
        'SYSTEM_ROLE_PROTECTED',
        403
      );
    }

    // Check for name conflict
    if (data.roleName && data.roleName !== existing.roleName) {
      const nameConflict = await permissionRepository.findRoleByName(data.roleName);
      if (nameConflict) {
        throw new ServiceError(
          `Role with name "${data.roleName}" already exists`,
          'ROLE_ALREADY_EXISTS',
          409
        );
      }
    }

    const role = await permissionRepository.updateRole(roleId, data);
    if (!role) {
      throw new ServiceError(`Failed to update role: ${roleId}`, 'UPDATE_FAILED', 500);
    }

    // Audit log with field changes
    const changes: { fieldName: string; oldValue?: string | null; newValue?: string | null }[] = [];
    if (data.roleName !== undefined && data.roleName !== existing.roleName) {
      changes.push({ fieldName: 'roleName', oldValue: existing.roleName, newValue: data.roleName });
    }
    if (data.roleDescription !== undefined && data.roleDescription !== existing.roleDescription) {
      changes.push({ fieldName: 'roleDescription', oldValue: existing.roleDescription, newValue: data.roleDescription });
    }

    if (changes.length > 0) {
      await auditLogRepository.logRoleChange(roleId, 'UPDATE', userId, changes);
    }

    return role;
  }

  /**
   * Delete a role (non-system roles only)
   */
  async deleteRole(roleId: string): Promise<void> {
    await this.permissionService.requirePermission(ResourceTypes.ROLE, Actions.DELETE);
    const userId = this.requireUserContext();

    const existing = await permissionRepository.findRoleById(roleId);
    if (!existing) {
      throw new ServiceError(`Role not found: ${roleId}`, 'ROLE_NOT_FOUND', 404);
    }

    if (existing.isSystemRole) {
      throw new ServiceError('Cannot delete system roles', 'SYSTEM_ROLE_PROTECTED', 403);
    }

    const deleted = await permissionRepository.deleteRole(roleId);
    if (!deleted) {
      throw new ServiceError(`Failed to delete role: ${roleId}`, 'DELETE_FAILED', 500);
    }

    // Audit log
    await auditLogRepository.logRoleChange(roleId, 'DELETE', userId);
  }

  // ============ Permission Management ============

  /**
   * List all permissions
   */
  async listPermissions(): Promise<Permission[]> {
    await this.permissionService.requirePermission(ResourceTypes.PERMISSION, Actions.READ);
    return permissionRepository.findAllPermissions();
  }

  /**
   * List permissions for a specific resource type
   */
  async listPermissionsByResourceType(resourceType: string): Promise<Permission[]> {
    await this.permissionService.requirePermission(ResourceTypes.PERMISSION, Actions.READ);
    return permissionRepository.findPermissionsByResourceType(resourceType);
  }

  /**
   * Create a new permission
   */
  async createPermission(data: CreatePermissionInput): Promise<Permission> {
    await this.permissionService.requirePermission(ResourceTypes.PERMISSION, Actions.CREATE);

    // Generate standard permission name if not provided
    const permissionName = data.permissionName || generatePermissionName(
      data.resourceType as any,
      data.action as any
    );

    // Check if permission already exists
    const existing = await permissionRepository.findPermissionByName(permissionName);
    if (existing) {
      throw new ServiceError(
        `Permission "${permissionName}" already exists`,
        'PERMISSION_ALREADY_EXISTS',
        409
      );
    }

    return permissionRepository.createPermission({
      permissionName,
      resourceType: data.resourceType,
      action: data.action,
      description: data.description,
    });
  }

  /**
   * Get permissions assigned to a role
   */
  async getRolePermissions(roleId: string): Promise<Permission[]> {
    await this.permissionService.requirePermission(ResourceTypes.ROLE, Actions.READ);
    return permissionRepository.findPermissionsByRole(roleId);
  }

  /**
   * Assign a permission to a role
   */
  async assignPermissionToRole(roleId: string, permissionId: string): Promise<void> {
    await this.permissionService.requirePermission(ResourceTypes.ROLE, Actions.MANAGE);
    const userId = this.requireUserContext();

    // Verify role exists
    const role = await permissionRepository.findRoleById(roleId);
    if (!role) {
      throw new ServiceError(`Role not found: ${roleId}`, 'ROLE_NOT_FOUND', 404);
    }

    // Verify permission exists
    const permission = await permissionRepository.findPermissionById(permissionId);
    if (!permission) {
      throw new ServiceError(`Permission not found: ${permissionId}`, 'PERMISSION_NOT_FOUND', 404);
    }

    await permissionRepository.assignPermissionToRole(roleId, permissionId);

    // Audit log
    await auditLogRepository.logPermissionChange(roleId, permissionId, 'ASSIGN', userId);

    // Clear permission cache for all users with this role
    PermissionService.clearAllCache();
  }

  /**
   * Revoke a permission from a role
   */
  async revokePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    await this.permissionService.requirePermission(ResourceTypes.ROLE, Actions.MANAGE);
    const userId = this.requireUserContext();

    await permissionRepository.revokePermissionFromRole(roleId, permissionId);

    // Audit log
    await auditLogRepository.logPermissionChange(roleId, permissionId, 'REVOKE', userId);

    // Clear permission cache
    PermissionService.clearAllCache();
  }

  // ============ User Role Assignment ============

  /**
   * Get roles assigned to a user
   */
  async getUserRoles(targetUserId: string): Promise<UserRole[]> {
    await this.permissionService.requirePermission(ResourceTypes.USER, Actions.READ);
    return permissionRepository.findUserRoles(targetUserId);
  }

  /**
   * Assign a role to a user
   */
  async assignRoleToUser(data: AssignRoleInput): Promise<void> {
    await this.permissionService.requirePermission(ResourceTypes.USER, Actions.MANAGE);
    const grantedBy = this.requireUserContext();

    // Verify role exists
    const role = await permissionRepository.findRoleById(data.roleId);
    if (!role) {
      throw new ServiceError(`Role not found: ${data.roleId}`, 'ROLE_NOT_FOUND', 404);
    }

    await permissionRepository.assignRoleToUser(
      data.userId,
      data.roleId,
      grantedBy,
      data.subsidiaryId,
      data.expiresDate
    );

    // Audit log
    await auditLogRepository.logRoleAssignment(
      data.userId,
      data.userId,
      data.roleId,
      'ASSIGN',
      grantedBy,
      undefined,
      undefined,
      data.subsidiaryId
    );

    // Clear permission cache for this user
    PermissionService.clearUserCache(data.userId);
  }

  /**
   * Revoke a role from a user
   */
  async revokeRoleFromUser(userId: string, roleId: string, subsidiaryId?: string): Promise<void> {
    await this.permissionService.requirePermission(ResourceTypes.USER, Actions.MANAGE);
    const revokedBy = this.requireUserContext();

    await permissionRepository.revokeRoleFromUser(userId, roleId, subsidiaryId);

    // Audit log
    await auditLogRepository.logRoleAssignment(
      userId,
      userId,
      roleId,
      'REVOKE',
      revokedBy,
      undefined,
      undefined,
      subsidiaryId
    );

    // Clear permission cache for this user
    PermissionService.clearUserCache(userId);
  }

  // ============ Subsidiary Access Management ============

  /**
   * Get subsidiary access for a user
   */
  async getUserSubsidiaryAccess(targetUserId: string): Promise<Array<{
    subsidiaryId: string;
    accessLevel: string;
    grantedDate: Date;
    expiresDate: Date | null;
  }>> {
    await this.permissionService.requirePermission(ResourceTypes.USER, Actions.READ);
    const access = await permissionRepository.findUserSubsidiaryAccess(targetUserId);

    return access.map((a) => ({
      subsidiaryId: a.subsidiaryId,
      accessLevel: a.accessLevel,
      grantedDate: a.grantedDate,
      expiresDate: a.expiresDate,
    }));
  }

  /**
   * Grant subsidiary access to a user
   */
  async grantSubsidiaryAccess(data: GrantSubsidiaryAccessInput): Promise<void> {
    await this.permissionService.requirePermission(ResourceTypes.USER, Actions.MANAGE);
    const grantedBy = this.requireUserContext();

    // Get existing access to determine if this is grant or update
    const existingAccess = await permissionRepository.findUserSubsidiaryAccess(data.userId);
    const existing = existingAccess.find((a) => a.subsidiaryId === data.subsidiaryId);

    await permissionRepository.grantSubsidiaryAccess(
      data.userId,
      data.subsidiaryId,
      data.accessLevel,
      grantedBy,
      data.expiresDate
    );

    // Audit log
    await auditLogRepository.logSubsidiaryAccessChange(
      data.userId,
      data.subsidiaryId,
      existing ? 'UPDATE' : 'GRANT',
      grantedBy,
      existing?.accessLevel,
      data.accessLevel
    );

    // Clear permission cache for this user
    PermissionService.clearUserCache(data.userId);
  }

  /**
   * Revoke subsidiary access from a user
   */
  async revokeSubsidiaryAccess(userId: string, subsidiaryId: string): Promise<void> {
    await this.permissionService.requirePermission(ResourceTypes.USER, Actions.MANAGE);
    const revokedBy = this.requireUserContext();

    // Get existing access for audit
    const existingAccess = await permissionRepository.findUserSubsidiaryAccess(userId);
    const existing = existingAccess.find((a) => a.subsidiaryId === subsidiaryId);

    await permissionRepository.revokeSubsidiaryAccess(userId, subsidiaryId);

    // Audit log
    if (existing) {
      await auditLogRepository.logSubsidiaryAccessChange(
        userId,
        subsidiaryId,
        'REVOKE',
        revokedBy,
        existing.accessLevel,
        null
      );
    }

    // Clear permission cache for this user
    PermissionService.clearUserCache(userId);
  }

  // ============ Audit Log Access ============

  /**
   * Get RBAC audit logs
   */
  async getRbacAuditLogs(params: { page?: number; limit?: number } = {}): Promise<PaginatedResult<any>> {
    await this.permissionService.requirePermission(ResourceTypes.AUDIT_LOG, Actions.READ);

    const result = await auditLogRepository.findRbacAuditLogs(params);

    return {
      data: result.data,
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit,
      totalPages: result.pagination.pages,
    };
  }
}
