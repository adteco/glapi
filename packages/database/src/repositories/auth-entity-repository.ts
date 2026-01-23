import { eq, and, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { entities } from '../db/schema/entities';

/**
 * Input for creating a new user entity (Employee with auth capabilities)
 */
export interface CreateUserEntityInput {
  clerkUserId: string;
  email: string;
  name: string;
  displayName?: string | null;
  organizationId: string;
  role?: string;
  settings?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Input for updating user entity auth fields
 */
export interface UpdateUserEntityInput {
  name?: string;
  displayName?: string | null;
  email?: string;
  role?: string;
  settings?: Record<string, unknown> | null;
  isActive?: boolean;
  lastLogin?: Date;
  metadata?: Record<string, unknown> | null;
}

/**
 * Lightweight user info returned by auth lookups
 */
export interface AuthEntityInfo {
  id: string;
  clerkUserId: string;
  email: string | null;
  name: string;
  displayName: string | null;
  organizationId: string;
  role: string | null;
  settings: unknown;
  isActive: boolean;
  lastLogin: Date | null;
  entityTypes: string[];
  status: string;
}

/**
 * AuthEntityRepository handles authentication-related operations on entities.
 *
 * This repository is designed to support the consolidation of the users table into entities,
 * allowing Employee entities to serve as authenticated users via their clerkUserId field.
 *
 * Key design decisions:
 * - Only entities with a clerkUserId can be authenticated
 * - Typically these are Employee entities, but the type constraint is not enforced here
 * - The findByLegacyUserId method supports migration from the old users table
 */
export class AuthEntityRepository extends BaseRepository {
  /**
   * Find an entity by Clerk user ID for authentication
   * This is the primary lookup method for auth flows
   */
  async findByClerkId(clerkUserId: string): Promise<AuthEntityInfo | null> {
    const [result] = await this.db
      .select({
        id: entities.id,
        clerkUserId: entities.clerkUserId,
        email: entities.email,
        name: entities.name,
        displayName: entities.displayName,
        organizationId: entities.organizationId,
        role: entities.role,
        settings: entities.settings,
        isActive: entities.isActive,
        lastLogin: entities.lastLogin,
        entityTypes: entities.entityTypes,
        status: entities.status,
      })
      .from(entities)
      .where(eq(entities.clerkUserId, clerkUserId))
      .limit(1);

    if (!result || !result.clerkUserId) {
      return null;
    }

    return result as AuthEntityInfo;
  }

  /**
   * Find entity by database ID (for internal operations)
   */
  async findById(id: string): Promise<AuthEntityInfo | null> {
    const [result] = await this.db
      .select({
        id: entities.id,
        clerkUserId: entities.clerkUserId,
        email: entities.email,
        name: entities.name,
        displayName: entities.displayName,
        organizationId: entities.organizationId,
        role: entities.role,
        settings: entities.settings,
        isActive: entities.isActive,
        lastLogin: entities.lastLogin,
        entityTypes: entities.entityTypes,
        status: entities.status,
      })
      .from(entities)
      .where(eq(entities.id, id))
      .limit(1);

    if (!result || !result.clerkUserId) {
      return null;
    }

    return result as AuthEntityInfo;
  }

  /**
   * Find entity by email within an organization
   */
  async findByEmail(email: string, organizationId: string): Promise<AuthEntityInfo | null> {
    const [result] = await this.db
      .select({
        id: entities.id,
        clerkUserId: entities.clerkUserId,
        email: entities.email,
        name: entities.name,
        displayName: entities.displayName,
        organizationId: entities.organizationId,
        role: entities.role,
        settings: entities.settings,
        isActive: entities.isActive,
        lastLogin: entities.lastLogin,
        entityTypes: entities.entityTypes,
        status: entities.status,
      })
      .from(entities)
      .where(
        and(
          eq(entities.email, email),
          eq(entities.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!result) {
      return null;
    }

    return result as AuthEntityInfo;
  }

  /**
   * Find entity by legacy user ID during migration transition
   * Uses the user_entity_mapping table to resolve old user IDs to entity IDs
   */
  async findByLegacyUserId(userId: string): Promise<AuthEntityInfo | null> {
    const result = await this.db.execute(sql`
      SELECT
        e.id,
        e.clerk_user_id as "clerkUserId",
        e.email,
        e.name,
        e.display_name as "displayName",
        e.organization_id as "organizationId",
        e.role,
        e.settings,
        e.is_active as "isActive",
        e.last_login as "lastLogin",
        e.entity_types as "entityTypes",
        e.status
      FROM entities e
      JOIN user_entity_mapping m ON m.entity_id = e.id
      WHERE m.user_id = ${userId}::uuid
      LIMIT 1
    `);

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as unknown as AuthEntityInfo;
  }

  /**
   * Create a new user entity (Employee with auth capabilities)
   * Used by Clerk webhooks when a new user signs up
   */
  async createUserEntity(input: CreateUserEntityInput): Promise<AuthEntityInfo> {
    const [result] = await this.db
      .insert(entities)
      .values({
        organizationId: input.organizationId,
        name: input.name,
        displayName: input.displayName || null,
        email: input.email,
        entityTypes: ['Employee'],
        clerkUserId: input.clerkUserId,
        role: input.role || 'user',
        settings: input.settings || null,
        metadata: input.metadata || null,
        status: 'active',
        isActive: true,
      })
      .returning({
        id: entities.id,
        clerkUserId: entities.clerkUserId,
        email: entities.email,
        name: entities.name,
        displayName: entities.displayName,
        organizationId: entities.organizationId,
        role: entities.role,
        settings: entities.settings,
        isActive: entities.isActive,
        lastLogin: entities.lastLogin,
        entityTypes: entities.entityTypes,
        status: entities.status,
      });

    return result as AuthEntityInfo;
  }

  /**
   * Update user entity by Clerk ID
   */
  async updateByClerkId(clerkUserId: string, input: UpdateUserEntityInput): Promise<AuthEntityInfo | null> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.displayName !== undefined) updateData.displayName = input.displayName;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.role !== undefined) updateData.role = input.role;
    if (input.settings !== undefined) updateData.settings = input.settings;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.lastLogin !== undefined) updateData.lastLogin = input.lastLogin;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;

    const [result] = await this.db
      .update(entities)
      .set(updateData)
      .where(eq(entities.clerkUserId, clerkUserId))
      .returning({
        id: entities.id,
        clerkUserId: entities.clerkUserId,
        email: entities.email,
        name: entities.name,
        displayName: entities.displayName,
        organizationId: entities.organizationId,
        role: entities.role,
        settings: entities.settings,
        isActive: entities.isActive,
        lastLogin: entities.lastLogin,
        entityTypes: entities.entityTypes,
        status: entities.status,
      });

    if (!result) {
      return null;
    }

    return result as AuthEntityInfo;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(clerkUserId: string): Promise<void> {
    await this.db
      .update(entities)
      .set({
        lastLogin: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(entities.clerkUserId, clerkUserId));
  }

  /**
   * Delete user entity by Clerk ID
   * Note: This is a hard delete, consider soft delete (isActive = false) instead
   */
  async deleteByClerkId(clerkUserId: string): Promise<boolean> {
    const result = await this.db
      .delete(entities)
      .where(eq(entities.clerkUserId, clerkUserId))
      .returning({ id: entities.id });

    return result.length > 0;
  }

  /**
   * Deactivate user entity (soft delete) by Clerk ID
   */
  async deactivateByClerkId(clerkUserId: string): Promise<AuthEntityInfo | null> {
    return this.updateByClerkId(clerkUserId, {
      isActive: false,
    });
  }

  /**
   * Check if an entity exists with the given Clerk user ID
   */
  async existsByClerkId(clerkUserId: string): Promise<boolean> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(entities)
      .where(eq(entities.clerkUserId, clerkUserId));

    return (result?.count ?? 0) > 0;
  }

  /**
   * List all authenticated entities in an organization
   */
  async listAuthenticatedEntities(
    organizationId: string,
    options?: {
      isActive?: boolean;
      role?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<AuthEntityInfo[]> {
    const conditions = [
      eq(entities.organizationId, organizationId),
      sql`${entities.clerkUserId} IS NOT NULL`,
    ];

    if (options?.isActive !== undefined) {
      conditions.push(eq(entities.isActive, options.isActive));
    }

    if (options?.role) {
      conditions.push(eq(entities.role, options.role));
    }

    let query = this.db
      .select({
        id: entities.id,
        clerkUserId: entities.clerkUserId,
        email: entities.email,
        name: entities.name,
        displayName: entities.displayName,
        organizationId: entities.organizationId,
        role: entities.role,
        settings: entities.settings,
        isActive: entities.isActive,
        lastLogin: entities.lastLogin,
        entityTypes: entities.entityTypes,
        status: entities.status,
      })
      .from(entities)
      .where(and(...conditions));

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }

    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    const results = await query;
    return results as AuthEntityInfo[];
  }

  /**
   * Link an existing entity to a Clerk user ID
   * Useful for associating an existing Employee entity with a new Clerk user
   */
  async linkClerkUser(
    entityId: string,
    organizationId: string,
    clerkUserId: string,
    role?: string
  ): Promise<AuthEntityInfo | null> {
    const [result] = await this.db
      .update(entities)
      .set({
        clerkUserId,
        role: role || 'user',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(entities.id, entityId),
          eq(entities.organizationId, organizationId)
        )
      )
      .returning({
        id: entities.id,
        clerkUserId: entities.clerkUserId,
        email: entities.email,
        name: entities.name,
        displayName: entities.displayName,
        organizationId: entities.organizationId,
        role: entities.role,
        settings: entities.settings,
        isActive: entities.isActive,
        lastLogin: entities.lastLogin,
        entityTypes: entities.entityTypes,
        status: entities.status,
      });

    if (!result) {
      return null;
    }

    return result as AuthEntityInfo;
  }
}
