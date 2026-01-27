import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, sql } from 'drizzle-orm';
import { db as globalDb } from '../db';
import type { ContextualDatabase } from '../context';

/**
 * Base repository class that provides common database access functionality
 * All entity-specific repositories should extend this class
 *
 * IMPORTANT: When using with RLS-protected tables, pass the contextual db
 * from the tRPC context to ensure proper organization isolation.
 */
export abstract class BaseRepository {
  protected db: NodePgDatabase<any>;

  /**
   * @param db Optional contextual database instance. If not provided, uses
   *           the global db which does NOT have RLS context set. For RLS-
   *           protected tables, always pass the contextual db from ctx.db.
   */
  constructor(db?: ContextualDatabase | NodePgDatabase<any>) {
    this.db = db ?? globalDb;
  }

  /**
   * Helper method to check if a given record belongs to the specified organization
   * @param table The table to query
   * @param id The record ID
   * @param organizationId The organization ID to check ownership against
   * @returns Boolean indicating if the record belongs to the organization
   */
  protected async belongsToOrganization<T extends { id: string, organizationId: string }>(
    table: any,
    id: string,
    organizationId: string
  ): Promise<boolean> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(
        and(
          eq(table.id, id),
          eq(table.organizationId, organizationId)
        )
      );

    return result[0]?.count > 0;
  }
}