"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const base_repository_1 = require("./base-repository");
const accounts_1 = require("../db/schema/accounts");
class AccountRepository extends base_repository_1.BaseRepository {
    /**
     * Find an account by ID with organization context
     */
    async findById(id, organizationId) {
        const [result] = await this.db
            .select()
            .from(accounts_1.accounts)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(accounts_1.accounts.id, id), (0, drizzle_orm_1.eq)(accounts_1.accounts.organizationId, organizationId)))
            .limit(1);
        return result || null;
    }
    /**
     * Find all accounts for an organization with pagination and filtering
     */
    async findAll(organizationId, params = {}, filters = {}) {
        // Calculate pagination
        const page = Math.max(1, params.page || 1);
        const limit = Math.max(1, Math.min(100, params.limit || 20));
        const skip = (page - 1) * limit;
        // Build the where clause
        let whereClause = (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(accounts_1.accounts.organizationId, organizationId));
        if (filters.accountCategory) {
            whereClause = (0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.eq)(accounts_1.accounts.accountCategory, filters.accountCategory));
        }
        if (filters.isActive !== undefined) {
            whereClause = (0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.eq)(accounts_1.accounts.isActive, filters.isActive));
        }
        // Get the total count
        const countResult = await this.db
            .select({ count: (0, drizzle_orm_1.sql) `COUNT(*)` })
            .from(accounts_1.accounts)
            .where(whereClause);
        const count = Number(countResult[0]?.count || 0);
        // Get the paginated results with ordering
        const orderBy = params.orderBy || 'accountNumber';
        const orderDirection = params.orderDirection || 'asc';
        let orderColumn;
        switch (orderBy) {
            case 'accountName':
                orderColumn = accounts_1.accounts.accountName;
                break;
            case 'createdAt':
                orderColumn = accounts_1.accounts.createdAt;
                break;
            default:
                orderColumn = accounts_1.accounts.accountNumber;
        }
        const orderFunc = orderDirection === 'asc' ? drizzle_orm_1.asc : drizzle_orm_1.desc;
        const results = await this.db
            .select()
            .from(accounts_1.accounts)
            .where(whereClause)
            .orderBy(orderFunc(orderColumn))
            .limit(limit)
            .offset(skip);
        return {
            data: results,
            pagination: {
                page,
                limit,
                total: count,
                pages: Math.ceil(count / limit),
            },
        };
    }
    /**
     * Find all accounts for an organization without pagination
     */
    async findAllNoPagination(organizationId) {
        const results = await this.db
            .select()
            .from(accounts_1.accounts)
            .where((0, drizzle_orm_1.eq)(accounts_1.accounts.organizationId, organizationId))
            .orderBy((0, drizzle_orm_1.asc)(accounts_1.accounts.accountNumber));
        return results;
    }
    /**
     * Check if accounts exist for an organization
     */
    async existsForOrganization(organizationId) {
        const [result] = await this.db
            .select({ count: (0, drizzle_orm_1.sql) `COUNT(*)` })
            .from(accounts_1.accounts)
            .where((0, drizzle_orm_1.eq)(accounts_1.accounts.organizationId, organizationId))
            .limit(1);
        return Number(result?.count || 0) > 0;
    }
    /**
     * Create a new account
     */
    async create(data) {
        const [result] = await this.db
            .insert(accounts_1.accounts)
            .values({
            organizationId: data.organizationId,
            accountNumber: data.accountNumber,
            accountName: data.accountName,
            accountCategory: data.accountCategory,
            description: data.description,
            isActive: data.isActive ?? true,
        })
            .returning();
        return result;
    }
    /**
     * Create multiple accounts
     */
    async createMany(data) {
        if (data.length === 0) {
            return [];
        }
        const results = await this.db
            .insert(accounts_1.accounts)
            .values(data.map(item => ({
            organizationId: item.organizationId,
            accountNumber: item.accountNumber,
            accountName: item.accountName,
            accountCategory: item.accountCategory,
            description: item.description,
            isActive: item.isActive ?? true,
        })))
            .returning();
        return results;
    }
    /**
     * Update an account
     */
    async update(id, organizationId, data) {
        const [result] = await this.db
            .update(accounts_1.accounts)
            .set({
            ...data,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(accounts_1.accounts.id, id), (0, drizzle_orm_1.eq)(accounts_1.accounts.organizationId, organizationId)))
            .returning();
        return result || null;
    }
    /**
     * Delete an account (soft delete by setting isActive to false)
     */
    async delete(id, organizationId) {
        const [result] = await this.db
            .update(accounts_1.accounts)
            .set({
            isActive: false,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(accounts_1.accounts.id, id), (0, drizzle_orm_1.eq)(accounts_1.accounts.organizationId, organizationId)))
            .returning();
        return result || null;
    }
}
exports.AccountRepository = AccountRepository;
//# sourceMappingURL=account-repository.js.map