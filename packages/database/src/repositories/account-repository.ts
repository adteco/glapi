import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { accounts } from '../db/schema/accounts';

export interface AccountPaginationParams {
  page?: number;
  limit?: number;
  orderBy?: 'accountNumber' | 'accountName' | 'createdAt';
  orderDirection?: 'asc' | 'desc';
}

export class AccountRepository extends BaseRepository {
  /**
   * Find an account by ID with organization context
   */
  async findById(id: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, id),
          eq(accounts.organizationId, organizationId)
        )
      )
      .limit(1);
    
    return result || null;
  }
  
  /**
   * Find an account by account number with organization context
   */
  async findByAccountNumber(accountNumber: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.accountNumber, accountNumber),
          eq(accounts.organizationId, organizationId)
        )
      )
      .limit(1);
    
    return result || null;
  }

  /**
   * Find all accounts for an organization with pagination and filtering
   */
  async findAll(
    organizationId: string,
    params: AccountPaginationParams = {},
    filters: { accountCategory?: string; isActive?: boolean } = {}
  ) {
    // Calculate pagination
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;
    
    // Build the where clause
    let whereClause = and(
      eq(accounts.organizationId, organizationId)
    );
    
    if (filters.accountCategory) {
      whereClause = and(whereClause, eq(accounts.accountCategory, filters.accountCategory as any));
    }
    
    if (filters.isActive !== undefined) {
      whereClause = and(whereClause, eq(accounts.isActive, filters.isActive));
    }
    
    // Get the total count
    const countResult = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(accounts)
      .where(whereClause);
    
    const count = Number(countResult[0]?.count || 0);
    
    // Get the paginated results with ordering
    const orderBy = params.orderBy || 'accountNumber';
    const orderDirection = params.orderDirection || 'asc';
    
    let orderColumn;
    switch (orderBy) {
      case 'accountName':
        orderColumn = accounts.accountName;
        break;
      case 'createdAt':
        orderColumn = accounts.createdAt;
        break;
      default:
        orderColumn = accounts.accountNumber;
    }
    
    const orderFunc = orderDirection === 'asc' ? asc : desc;
    
    const results = await this.db
      .select()
      .from(accounts)
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
  async findAllNoPagination(organizationId: string) {
    const results = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.organizationId, organizationId))
      .orderBy(asc(accounts.accountNumber));
    
    return results;
  }

  /**
   * Check if accounts exist for an organization
   */
  async existsForOrganization(organizationId: string): Promise<boolean> {
    const [result] = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(accounts)
      .where(eq(accounts.organizationId, organizationId))
      .limit(1);
    
    return Number(result?.count || 0) > 0;
  }

  /**
   * Create a new account
   */
  async create(data: {
    organizationId: string;
    accountNumber: string;
    accountName: string;
    accountCategory: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'COGS' | 'Expense';
    description?: string | null;
    isActive?: boolean;
    isControlAccount?: boolean;
    accountSubcategory?: string | null;
    normalBalance?: string | null;
    financialStatementLine?: string | null;
    rollupAccountId?: string | null;
    gaapClassification?: string | null;
    cashFlowCategory?: string | null;
  }) {
    const [result] = await this.db
      .insert(accounts)
      .values({
        organizationId: data.organizationId,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        accountCategory: data.accountCategory,
        description: data.description,
        isActive: data.isActive ?? true,
        isControlAccount: data.isControlAccount ?? false,
        accountSubcategory: data.accountSubcategory,
        normalBalance: data.normalBalance,
        financialStatementLine: data.financialStatementLine,
        rollupAccountId: data.rollupAccountId,
        gaapClassification: data.gaapClassification,
        cashFlowCategory: data.cashFlowCategory,
      })
      .returning();
    
    return result;
  }

  /**
   * Create multiple accounts
   */
  async createMany(data: Array<{
    organizationId: string;
    accountNumber: string;
    accountName: string;
    accountCategory: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'COGS' | 'Expense';
    description?: string;
    isActive?: boolean;
  }>) {
    if (data.length === 0) {
      return [];
    }

    const results = await this.db
      .insert(accounts)
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
  async update(
    id: string,
    organizationId: string,
    data: {
      accountNumber?: string;
      accountName?: string;
      accountCategory?: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'COGS' | 'Expense';
      description?: string | null;
      isActive?: boolean;
      isControlAccount?: boolean;
      accountSubcategory?: string | null;
      normalBalance?: string | null;
      financialStatementLine?: string | null;
      rollupAccountId?: string | null;
      gaapClassification?: string | null;
      cashFlowCategory?: string | null;
    }
  ) {
    const [result] = await this.db
      .update(accounts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(accounts.id, id),
          eq(accounts.organizationId, organizationId)
        )
      )
      .returning();
    
    return result || null;
  }

  /**
   * Delete an account (soft delete by setting isActive to false)
   */
  async delete(id: string, organizationId: string) {
    const [result] = await this.db
      .update(accounts)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(accounts.id, id),
          eq(accounts.organizationId, organizationId)
        )
      )
      .returning();
    
    return result || null;
  }
  
  /**
   * Check database connection by attempting a simple query
   */
  async checkConnection(): Promise<boolean> {
    try {
      // Try to execute a simple query to check if the database is accessible
      const result = await this.db.execute(sql`SELECT 1 as test`);
      
      // Log some debug information
      console.log('Database connection check result:', result);
      
      return true;
    } catch (error) {
      console.error('Database connection check failed:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      
      // Check if it's a table not found error
      if (error instanceof Error && error.message.includes('relation') && error.message.includes('does not exist')) {
        console.error('Table does not exist error detected');
      }
      
      return false;
    }
  }
}