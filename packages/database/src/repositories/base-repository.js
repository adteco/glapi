"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = void 0;
const db_1 = require("../db");
/**
 * Base repository class that provides common database access functionality
 * All entity-specific repositories should extend this class
 */
class BaseRepository {
    constructor() {
        this.db = db_1.db;
    }
    /**
     * Helper method to check if a given record belongs to the specified organization
     * @param table The table to query
     * @param id The record ID
     * @param organizationId The organization ID to check ownership against
     * @returns Boolean indicating if the record belongs to the organization
     */
    async belongsToOrganization(table, id, organizationId) {
        const result = await this.db
            .select({ count: this.db.fn.count() })
            .from(table)
            .where(this.db.and(this.db.eq(table.id, id), this.db.eq(table.organizationId, organizationId)));
        return result[0]?.count > 0;
    }
}
exports.BaseRepository = BaseRepository;
//# sourceMappingURL=base-repository.js.map