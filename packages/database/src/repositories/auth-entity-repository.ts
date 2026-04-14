import { eq, and, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { entities } from '../db/schema/entities';
import { hasSchemaColumn, pgTextArray } from './schema-compatibility';

type EntitySchemaSupport = {
  betterAuthUserId: boolean;
};

let entitySchemaSupportPromise: Promise<EntitySchemaSupport> | null = null;

/**
 * Input for creating a new user entity (Employee with auth capabilities)
 */
export interface CreateUserEntityInput {
  clerkUserId?: string | null;
  betterAuthUserId?: string | null;
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
  betterAuthUserId?: string | null;
}

/**
 * Lightweight user info returned by auth lookups
 */
export interface AuthEntityInfo {
  id: string;
  clerkUserId: string | null;
  betterAuthUserId: string | null;
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
 * allowing Employee entities to serve as authenticated users via their clerkUserId or betterAuthUserId field.
 *
 * Key design decisions:
 * - Entities with clerkUserId OR betterAuthUserId can be authenticated
 * - Typically these are Employee entities, but the type constraint is not enforced here
 * - The findByLegacyUserId method supports migration from the old users table
 */
export class AuthEntityRepository extends BaseRepository {
  private async getSchemaSupport(): Promise<EntitySchemaSupport> {
    if (!entitySchemaSupportPromise) {
      entitySchemaSupportPromise = this.db
        .execute(sql`
          select column_name
          from information_schema.columns
          where table_schema = current_schema()
            and table_name = 'entities'
            and column_name in ('better_auth_user_id')
        `)
        .then((result) => {
          return {
            betterAuthUserId: hasSchemaColumn(
              result.rows as { column_name?: string | null }[] | undefined,
              'better_auth_user_id'
            ),
          };
        })
        .catch(() => ({
          betterAuthUserId: true,
        }));
    }

    return entitySchemaSupportPromise;
  }

  private async getSelection() {
    const support = await this.getSchemaSupport();

    return {
      id: entities.id,
      clerkUserId: entities.clerkUserId,
      betterAuthUserId: support.betterAuthUserId
        ? entities.betterAuthUserId
        : sql<string | null>`null`,
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
    };
  }

  /**
   * Find an entity by Clerk user ID for authentication
   * This is the primary lookup method for auth flows
   */
  async findByClerkId(clerkUserId: string): Promise<AuthEntityInfo | null> {
    const selection = await this.getSelection();
    const [result] = await this.db
      .select(selection)
      .from(entities)
      .where(eq(entities.clerkUserId, clerkUserId))
      .limit(1);

    if (!result || !result.clerkUserId) {
      return null;
    }

    return result as AuthEntityInfo;
  }

  /**
   * Find an entity by Better Auth user ID for authentication
   */
  async findByBetterAuthId(betterAuthUserId: string): Promise<AuthEntityInfo | null> {
    const support = await this.getSchemaSupport();
    if (!support.betterAuthUserId) {
      return null;
    }

    const selection = await this.getSelection();
    const [result] = await this.db
      .select(selection)
      .from(entities)
      .where(eq(entities.betterAuthUserId, betterAuthUserId))
      .limit(1);

    if (!result || !result.betterAuthUserId) {
      return null;
    }

    return result as AuthEntityInfo;
  }

  /**
   * Find entity by database ID (for internal operations)
   */
  async findById(id: string): Promise<AuthEntityInfo | null> {
    const selection = await this.getSelection();
    const [result] = await this.db
      .select(selection)
      .from(entities)
      .where(eq(entities.id, id))
      .limit(1);

    if (!result || (!result.clerkUserId && !result.betterAuthUserId)) {
      return null;
    }

    return result as AuthEntityInfo;
  }

  /**
   * Find entity by email within an organization
   */
  async findByEmail(email: string, organizationId: string): Promise<AuthEntityInfo | null> {
    const selection = await this.getSelection();
    const [result] = await this.db
      .select(selection)
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
        e.better_auth_user_id as "betterAuthUserId",
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
   * Used by Clerk webhooks or Better Auth signup
   */
  async createUserEntity(input: CreateUserEntityInput): Promise<AuthEntityInfo> {
    const selection = await this.getSelection();
    const support = await this.getSchemaSupport();

    if (!support.betterAuthUserId) {
      const result = await this.db.execute(sql`
        insert into entities (
          organization_id,
          name,
          display_name,
          entity_types,
          email,
          metadata,
          status,
          is_active,
          clerk_user_id,
          role,
          settings
        ) values (
          ${input.organizationId}::uuid,
          ${input.name},
          ${input.displayName || null},
          ${pgTextArray(['Employee'])},
          ${input.email},
          ${input.metadata ? JSON.stringify(input.metadata) : null}::jsonb,
          ${'active'},
          ${true},
          ${input.clerkUserId || null},
          ${input.role || 'user'},
          ${input.settings ? JSON.stringify(input.settings) : null}::jsonb
        )
        returning
          id,
          clerk_user_id as "clerkUserId",
          null as "betterAuthUserId",
          email,
          name,
          display_name as "displayName",
          organization_id as "organizationId",
          role,
          settings,
          is_active as "isActive",
          last_login as "lastLogin",
          entity_types as "entityTypes",
          status
      `);

      return result.rows[0] as unknown as AuthEntityInfo;
    }

    const [result] = await this.db
      .insert(entities)
      .values({
        organizationId: input.organizationId,
        name: input.name,
        displayName: input.displayName || null,
        email: input.email,
        entityTypes: ['Employee'],
        clerkUserId: input.clerkUserId || null,
        ...(support.betterAuthUserId
          ? { betterAuthUserId: input.betterAuthUserId || null }
          : {}),
        role: input.role || 'user',
        settings: input.settings || null,
        metadata: input.metadata || null,
        status: 'active',
        isActive: true,
      })
      .returning(selection);

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
        betterAuthUserId: entities.betterAuthUserId,
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
   * Update user entity by Better Auth ID
   */
  async updateByBetterAuthId(betterAuthUserId: string, input: UpdateUserEntityInput): Promise<AuthEntityInfo | null> {
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
      .where(eq(entities.betterAuthUserId, betterAuthUserId))
      .returning({
        id: entities.id,
        clerkUserId: entities.clerkUserId,
        betterAuthUserId: entities.betterAuthUserId,
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
   * Update last login timestamp for Clerk
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
   * Update last login timestamp for Better Auth
   */
  async updateLastLoginByBetterAuthId(betterAuthUserId: string): Promise<void> {
    await this.db
      .update(entities)
      .set({
        lastLogin: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(entities.betterAuthUserId, betterAuthUserId));
  }

  /**
   * Delete user entity by Clerk ID
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
      sql`(${entities.clerkUserId} IS NOT NULL OR ${entities.betterAuthUserId} IS NOT NULL)`,
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
        betterAuthUserId: entities.betterAuthUserId,
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
        betterAuthUserId: entities.betterAuthUserId,
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
   * Link an existing entity to a Better Auth user ID
   */
  async linkBetterAuthUser(
    entityId: string,
    organizationId: string,
    betterAuthUserId: string,
    role?: string
  ): Promise<AuthEntityInfo | null> {
    const [result] = await this.db
      .update(entities)
      .set({
        betterAuthUserId,
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
        betterAuthUserId: entities.betterAuthUserId,
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
