import { NodePgDatabase } from 'drizzle-orm/node-postgres';
/**
 * Base repository class that provides common database access functionality
 * All entity-specific repositories should extend this class
 */
export declare abstract class BaseRepository {
    protected db: NodePgDatabase;
    constructor();
    /**
     * Helper method to check if a given record belongs to the specified organization
     * @param table The table to query
     * @param id The record ID
     * @param organizationId The organization ID to check ownership against
     * @returns Boolean indicating if the record belongs to the organization
     */
    protected belongsToOrganization<T extends {
        id: string;
        organizationId: string;
    }>(table: any, id: string, organizationId: string): Promise<boolean>;
}
//# sourceMappingURL=base-repository.d.ts.map