/**
 * RLS Context Handler for Multi-Tenancy Isolation
 *
 * This module provides the SINGLE POINT where PostgreSQL session variables
 * are set to enable Row Level Security (RLS) policies. All database operations
 * that need organization isolation should use withOrganizationContext.
 *
 * The RLS policies in the database use get_current_organization_id() which
 * reads from current_setting('app.current_organization_id', true).
 */

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PoolClient } from 'pg';
import { pool } from './db';
import { schema } from './db/schema';

/**
 * Organization context for RLS policies
 */
export interface OrganizationContext {
  organizationId: string;
  userId?: string;
}

/**
 * Type for the contextual Drizzle database instance.
 * Uses NodePgDatabase with our schema type for compatibility with both
 * Pool-based and PoolClient-based connections.
 */
export type ContextualDatabase = NodePgDatabase<typeof schema>;

/**
 * Execute database operations with organization context set.
 * This is the SINGLE POINT where RLS context is established.
 * All queries within the operation will be filtered by RLS policies.
 *
 * @param context - The organization context containing organizationId and optional userId
 * @param operation - The database operation to execute with the contextual client
 * @returns The result of the operation
 *
 * @example
 * ```typescript
 * const result = await withOrganizationContext(
 *   { organizationId: ctx.user.organizationId, userId: ctx.user.id },
 *   async (db) => {
 *     // All queries here are RLS-protected
 *     return db.select().from(customers).execute();
 *   }
 * );
 * ```
 */
export async function withOrganizationContext<T>(
  context: OrganizationContext,
  operation: (db: ContextualDatabase, client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    // Set organization context - enables RLS policies
    // Use session-scoped setting so it persists across queries in this connection.
    await client.query(
      "SELECT set_config('app.current_organization_id', $1, false)",
      [context.organizationId]
    );

    // Optionally set user context for audit trails and user-level policies
    if (context.userId) {
      await client.query(
        "SELECT set_config('app.current_user_id', $1, false)",
        [context.userId]
      );
    }

    // Create a Drizzle instance bound to this specific client
    const contextualDb = drizzle(client, { schema });

    return await operation(contextualDb, client);
  } finally {
    // Always release the connection back to the pool
    client.release();
  }
}

/**
 * Execute database operations within a transaction with organization context.
 * Combines RLS context setting with transaction semantics.
 *
 * @param context - The organization context containing organizationId and optional userId
 * @param operation - The database operation to execute within the transaction
 * @returns The result of the operation
 *
 * @example
 * ```typescript
 * const result = await withOrganizationContextTransaction(
 *   { organizationId: ctx.user.organizationId },
 *   async (db) => {
 *     await db.insert(orders).values({ ... });
 *     await db.insert(orderLines).values({ ... });
 *     return { success: true };
 *   }
 * );
 * ```
 */
export async function withOrganizationContextTransaction<T>(
  context: OrganizationContext,
  operation: (db: ContextualDatabase) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    // Begin transaction
    await client.query('BEGIN');

    // Set organization context within the transaction
    // With 'true', settings are local to the transaction
    await client.query(
      "SELECT set_config('app.current_organization_id', $1, true)",
      [context.organizationId]
    );

    if (context.userId) {
      await client.query(
        "SELECT set_config('app.current_user_id', $1, true)",
        [context.userId]
      );
    }

    // Create a Drizzle instance bound to this client
    const contextualDb = drizzle(client, { schema });

    const result = await operation(contextualDb);

    // Commit transaction
    await client.query('COMMIT');

    return result;
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // Always release the connection
    client.release();
  }
}

/**
 * Creates a contextual database instance for a specific organization.
 * This is useful when you need to pass the db instance to services
 * while maintaining RLS context.
 *
 * IMPORTANT: The caller is responsible for releasing the client when done.
 * Consider using withOrganizationContext instead for automatic cleanup.
 *
 * @param context - The organization context
 * @returns Object containing the contextual db and a release function
 *
 * @example
 * ```typescript
 * const { db, release } = await createContextualDb({ organizationId: '...' });
 * try {
 *   const result = await db.select().from(customers).execute();
 *   return result;
 * } finally {
 *   release();
 * }
 * ```
 */
export async function createContextualDb(
  context: OrganizationContext
): Promise<{ db: ContextualDatabase; release: () => void; client: PoolClient }> {
  const client = await pool.connect();

  // Set organization context (session-scoped for this client)
  await client.query(
    "SELECT set_config('app.current_organization_id', $1, false)",
    [context.organizationId]
  );

  if (context.userId) {
    await client.query(
      "SELECT set_config('app.current_user_id', $1, false)",
      [context.userId]
    );
  }

  const db = drizzle(client, { schema });

  return {
    db,
    client,
    release: () => client.release(),
  };
}

/**
 * Verifies that the RLS context is properly set for a given client.
 * Useful for debugging and testing.
 *
 * @param client - The PostgreSQL client to check
 * @returns The current organization ID set in the session
 */
export async function verifyRLSContext(client: PoolClient): Promise<{
  organizationId: string | null;
  userId: string | null;
}> {
  const orgResult = await client.query(
    "SELECT current_setting('app.current_organization_id', true) as org_id"
  );
  const userResult = await client.query(
    "SELECT current_setting('app.current_user_id', true) as user_id"
  );

  const orgId = orgResult.rows[0]?.org_id || null;
  const userId = userResult.rows[0]?.user_id || null;

  return {
    organizationId: orgId,
    userId: userId,
  };
}
