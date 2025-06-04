import { BaseRepository } from './base-repository';
export interface AccountPaginationParams {
    page?: number;
    limit?: number;
    orderBy?: 'accountNumber' | 'accountName' | 'createdAt';
    orderDirection?: 'asc' | 'desc';
}
export declare class AccountRepository extends BaseRepository {
    /**
     * Find an account by ID with organization context
     */
    findById(id: string, organizationId: string): Promise<{
        [x: string]: any;
    }>;
    /**
     * Find all accounts for an organization with pagination and filtering
     */
    findAll(organizationId: string, params?: AccountPaginationParams, filters?: {
        accountCategory?: string;
        isActive?: boolean;
    }): Promise<{
        data: {
            [x: string]: any;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    /**
     * Find all accounts for an organization without pagination
     */
    findAllNoPagination(organizationId: string): Promise<{
        [x: string]: any;
    }[]>;
    /**
     * Check if accounts exist for an organization
     */
    existsForOrganization(organizationId: string): Promise<boolean>;
    /**
     * Create a new account
     */
    create(data: {
        organizationId: string;
        accountNumber: string;
        accountName: string;
        accountCategory: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'COGS' | 'Expense';
        description?: string;
        isActive?: boolean;
    }): Promise<any>;
    /**
     * Create multiple accounts
     */
    createMany(data: Array<{
        organizationId: string;
        accountNumber: string;
        accountName: string;
        accountCategory: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'COGS' | 'Expense';
        description?: string;
        isActive?: boolean;
    }>): Promise<any[] | import("pg").QueryResult<never>>;
    /**
     * Update an account
     */
    update(id: string, organizationId: string, data: {
        accountNumber?: string;
        accountName?: string;
        accountCategory?: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'COGS' | 'Expense';
        description?: string;
        isActive?: boolean;
    }): Promise<{
        [x: string]: any;
    }>;
    /**
     * Delete an account (soft delete by setting isActive to false)
     */
    delete(id: string, organizationId: string): Promise<{
        [x: string]: any;
    }>;
}
//# sourceMappingURL=account-repository.d.ts.map