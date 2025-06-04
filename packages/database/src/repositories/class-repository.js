"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const base_repository_1 = require("./base-repository");
const classes_1 = require("../db/schema/classes");
const subsidiaries_1 = require("../db/schema/subsidiaries");
/**
 * Repository for managing class entities
 */
class ClassRepository extends base_repository_1.BaseRepository {
    /**
     * Find all classes belonging to an organization
     * @param organizationId The organization ID
     * @param page Page number for pagination
     * @param limit Number of records per page
     * @param sortField Field to sort by
     * @param sortOrder Sort direction ('asc' or 'desc')
     * @returns Array of classes and total count
     */
    async findAll(organizationId, page = 1, limit = 20, sortField = 'name', sortOrder = 'asc') {
        const offset = (page - 1) * limit;
        // Get total count
        const countResult = await this.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(classes_1.classes)
            .where((0, drizzle_orm_1.eq)(classes_1.classes.organizationId, organizationId));
        const totalCount = Number(countResult[0]?.count || 0);
        // Get sorted results with pagination
        let query = this.db
            .select()
            .from(classes_1.classes)
            .where((0, drizzle_orm_1.eq)(classes_1.classes.organizationId, organizationId))
            .limit(limit)
            .offset(offset);
        // Handle sorting
        if (sortField in classes_1.classes) {
            const sortColumn = classes_1.classes[sortField];
            query = sortOrder === 'desc'
                ? query.orderBy((0, drizzle_orm_1.desc)(sortColumn))
                : query.orderBy((0, drizzle_orm_1.asc)(sortColumn));
        }
        else {
            query = sortOrder === 'desc'
                ? query.orderBy((0, drizzle_orm_1.desc)(classes_1.classes.name))
                : query.orderBy((0, drizzle_orm_1.asc)(classes_1.classes.name));
        }
        const result = await query;
        return {
            classes: result,
            totalCount
        };
    }
    /**
     * Find a class by ID
     * @param id Class ID
     * @param organizationId Organization ID
     * @returns Class or null if not found
     */
    async findById(id, organizationId) {
        const [result] = await this.db
            .select()
            .from(classes_1.classes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(classes_1.classes.id, id), (0, drizzle_orm_1.eq)(classes_1.classes.organizationId, organizationId)))
            .limit(1);
        return result || null;
    }
    /**
     * Find classes by subsidiary ID
     * @param subsidiaryId Subsidiary ID
     * @param organizationId Organization ID
     * @returns Array of classes
     */
    async findBySubsidiary(subsidiaryId, organizationId) {
        // First verify the subsidiary belongs to the organization
        const subsidiaryBelongs = await this.belongsToOrganization(subsidiaries_1.subsidiaries, subsidiaryId, organizationId);
        if (!subsidiaryBelongs) {
            return [];
        }
        const result = await this.db
            .select()
            .from(classes_1.classes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(classes_1.classes.subsidiaryId, subsidiaryId), (0, drizzle_orm_1.eq)(classes_1.classes.organizationId, organizationId)))
            .orderBy((0, drizzle_orm_1.asc)(classes_1.classes.name));
        return result;
    }
    /**
     * Create a new class
     * @param classData Class data
     * @returns The created class
     */
    async create(classData) {
        const [result] = await this.db
            .insert(classes_1.classes)
            .values(classData)
            .returning();
        return result;
    }
    /**
     * Update a class
     * @param id Class ID
     * @param classData Class data to update
     * @param organizationId Organization ID
     * @returns The updated class or null if not found
     */
    async update(id, classData, organizationId) {
        // Verify the class exists and belongs to this organization
        const existing = await this.findById(id, organizationId);
        if (!existing) {
            return null;
        }
        const [result] = await this.db
            .update(classes_1.classes)
            .set({
            ...classData,
            updatedAt: new Date()
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(classes_1.classes.id, id), (0, drizzle_orm_1.eq)(classes_1.classes.organizationId, organizationId)))
            .returning();
        return result;
    }
    /**
     * Delete a class
     * @param id Class ID
     * @param organizationId Organization ID
     * @returns Boolean indicating success
     */
    async delete(id, organizationId) {
        // Verify the class exists and belongs to this organization
        const existing = await this.findById(id, organizationId);
        if (!existing) {
            return false;
        }
        const result = await this.db
            .delete(classes_1.classes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(classes_1.classes.id, id), (0, drizzle_orm_1.eq)(classes_1.classes.organizationId, organizationId)));
        return true;
    }
}
exports.ClassRepository = ClassRepository;
//# sourceMappingURL=class-repository.js.map