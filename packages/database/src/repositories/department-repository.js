"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const base_repository_1 = require("./base-repository");
const departments_1 = require("../db/schema/departments");
const subsidiaries_1 = require("../db/schema/subsidiaries");
/**
 * Repository for managing department entities
 */
class DepartmentRepository extends base_repository_1.BaseRepository {
    /**
     * Find all departments belonging to an organization
     * @param organizationId The organization ID
     * @param page Page number for pagination
     * @param limit Number of records per page
     * @param sortField Field to sort by
     * @param sortOrder Sort direction ('asc' or 'desc')
     * @returns Array of departments and total count
     */
    async findAll(organizationId, page = 1, limit = 20, sortField = 'name', sortOrder = 'asc') {
        const offset = (page - 1) * limit;
        // Get total count
        const countResult = await this.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(departments_1.departments)
            .where((0, drizzle_orm_1.eq)(departments_1.departments.organizationId, organizationId));
        const totalCount = Number(countResult[0]?.count || 0);
        // Get sorted results with pagination
        let query = this.db
            .select()
            .from(departments_1.departments)
            .where((0, drizzle_orm_1.eq)(departments_1.departments.organizationId, organizationId))
            .limit(limit)
            .offset(offset);
        // Handle sorting
        if (sortField in departments_1.departments) {
            const sortColumn = departments_1.departments[sortField];
            query = sortOrder === 'desc'
                ? query.orderBy((0, drizzle_orm_1.desc)(sortColumn))
                : query.orderBy((0, drizzle_orm_1.asc)(sortColumn));
        }
        else {
            query = sortOrder === 'desc'
                ? query.orderBy((0, drizzle_orm_1.desc)(departments_1.departments.name))
                : query.orderBy((0, drizzle_orm_1.asc)(departments_1.departments.name));
        }
        const result = await query;
        return {
            departments: result,
            totalCount
        };
    }
    /**
     * Find a department by ID
     * @param id Department ID
     * @param organizationId Organization ID
     * @returns Department or null if not found
     */
    async findById(id, organizationId) {
        const [result] = await this.db
            .select()
            .from(departments_1.departments)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(departments_1.departments.id, id), (0, drizzle_orm_1.eq)(departments_1.departments.organizationId, organizationId)))
            .limit(1);
        return result || null;
    }
    /**
     * Find departments by subsidiary ID
     * @param subsidiaryId Subsidiary ID
     * @param organizationId Organization ID
     * @returns Array of departments
     */
    async findBySubsidiary(subsidiaryId, organizationId) {
        // First verify the subsidiary belongs to the organization
        const subsidiaryBelongs = await this.belongsToOrganization(subsidiaries_1.subsidiaries, subsidiaryId, organizationId);
        if (!subsidiaryBelongs) {
            return [];
        }
        const result = await this.db
            .select()
            .from(departments_1.departments)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(departments_1.departments.subsidiaryId, subsidiaryId), (0, drizzle_orm_1.eq)(departments_1.departments.organizationId, organizationId)))
            .orderBy((0, drizzle_orm_1.asc)(departments_1.departments.name));
        return result;
    }
    /**
     * Create a new department
     * @param department Department data
     * @returns The created department
     */
    async create(department) {
        const [result] = await this.db
            .insert(departments_1.departments)
            .values(department)
            .returning();
        return result;
    }
    /**
     * Update a department
     * @param id Department ID
     * @param department Department data to update
     * @param organizationId Organization ID
     * @returns The updated department or null if not found
     */
    async update(id, department, organizationId) {
        // Verify the department exists and belongs to this organization
        const existing = await this.findById(id, organizationId);
        if (!existing) {
            return null;
        }
        const [result] = await this.db
            .update(departments_1.departments)
            .set({
            ...department,
            updatedAt: new Date()
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(departments_1.departments.id, id), (0, drizzle_orm_1.eq)(departments_1.departments.organizationId, organizationId)))
            .returning();
        return result;
    }
    /**
     * Delete a department
     * @param id Department ID
     * @param organizationId Organization ID
     * @returns Boolean indicating success
     */
    async delete(id, organizationId) {
        // Verify the department exists and belongs to this organization
        const existing = await this.findById(id, organizationId);
        if (!existing) {
            return false;
        }
        const result = await this.db
            .delete(departments_1.departments)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(departments_1.departments.id, id), (0, drizzle_orm_1.eq)(departments_1.departments.organizationId, organizationId)));
        return true;
    }
}
exports.DepartmentRepository = DepartmentRepository;
//# sourceMappingURL=department-repository.js.map