import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';

/**
 * Base repository class that provides common database access functionality
 * All entity-specific repositories should extend this class
 */
export abstract class BaseRepository {
  protected db: NodePgDatabase<any>;

  constructor() {
    this.db = db;
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