import { BaseRepository } from './base-repository';
export interface BusinessTransactionPaginationParams {
    page?: number;
    limit?: number;
    orderBy?: 'transactionNumber' | 'transactionDate' | 'createdDate';
    orderDirection?: 'asc' | 'desc';
}
export interface BusinessTransactionFilters {
    subsidiaryId?: string;
    transactionTypeId?: string;
    status?: string;
    entityId?: string;
    dateFrom?: string | Date;
    dateTo?: string | Date;
}
export declare class GlTransactionRepository extends BaseRepository {
    /**
     * Get subsidiaries accessible to an organization
     */
    private getOrganizationSubsidiaries;
    /**
     * Validate that a subsidiary belongs to the organization
     */
    private validateSubsidiaryAccess;
    /**
     * Find a business transaction by ID with organization RLS
     */
    findById(id: string, organizationId: string): Promise<{
        id: any;
        transactionNumber: any;
        transactionTypeId: any;
        subsidiaryId: any;
        entityId: any;
        entityType: any;
        transactionDate: any;
        dueDate: any;
        termsId: any;
        currencyCode: any;
        exchangeRate: any;
        subtotalAmount: any;
        taxAmount: any;
        discountAmount: any;
        totalAmount: any;
        baseTotalAmount: any;
        memo: any;
        externalReference: any;
        status: any;
        workflowStatus: any;
        glTransactionId: any;
        createdBy: any;
        createdDate: any;
        modifiedBy: any;
        modifiedDate: any;
        approvedBy: any;
        approvedDate: any;
        postedDate: any;
        versionNumber: any;
    } | null>;
    /**
     * Find all business transactions for an organization with pagination and filtering
     */
    findAll(organizationId: string, params?: BusinessTransactionPaginationParams, filters?: BusinessTransactionFilters): Promise<{
        data: ({
            id: any;
            transactionNumber: any;
            transactionTypeId: any;
            subsidiaryId: any;
            entityId: any;
            entityType: any;
            transactionDate: any;
            totalAmount: any;
            status: any;
            memo: any;
            createdDate: any;
        } | {
            id: any;
            transactionNumber: any;
            transactionTypeId: any;
            subsidiaryId: any;
            entityId: any;
            entityType: any;
            transactionDate: any;
            totalAmount: any;
            status: any;
            memo: any;
            createdDate: any;
        })[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    /**
     * Create a new business transaction with organization RLS
     */
    create(data: any, organizationId: string): Promise<any>;
    /**
     * Update an existing business transaction with organization RLS
     */
    update(id: string, data: any, organizationId: string): Promise<{
        [x: string]: any;
    } | null>;
    /**
     * Delete a business transaction with organization RLS
     */
    delete(id: string, organizationId: string): Promise<void>;
    /**
     * Get transaction lines for a business transaction with organization RLS
     */
    getTransactionLines(transactionId: string, organizationId: string): Promise<{
        id: string;
        businessTransactionId: string;
        lineNumber: number;
        lineType: string;
        itemId: string | null;
        description: string;
        quantity: string;
        unitOfMeasure: string | null;
        unitPrice: string;
        discountPercent: string;
        discountAmount: string;
        lineAmount: string;
        taxCodeId: string | null;
        taxAmount: string;
        totalLineAmount: string;
        accountId: string | null;
        classId: string | null;
        departmentId: string | null;
        locationId: string | null;
        projectId: string | null;
        jobId: string | null;
        activityCodeId: string | null;
        billableFlag: boolean;
        billingRate: string | null;
        hoursWorked: string | null;
        employeeId: string | null;
        workDate: string | null;
        parentLineId: string | null;
        quantityReceived: string;
        quantityBilled: string;
        quantityShipped: string;
        costAmount: string;
        marginAmount: string | null;
        serialNumbers: unknown;
        lotNumbers: unknown;
        estimatedHours: string | null;
        hourlyRate: string | null;
        costEstimate: string | null;
        notes: string | null;
        customFields: unknown;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    /**
     * Create transaction lines with organization RLS validation
     */
    createTransactionLines(lines: any[], organizationId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        notes: string | null;
        customFields: unknown;
        accountId: string | null;
        classId: string | null;
        departmentId: string | null;
        locationId: string | null;
        discountPercent: string;
        taxAmount: string;
        discountAmount: string;
        projectId: string | null;
        estimatedHours: string | null;
        lineNumber: number;
        businessTransactionId: string;
        lineType: string;
        itemId: string | null;
        quantity: string;
        unitOfMeasure: string | null;
        unitPrice: string;
        lineAmount: string;
        taxCodeId: string | null;
        totalLineAmount: string;
        jobId: string | null;
        activityCodeId: string | null;
        billableFlag: boolean;
        billingRate: string | null;
        hoursWorked: string | null;
        employeeId: string | null;
        workDate: string | null;
        parentLineId: string | null;
        quantityReceived: string;
        quantityBilled: string;
        quantityShipped: string;
        costAmount: string;
        marginAmount: string | null;
        serialNumbers: unknown;
        lotNumbers: unknown;
        hourlyRate: string | null;
        costEstimate: string | null;
    }[]>;
    /**
     * Update transaction status with organization RLS
     */
    updateStatus(id: string, status: string, userId: string, organizationId: string): Promise<{
        [x: string]: any;
    }>;
}
//# sourceMappingURL=gl-transaction-repository.d.ts.map