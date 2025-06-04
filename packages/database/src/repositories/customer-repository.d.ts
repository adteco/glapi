import { BaseRepository } from './base-repository';
export interface CustomerPaginationParams {
    page?: number;
    limit?: number;
    orderBy?: 'companyName' | 'createdAt';
    orderDirection?: 'asc' | 'desc';
}
export declare class CustomerRepository extends BaseRepository {
    /**
     * Find a customer by ID with organization context
     */
    findById(id: string, organizationId: string): Promise<{
        id: string;
        organizationId: string;
        companyName: string;
        customerId: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        billingAddress: unknown;
    } | null>;
    /**
     * Find all customers for an organization with pagination and filtering
     */
    findAll(organizationId: string, params?: CustomerPaginationParams, filters?: {
        status?: string;
    }): Promise<{
        data: {
            id: string;
            organizationId: string;
            companyName: string;
            customerId: string | null;
            contactEmail: string | null;
            contactPhone: string | null;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            billingAddress: unknown;
        }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    /**
     * Create a new customer
     */
    create(data: any): Promise<{
        id: string;
        organizationId: string;
        companyName: string;
        customerId: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        billingAddress: any;
    }>;
    /**
     * Update an existing customer
     */
    update(id: string, data: any, organizationId: string): Promise<{
        id: string;
        organizationId: string;
        companyName: string;
        customerId: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        billingAddress: unknown;
    } | null>;
    /**
     * Delete a customer
     */
    delete(id: string, organizationId: string): Promise<void>;
    /**
     * Find a customer by customerId (the business ID, not the UUID)
     */
    findByCustomerId(customerId: string, organizationId: string): Promise<{
        id: string;
        organizationId: string;
        companyName: string;
        customerId: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        billingAddress: unknown;
    } | null>;
}
//# sourceMappingURL=customer-repository.d.ts.map