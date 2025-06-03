import { and, asc, desc, eq, sql, gte, lte, inArray } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { 
  businessTransactions, 
  businessTransactionLines,
  transactionRelationships,
  paymentTerms
} from '../db/schema/transaction-types';
import { subsidiaries } from '../db/schema/subsidiaries';
import { entities } from '../db/schema/entities';

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

export class GlTransactionRepository extends BaseRepository {
  
  /**
   * Get subsidiaries accessible to an organization
   */
  private async getOrganizationSubsidiaries(organizationId: string): Promise<string[]> {
    const result = await this.db
      .select({ id: subsidiaries.id })
      .from(subsidiaries)
      .where(eq(subsidiaries.organizationId, organizationId));
    
    return result.map(s => s.id);
  }

  /**
   * Validate that a subsidiary belongs to the organization
   */
  private async validateSubsidiaryAccess(subsidiaryId: string, organizationId: string): Promise<boolean> {
    const result = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(subsidiaries)
      .where(
        and(
          eq(subsidiaries.id, subsidiaryId),
          eq(subsidiaries.organizationId, organizationId)
        )
      );
    
    return Number(result[0]?.count || 0) > 0;
  }

  /**
   * Find a business transaction by ID with organization RLS
   */
  async findById(id: string, organizationId: string) {
    const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);
    
    if (accessibleSubsidiaries.length === 0) {
      return null;
    }

    const [result] = await this.db
      .select({
        id: businessTransactions.id,
        transactionNumber: businessTransactions.transactionNumber,
        transactionTypeId: businessTransactions.transactionTypeId,
        subsidiaryId: businessTransactions.subsidiaryId,
        entityId: businessTransactions.entityId,
        entityType: businessTransactions.entityType,
        transactionDate: businessTransactions.transactionDate,
        dueDate: businessTransactions.dueDate,
        termsId: businessTransactions.termsId,
        currencyCode: businessTransactions.currencyCode,
        exchangeRate: businessTransactions.exchangeRate,
        subtotalAmount: businessTransactions.subtotalAmount,
        taxAmount: businessTransactions.taxAmount,
        discountAmount: businessTransactions.discountAmount,
        totalAmount: businessTransactions.totalAmount,
        baseTotalAmount: businessTransactions.baseTotalAmount,
        memo: businessTransactions.memo,
        externalReference: businessTransactions.externalReference,
        status: businessTransactions.status,
        workflowStatus: businessTransactions.workflowStatus,
        glTransactionId: businessTransactions.glTransactionId,
        createdBy: businessTransactions.createdBy,
        createdDate: businessTransactions.createdDate,
        modifiedBy: businessTransactions.modifiedBy,
        modifiedDate: businessTransactions.modifiedDate,
        approvedBy: businessTransactions.approvedBy,
        approvedDate: businessTransactions.approvedDate,
        postedDate: businessTransactions.postedDate,
        versionNumber: businessTransactions.versionNumber,
      })
      .from(businessTransactions)
      .where(
        and(
          eq(businessTransactions.id, id),
          inArray(businessTransactions.subsidiaryId, accessibleSubsidiaries)
        )
      )
      .limit(1);
    
