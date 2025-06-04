"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlReportingRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const base_repository_1 = require("./base-repository");
const gl_transactions_1 = require("../db/schema/gl-transactions");
const accounting_periods_1 = require("../db/schema/accounting-periods");
const subsidiaries_1 = require("../db/schema/subsidiaries");
const accounts_1 = require("../db/schema/accounts");
class GlReportingRepository extends base_repository_1.BaseRepository {
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
     * Find GL transaction by ID with organization RLS
     */
    async findGlTransactionById(id, organizationId) {
        const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);
        if (accessibleSubsidiaries.length === 0) {
            return null;
        }
        const [result] = await this.db
            .select()
            .from(gl_transactions_1.glTransactions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(gl_transactions_1.glTransactions.id, id), (0, drizzle_orm_1.inArray)(gl_transactions_1.glTransactions.subsidiaryId, accessibleSubsidiaries)))
            .limit(1);
        return result || null;
    }
    /**
     * List GL transactions with organization RLS
     */
    async findAllGlTransactions(organizationId, params = {}, filters = {}) {
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
            (0, drizzle_orm_1.inArray)(gl_transactions_1.glTransactions.subsidiaryId, accessibleSubsidiaries)
        ];
        // Apply subsidiary filter if specified and validate access
        if (filters.subsidiaryId) {
            const hasAccess = await this.validateSubsidiaryAccess(filters.subsidiaryId, organizationId);
            if (!hasAccess) {
                throw new Error('Access denied to specified subsidiary');
            }
            whereConditions.push((0, drizzle_orm_1.eq)(gl_transactions_1.glTransactions.subsidiaryId, filters.subsidiaryId));
        }
        if (filters.periodId) {
            whereConditions.push((0, drizzle_orm_1.eq)(gl_transactions_1.glTransactions.periodId, filters.periodId));
        }
        if (filters.status) {
            whereConditions.push((0, drizzle_orm_1.eq)(gl_transactions_1.glTransactions.status, filters.status));
        }
        if (filters.transactionType) {
            whereConditions.push((0, drizzle_orm_1.eq)(gl_transactions_1.glTransactions.transactionType, filters.transactionType));
        }
        if (filters.sourceTransactionId) {
            whereConditions.push((0, drizzle_orm_1.eq)(gl_transactions_1.glTransactions.sourceTransactionId, filters.sourceTransactionId));
        }
        if (filters.dateFrom) {
            const dateFrom = typeof filters.dateFrom === 'string' ? filters.dateFrom : filters.dateFrom.toISOString().split('T')[0];
            whereConditions.push((0, drizzle_orm_1.gte)(gl_transactions_1.glTransactions.transactionDate, dateFrom));
        }
        if (filters.dateTo) {
            const dateTo = typeof filters.dateTo === 'string' ? filters.dateTo : filters.dateTo.toISOString().split('T')[0];
            whereConditions.push((0, drizzle_orm_1.lte)(gl_transactions_1.glTransactions.transactionDate, dateTo));
        }
        const whereClause = (0, drizzle_orm_1.and)(...whereConditions);
        // Get the total count
        const countResult = await this.db
            .select({ count: (0, drizzle_orm_1.sql) `COUNT(*)` })
            .from(gl_transactions_1.glTransactions)
            .where(whereClause);
        const count = Number(countResult[0]?.count || 0);
        // Get the paginated results with ordering
        const orderBy = params.orderBy || 'transactionDate';
        const orderDirection = params.orderDirection || 'desc';
        let orderColumn;
        switch (orderBy) {
            case 'transactionNumber':
                orderColumn = gl_transactions_1.glTransactions.transactionNumber;
                break;
            case 'postingDate':
                orderColumn = gl_transactions_1.glTransactions.postingDate;
                break;
            default:
                orderColumn = gl_transactions_1.glTransactions.transactionDate;
        }
        const orderFunc = orderDirection === 'asc' ? drizzle_orm_1.asc : drizzle_orm_1.desc;
        const results = await this.db
            .select()
            .from(gl_transactions_1.glTransactions)
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
     * Get GL transaction lines with organization RLS
     */
    async getGlTransactionLines(transactionId, organizationId) {
        // First verify access to the transaction
        const transaction = await this.findGlTransactionById(transactionId, organizationId);
        if (!transaction) {
            return [];
        }
        const results = await this.db
            .select()
            .from(gl_transactions_1.glTransactionLines)
            .where((0, drizzle_orm_1.eq)(gl_transactions_1.glTransactionLines.transactionId, transactionId))
            .orderBy((0, drizzle_orm_1.asc)(gl_transactions_1.glTransactionLines.lineNumber));
        return results;
    }
    /**
     * Get account activity with organization RLS
     */
    async getAccountActivity(filters, organizationId, params = {}) {
        const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);
        if (accessibleSubsidiaries.length === 0) {
            return {
                data: [],
                total: 0,
                page: 1,
                limit: params.limit || 50,
                totalPages: 0
            };
        }
        // Calculate pagination
        const page = Math.max(1, params.page || 1);
        const limit = Math.max(1, Math.min(100, params.limit || 50));
        const skip = (page - 1) * limit;
        // Build the where clause
        let whereConditions = [
            (0, drizzle_orm_1.eq)(gl_transactions_1.glTransactionLines.accountId, filters.accountId),
            (0, drizzle_orm_1.inArray)(gl_transactions_1.glTransactionLines.subsidiaryId, accessibleSubsidiaries),
            (0, drizzle_orm_1.gte)(gl_transactions_1.glTransactions.transactionDate, typeof filters.dateFrom === 'string' ? filters.dateFrom : filters.dateFrom.toISOString().split('T')[0]),
            (0, drizzle_orm_1.lte)(gl_transactions_1.glTransactions.transactionDate, typeof filters.dateTo === 'string' ? filters.dateTo : filters.dateTo.toISOString().split('T')[0])
        ];
        // Apply subsidiary filter if specified and validate access
        if (filters.subsidiaryId) {
            const hasAccess = await this.validateSubsidiaryAccess(filters.subsidiaryId, organizationId);
            if (!hasAccess) {
                throw new Error('Access denied to specified subsidiary');
            }
            whereConditions.push((0, drizzle_orm_1.eq)(gl_transactions_1.glTransactionLines.subsidiaryId, filters.subsidiaryId));
        }
        if (filters.classId) {
            whereConditions.push((0, drizzle_orm_1.eq)(gl_transactions_1.glTransactionLines.classId, filters.classId));
        }
        if (filters.departmentId) {
            whereConditions.push((0, drizzle_orm_1.eq)(gl_transactions_1.glTransactionLines.departmentId, filters.departmentId));
        }
        if (filters.locationId) {
            whereConditions.push((0, drizzle_orm_1.eq)(gl_transactions_1.glTransactionLines.locationId, filters.locationId));
        }
        const whereClause = (0, drizzle_orm_1.and)(...whereConditions);
        // Get the total count
        const countResult = await this.db
            .select({ count: (0, drizzle_orm_1.sql) `COUNT(*)` })
            .from(gl_transactions_1.glTransactionLines)
            .innerJoin(gl_transactions_1.glTransactions, (0, drizzle_orm_1.eq)(gl_transactions_1.glTransactionLines.transactionId, gl_transactions_1.glTransactions.id))
            .where(whereClause);
        const count = Number(countResult[0]?.count || 0);
        // Get the paginated results
        const results = await this.db
            .select({
            date: gl_transactions_1.glTransactions.transactionDate,
            transactionNumber: gl_transactions_1.glTransactions.transactionNumber,
            description: gl_transactions_1.glTransactionLines.description,
            reference: gl_transactions_1.glTransactionLines.reference1,
            debitAmount: gl_transactions_1.glTransactionLines.debitAmount,
            creditAmount: gl_transactions_1.glTransactionLines.creditAmount,
            glTransactionId: gl_transactions_1.glTransactions.id,
            sourceTransactionId: gl_transactions_1.glTransactions.sourceTransactionId,
        })
            .from(gl_transactions_1.glTransactionLines)
            .innerJoin(gl_transactions_1.glTransactions, (0, drizzle_orm_1.eq)(gl_transactions_1.glTransactionLines.transactionId, gl_transactions_1.glTransactions.id))
            .where(whereClause)
            .orderBy((0, drizzle_orm_1.asc)(gl_transactions_1.glTransactions.transactionDate), (0, drizzle_orm_1.asc)(gl_transactions_1.glTransactionLines.lineNumber))
            .limit(limit)
            .offset(skip);
        // Calculate running balance
        let runningBalance = 0;
        const dataWithBalance = results.map(row => {
            const debit = Number(row.debitAmount || 0);
            const credit = Number(row.creditAmount || 0);
            runningBalance += debit - credit;
            return {
                ...row,
                debitAmount: debit,
                creditAmount: credit,
                runningBalance
            };
        });
        return {
            data: dataWithBalance,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit)
        };
    }
    /**
     * Get trial balance with organization RLS
     */
    async getTrialBalance(filters, organizationId) {
        const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);
        if (accessibleSubsidiaries.length === 0) {
            return {
                periodName: '',
                subsidiaryName: '',
                asOfDate: '',
                entries: [],
                totals: { totalDebits: 0, totalCredits: 0, difference: 0 }
            };
        }
        // Apply subsidiary filter if specified and validate access
        let targetSubsidiaries = accessibleSubsidiaries;
        if (filters.subsidiaryId) {
            const hasAccess = await this.validateSubsidiaryAccess(filters.subsidiaryId, organizationId);
            if (!hasAccess) {
                throw new Error('Access denied to specified subsidiary');
            }
            targetSubsidiaries = [filters.subsidiaryId];
        }
        // Build the where clause for account balances
        let whereConditions = [
            (0, drizzle_orm_1.eq)(gl_transactions_1.glAccountBalances.periodId, filters.periodId),
            (0, drizzle_orm_1.inArray)(gl_transactions_1.glAccountBalances.subsidiaryId, targetSubsidiaries)
        ];
        if (filters.classId) {
            whereConditions.push((0, drizzle_orm_1.eq)(gl_transactions_1.glAccountBalances.classId, filters.classId));
        }
        if (filters.departmentId) {
            whereConditions.push((0, drizzle_orm_1.eq)(gl_transactions_1.glAccountBalances.departmentId, filters.departmentId));
        }
        if (filters.locationId) {
            whereConditions.push((0, drizzle_orm_1.eq)(gl_transactions_1.glAccountBalances.locationId, filters.locationId));
        }
        const whereClause = (0, drizzle_orm_1.and)(...whereConditions);
        // Get account balances with account details
        const results = await this.db
            .select({
            accountId: gl_transactions_1.glAccountBalances.accountId,
            accountNumber: accounts_1.accounts.accountNumber,
            accountName: accounts_1.accounts.accountName,
            accountCategory: accounts_1.accounts.accountCategory,
            beginningBalanceDebit: gl_transactions_1.glAccountBalances.beginningBalanceDebit,
            beginningBalanceCredit: gl_transactions_1.glAccountBalances.beginningBalanceCredit,
            periodDebitAmount: gl_transactions_1.glAccountBalances.periodDebitAmount,
            periodCreditAmount: gl_transactions_1.glAccountBalances.periodCreditAmount,
            endingBalanceDebit: gl_transactions_1.glAccountBalances.endingBalanceDebit,
            endingBalanceCredit: gl_transactions_1.glAccountBalances.endingBalanceCredit,
            ytdDebitAmount: gl_transactions_1.glAccountBalances.ytdDebitAmount,
            ytdCreditAmount: gl_transactions_1.glAccountBalances.ytdCreditAmount,
        })
            .from(gl_transactions_1.glAccountBalances)
            .innerJoin(accounts_1.accounts, (0, drizzle_orm_1.eq)(gl_transactions_1.glAccountBalances.accountId, accounts_1.accounts.id))
            .where((0, drizzle_orm_1.and)(whereClause, filters.includeInactive ? undefined : (0, drizzle_orm_1.eq)(accounts_1.accounts.isActive, true)))
            .orderBy((0, drizzle_orm_1.asc)(accounts_1.accounts.accountNumber));
        // Calculate totals
        let totalDebits = 0;
        let totalCredits = 0;
        const entries = results.map(row => {
            const debitBalance = Number(row.endingBalanceDebit || 0);
            const creditBalance = Number(row.endingBalanceCredit || 0);
            const netBalance = debitBalance - creditBalance;
            totalDebits += debitBalance;
            totalCredits += creditBalance;
            return {
                accountId: row.accountId,
                accountNumber: row.accountNumber,
                accountName: row.accountName,
                accountType: row.accountCategory,
                debitBalance,
                creditBalance,
                netBalance,
                periodActivity: {
                    debits: Number(row.periodDebitAmount || 0),
                    credits: Number(row.periodCreditAmount || 0),
                    net: Number(row.periodDebitAmount || 0) - Number(row.periodCreditAmount || 0)
                },
                ytdActivity: {
                    debits: Number(row.ytdDebitAmount || 0),
                    credits: Number(row.ytdCreditAmount || 0),
                    net: Number(row.ytdDebitAmount || 0) - Number(row.ytdCreditAmount || 0)
                }
            };
        });
        // Get period and subsidiary info for the header
        const [periodInfo] = await this.db
            .select({
            periodName: accounting_periods_1.accountingPeriods.periodName,
            endDate: accounting_periods_1.accountingPeriods.endDate,
        })
            .from(accounting_periods_1.accountingPeriods)
            .where((0, drizzle_orm_1.eq)(accounting_periods_1.accountingPeriods.id, filters.periodId))
            .limit(1);
        let subsidiaryName = '';
        if (filters.subsidiaryId) {
            const [subInfo] = await this.db
                .select({ name: subsidiaries_1.subsidiaries.name })
                .from(subsidiaries_1.subsidiaries)
                .where((0, drizzle_orm_1.eq)(subsidiaries_1.subsidiaries.id, filters.subsidiaryId))
                .limit(1);
            subsidiaryName = subInfo?.name || '';
        }
        else {
            subsidiaryName = 'All Subsidiaries';
        }
        return {
            periodName: periodInfo?.periodName || '',
            subsidiaryName,
            asOfDate: periodInfo?.endDate || '',
            entries,
            totals: {
                totalDebits,
                totalCredits,
                difference: totalDebits - totalCredits
            }
        };
    }
    /**
     * Get general ledger entries with organization RLS
     */
    async getGeneralLedger(filters, organizationId, params = {}) {
        const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);
        if (accessibleSubsidiaries.length === 0) {
            return {
                data: [],
                total: 0,
                page: 1,
                limit: params.limit || 100,
                totalPages: 0
            };
        }
        // Calculate pagination
        const page = Math.max(1, params.page || 1);
        const limit = Math.max(1, Math.min(500, params.limit || 100));
        const skip = (page - 1) * limit;
        // Build the where clause
        let whereConditions = [
            (0, drizzle_orm_1.inArray)(gl_transactions_1.glTransactionLines.subsidiaryId, accessibleSubsidiaries)
        ];
        // Apply subsidiary filter if specified and validate access
        if (filters.subsidiaryId) {
            const hasAccess = await this.validateSubsidiaryAccess(filters.subsidiaryId, organizationId);
            if (!hasAccess) {
                throw new Error('Access denied to specified subsidiary');
            }
            whereConditions.push((0, drizzle_orm_1.eq)(gl_transactions_1.glTransactionLines.subsidiaryId, filters.subsidiaryId));
        }
        if (filters.periodId) {
            whereConditions.push((0, drizzle_orm_1.eq)(gl_transactions_1.glTransactions.periodId, filters.periodId));
        }
        if (filters.dateFrom) {
            const dateFrom = typeof filters.dateFrom === 'string' ? filters.dateFrom : filters.dateFrom.toISOString().split('T')[0];
            whereConditions.push((0, drizzle_orm_1.gte)(gl_transactions_1.glTransactions.transactionDate, dateFrom));
        }
        if (filters.dateTo) {
            const dateTo = typeof filters.dateTo === 'string' ? filters.dateTo : filters.dateTo.toISOString().split('T')[0];
            whereConditions.push((0, drizzle_orm_1.lte)(gl_transactions_1.glTransactions.transactionDate, dateTo));
        }
        if (filters.accountIds && filters.accountIds.length > 0) {
            whereConditions.push((0, drizzle_orm_1.inArray)(gl_transactions_1.glTransactionLines.accountId, filters.accountIds));
        }
        if (!filters.includeAdjustments) {
            whereConditions.push((0, drizzle_orm_1.eq)(gl_transactions_1.glTransactions.transactionType, 'POSTING'));
        }
        const whereClause = (0, drizzle_orm_1.and)(...whereConditions);
        // Get the total count
        const countResult = await this.db
            .select({ count: (0, drizzle_orm_1.sql) `COUNT(*)` })
            .from(gl_transactions_1.glTransactionLines)
            .innerJoin(gl_transactions_1.glTransactions, (0, drizzle_orm_1.eq)(gl_transactions_1.glTransactionLines.transactionId, gl_transactions_1.glTransactions.id))
            .where(whereClause);
        const count = Number(countResult[0]?.count || 0);
        // Determine ordering based on groupBy
        let orderByColumns;
        switch (filters.groupBy) {
            case 'account':
                orderByColumns = [(0, drizzle_orm_1.asc)(accounts_1.accounts.accountNumber), (0, drizzle_orm_1.asc)(gl_transactions_1.glTransactions.transactionDate), (0, drizzle_orm_1.asc)(gl_transactions_1.glTransactionLines.lineNumber)];
                break;
            case 'date':
                orderByColumns = [(0, drizzle_orm_1.asc)(gl_transactions_1.glTransactions.transactionDate), (0, drizzle_orm_1.asc)(accounts_1.accounts.accountNumber), (0, drizzle_orm_1.asc)(gl_transactions_1.glTransactionLines.lineNumber)];
                break;
            case 'transaction':
            default:
                orderByColumns = [(0, drizzle_orm_1.asc)(gl_transactions_1.glTransactions.transactionNumber), (0, drizzle_orm_1.asc)(gl_transactions_1.glTransactionLines.lineNumber)];
                break;
        }
        // Get the paginated results
        const results = await this.db
            .select({
            glTransactionId: gl_transactions_1.glTransactions.id,
            transactionNumber: gl_transactions_1.glTransactions.transactionNumber,
            transactionDate: gl_transactions_1.glTransactions.transactionDate,
            postingDate: gl_transactions_1.glTransactions.postingDate,
            description: gl_transactions_1.glTransactionLines.description,
            accountId: gl_transactions_1.glTransactionLines.accountId,
            accountNumber: accounts_1.accounts.accountNumber,
            accountName: accounts_1.accounts.accountName,
            debitAmount: gl_transactions_1.glTransactionLines.debitAmount,
            creditAmount: gl_transactions_1.glTransactionLines.creditAmount,
            reference1: gl_transactions_1.glTransactionLines.reference1,
            reference2: gl_transactions_1.glTransactionLines.reference2,
            classId: gl_transactions_1.glTransactionLines.classId,
            departmentId: gl_transactions_1.glTransactionLines.departmentId,
            locationId: gl_transactions_1.glTransactionLines.locationId,
        })
            .from(gl_transactions_1.glTransactionLines)
            .innerJoin(gl_transactions_1.glTransactions, (0, drizzle_orm_1.eq)(gl_transactions_1.glTransactionLines.transactionId, gl_transactions_1.glTransactions.id))
            .innerJoin(accounts_1.accounts, (0, drizzle_orm_1.eq)(gl_transactions_1.glTransactionLines.accountId, accounts_1.accounts.id))
            .where(whereClause)
            .orderBy(...orderByColumns)
            .limit(limit)
            .offset(skip);
        return {
            data: results.map(row => ({
                ...row,
                debitAmount: Number(row.debitAmount || 0),
                creditAmount: Number(row.creditAmount || 0)
            })),
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit)
        };
    }
}
exports.GlReportingRepository = GlReportingRepository;
//# sourceMappingURL=gl-reporting-repository.js.map