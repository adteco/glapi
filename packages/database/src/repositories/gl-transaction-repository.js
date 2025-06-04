"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlTransactionRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const base_repository_1 = require("./base-repository");
const transaction_types_1 = require("../db/schema/transaction-types");
const subsidiaries_1 = require("../db/schema/subsidiaries");
class GlTransactionRepository extends base_repository_1.BaseRepository {
    /**
     * Get subsidiaries accessible to an organization
     */
    async getOrganizationSubsidiaries(organizationId) {
        const result = await this.db
            .select({ id: subsidiaries_1.subsidiaries.id })
            .from(subsidiaries_1.subsidiaries)
            .where((0, drizzle_orm_1.eq)(subsidiaries_1.subsidiaries.organizationId, organizationId));
        return result.map(s => s.id);
    }
    /**
     * Validate that a subsidiary belongs to the organization
     */
    async validateSubsidiaryAccess(subsidiaryId, organizationId) {
        const result = await this.db
            .select({ count: (0, drizzle_orm_1.sql) `COUNT(*)` })
            .from(subsidiaries_1.subsidiaries)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(subsidiaries_1.subsidiaries.id, subsidiaryId), (0, drizzle_orm_1.eq)(subsidiaries_1.subsidiaries.organizationId, organizationId)));
        return Number(result[0]?.count || 0) > 0;
    }
    /**
     * Find a business transaction by ID with organization RLS
     */
    async findById(id, organizationId) {
        const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);
        if (accessibleSubsidiaries.length === 0) {
            return null;
        }
        const [result] = await this.db
            .select({
            id: transaction_types_1.businessTransactions.id,
            transactionNumber: transaction_types_1.businessTransactions.transactionNumber,
            transactionTypeId: transaction_types_1.businessTransactions.transactionTypeId,
            subsidiaryId: transaction_types_1.businessTransactions.subsidiaryId,
            entityId: transaction_types_1.businessTransactions.entityId,
            entityType: transaction_types_1.businessTransactions.entityType,
            transactionDate: transaction_types_1.businessTransactions.transactionDate,
            dueDate: transaction_types_1.businessTransactions.dueDate,
            termsId: transaction_types_1.businessTransactions.termsId,
            currencyCode: transaction_types_1.businessTransactions.currencyCode,
            exchangeRate: transaction_types_1.businessTransactions.exchangeRate,
            subtotalAmount: transaction_types_1.businessTransactions.subtotalAmount,
            taxAmount: transaction_types_1.businessTransactions.taxAmount,
            discountAmount: transaction_types_1.businessTransactions.discountAmount,
            totalAmount: transaction_types_1.businessTransactions.totalAmount,
            baseTotalAmount: transaction_types_1.businessTransactions.baseTotalAmount,
            memo: transaction_types_1.businessTransactions.memo,
            externalReference: transaction_types_1.businessTransactions.externalReference,
            status: transaction_types_1.businessTransactions.status,
            workflowStatus: transaction_types_1.businessTransactions.workflowStatus,
            glTransactionId: transaction_types_1.businessTransactions.glTransactionId,
            createdBy: transaction_types_1.businessTransactions.createdBy,
            createdDate: transaction_types_1.businessTransactions.createdDate,
            modifiedBy: transaction_types_1.businessTransactions.modifiedBy,
            modifiedDate: transaction_types_1.businessTransactions.modifiedDate,
            approvedBy: transaction_types_1.businessTransactions.approvedBy,
            approvedDate: transaction_types_1.businessTransactions.approvedDate,
            postedDate: transaction_types_1.businessTransactions.postedDate,
            versionNumber: transaction_types_1.businessTransactions.versionNumber,
        })
            .from(transaction_types_1.businessTransactions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(transaction_types_1.businessTransactions.id, id), (0, drizzle_orm_1.inArray)(transaction_types_1.businessTransactions.subsidiaryId, accessibleSubsidiaries)))
            .limit(1);
        return result || null;
    }
    /**
     * Find all business transactions for an organization with pagination and filtering
     */
    async findAll(organizationId, params = {}, filters = {}) {
        const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);
        if (accessibleSubsidiaries.length === 0) {
            return {
                data: [],
                total: 0,
                page: 1,
                limit: params.limit || 20,
                totalPages: 0
            };
        }
        // Calculate pagination
        const page = Math.max(1, params.page || 1);
        const limit = Math.max(1, Math.min(100, params.limit || 20));
        const skip = (page - 1) * limit;
        // Build the where clause
        let whereConditions = [
            (0, drizzle_orm_1.inArray)(transaction_types_1.businessTransactions.subsidiaryId, accessibleSubsidiaries)
        ];
        // Apply subsidiary filter if specified and validate access
        if (filters.subsidiaryId) {
            const hasAccess = await this.validateSubsidiaryAccess(filters.subsidiaryId, organizationId);
            if (!hasAccess) {
                throw new Error('Access denied to specified subsidiary');
            }
            whereConditions.push((0, drizzle_orm_1.eq)(transaction_types_1.businessTransactions.subsidiaryId, filters.subsidiaryId));
        }
        if (filters.transactionTypeId) {
            whereConditions.push((0, drizzle_orm_1.eq)(transaction_types_1.businessTransactions.transactionTypeId, filters.transactionTypeId));
        }
        if (filters.status) {
            whereConditions.push((0, drizzle_orm_1.eq)(transaction_types_1.businessTransactions.status, filters.status));
        }
        if (filters.entityId) {
            whereConditions.push((0, drizzle_orm_1.eq)(transaction_types_1.businessTransactions.entityId, filters.entityId));
        }
        if (filters.dateFrom) {
            const dateFrom = typeof filters.dateFrom === 'string' ? filters.dateFrom : filters.dateFrom.toISOString().split('T')[0];
            whereConditions.push((0, drizzle_orm_1.gte)(transaction_types_1.businessTransactions.transactionDate, dateFrom));
        }
        if (filters.dateTo) {
            const dateTo = typeof filters.dateTo === 'string' ? filters.dateTo : filters.dateTo.toISOString().split('T')[0];
            whereConditions.push((0, drizzle_orm_1.lte)(transaction_types_1.businessTransactions.transactionDate, dateTo));
        }
        const whereClause = (0, drizzle_orm_1.and)(...whereConditions);
        // Get the total count
        const countResult = await this.db
            .select({ count: (0, drizzle_orm_1.sql) `COUNT(*)` })
            .from(transaction_types_1.businessTransactions)
            .where(whereClause);
        const count = Number(countResult[0]?.count || 0);
        // Get the paginated results with ordering
        const orderBy = params.orderBy || 'transactionDate';
        const orderDirection = params.orderDirection || 'desc';
        let orderColumn;
        switch (orderBy) {
            case 'transactionNumber':
                orderColumn = transaction_types_1.businessTransactions.transactionNumber;
                break;
            case 'createdDate':
                orderColumn = transaction_types_1.businessTransactions.createdDate;
                break;
            default:
                orderColumn = transaction_types_1.businessTransactions.transactionDate;
        }
        const orderFunc = orderDirection === 'asc' ? drizzle_orm_1.asc : drizzle_orm_1.desc;
        const results = await this.db
            .select({
            id: transaction_types_1.businessTransactions.id,
            transactionNumber: transaction_types_1.businessTransactions.transactionNumber,
            transactionTypeId: transaction_types_1.businessTransactions.transactionTypeId,
            subsidiaryId: transaction_types_1.businessTransactions.subsidiaryId,
            entityId: transaction_types_1.businessTransactions.entityId,
            entityType: transaction_types_1.businessTransactions.entityType,
            transactionDate: transaction_types_1.businessTransactions.transactionDate,
            totalAmount: transaction_types_1.businessTransactions.totalAmount,
            status: transaction_types_1.businessTransactions.status,
            memo: transaction_types_1.businessTransactions.memo,
            createdDate: transaction_types_1.businessTransactions.createdDate,
        })
            .from(transaction_types_1.businessTransactions)
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
     * Create a new business transaction with organization RLS
     */
    async create(data, organizationId) {
        // Validate subsidiary access
        const hasAccess = await this.validateSubsidiaryAccess(data.subsidiaryId, organizationId);
        if (!hasAccess) {
            throw new Error('Access denied to specified subsidiary');
        }
        // Insert the business transaction
        const resultArray = await this.db
            .insert(transaction_types_1.businessTransactions)
            .values({
            transactionNumber: data.transactionNumber,
            transactionTypeId: data.transactionTypeId,
            subsidiaryId: data.subsidiaryId,
            entityId: data.entityId,
            entityType: data.entityType,
            transactionDate: data.transactionDate,
            dueDate: data.dueDate,
            termsId: data.termsId,
            currencyCode: data.currencyCode,
            exchangeRate: data.exchangeRate || '1',
            subtotalAmount: data.subtotalAmount || '0',
            taxAmount: data.taxAmount || '0',
            discountAmount: data.discountAmount || '0',
            totalAmount: data.totalAmount,
            baseTotalAmount: data.baseTotalAmount,
            memo: data.memo,
            externalReference: data.externalReference,
            status: data.status,
            workflowStatus: data.workflowStatus,
            createdBy: data.createdBy,
            versionNumber: 1,
        })
            .returning();
        const result = resultArray[0];
        return result;
    }
    /**
     * Update an existing business transaction with organization RLS
     */
    async update(id, data, organizationId) {
        // First verify access to the transaction
        const existing = await this.findById(id, organizationId);
        if (!existing) {
            return null;
        }
        // If changing subsidiary, validate access to new subsidiary
        if (data.subsidiaryId && data.subsidiaryId !== existing.subsidiaryId) {
            const hasAccess = await this.validateSubsidiaryAccess(data.subsidiaryId, organizationId);
            if (!hasAccess) {
                throw new Error('Access denied to specified subsidiary');
            }
        }
        const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);
        const updateData = {
            modifiedDate: new Date(),
            modifiedBy: data.modifiedBy,
            versionNumber: (existing.versionNumber || 1) + 1,
        };
        // Add fields that can be updated
        const updatableFields = [
            'transactionTypeId', 'subsidiaryId', 'entityId', 'entityType',
            'transactionDate', 'dueDate', 'termsId', 'currencyCode', 'exchangeRate',
            'subtotalAmount', 'taxAmount', 'discountAmount', 'totalAmount', 'baseTotalAmount',
            'memo', 'externalReference', 'status', 'workflowStatus',
            'approvedBy', 'approvedDate', 'postedDate'
        ];
        updatableFields.forEach(field => {
            if (data[field] !== undefined) {
                updateData[field] = data[field];
            }
        });
        const [result] = await this.db
            .update(transaction_types_1.businessTransactions)
            .set(updateData)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(transaction_types_1.businessTransactions.id, id), (0, drizzle_orm_1.inArray)(transaction_types_1.businessTransactions.subsidiaryId, accessibleSubsidiaries)))
            .returning();
        return result || null;
    }
    /**
     * Delete a business transaction with organization RLS
     */
    async delete(id, organizationId) {
        const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);
        await this.db
            .delete(transaction_types_1.businessTransactions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(transaction_types_1.businessTransactions.id, id), (0, drizzle_orm_1.inArray)(transaction_types_1.businessTransactions.subsidiaryId, accessibleSubsidiaries)));
    }
    /**
     * Get transaction lines for a business transaction with organization RLS
     */
    async getTransactionLines(transactionId, organizationId) {
        // First verify access to the transaction
        const transaction = await this.findById(transactionId, organizationId);
        if (!transaction) {
            return [];
        }
        const results = await this.db
            .select()
            .from(transaction_types_1.businessTransactionLines)
            .where((0, drizzle_orm_1.eq)(transaction_types_1.businessTransactionLines.businessTransactionId, transactionId))
            .orderBy((0, drizzle_orm_1.asc)(transaction_types_1.businessTransactionLines.lineNumber));
        return results;
    }
    /**
     * Create transaction lines with organization RLS validation
     */
    async createTransactionLines(lines, organizationId) {
        // Validate that all transaction IDs belong to accessible subsidiaries
        const transactionIdsSet = new Set(lines.map(line => line.businessTransactionId));
        const transactionIds = Array.from(transactionIdsSet);
        for (const transactionId of transactionIds) {
            const transaction = await this.findById(transactionId, organizationId);
            if (!transaction) {
                throw new Error(`Access denied to transaction ${transactionId}`);
            }
        }
        const results = await this.db
            .insert(transaction_types_1.businessTransactionLines)
            .values(lines)
            .returning();
        return results;
    }
    /**
     * Update transaction status with organization RLS
     */
    async updateStatus(id, status, userId, organizationId) {
        const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);
        const updateData = {
            status,
            modifiedDate: new Date(),
            modifiedBy: userId,
        };
        // Add status-specific fields
        if (status === 'APPROVED') {
            updateData.approvedBy = userId;
            updateData.approvedDate = new Date();
        }
        else if (status === 'POSTED') {
            updateData.postedDate = new Date();
        }
        const [result] = await this.db
            .update(transaction_types_1.businessTransactions)
            .set(updateData)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(transaction_types_1.businessTransactions.id, id), (0, drizzle_orm_1.inArray)(transaction_types_1.businessTransactions.subsidiaryId, accessibleSubsidiaries)))
            .returning();
        return result || null;
    }
}
exports.GlTransactionRepository = GlTransactionRepository;
//# sourceMappingURL=gl-transaction-repository.js.map