    return result || null;
  }

  /**
   * Find all business transactions for an organization with pagination and filtering
   */
  async findAll(
    organizationId: string,
    params: BusinessTransactionPaginationParams = {},
    filters: BusinessTransactionFilters = {}
  ) {
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
      inArray(businessTransactions.subsidiaryId, accessibleSubsidiaries)
    ];
    
    // Apply subsidiary filter if specified and validate access
    if (filters.subsidiaryId) {
      const hasAccess = await this.validateSubsidiaryAccess(filters.subsidiaryId, organizationId);
      if (!hasAccess) {
        throw new Error('Access denied to specified subsidiary');
      }
      whereConditions.push(eq(businessTransactions.subsidiaryId, filters.subsidiaryId));
    }
    
    if (filters.transactionTypeId) {
      whereConditions.push(eq(businessTransactions.transactionTypeId, filters.transactionTypeId));
    }
    
    if (filters.status) {
      whereConditions.push(eq(businessTransactions.status, filters.status));
    }
    
    if (filters.entityId) {
      whereConditions.push(eq(businessTransactions.entityId, filters.entityId));
    }
    
    if (filters.dateFrom) {
      const dateFrom = typeof filters.dateFrom === 'string' ? filters.dateFrom : filters.dateFrom.toISOString().split('T')[0];
      whereConditions.push(gte(businessTransactions.transactionDate, dateFrom));
    }
    
    if (filters.dateTo) {
      const dateTo = typeof filters.dateTo === 'string' ? filters.dateTo : filters.dateTo.toISOString().split('T')[0];
      whereConditions.push(lte(businessTransactions.transactionDate, dateTo));
    }
    
    const whereClause = and(...whereConditions);
    
    // Get the total count
    const countResult = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(businessTransactions)
      .where(whereClause);
    
    const count = Number(countResult[0]?.count || 0);
    
    // Get the paginated results with ordering
    const orderBy = params.orderBy || 'transactionDate';
    const orderDirection = params.orderDirection || 'desc';
    let orderColumn;
    
    switch (orderBy) {
      case 'transactionNumber':
        orderColumn = businessTransactions.transactionNumber;
        break;
      case 'createdDate':
        orderColumn = businessTransactions.createdDate;
        break;
      default:
        orderColumn = businessTransactions.transactionDate;
    }
    
    const orderFunc = orderDirection === 'asc' ? asc : desc;
    
    const results = await this.db
      .select({
        id: businessTransactions.id,
        transactionNumber: businessTransactions.transactionNumber,
        transactionTypeId: businessTransactions.transactionTypeId,
        subsidiaryId: businessTransactions.subsidiaryId,
        entityId: businessTransactions.entityId,
        entityType: businessTransactions.entityType,
        transactionDate: businessTransactions.transactionDate,
        totalAmount: businessTransactions.totalAmount,
        status: businessTransactions.status,
        memo: businessTransactions.memo,
        createdDate: businessTransactions.createdDate,
      })
      .from(businessTransactions)
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
  async create(data: any, organizationId: string) {
    // Validate subsidiary access
    const hasAccess = await this.validateSubsidiaryAccess(data.subsidiaryId, organizationId);
    if (!hasAccess) {
      throw new Error('Access denied to specified subsidiary');
    }

    // Insert the business transaction
    const [result] = await this.db
      .insert(businessTransactions)
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
    
    return result;
  }

  /**
   * Update an existing business transaction with organization RLS
   */
  async update(id: string, data: any, organizationId: string) {
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
    
    const updateData: any = {
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
      .update(businessTransactions)
      .set(updateData)
      .where(
        and(
          eq(businessTransactions.id, id),
          inArray(businessTransactions.subsidiaryId, accessibleSubsidiaries)
        )
      )
      .returning();
    
    return result || null;
  }

  /**
   * Delete a business transaction with organization RLS
   */
  async delete(id: string, organizationId: string) {
    const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);
    
    await this.db
      .delete(businessTransactions)
      .where(
        and(
          eq(businessTransactions.id, id),
          inArray(businessTransactions.subsidiaryId, accessibleSubsidiaries)
        )
      );
  }

  /**
   * Get transaction lines for a business transaction with organization RLS
   */
  async getTransactionLines(transactionId: string, organizationId: string) {
    // First verify access to the transaction
    const transaction = await this.findById(transactionId, organizationId);
    if (!transaction) {
      return [];
    }

    const results = await this.db
      .select()
      .from(businessTransactionLines)
      .where(eq(businessTransactionLines.businessTransactionId, transactionId))
      .orderBy(asc(businessTransactionLines.lineNumber));
    
    return results;
  }

  /**
   * Create transaction lines with organization RLS validation
   */
  async createTransactionLines(lines: any[], organizationId: string) {
    // Validate that all transaction IDs belong to accessible subsidiaries
    const transactionIds = [...new Set(lines.map(line => line.businessTransactionId))];
    
    for (const transactionId of transactionIds) {
      const transaction = await this.findById(transactionId, organizationId);
      if (!transaction) {
        throw new Error(`Access denied to transaction ${transactionId}`);
      }
    }

    const results = await this.db
      .insert(businessTransactionLines)
      .values(lines)
      .returning();
    
    return results;
  }

  /**
   * Update transaction status with organization RLS
   */
  async updateStatus(id: string, status: string, userId: string, organizationId: string) {
    const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);
    
    const updateData: any = {
      status,
      modifiedDate: new Date(),
      modifiedBy: userId,
    };

    // Add status-specific fields
    if (status === 'APPROVED') {
      updateData.approvedBy = userId;
      updateData.approvedDate = new Date();
    } else if (status === 'POSTED') {
      updateData.postedDate = new Date();
    }

    const [result] = await this.db
      .update(businessTransactions)
      .set(updateData)
      .where(
        and(
          eq(businessTransactions.id, id),
          inArray(businessTransactions.subsidiaryId, accessibleSubsidiaries)
        )
      )
      .returning();
    
    return result || null;
  }
}