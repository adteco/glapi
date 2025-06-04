"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const base_repository_1 = require("./base-repository");
const locations_1 = require("../db/schema/locations");
const subsidiaries_1 = require("../db/schema/subsidiaries");
/**
 * Repository for managing location entities
 */
class LocationRepository extends base_repository_1.BaseRepository {
    /**
     * Find all locations belonging to an organization
     * @param organizationId The organization ID
     * @param page Page number for pagination
     * @param limit Number of records per page
     * @param sortField Field to sort by
     * @param sortOrder Sort direction ('asc' or 'desc')
     * @returns Array of locations and total count
     */
    async findAll(organizationId, page = 1, limit = 20, sortField = 'name', sortOrder = 'asc') {
        const offset = (page - 1) * limit;
        // Get total count
        const countResult = await this.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(locations_1.locations)
            .where((0, drizzle_orm_1.eq)(locations_1.locations.organizationId, organizationId));
        const totalCount = Number(countResult[0]?.count || 0);
        // Determine sort column
        let sortColumn;
        if (sortField === 'name') {
            sortColumn = locations_1.locations.name;
        }
        else if (sortField === 'code') {
            sortColumn = locations_1.locations.code;
        }
        else if (sortField === 'createdAt') {
            sortColumn = locations_1.locations.createdAt;
        }
        else {
            sortColumn = locations_1.locations.name; // default
        }
        // Get sorted results with pagination
        const result = await this.db
            .select()
            .from(locations_1.locations)
            .where((0, drizzle_orm_1.eq)(locations_1.locations.organizationId, organizationId))
            .orderBy(sortOrder === 'desc' ? (0, drizzle_orm_1.desc)(sortColumn) : (0, drizzle_orm_1.asc)(sortColumn))
            .limit(limit)
            .offset(offset);
        return {
            locations: result,
            totalCount
        };
    }
    /**
     * Find a location by ID
     * @param id Location ID
     * @param organizationId Organization ID
     * @returns Location or null if not found
     */
    async findById(id, organizationId) {
        const [result] = await this.db
            .select()
            .from(locations_1.locations)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(locations_1.locations.id, id), (0, drizzle_orm_1.eq)(locations_1.locations.organizationId, organizationId)))
            .limit(1);
        return result || null;
    }
    /**
     * Find locations by subsidiary ID
     * @param subsidiaryId Subsidiary ID
     * @param organizationId Organization ID
     * @returns Array of locations
     */
    async findBySubsidiary(subsidiaryId, organizationId) {
        // First verify the subsidiary belongs to the organization
        const subsidiaryBelongs = await this.belongsToOrganization(subsidiaries_1.subsidiaries, subsidiaryId, organizationId);
        if (!subsidiaryBelongs) {
            return [];
        }
        const result = await this.db
            .select()
            .from(locations_1.locations)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(locations_1.locations.subsidiaryId, subsidiaryId), (0, drizzle_orm_1.eq)(locations_1.locations.organizationId, organizationId)))
            .orderBy((0, drizzle_orm_1.asc)(locations_1.locations.name));
        return result;
    }
    /**
     * Create a new location
     * @param location Location data
     * @returns The created location
     */
    async create(location) {
        const [result] = await this.db
            .insert(locations_1.locations)
            .values(location)
            .returning();
        return result;
    }
    /**
     * Update a location
     * @param id Location ID
     * @param location Location data to update
     * @param organizationId Organization ID
     * @returns The updated location or null if not found
     */
    async update(id, location, organizationId) {
        // Verify the location exists and belongs to this organization
        const existing = await this.findById(id, organizationId);
        if (!existing) {
            return null;
        }
        const [result] = await this.db
            .update(locations_1.locations)
            .set({
            ...location,
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(locations_1.locations.id, id), (0, drizzle_orm_1.eq)(locations_1.locations.organizationId, organizationId)))
            .returning();
        return result;
    }
    /**
     * Delete a location
     * @param id Location ID
     * @param organizationId Organization ID
     * @returns Boolean indicating success
     */
    async delete(id, organizationId) {
        // Verify the location exists and belongs to this organization
        const existing = await this.findById(id, organizationId);
        if (!existing) {
            return false;
        }
        const result = await this.db
            .delete(locations_1.locations)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(locations_1.locations.id, id), (0, drizzle_orm_1.eq)(locations_1.locations.organizationId, organizationId)));
        return true;
    }
}
exports.LocationRepository = LocationRepository;
//# sourceMappingURL=location-repository.js.map