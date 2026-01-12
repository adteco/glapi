import { and, eq, desc, gte, lte, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { glAuditTrail } from '../db/schema/gl-transactions';

export interface AuditLogEntry {
  id: string;
  tableName: string;
  recordId: string;
  actionType: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  userId: string;
  sessionId: string | null;
  ipAddress: string | null;
  timestamp: Date;
}

export interface NewAuditLogEntry {
  tableName: string;
  recordId: string;
  actionType: 'INSERT' | 'UPDATE' | 'DELETE';
  fieldName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  userId: string;
  sessionId?: string | null;
  ipAddress?: string | null;
}

export interface AuditLogFilters {
  tableName?: string;
  recordId?: string;
  actionType?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface AuditLogPaginationParams {
  page?: number;
  limit?: number;
}

// Pre-defined table names for RBAC auditing
export const AuditTableNames = {
  ROLES: 'roles',
  PERMISSIONS: 'permissions',
  ROLE_PERMISSIONS: 'role_permissions',
  USER_ROLES: 'user_roles',
  USER_SUBSIDIARY_ACCESS: 'user_subsidiary_access',
} as const;

export class AuditLogRepository extends BaseRepository {
  /**
   * Create a new audit log entry
   */
  async create(entry: NewAuditLogEntry): Promise<AuditLogEntry> {
    const [result] = await this.db
      .insert(glAuditTrail)
      .values({
        tableName: entry.tableName,
        recordId: entry.recordId,
        actionType: entry.actionType,
        fieldName: entry.fieldName ?? null,
        oldValue: entry.oldValue ?? null,
        newValue: entry.newValue ?? null,
        userId: entry.userId,
        sessionId: entry.sessionId ?? null,
        ipAddress: entry.ipAddress ?? null,
      })
      .returning();

    return result;
  }

  /**
   * Create multiple audit log entries (for batch operations)
   */
  async createMany(entries: NewAuditLogEntry[]): Promise<AuditLogEntry[]> {
    if (entries.length === 0) return [];

    const results = await this.db
      .insert(glAuditTrail)
      .values(
        entries.map((entry) => ({
          tableName: entry.tableName,
          recordId: entry.recordId,
          actionType: entry.actionType,
          fieldName: entry.fieldName ?? null,
          oldValue: entry.oldValue ?? null,
          newValue: entry.newValue ?? null,
          userId: entry.userId,
          sessionId: entry.sessionId ?? null,
          ipAddress: entry.ipAddress ?? null,
        }))
      )
      .returning();

    return results;
  }

  /**
   * Find audit logs with filtering and pagination
   */
  async findAll(
    filters: AuditLogFilters = {},
    params: AuditLogPaginationParams = {}
  ): Promise<{ data: AuditLogEntry[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 50));
    const skip = (page - 1) * limit;

    // Build where clause
    const conditions = [];

    if (filters.tableName) {
      conditions.push(eq(glAuditTrail.tableName, filters.tableName));
    }

    if (filters.recordId) {
      conditions.push(eq(glAuditTrail.recordId, filters.recordId));
    }

    if (filters.actionType) {
      conditions.push(eq(glAuditTrail.actionType, filters.actionType));
    }

    if (filters.userId) {
      conditions.push(eq(glAuditTrail.userId, filters.userId));
    }

    if (filters.startDate) {
      conditions.push(gte(glAuditTrail.timestamp, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(glAuditTrail.timestamp, filters.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(glAuditTrail)
      .where(whereClause);

    const total = Number(countResult[0]?.count || 0);

    // Get paginated results
    const results = await this.db
      .select()
      .from(glAuditTrail)
      .where(whereClause)
      .orderBy(desc(glAuditTrail.timestamp))
      .limit(limit)
      .offset(skip);

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find audit logs for a specific record
   */
  async findByRecord(tableName: string, recordId: string): Promise<AuditLogEntry[]> {
    return await this.db
      .select()
      .from(glAuditTrail)
      .where(
        and(eq(glAuditTrail.tableName, tableName), eq(glAuditTrail.recordId, recordId))
      )
      .orderBy(desc(glAuditTrail.timestamp));
  }

  /**
   * Find audit logs by user
   */
  async findByUser(
    userId: string,
    params: AuditLogPaginationParams = {}
  ): Promise<{ data: AuditLogEntry[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
    return this.findAll({ userId }, params);
  }

  // ============ RBAC-Specific Audit Methods ============

  /**
   * Log a role assignment change
   */
  async logRoleAssignment(
    userId: string,
    targetUserId: string,
    roleId: string,
    action: 'ASSIGN' | 'REVOKE',
    performedBy: string,
    sessionId?: string,
    ipAddress?: string,
    subsidiaryId?: string | null
  ): Promise<AuditLogEntry> {
    return this.create({
      tableName: AuditTableNames.USER_ROLES,
      recordId: `${targetUserId}:${roleId}${subsidiaryId ? `:${subsidiaryId}` : ''}`,
      actionType: action === 'ASSIGN' ? 'INSERT' : 'DELETE',
      fieldName: 'roleId',
      oldValue: action === 'REVOKE' ? roleId : null,
      newValue: action === 'ASSIGN' ? roleId : null,
      userId: performedBy,
      sessionId,
      ipAddress,
    });
  }

  /**
   * Log a permission change on a role
   */
  async logPermissionChange(
    roleId: string,
    permissionId: string,
    action: 'ASSIGN' | 'REVOKE',
    performedBy: string,
    sessionId?: string,
    ipAddress?: string
  ): Promise<AuditLogEntry> {
    return this.create({
      tableName: AuditTableNames.ROLE_PERMISSIONS,
      recordId: `${roleId}:${permissionId}`,
      actionType: action === 'ASSIGN' ? 'INSERT' : 'DELETE',
      fieldName: 'permissionId',
      oldValue: action === 'REVOKE' ? permissionId : null,
      newValue: action === 'ASSIGN' ? permissionId : null,
      userId: performedBy,
      sessionId,
      ipAddress,
    });
  }

  /**
   * Log a role creation/update/deletion
   */
  async logRoleChange(
    roleId: string,
    action: 'INSERT' | 'UPDATE' | 'DELETE',
    performedBy: string,
    changes?: { fieldName: string; oldValue?: string | null; newValue?: string | null }[],
    sessionId?: string,
    ipAddress?: string
  ): Promise<AuditLogEntry[]> {
    if (action === 'UPDATE' && changes && changes.length > 0) {
      // Log each field change separately for UPDATE
      return this.createMany(
        changes.map((change) => ({
          tableName: AuditTableNames.ROLES,
          recordId: roleId,
          actionType: action,
          fieldName: change.fieldName,
          oldValue: change.oldValue ?? null,
          newValue: change.newValue ?? null,
          userId: performedBy,
          sessionId,
          ipAddress,
        }))
      );
    }

    // For INSERT/DELETE, create a single entry
    const entry = await this.create({
      tableName: AuditTableNames.ROLES,
      recordId: roleId,
      actionType: action,
      userId: performedBy,
      sessionId,
      ipAddress,
    });

    return [entry];
  }

  /**
   * Log subsidiary access changes
   */
  async logSubsidiaryAccessChange(
    userId: string,
    subsidiaryId: string,
    action: 'GRANT' | 'REVOKE' | 'UPDATE',
    performedBy: string,
    oldAccessLevel?: string | null,
    newAccessLevel?: string | null,
    sessionId?: string,
    ipAddress?: string
  ): Promise<AuditLogEntry> {
    const actionType: 'INSERT' | 'UPDATE' | 'DELETE' =
      action === 'GRANT' ? 'INSERT' : action === 'REVOKE' ? 'DELETE' : 'UPDATE';

    return this.create({
      tableName: AuditTableNames.USER_SUBSIDIARY_ACCESS,
      recordId: `${userId}:${subsidiaryId}`,
      actionType,
      fieldName: 'accessLevel',
      oldValue: oldAccessLevel ?? null,
      newValue: newAccessLevel ?? null,
      userId: performedBy,
      sessionId,
      ipAddress,
    });
  }

  /**
   * Get RBAC audit history (all RBAC-related changes)
   */
  async findRbacAuditLogs(
    params: AuditLogPaginationParams = {}
  ): Promise<{ data: AuditLogEntry[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 50));
    const skip = (page - 1) * limit;

    const rbacTables = Object.values(AuditTableNames);

    // Get total count for RBAC tables
    const countResult = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(glAuditTrail)
      .where(sql`${glAuditTrail.tableName} = ANY(${rbacTables})`);

    const total = Number(countResult[0]?.count || 0);

    // Get paginated results
    const results = await this.db
      .select()
      .from(glAuditTrail)
      .where(sql`${glAuditTrail.tableName} = ANY(${rbacTables})`)
      .orderBy(desc(glAuditTrail.timestamp))
      .limit(limit)
      .offset(skip);

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

// Export singleton instance
export const auditLogRepository = new AuditLogRepository();
