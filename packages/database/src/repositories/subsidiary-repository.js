"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubsidiaryRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const base_repository_1 = require("./base-repository");
const subsidiaries_1 = require("../db/schema/subsidiaries");
class SubsidiaryRepository extends base_repository_1.BaseRepository {
    /**
     * Find a subsidiary by ID with organization context
     */
    async findById(id, organizationId) {
        const [result] = await this.db
            .select()
            .from(subsidiaries_1.subsidiaries)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(subsidiaries_1.subsidiaries.id, id), (0, drizzle_orm_1.eq)(subsidiaries_1.subsidiaries.organizationId, organizationId)))
            .limit(1);
        return result || null;
    }
    /**
     * Find all subsidiaries for an organization with pagination and filtering
     */
    async findAll(organizationId, params = {}, filters = {}) {
        // Calculate pagination
        const page = Math.max(1, params.page || 1);
        const limit = Math.max(1, Math.min(100, params.limit || 20));
        const skip = (page - 1) * limit;
        // Build the where clause
        let whereClause = (0, drizzle_orm_1.eq)(subsidiaries_1.subsidiaries.organizationId, organizationId);
        if (filters.isActive !== undefined) {
            whereClause = (0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.eq)(subsidiaries_1.subsidiaries.isActive, filters.isActive));
        }
        if (filters.parentId !== undefined) {
            if (filters.parentId === null) {
                whereClause = (0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.isNull)(subsidiaries_1.subsidiaries.parentId));
            }
            else {
                whereClause = (0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.eq)(subsidiaries_1.subsidiaries.parentId, filters.parentId));
            }
        }
        // Get the total count
        const countResult = await this.db
            .select({ count: (0, drizzle_orm_1.sql) `COUNT(*)` })
            .from(subsidiaries_1.subsidiaries)
            .where(whereClause);
        const count = Number(countResult[0]?.count || 0);
        // Get the paginated results with ordering
        const orderBy = params.orderBy || 'name';
        const orderDirection = params.orderDirection || 'asc';
        const orderColumn = orderBy === 'name' ? subsidiaries_1.subsidiaries.name : subsidiaries_1.subsidiaries.createdAt;
        const orderFunc = orderDirection === 'asc' ? drizzle_orm_1.asc : drizzle_orm_1.desc;
        const results = await this.db
            .select()
            .from(subsidiaries_1.subsidiaries)
            .where(whereClause)
            .orderBy(orderFunc(orderColumn))
            .limit(limit)
            .offset(skip);
        return {
            data: results,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit)
        };
    }
    /**
     * Create a new subsidiary
     */
    async create(data) {
        const [result] = await this.db
            .insert(subsidiaries_1.subsidiaries)
            .values(data)
            .returning();
        return result;
    }
    /**
     * Update an existing subsidiary
     */
    async update(id, data, organizationId) {
        const [result] = await this.db
            .update(subsidiaries_1.subsidiaries)
            .set({
            ...data,
            updatedAt: new Date()
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(subsidiaries_1.subsidiaries.id, id), (0, drizzle_orm_1.eq)(subsidiaries_1.subsidiaries.organizationId, organizationId)))
            .returning();
        return result || null;
    }
    /**
     * Delete a subsidiary
     */
    async delete(id, organizationId) {
        await this.db
            .delete(subsidiaries_1.subsidiaries)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(subsidiaries_1.subsidiaries.id, id), (0, drizzle_orm_1.eq)(subsidiaries_1.subsidiaries.organizationId, organizationId)));
    }
    /**
     * Find subsidiaries by parent ID
     */
    async findByParentId(parentId, organizationId) {
        const results = await this.db
            .select()
            .from(subsidiaries_1.subsidiaries)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(subsidiaries_1.subsidiaries.parentId, parentId), (0, drizzle_orm_1.eq)(subsidiaries_1.subsidiaries.organizationId, organizationId)));
        return results;
    }
    /**
     * Count child subsidiaries
     */
    async countChildren(id, organizationId) {
        const childCountResult = await this.db
            .select({ count: (0, drizzle_orm_1.sql) `COUNT(*)` })
            .from(subsidiaries_1.subsidiaries)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(subsidiaries_1.subsidiaries.parentId, id), (0, drizzle_orm_1.eq)(subsidiaries_1.subsidiaries.organizationId, organizationId)));
        return Number(childCountResult[0]?.count || 0);
    }
    /**
     * Find a subsidiary by code
     */
    async findByCode(code, organizationId) {
        const [result] = await this.db
            .select()
            .from(subsidiaries_1.subsidiaries)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(subsidiaries_1.subsidiaries.code, code), (0, drizzle_orm_1.eq)(subsidiaries_1.subsidiaries.organizationId, organizationId)))
            .limit(1);
        return result || null;
    }
}
exports.SubsidiaryRepository = SubsidiaryRepository;
//# sourceMappingURL=subsidiary-repository.js.map