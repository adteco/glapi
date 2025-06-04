import { BaseRepository } from './base-repository';
export interface SubsidiaryPaginationParams {
    page?: number;
    limit?: number;
    orderBy?: 'name' | 'createdAt';
    orderDirection?: 'asc' | 'desc';
}
export declare class SubsidiaryRepository extends BaseRepository {
    /**
     * Find a subsidiary by ID with organization context
     */
    findById(id: string, organizationId: string): Promise<{
        id: string;
        organizationId: string;
        name: string;
        code: string | null;
        description: string | null;
        parentId: string | null;
        baseCurrencyId: string | null;
        countryCode: string | null;
        isActive: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    /**
     * Find all subsidiaries for an organization with pagination and filtering
     */
    findAll(organizationId: string, params?: SubsidiaryPaginationParams, filters?: {
        isActive?: boolean;
        parentId?: string | null;
    }): Promise<{
        data: {
            id: string;
            organizationId: string;
            name: string;
            code: string | null;
            description: string | null;
            parentId: string | null;
            baseCurrencyId: string | null;
            countryCode: string | null;
            isActive: boolean | null;
            createdAt: Date | null;
            updatedAt: Date | null;
        }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    /**
     * Create a new subsidiary
     */
    create(data: any): Promise<{
        id: string;
        name: string;
        organizationId: string;
        code: string | null;
        description: string | null;
        parentId: string | null;
        baseCurrencyId: string | null;
        countryCode: string | null;
        isActive: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    /**
     * Update an existing subsidiary
     */
    update(id: string, data: any, organizationId: string): Promise<{
        id: string;
        organizationId: string;
        name: string;
        code: string | null;
        description: string | null;
        parentId: string | null;
        baseCurrencyId: string | null;
        countryCode: string | null;
        isActive: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    /**
     * Delete a subsidiary
     */
    delete(id: string, organizationId: string): Promise<void>;
    /**
     * Find subsidiaries by parent ID
     */
    findByParentId(parentId: string, organizationId: string): Promise<{
        id: string;
        organizationId: string;
        name: string;
        code: string | null;
        description: string | null;
        parentId: string | null;
        baseCurrencyId: string | null;
        countryCode: string | null;
        isActive: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }[]>;
    /**
     * Count child subsidiaries
     */
    countChildren(id: string, organizationId: string): Promise<number>;
    /**
     * Find a subsidiary by code
     */
    findByCode(code: string, organizationId: string): Promise<{
        id: string;
        organizationId: string;
        name: string;
        code: string | null;
        description: string | null;
        parentId: string | null;
        baseCurrencyId: string | null;
        countryCode: string | null;
        isActive: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
}
//# sourceMappingURL=subsidiary-repository.d.ts.map